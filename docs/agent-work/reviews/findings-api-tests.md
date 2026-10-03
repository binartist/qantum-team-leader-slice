# API layer test review

Lens: test quality and whether a real defect in `src/application`, `src/server`, `src/ports`, or `src/adapters` would fail the suite. Domain coverage is out of scope except where an AC-named test never leaves the domain function.

Mutants were applied only under `/tmp/review-api-q`. The repo was not modified. "Suite" means `vitest run --config vitest.config.cts` there: 147 passed, 3 pending, exit 0 on the unmutated tree.

## Findings

### 1. High — nominations and solution-materials `down` never run

- Location: `tests/api/stubs.test.ts:26`
- Defect: The AC 9 stub test turns all four ports to `down`, then calls only `stock.getStock` and `sites.listSites`.
- Evidence: Ignoring `refuseIfDown` for `nominations` (`src/adapters/stub/index.ts:64`) leaves the suite green (exit 0). `GET /api/sites` then returns site-a `crewStatus: "clear"`. The same mutant for `solution_materials` (`src/adapters/stub/index.ts:85`) also leaves the suite green, and site-a is again `clear`. The route test at `tests/api/routes.test.ts:133` injects its own nominations throw, so it does not call this stub mode. Nothing injects `solutionMaterials: "down"`.
- Fix: Call `getNominations` and `getSolutionMaterials` on the down stub and assert `upstream_unavailable` with the system name. Drive `GET /api/sites` and `GET /api/sites/site-a/readiness` with each mode and assert no site is `clear`.

### 2. High — a stock outage on the candidate route can still say in stock

- Location: `src/application/candidates.ts:52` (no test reaches a failing `getStock` here)
- Defect: Swallowing a stock error and inventing a million on hand for every material still passes the suite.
- Evidence: Suite exit 0. `GET /api/sites/site-b/penetrations/pen-b-01/substitution-candidates` with `stock: "down"` returns 200 and `[["0451","in_stock"],["0464","no_material_mapping"]]`. The only candidate HTTP test (`tests/api/routes.test.ts:103`) uses healthy stock.
- Fix: With stock `down`, assert 502 and that the body does not contain `in_stock`. Do the same for nominations `down` and for malformed stock on this route.

### 3. High — AC 13 is only proved for wait

- Location: `tests/api/routes.test.ts:222` (escalate guard at `src/application/shortages.ts:53`)
- Defect: Deleting the escalate "shortage or blocker must exist" check still passes the suite.
- Evidence: Suite exit 0. `POST /api/sites/site-b/shortages/site-b:MAT-PUTTY/escalate` with `{"escalateTo":"purchasing"}` returns 201. The named test only waits on that id and expects 404.
- Fix: Escalate a missing id and expect 404 `shortage_not_found`, and assert the actions list did not grow.

### 4. High — escalate idempotency is not exercised

- Location: `src/application/shortages.ts:62` (AC 16 HTTP coverage is `tests/api/routes.test.ts:236`, which only waits)
- Defect: Replacing the escalate idempotency key with `crypto.randomUUID()` still passes the suite.
- Evidence: Suite exit 0. Two escalates of `site-b:MAT-SEALANT` with the same `Idempotency-Key` return 201 both times. Wait repeats are covered (the second is 200 and `created` is false).
- Fix: Repeat an escalate and a blocker escalate with the same key and expect 200, `created: false`, and one stored row.

### 5. High — shortage idempotency is not pinned to `(createdBy, key)`

- Location: `tests/api/actions-repository.test.ts:44` (implementation `src/adapters/memory/actions-repository.ts:39`)
- Defect: Also matching `shortageId` still passes, so a second row for the same user and key is invisible to the suite.
- Evidence: Suite exit 0. Wait `site-b:MAT-SEALANT` then wait `site-b:MAT-COLLAR-25` with key `shared-key`. The second response is 201. The migration's unique key is `(created_by, idempotency_key)` only (`supabase/migrations/0001_actions.sql:18`). The contract repeats one shortage and changes the note.
- Fix: In the shared contract, repeat the same key against another shortage and against another site, and expect the original row and `created: false`.

### 6. High — the proposal half of the repository contract cannot fail for order or site isolation

