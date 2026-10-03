# Spec conformance and correctness

Reviewed the working tree (uncommitted API layer on top of the last commit). Behaviour was checked against `docs/slice-specification.md`, `docs/technical-design.md` §§4–6 and 8, `docs/sample-data-and-stubs.md`, and `docs/agent-work/06-api-layer-brief.md`. The Supabase adapter was read, not executed against a database. Next was not started.

## Critical

None. No probe produced `clear` for a crew that still had a shortage or a blocker, an unauthenticated read or write beyond the demo identity, or a response that leaked a note, a path, SQL, or the service key.

## High

### Idempotency is applied only after the target still passes the business checks

- **Severity:** High
- **Where:** `src/application/shortages.ts:28-43` (`recordWait`), `src/application/shortages.ts:50-63` (`recordEscalation`), `src/application/candidates.ts:87-101` (`proposeSubstitution`). The key lookup itself is correct and per-user, but it sits inside `appendShortageAction` / `appendSubstitutionProposal` (`src/adapters/memory/actions-repository.ts:38-40` and `:57-59`; the Supabase adapter does the same lookup only after a `23505` on insert, `src/adapters/supabase/actions-repository.ts:214-216` and `:226-231`).
- **Defect:** A schema-valid replay whose target has disappeared, or which now fails a later business rule, returns that error and does not return the original record.
- **Evidence** (handlers called with `Request` objects against the sample stubs and the in-memory repository; `Cache-Control: no-store` on the error responses):
  1. `POST` wait on `site-b` / `site-b:MAT-SEALANT`, key `same-key`, note `original` → 201, `shortfallQtyAtTime` 2. The same key with note `changed`, while the shortage still exists → 200, `created: false`, note still `original`. Stock for every balance is then raised by 100, site B becomes `clear`, and the same wait is sent again → **404 `shortage_not_found`**. The stored row is still the one original wait (`actionCount` 1, status `resolved` because the shortage is gone). The `clear` here is the covered stock, which is the right crew status after that increase.
  2. `POST` substitution on `site-b` / `pen-b-01`, key `proposal-key`, `toInternalCode` `0451` → 201. The same key with `toInternalCode` `9999` → **422 `not_a_candidate`**, `record` null. One proposal stays stored.
  3. Key `stale-key`, body `0438` → `0451` → 201. The nomination for `pen-b-01` is then changed to `0344` and the same body is sent again → **409 `stale_nomination`**. Stored proposal count stays 1.
  4. Escalate `site-c:blocker.pen-c-03` with key `blk-key` → 201, kind `escalate`. `POST` wait on that same id and key → **422 `wait_not_allowed_for_blocker`**, `record` null. The one escalate row remains.
- **Which text is right:** Slice AC 16 / FR16 and technical design §4 ("a repeat returns the original record"; rejecting a different body is left to production) and brief §3 (same decision, explicitly including a different body) are the contract. Brief §6 tells the use case to find the target and then append, which is what the code does, and that loses the retry as soon as the target check throws. AC 16 should win for a request that has already passed path, key format, size, JSON, and schema. A schema-invalid body staying 422 is still right, because brief §7 runs those checks before the use case and that body is not a well-formed repeat. The route test named AC 16 only replays while `site-b:MAT-SEALANT` still exists, and a different note on that live shortage does return the original, so the suite stays green.
- **Suggested fix:** In all three use cases, read the existing row for `(createdBy, idempotencyKey)` and return `{ record, created: false }` before readiness, nomination, and candidate checks. Keep the insert on the first call behind those checks so a bad first request still stores nothing.

No second row is written in any of these replays, and crew status does not flip because of them. That is why this is High rather than Critical.

## Medium

### Repeated material rows are each compared with the full on-hand balance

