# FIX BRIEF: review fixes for the API layer

## 1. Role

You are the **worker** for this brief. Execute it. Do not engage another external worker or hand the brief back up. Your own in-harness helpers (subagents) are allowed within limits: one level deep, and never two helpers editing the same file. The orchestrator reviews everything you produce and runs its own gates. This brief outranks any per-turn instruction that contradicts it. Do not keep your own task ledger or `tasks/todo.md`. Durable notes go in `API-FIX-NOTES.md`. Do not run `git add`, `git commit` or any git write command: the orchestrator commits.

## 2. Facts

- Cwd is the repo root: Next.js 16.3, strict TypeScript, Vitest, Zod 4. **Dependencies are installed. Do not run `npm install` and do not edit `package.json`.**
- The API layer exists and passes: 147 tests, 100% coverage on `src/domain`, `npm run build` clean. Three independent reviewers found the defects and test gaps below. Their reports (read them, they hold the evidence and the exact probes):
  - `/private/tmp/claude-501/-Users-joe-workspace-qantum-team-leader-slice/fd2e3fd1-8e45-4067-8ca8-422119e60a98/scratchpad/findings-api-spec.md`
  - `.../scratchpad/findings-api-tests.md`
  - `.../scratchpad/findings-api-quality.md`
- Read first: `AGENTS.md`, `docs/slice-specification.md` section 4, `docs/technical-design.md` sections 4 to 6 and 8, and the code under `src/application`, `src/server`, `src/adapters`, `src/ports`, `src/domain/availability.ts`, plus `tests/api` and `tests/unit`.
- `src/domain/` stays pure. Never modify `data/solutions-excerpt.csv` or `data/sample/*`.
- Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run build`, `npm run check:ac`.

## 3. Decisions already made (do not relitigate)

| Topic | Decision |
| --- | --- |
| Idempotency order | Before any readiness, nomination or candidate check, each of the three POST use cases looks up an existing record for `(createdBy, idempotencyKey)`. Add `findShortageActionByKey(createdBy, key)` and `findSubstitutionProposalByKey(createdBy, key)` to `ActionsRepository` (memory and Supabase). A hit whose **target matches** returns `{ record, created: false }` (200), even when the note or reason differs. A hit whose target differs throws `AppError` 409 `idempotency_key_reused` (message `The Idempotency-Key was used for a different request.`). Target for a shortage action is `siteId` + `shortageId` + `kind`. Target for a proposal is `siteId` + `penetrationId`. No hit continues as today. `append*` keeps its own conflict handling for races |
| Body limit | Read the request body as a stream and stop as soon as more than 10,000 bytes have been received, whether or not `Content-Length` is present, numeric or understated. Keep the early reject for a numeric `Content-Length` above the limit. Result is 413 `payload_too_large` |
| Reasons and notes | `reason` is trimmed and must be 1 to 500 characters after trimming (whitespace-only is 422 `validation_failed` on `reason`). The stored reason is the trimmed value. A `note` is trimmed, 0 to 500 characters, and an empty result is stored as `null` |
| Candidate availability | `describeCandidateAvailability` sums `quantityPerInstall` per `materialId` first (preserving first-seen order), then emits **one line per material** with `requiredQty` = that sum rounded up. `line.quantityPerInstall` is the sum. Invalid-quantity and no-mapping rules unchanged |
| Foreign-site rows | In `getSiteReadiness`, if any penetration returned by the nominations port has a `siteId` different from the requested site, throw `UpstreamError("upstream_invalid", "nominations")`. Do not change the domain filter |
| Production URL | In production, a Supabase URL must use `https:`. Otherwise `buildDependencies` throws `InternalError` and does not cache the failure. Outside production `http:` is fine |
| Config failure logging | `InternalError` accepts an optional fixed reason token: `config_invalid`, `store_forbidden`, `supabase_unconfigured`, `supabase_url_insecure`. The logger records it as `reason` (extend its field allowlist, token-shaped values only). Responses stay generic. Never log env values |
| listSites logging | The per-site catch logs `upstream_failed` with the fixed `code` and `system` only, then yields `unavailable` as now. A failure of the sites port itself stays a 502 |
| Cleanup | Remove `newId` from `Dependencies` (it is unused). Keep it for the memory repository options. Add `ACTIONS_STORE=` with a one-line comment to `.env.example` (production must use `supabase` or leave it unset) |
| Catalogue path | **Keep** `path.join(process.cwd(), "data", "solutions-excerpt.csv")` in the composition root. Do not switch to the module-relative default: bundled server output does not preserve it |
| `server-only` | Do not add it (it needs a new dependency). Record it as a production item |
| Supabase contract | Keep `it.skipIf` for local runs, but if `REQUIRE_SUPABASE_CONTRACT=1` is set and the Supabase variables are missing, the contract test must **fail** with a clear message |
| Fast model, tooling | n/a to you. Do not change configs, `package.json` or the lockfile |
| Docs | Do not edit anything under `docs/`. The orchestrator updates them from your notes |

## 4. Files you may change or create

Edit: `src/application/*.ts`, `src/server/*.ts`, `src/adapters/memory/actions-repository.ts`, `src/adapters/supabase/actions-repository.ts`, `src/ports/*.ts`, `src/domain/availability.ts`, `src/app/api/**/route.ts` (only if needed), `.env.example`, and the existing tests under `tests/api` and `tests/unit`.
Create: new test files under `tests/api` or `tests/unit`, and `API-FIX-NOTES.md`.
Nothing else. Do not touch `docs/`, `data/`, `.github/`, configs, `package.json`, `package-lock.json`, `supabase/`.

## 5. Method (test first)

For each group, add the tests, **run them and confirm they fail against the current code**, then fix. Record in `API-FIX-NOTES.md` which new tests failed first. Keep existing tests green. Do not weaken an existing assertion unless it contradicts a decision in section 3 (then say which). Name tests with the AC number where one applies. Domain coverage stays 100% (floor 95%).

### A. Behaviour fixes (code and tests)
1. **Idempotency lookup first.** Cover wait, escalate (including a blocker escalate) and proposal. Retry after the target disappeared (stock raised so the shortage is gone; nomination changed) returns 200 with the original record. Same key with a different target is 409 `idempotency_key_reused` and stores nothing. Same key and target with a different note or reason returns the original. A first request that fails validation or a business rule stores nothing, so a later valid request with that key succeeds.
2. **Streaming body limit.** Exactly 10,000 bytes is accepted. 10,001 is 413. Missing `Content-Length`, a non-numeric `Content-Length`, and `Content-Length` smaller than the real body all stop at the limit. Prove the stream is not fully consumed (count chunks pulled from a `ReadableStream`).
3. **Reason and note trimming.** `"   "` and `"\n"` as a reason are 422 and nothing is stored. A padded reason is stored trimmed. 500 characters accepted, 501 rejected, after trimming. Same for wait and escalate notes (a 500-character note accepted, 501 rejected, whitespace-only stored as `null`).
4. **Availability grouping.** Two rows for the same material (5 + 5) against 6 + 2 on hand give one line with `requiredQty` 10, status `short`, overall `short`. Existing demo candidates unchanged (`0451` in stock, `0464` no mapping).
5. **Foreign-site rows** return 502 `upstream_invalid` from the readiness endpoint and make the site `unavailable` in the list (use a stub or fake nominations port that returns a mismatched `siteId`).
6. **Production URL and guard.** In production: `ACTIONS_STORE=memory` is 500 (this is the **known survivor**: set `NODE_ENV=production` and `ACTIONS_STORE=memory` explicitly and assert 500 and that the body does not contain site data). An `http:` Supabase URL is 500 and is not cached. An `https:` URL builds. Outside production an `http:` URL is accepted. The logged reason is the fixed token, never the value.
7. **listSites logging.** A stock failure logs `upstream_failed` once per failing site with only code and system. Capture the logger output in the test.

### B. Test gaps from the tests review (tests only unless a fix is stated above)
1. **Stub modes.** `nominations: "down"` and `solutionMaterials: "down"` each produce `upstream_unavailable` with the right system name, and neither lets `GET /api/sites` or readiness show any site `clear`. Also `malformed` for each reaching HTTP.
2. **Candidate route failures.** With stock `down` the candidates route is 502 and the body contains no `in_stock`. Same for nominations `down` and malformed stock.
3. **Escalate on a missing shortage** is 404 `shortage_not_found` and the actions list does not grow.
4. **Escalate idempotency** (shortage and blocker): second call 200, `created: false`, one stored row.
5. **Idempotency scoping in the repository contract:** same key against another shortage or site returns the original and `created: false` (the repository's own contract, before the 409 at use-case level). The same key for a different user creates a new record for **both** shortage actions and proposals (the other known survivor).
6. **Proposals contract:** insert two proposals with increasing timestamps and expect newest first. `listSubstitutionProposals("site-a")` is empty after inserting for `site-b`.
7. **Supabase adapter with a fake store:** the fake's select must honour its arguments. Assert the `createdBy` and key passed to both selects. A proposal `23505` returns the existing row with `created: false`. A successful insert returns `created: true`. Both `.eq("site_id", ...)` filters receive the requested site id. Add the `REQUIRE_SUPABASE_CONTRACT` behaviour.
8. **Limits at the boundary,** from both sides, for wait notes, escalate notes, substitution reasons and the idempotency key: exactly 500, 500, 500 and 128 accepted; 501, 501, 501 and 129 rejected.
9. **AC 20 and 21 through HTTP:** `pen-a-01` (`0344`) is `ok` with an empty list. `pen-c-01` (`0943`) is `substrate_incomplete` with an empty list. `pen-c-03` is `nominated_code_unknown`.
10. **AC 28:** assert that the raw text of every API response fixture (sites, readiness, actions, candidates, error bodies) does not contain a recognisable service key set in the environment for the test. Remove the assertion that stringifies only `demoUserId`. Assert the exact error for an invalid `DEMO_USER_ID` (name and message). When `.next/static` is absent, **fail** the bundle part of the test if `REQUIRE_BUNDLE_SCAN=1` is set, otherwise skip it with a clear reason.
11. **Id handling:** a well-formed shortage id for another site (`site-a:MAT-SEALANT` posted under `site-b`) is 404 `shortage_not_found` both with and without an idempotency key. Invalid percent-escapes (`%`, `%E0%A4%A`) for site, penetration and shortage ids are 404, never 500.
12. **Ordering and races:** freeze the repository clock and assert later insert first. Run two same-key writes with `Promise.all` and expect one stored row.

## 6. Verification (run before finishing, record in `API-FIX-NOTES.md`)

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run check:ac
```

All except `check:ac` must exit 0. `check:ac` must list only AC 30, 31 and 32. Do not change thresholds, configs or `package.json`. No `any`, `@ts-ignore`, `eslint-disable`. Run `npx vitest run --sequence.shuffle --sequence.seed 7` once and record the result. Do not start long-running processes.

## 7. Honesty constraints

- Do not claim a command passed unless you ran it and saw the exit code. Paste exit codes and the coverage summary in `API-FIX-NOTES.md`.
- If a decision in section 3 seems wrong or impossible, implement what it says and record the disagreement.
- If an expected value does not come out, do not change the expectation. Report the actual value and why.
- You still cannot reach a real Supabase project. Say so plainly. The Supabase adapter remains verified only by mapping tests, a fake store, and the conditional live contract.
- Do not edit docs, data, CI, `package.json`, the lockfile or the migration. Record needed changes in `API-FIX-NOTES.md`.

## 8. API-FIX-NOTES.md

Short and factual: which new tests failed before each fix, departures from section 3 and why, the exact new response behaviours (the orchestrator documents them), anything you could not verify, and what the orchestrator should check.