- Location: `tests/api/actions-repository.test.ts:67`
- Defect: The test name says proposals are newest first, then inserts one proposal and lists only `site-b`.
- Evidence: Reversing proposal sort (`src/adapters/memory/actions-repository.ts:86`) leaves the suite green (exit 0). A probe that inserts two proposals gets `["id-1","id-2"]` instead of newest-first `["id-2","id-1"]`. Removing the `siteId` filter on the same function also leaves the suite green. Listing `site-a` then returns the site-b proposal. Action isolation is real: dropping the action site filter fails the `site-a` expectation at line 72.
- Fix: Insert two proposals with increasing timestamps, expect newest-first ids, and expect `listSubstitutionProposals("site-a")` to be empty.

### 7. High — the Supabase adapter's client and proposal replay are skipped

- Location: `tests/api/actions-repository.test.ts:209`
- Defect: `it.skipIf(!SUPABASE_URL || !SUPABASE_SERVICE_KEY)` skips the whole contract (3 pending in this run). `tests/db` has no tests. The fake store covers shortage unique-violation replay only, and its `selectShortageActionByKey` ignores the arguments (`tests/api/actions-repository.test.ts:178`).
- Evidence: All three of these left the suite at exit 0, 147 passed, 3 pending:
  - `writeOne` returns `created: false` on a successful insert (`src/adapters/supabase/actions-repository.ts:169`). A fake insert with `error: null` then reports `created: false`.
  - Proposal `23505` is turned into `upstream_unavailable` instead of reading the existing row (`src/adapters/supabase/actions-repository.ts:181`). The probe throws `UpstreamError: actions_store is unavailable.`
  - Both client `.eq("site_id", siteId)` filters (`src/adapters/supabase/actions-repository.ts:219` and `:236`) are changed to `.eq("site_id", "___none___")`.
  The skip is printed as pending, so it is not a silent pass of those three tests. A default run still exits 0 with the SQL filters unexecuted.
- Fix: Keep the fake, but assert the `createdBy` and key passed into both selects, return `23505` for proposals and expect `created: false`, and fail the job when the live contract is skipped unless a named flag says no database is configured.

### 8. High — AC 17 and the other length limits are tested from the rejecting side only, and only for wait notes

- Location: `tests/api/routes.test.ts:260` (`src/server/http.ts:18`, `:22`, `:27`, `:33`, `:108`; `src/application/shortages.ts:24`; `src/application/candidates.ts:87`)
- Defect: The test sends a 501-character wait note and a 10001-byte body. Inclusive bounds, escalate notes, substitution reasons, and the 128-character key are free to move.
- Evidence: Suite exit 0 for each of these, with the probe result after it:
  - Wait schema `max(500)` lowered to `max(499)`. A note of exactly 500 characters returns 422.
  - Escalate schema and `noteOrNull` raised to 5000. An escalate note of 501 characters returns 201. The wait test still sends its 501-character note to `WaitBodySchema`.
  - Reason schema and the use-case check raised to 5000. A 501-character reason returns 201.
  - `bytes.byteLength > 10000` changed to `>=`. A body of exactly 10000 bytes returns 413. Deleting the byte-length check does fail the suite: 10001 bytes becomes 400 because this Node `Request` does not set `Content-Length`.
  - Idempotency regex widened from `{1,128}` to `{1,10000}`. A 129-character key returns 201. On the unmutated code a 128-character key returns 201 (probe passed) and a 129-character key returns 400.
- Fix: Accept exactly 500 characters, exactly 10000 bytes, and a 128-character key. Reject 501, 10001, and 129. Do that for wait notes, escalate notes, and substitution reasons.

### 9. High — AC 21 never reaches the use case or the route

- Location: `tests/unit/candidates.test.ts:98` (passthrough at `src/application/candidates.ts:77`)
- Defect: The test calls `findCandidates`. Forcing `listCandidates` to return `status: "ok"` still passes the suite.
- Evidence: Suite exit 0. `GET /api/sites/site-c/penetrations/pen-c-01/substitution-candidates` (nominated `0943`) returns `status: "ok"`. No suite test requests `pen-c-01` or `pen-a-01` (`0344`, AC 20).
- Fix: HTTP-test `pen-c-01` for `substrate_incomplete` and an empty list, and `pen-a-01` for `status: "ok"` and an empty list.

### 10. High — AC 28 does not look at HTTP bodies

- Location: `tests/api/security.test.ts:35` and `:106`
- Defect: The scan only flags `"use client"` imports and `NEXT_PUBLIC_*` names that look like secrets. There is no client module under `src`. The `.next/static` scan at line 54 runs only when that directory exists, which a unit run does not create. The env assertion stringifies a new object that contains only `demoUserId`, so it cannot fail while `demoUserId` is `leader-2`.
- Evidence: Adding `serviceKey: "super-secret-value"` to the `GET /api/sites` JSON (`src/application/sites.ts:24`) leaves the suite green. The response text contains `super-secret-value`.
- Fix: Assert the raw text of every API response fixture does not contain the service key, and drop the `demoUserId`-only stringify. Run the static-asset scan against a built fixture, or fail when `.next/static` is absent in the job that claims AC 28.