- **Severity:** Medium
- **Where:** `src/domain/availability.ts:33-55`
- **Defect:** `describeCandidateAvailability` can report `overall: "in_stock"` when the same material id appears on more than one row and the combined requirement exceeds stock.
- **Evidence:** Two solution-material rows for code `DUP`, both `MAT-SEALANT` with `quantityPerInstall` 5, and stock 6 (Warehouse) + 2 (Van 2). Result: both lines `requiredQty` 5, `onHandQty` 8, `status: "in_stock"`, `overall: "in_stock"`. Readiness would sum the two rows to 10, round up to 10, and record a shortage of 2 against the same on-hand of 8 (`src/domain/readiness.ts:67-75` and `:87-89`).
- **Which text is right:** The code follows brief §5 ("one line per row", compare that row's rounded quantity with on-hand). The sample file has no duplicate material id per code, so the demo candidates are unaffected (`0451` is `in_stock`, `0464` is `no_material_mapping`). FR11 and the readiness rule are the better rule for the `overall` label: the label answers whether the substitute's materials are in stock, and counting one pile twice can show a substitute as in stock when installing it would be short. A proposal still does not change the nomination or the crew status, and the notice stays "Catalogue match, not verified", so this does not clear a crew.
- **Suggested fix:** Sum `quantityPerInstall` per `materialId` before comparing with on-hand, and emit one line per material, the same way readiness builds a requirement. Until the data contract forbids duplicate material ids, do not treat the per-row `in_stock` rollup as the quantity the leader would consume.

## Low

### A whitespace-only substitution reason is accepted and stored

- **Severity:** Low
- **Where:** `src/server/http.ts:32` (`reason: z.string().min(1).max(500)`) and `src/application/candidates.ts:87`
- **Defect:** A reason made only of spaces or a newline is stored as the proposal reason.
- **Evidence:** On a clean store, `POST` substitution for `pen-b-01` from `0438` to `0451` (an `ok` candidate) with reason `"   "` → 201, and the stored reason is three spaces. Reason `"\n"` → 201 and is stored. A 500-character reason → 201. A 501-character reason → 422 `validation_failed`, and the body does not contain the submitted characters. An earlier probe that sent `"   "` with `toInternalCode` `0464` after a nomination override returned 409 `stale_nomination`; that run did not test the reason, and the clean run above replaces it.
- **Which text is right:** Brief §3 and §7 define reason as 1 to 500 characters, which this matches. Technical design §6 calls it a mandatory free-text reason that a manager would review. The design's wording is the better rule for an empty-looking reason. It is Low because the character rule was implemented as written and the crew status does not change.
- **Suggested fix:** Trim the reason and reject it with `validation_failed` on `reason` when nothing remains. Keep the 500-character cap on the trimmed value, or document that whitespace counts.

## Verified OK

Checked by calling the route handlers and domain functions. Failures below are the specified ones.

**Readiness does not go `clear` on bad or empty upstream data.**

- Stock mode `empty`: sites A, B, and C are `blocked`; site D is `nothing_planned`. `getStock([])` returns no balances. `getStock` of putty returns only `MAT-PUTTY`. `getSolutionMaterials(["0451"])` returns only that code. `getSolutionMaterials([])` returns no items.
- Stock mode `down`: readiness for site A is 502 `upstream_unavailable`. The site list is 200 and every site is `unavailable`. Site D, which has no penetrations and would be `nothing_planned` when stock answers, is also 502 `upstream_unavailable` with `Cache-Control: no-store` and body `{"code":"upstream_unavailable","message":"stock is unavailable."}`. Readiness calls stock even when the material-id list is empty (`src/application/readiness.ts:51-54`), so an outage fails closed.
- Stock mode `malformed` (non-finite quantity): 502 `upstream_invalid`. The site list is `unavailable` for every site.
- Solution-materials mode `empty`: site A is `blocked` with six `no_material_mapping` blockers and no shortages. Site D stays `nothing_planned`.
- Nominations mode `empty` (`bySite` has no keys, so the port returns null): readiness is 404 `site_not_found`. The site list is `unavailable` for every site. That matches the port contract (null means unknown site). Sample site D uses `[]`, which is `nothing_planned`.
- One site failing inside the list: nominations throw only for site B. Result is A `clear`, B `unavailable`, C `blocked`, D `nothing_planned`. A failure of the sites port itself is not caught by `listSites` (`src/application/sites.ts:11-23`).
- A negative `MAT-SEALANT` stock row: site A is `blocked`, sealant kind `unknown`, `requiredQty` 2, `onHandQty` null, `shortfallQty` null. The negative row does not become zero.
- An invalid mapped quantity does not cancel a valid one: quantity 5 with stock 3 produces a shortage (`requiredQty` 5, `shortfallQty` 2, kind `short`) and the penetration with quantity -100 is an `invalid_quantity` blocker. Crew `blocked`.
- A penetration whose `siteId` does not match the nominations map key: the stub throws `UpstreamError` `upstream_invalid` (proven by patching only the copy of `data/sample/nominations.json`, then restoring it). Passed straight to `computeSiteReadiness`, a foreign `9999` row is dropped: the site's own covered penetration stays `clear`, and a site whose rows are all foreign is `nothing_planned`. The stub throws before that path.

**Quantity dust.** Ten rows of 0.1 sum to on-hand 1. Nine rows of 0.1 stay 0.9. `roundUpQuantity(2.2)` is 3, `roundUpQuantity(0.000001)` is 1, and `roundUpQuantity(0.0000004)` is 0. On-hand `0.9999996` snaps to 1 before the shortage comparison, so a requirement of 1 produces no shortage and crew `clear`. That is the stated 6-decimal snap, not a shortage with `shortfallQty` 0. `snapQuantity(1 - 0.9999996)` is 0, and readiness never emits that difference because it snaps on-hand first (`src/domain/readiness.ts:87-91`, `src/domain/quantities.ts:4-9`).

**Wait, escalate, shortage ids, and action classification.**

- Unknown-stock mastic accepts wait and escalate with `shortfallQtyAtTime` null. Wait on a blocker is 422 `wait_not_allowed_for_blocker`. Escalate on a blocker is 201. Covered by `tests/api/routes.test.ts` (AC 5 and 6), which passed in the suite below.
- After sealant stock is set to 0, a new wait records `shortfallQtyAtTime` 10. The earlier wait recorded at 2 becomes `earlier`. The shortage stays kind `short`, state `waiting`, crew `blocked`. `isActionCurrent` treats a numeric recorded shortfall against a null shortfall, or the reverse, as not current (`src/domain/lifecycle.ts:19-22`).
- An older escalate and a newer wait on the unknown mastic shortage are both `current` (both shortfalls null). Shortage state is `escalated`. Crew stays `blocked` (`src/domain/lifecycle.ts:25-32`).
- `listActions` with a ticking clock returns newest first: mastic escalate `current`, mastic wait `current`, blocker escalate `current`. The blocker lookup uses `shortfallQty: null` (`src/application/actions.ts:27-30`). Blocker state `escalated`. Crew `blocked`.
- Shortage id checks, all 404 `shortage_not_found` with `no-store`, and none of them wrote a row onto the real shortage: `site-a` plus `site-b:MAT-SEALANT`; `site-b` plus `site-b-extra:MAT-SEALANT`; lowercase `site-b:mat-sealant`; blocker id `site-b:blocker.pen-c-03` (site C's blocker); `site-b::MAT-SEALANT` (the second segment cannot contain a colon; `SHORTAGE_ID` is `src/server/http.ts:17`). `site-b%3AMAT-SEALANT`, the value Next leaves after one `decodeURIComponent` (`node_modules/next/dist/server/lib/router-utils/decode-path-params.js:29`), decodes in the handler to `site-b:MAT-SEALANT` and returns 201. The raw segment `site-b%253AMAT-SEALANT` passed straight to the handler is 404, which is what a single decode of a double-encoded colon produces only if the framework did not decode first. A real `%253A` request is decoded once by Next and then once by `decodeSegment` (`src/server/http.ts:64-69`).
- `pen-b-01` posted under site A is 404 `penetration_not_found`.

**Substitution.**

- Candidates for `pen-b-01`: 200, `no-store`, nominated `0438`, status `ok`, notice exactly `Catalogue match, not verified`, codes `0451` `in_stock` and `0464` `no_material_mapping`. The body does not contain "compatible" or "approved". `pen-c-01` is `substrate_incomplete` with no candidates. `pen-c-03` is `nominated_code_unknown`. `pen-a-01` (`0344`) is `ok` with zero candidates. The notice is still present when status is not `ok`, which the brief requires.
- Non-candidate `9999` is 422 and a changed nomination is 409 on a first call (AC 23 and 24 in the suite). A successful proposal does not change readiness (same test). Candidate membership is the catalogue match list, so `0464` can be proposed even though it has no material mapping.
- The same idempotency key on a wait and on a proposal both return 201. The two tables have separate unique keys (`supabase/migrations/0001_actions.sql`), which this matches.
- Repeated proposals with different keys are allowed. The spec does not reject them.

**Idempotency aside from the High finding.**

- Per user, for both record types: `leader-a` and `leader-b` with the same key each get `created: true` and different ids, for waits and for proposals.
- Key `a.b` and key `axb` are different rows (`id-3` and `id-4`). The memory match is string equality. A key containing `/` and a 129-character key are 400 `idempotency_key_required`. A 128-character key of `k` is 201.
- While the shortage still exists, a different note with the same key returns the original (200, `created: false`).

**HTTP checks, cache, and production guard.**

- POST order in the handlers is path ids, then `readPost`: idempotency key, declared and actual body size (10,000 bytes), UTF-8, `JSON.parse`, schema, then the use case (`src/app/api/sites/[id]/shortages/[shortageId]/wait/route.ts:11-14`, `src/server/http.ts:99-149`). The suite covers a bad site id with no key → 404 `site_not_found` (not 400), a missing key on an oversized body → 400 (not 413), invalid JSON → 400 `invalid_json`, and an unknown `createdBy` field → 422 `validation_failed` without the submitted value. Every handler returns through `json()`, including `errorResponse` (`src/server/http.ts:36-61`), so handler 404s and 500s send `Cache-Control: no-store`. `next.config.ts` does not add that header for a route this app does not define. Next was not started, so the framework's own 404 was not observed.
- `NODE_ENV=production` and `ACTIONS_STORE=memory` with no Supabase env: `GET /api/sites` is 500 `{"code":"internal_error","message":"Something went wrong."}`, `no-store`, and the body does not contain `site-a` (`src/server/deps.ts:34-36`). The suite's unconfigured-Supabase production case matches. Development with a Supabase URL set and `ACTIONS_STORE` unset keeps the memory store, which is the brief's default.
- `createdBy` comes from `getCurrentUser()` (`src/server/identity.ts`), not from the body. Logs from these failures contain the event, code, and status. The forced internal-error test in the suite expects the generic body and no note, path, or SQL.

**Existing readiness rules kept their meaning.** Unknown code, then no mapping, then invalid quantity. A blocked penetration adds no requirement. No penetrations is `nothing_planned`. Missing or unusable stock is kind `unknown` with null on-hand and null shortfall, and `requiredQty` stays a number. Crew status is `blocked` while any shortage or blocker exists, including after wait, escalate, or a proposal. Shared unreserved stock is unchanged: the suite's AC 10 still has site A `clear` and site B `blocked`.

## Commands

| Command | Exit |
| --- | --- |
| `cd /tmp/review-copy && npx vitest run --exclude tests/api/review-proof.test.ts --exclude tests/api/review-proof-2.test.ts --exclude tests/api/review-spec-probe.test.ts --exclude tests/api/review-extra.test.ts --exclude tests/api/review-mismatch.test.ts --reporter=dot` | 0. 12 files, 147 passed, 3 skipped. These are the repo tests. Vitest was not run in the repo cwd: the sandbox returns EPERM writing `node_modules/.vite-temp`. The copy excludes `node_modules`, `.next`, and `.git` from the rsync, and `node_modules/.vite-temp` is a symlink to `/tmp/vite-temp`. |
| `cd /tmp/review-copy && npx vitest run tests/api/review-spec-probe.test.ts` (included in an earlier run of the copy that exited 0) | wrote `/tmp/spec-probe.json` |
| `cd /tmp/review-copy && npx vitest run tests/api/review-extra.test.ts --reporter=verbose` | 0. Wrote `/tmp/extra-probe.json`. |
| Patch `pen-a-01.siteId` to `site-b` in the copy's `data/sample/nominations.json`, then `npx vitest run tests/api/review-mismatch.test.ts` | vitest 0. Stub result `UpstreamError:upstream_invalid`. Copy file restored to the snapshot (`site-a` again). The repo file was still `site-a`. |

The extra test files exist only under `/tmp/review-copy`. The repo working tree was not modified by this review.