### 11. Medium — the shortage-id prefix is unchecked by the suite

- Location: `src/server/http.ts:89`
- Defect: Deleting `decoded.startsWith(`${siteId}:`)` still passes the suite.
- Evidence: Suite exit 0. `POST` wait on site `site-b` for shortage `site-a:MAT-SEALANT` with no idempotency key returns 400 `idempotency_key_required`. Unmutated code returns 404 `shortage_not_found` before the key is read. Encoded `site-b%3AMAT-SEALANT` is covered (`tests/api/routes.test.ts:227`), so removing `decodeURIComponent` entirely does fail.
- Fix: Send a well-formed shortage id for another site, with and without a key, and expect 404 `shortage_not_found`.

### 12. Medium — a bad percent-escape becomes 500

- Location: `src/server/http.ts:64`
- Defect: Removing the `decodeURIComponent` try/catch still passes the suite.
- Evidence: Suite exit 0. Readiness for site id `%` returns 500. Unmutated code returns 404 `site_not_found`. No test sends an invalid escape.
- Fix: Request `%` and `%E0%A4%A` for site, penetration, and shortage ids and expect 404.

### 13. Medium — equal timestamps and a check-then-insert yield are invisible

- Location: `src/adapters/memory/actions-repository.ts:27` and `:39`; clocks at `tests/api/actions-repository.test.ts:84` and `tests/api/support.ts:10`
- Defect: The contract clock moves 1 second per insert, so the sequence tie-break never decides an assertion. HTTP tests freeze time at `2026-10-03T12:00:00.000Z` and never assert order. The suite is also entirely sequential.
- Evidence: Returning `0` from the tie-break leaves the suite green. Two actions with the same timestamp then list oldest first (`["id-1","id-2"]`). Inserting `await Promise.resolve()` before the idempotency find and again before the insert also leaves the suite green. `Promise.all` of two waits with the same key then stores 2 rows. The unmutated repository has no await between the find and the push, so today's memory adapter does not lose that race; the suite would not catch the regression.
- Fix: Freeze the contract clock, expect the later insert first, and `Promise.all` two same-key writes and expect one row.

## Confirmed known survivors

These match what the orchestrator already recorded. They are not extra findings.

- Deleting `if (production && store !== "supabase")` at `src/server/deps.ts:36` leaves the suite green. `tests/api/security.test.ts:78` sets `ACTIONS_STORE` to empty, so production still defaults to supabase and the missing-credential check throws. With `NODE_ENV=production` and `ACTIONS_STORE=memory`, `GET /api/sites` returns 200 and includes `site-a`.
- Dropping `createdBy` from the proposal match at `src/adapters/memory/actions-repository.ts:58` leaves the suite green. A second user with the same key gets `created: false` and the first user's row. The action-level equivalent is killed (finding is not repeated): the contract test at line 57 and the route test both fail.

## Verified OK

- Shuffle, one worker, shared module state: `--sequence.shuffle --sequence.seed 7 --no-file-parallelism` and seed 99. Both exit 0, 147 passed, 3 pending. No order leak showed up between the cached composition root, `setDependenciesForTests`, and `vi.stubEnv`.
- AC 9 does lock "fetch stock even when the material id list is empty". Skipping `getStock` when `materialIds.length === 0` (`src/application/readiness.ts`) fails `tests/api/routes.test.ts:126`: site-d would stay `nothing_planned` while stock is down, so "every site is unavailable" is false. Exit 1, 146 passed, 1 failed.
- Wait on a blocker is locked. Removing the check at `src/application/shortages.ts:31` makes the blocker wait return 404 instead of 422. Exit 1.
- Stale nomination is locked. Removing `src/application/candidates.ts:89` makes `from: 0344` / `to: 0451` on `pen-b-01` return 201 instead of 409. Exit 1. The `to` code is a real candidate, so this is the check that stops the write.
- The candidate check is locked. Removing `src/application/candidates.ts:92` makes `to: 9999` return 201 instead of 422. Exit 1.
- Action idempotency is per user. Matching on the key alone fails the different-user contract test (suite exit 1, 2 failed).
- Action lists are site-scoped. Dropping the filter at `src/adapters/memory/actions-repository.ts:78` fails the empty `site-a` expectation. Exit 1.
- `Cache-Control: no-store` is set on error responses that the route tests actually issue. Returning the header only for status below 400 fails 10 tests (`expected null to be 'no-store'`). AC 29's own test (`tests/api/security.test.ts:70`) only calls `GET /api/sites`, and the route tests cover readiness, actions, candidates, and the error statuses they hit.
- Route check order that the suite does lock: a bad site id with no key is 404 `site_not_found` before the key is required, and an oversized body with no key is 400 before 413. Swapping `readJsonBody` ahead of `requireIdempotencyKey` (`src/server/http.ts:146`) makes the 10001-byte request return 413. Exit 1.
- AC tests that assert the specified behaviour, not a weaker stand-in: AC 1 (20 / 15 / 5 / blocked), AC 2 (clear), AC 3 (6 + 9 = 15), AC 4 (the named test is the 2.2 to 3 clause; the ten 0.1 balances and the 4.2 shortfall of 0.8 are separate tests in `tests/unit/readiness.test.ts` and do assert those numbers), AC 5 (null unknown shortage, plus negative and non-finite stock in the same file, plus wait/escalate of `site-c:MAT-MASTIC` over HTTP), AC 6 (blocker reason and the 422/201 HTTP pair), AC 7 (the named test is `no_material_mapping`; `invalid_quantity` and "the bad penetration adds no requirement" are asserted by the fail-closed tests in the same file), AC 8 (`nothing_planned`, including another site's penetrations), AC 11 and AC 12 (201, state `waiting`, crew stays blocked, missing and invalid `escalateTo` are 422), AC 14 (escalate then wait stays escalated and both kinds are listed), AC 15 (the domain and lifecycle tests assert not-current, `open`, `earlier`, and `resolved`; this layer does not emit the sentence "earlier decision, shortfall has grown"), AC 16 for wait (201 then 200, same record, one row, missing key 400, other user gets a new row), AC 18 and AC 19 (exact code lists), AC 22 (null insulation is excluded; the 20-solution sweep checks the match rules and the code list), AC 23 and AC 24 (422, 409, `proposed`, reason stored, readiness body unchanged, repeat returns the same record), AC 25 (length 20), AC 26 (148 rows compared with an independent `csv-parse`, six incomplete codes in order), AC 27 (schemas, one deliberate `9999`, no colon in ids), AC 10 as a pair (the unit test asserts both sites clear on 10 required and 15 shared; the HTTP test asserts the notice `On hand, shared, not reserved` on the sample sites).
- Stub `malformed` is invoked for stock, sites, nominations, and solution materials (`tests/api/stubs.test.ts:32`). Stub `empty` is invoked for all four ports. HTTP empty stock on site-a asserts `blocked`.
- Same-user proposal replay is locked by the contract (`created: false`, original reason) and by the HTTP repeat (200, same record). The surviving proposal gap is the other user, recorded above as already known.

## Commands

Isolated copy: `/tmp/review-api-q`. A single symlink of `node_modules` still hit `EPERM` on `node_modules/.vite-temp` (the sandbox blocks that path). The copy uses per-package symlinks and `vitest.config.cts` with `cacheDir` `/tmp/vite-cache-api-q`.

- `vitest run --config vitest.config.cts --sequence.shuffle --sequence.seed 7 --no-file-parallelism` — exit 0 (147 passed, 3 pending)
- same with `--sequence.seed 99` — exit 0 (147 passed, 3 pending)
- Unmutated behaviour probes (`tests/api/zz-probe.test.ts`, 23 cases) — exit 0
- Mutants that the suite killed — exit 1: empty-id stock skip (1 failed), wait-on-blocker (1), stale nomination (1), candidate check (1), action per-user match (2), action site filter (1), no-store on errors (10), delete byte-length check (1), parse body before idempotency key (1)
- Mutants that the suite missed — suite exit 0, and a probe then exit 1, except the supabase site-filter mutant which has no in-process probe: nominations down, solution-materials down, candidate stock fail-open, escalate missing shortage, escalate `randomUUID` key, wait `max(499)`, escalate note 5000, reason 5000, body `>= 10000`, key `{1,10000}`, proposal sort and site filter, shortage-scoped idempotency, service key in `GET /api/sites`, candidate `status: "ok"`, shortage prefix removed, percent-decode try/catch removed, timestamp tie-break removed, yielded check-then-insert, supabase `created: false` on insert, proposal `23505` thrown as unavailable
- Known survivors, suite exit 0 and probe exit 1: production guard deleted; proposal match ignores `createdBy`
