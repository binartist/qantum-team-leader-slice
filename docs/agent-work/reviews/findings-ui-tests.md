# Test quality review (UI lens)

Reviewed the UI tests and the pure modules they claim to lock. Mutations were applied only under `/tmp/review-copy`. Playwright was not run. Critical: none. The fail-closed strings in `status.ts` and `messages.ts` are asserted exactly, and a module-local dependency cache does fail `tests/api/shared-store.test.ts`. The gaps below are tests that stay green when the rendered page, the action-list status, or the dialog client is wrong.

## High

### 1. Stock-down never reaches a rendered page
**Severity:** High
**Where:** `docs/ui-design.md:116`, `docs/test-strategy.md:37` (AC 9 is specified as API and e2e). No match in `tests/e2e/`. Page branch: `src/app/sites/[id]/page.tsx:53-60` (same shape on `/`, the actions page, and the substitutes page).
**Defect:** Nothing loads a page while stock is down and checks the can't-check banner.
**Evidence:** `tests/api/routes.test.ts:150-159` asserts HTTP 502 and `crewStatus` absent from JSON. `tests/unit/ui-messages.test.ts:43-48` asserts the banner string in isolation. `tests/unit/ui-load.test.ts:30-35` throws only `upstream_unavailable`. A copy with `loadPage` narrowed to `error.code === "upstream_unavailable"` still passes `tests/unit/ui-load.test.ts` (exit 0) and the rest of `tests/unit` + `tests/api` + `tests/data` (exit 0). The same copy, given `new UpstreamError("upstream_invalid", "stock")`, throws `stock is invalid.` instead of `{status:"unavailable"}`. That is the malformed-stock path. The page would hit `src/app/error.tsx`, which no e2e opens. No test would fail if that error screen were the only result, and none would fail if a page caught the error and rendered `readinessBanner("clear", ...)`.
**Fix:** Drive stock-down (and malformed stock) through the site page and the sites list. Assert the can't-check sentence and a zero count of "Crew can go". Extend `ui-load.test.ts` to `upstream_invalid`.

### 2. An earlier decision can be labelled Current
**Severity:** High
**Where:** `src/application/actions.ts:34`. Page render: `src/app/sites/[id]/actions/page.tsx:80`.
**Defect:** The additive `status` field on the actions list is never read by a test, so forcing every row to `"current"` stays green.
**Evidence:** On the unmodified copy, a wait recorded at shortfall 1 against site B sealant (live shortfall 2) lists as `status: "earlier"`. After `.map((action) => ({ ...action, status: "current" }))`, the same input lists `status: "current"`, and `npx vitest run tests/unit tests/api tests/data` exited 0. Domain tests call `classifyActionsForList` directly, so they still pass. No e2e looks for "Earlier decision, shortfall has grown" or "Current". `tests/e2e/scenario.spec.ts` checks the escalation heading only.
**Fix:** An API test that records an action below the live shortfall and expects `status: "earlier"` on `GET .../actions`, plus an e2e that shows that chip and does not show "Current" for that row.

### 3. AC 30's browser test accepts the wrong state and the wrong affected count
**Severity:** High
**Where:** `tests/e2e/ac30-status-text.spec.ts:11-17`. The unit test named AC 30 is `tests/unit/ui-status.test.ts:23-28`, which maps crew chips, not shortage rows.
**Defect:** The test that claims AC 30 cannot fail when a shortage chip says the wrong one of Open, Waiting, or Escalated, or when the collar card reports the wrong penetration count.
**Evidence:** Sealant quantity text is exact (`Need 10, have 8, short 2 cartridge`, `Affects 12 penetrations`). Collar count is `/Affects \d+ penetrations?/`, so "Affects 0 penetrations" passes. State is `hasText: /Open|Waiting|Escalated/` plus an `svg[aria-hidden='true']`. `src/ui/Icon.tsx:6` always emits that svg, including when no path matches the icon name, so an empty icon passes. Swapping the Open and Waiting labels in `shortageState` still matches. Site C (`:24-29`) checks "Need 1, stock unknown" and a zero count of "Crew can go", and does not require the blocked banner, so "Nothing planned" would pass there. `scripts/check-ac-coverage.mjs` treats the mis-named unit test as a reference to AC 30, so deleting the e2e file would still satisfy the script.
**Fix:** Assert the initial state word "Open" on each card, the collar's real penetration count, and the expanded penetration labels. Point the AC 30 name at the row test.

### 4. The dialog's idempotency key is not shown to be reused
**Severity:** High
**Where:** `src/ui/decisions/Dialog.tsx:29` and `:56`. `tests/e2e/scenario.spec.ts:40-60`.
**Defect:** The scenario checks that the first escalate request has some key, then replays that captured key with `fetch`. A dialog that minted a new key on every `send` still passes.
**Evidence:** `expect(key).toBeTruthy()` (`scenario.spec.ts:43`) accepts any non-empty header. The second call (`:50-59`) is a hand-built `fetch` of the captured key, which exercises `installReplayAnnouncer` and the API, and expects "Already recorded". It never submits the dialog twice and never compares two `idempotency-key` headers. The in-flight "Sending…" disable (`:36-37`) is a real check and would fail if the button stayed enabled. No test covers a failed submit followed by a retry with the same key.
**Fix:** Open the dialog once, fail the first submit (or let it succeed and resubmit before close), and assert both POSTs carry the same `Idempotency-Key`. Assert a network failure does not announce "Escalation recorded".

### 5. Decision-client failures are unwired
**Severity:** High
**Where:** `src/ui/decisions/api-client.ts:68-81` (`postDecision`), `:110-112` (`readCode`). Callers: `src/ui/decisions/EscalateDialog.tsx:44`, `WaitDialog.tsx:38`, `ProposeDialog.tsx:51`. `src/app/error.tsx:7-17`.
**Defect:** No unit test imports the decision client or the error screen, so a network failure reported as success, or a server sentence rendered in the dialog, would not fail vitest or the e2e specs as written.
**Evidence:** `postDecision` maps a thrown `fetch` to `{ok:false, code:"upstream_unavailable"}`, 201 to success, and 200 plus `created:false` to replay. Anything else uses `readCode`, which collapses a non-token `code` to `internal_error`. The e2e specs never return 409, 422, or 502 from a dialog submit. The one client error they do check is an empty proposal reason (`scenario.spec.ts:73-78`), which is the `GIVE_REASON` string and never calls the API (`waitForRequest` timeout 1500ms). `error.tsx` renders "Try again." and keeps `error.message` off the page, but no test renders it, so printing `error.message` or the digest would stay green. `apiErrorMessage` itself is exact (`tests/unit/ui-messages.test.ts:23-39`); the hole is the caller.
**Fix:** Unit-test `postDecision` for 201, 200 replay, 409 `stale_nomination`, a non-JSON body, and a rejected fetch. Assert the dialog shows `apiErrorMessage` output and not `payload.message`. Render `error.tsx` and assert the visible text is only the fixed copy.

### 6. Fixed on-screen phrases for stock and catalogue matches are only checked in JSON
**Severity:** High
**Where:** `src/app/sites/[id]/page.tsx:71` (`stockNotice`), `src/app/sites/[id]/penetrations/[pid]/page.tsx:66-67` (`notice` and the empty-state sentence). E2E gap: `tests/e2e/scenario.spec.ts` (no match for those sentences). API locks: `tests/api/routes.test.ts:62-64` and `:106`.
**Defect:** Removing `<Notice>` from either page leaves vitest and the scenario spec green, so FR3, FR11, and FR13 are not proved on screen.
**Evidence:** AC 10 and the test strategy require the shared-stock label on screen. The scenario opens Harbour Point, escalates, proposes `0451`, and opens Kingsway, and never reads "On hand, shared, not reserved" or "Catalogue match, not verified". It does read "Materials in stock" and the unmapped sentence for `0464` (`scenario.spec.ts:66-68`), so those two availability strings are locked for that penetration. `pen-b-10` nominates `0344` (no candidates) and `pen-c-01` nominates `0943` (incomplete substrate). Both URLs are in `tests/e2e/support.ts:12-13` for axe and overflow only. No spec reads "No catalogue match for this penetration. Escalate instead." or the substrate sentence. The strings exist in `tests/unit/ui-status.test.ts:69-83`, which does not render the page. `relatedDecisions` (`penetrations/[pid]/page.tsx:109-122`), which chooses the Escalate target on that empty page, has no test.
**Fix:** In the scenario, assert both fixed notices. Open `pen-b-10` and `pen-c-01` and assert the empty-state sentence and that Escalate is offered for that penetration's shortage or blocker.

### 7. The 44px check skips `<summary>` while its comment says the summary is checked
**Severity:** High
**Where:** `tests/e2e/support.ts:24-42`.
**Defect:** `assertTargets` cannot fail when the "Show affected penetrations" summary is under 44px, which is the behaviour the comment claims to cover.
**Evidence:** The query is `a, button, input, select, textarea` (`:25`). A `<summary>` matches none of those. The later `details` skip (`:39-42`) says the summary itself is checked. Closed-panel links are also skipped, and the only test that opens a disclosure (`scenario.spec.ts:62`) does not call `assertTargets`. Wait and Propose dialogs are never opened for the measure; only the Escalate dialog is (`ac31-keyboard.spec.ts:35-38`). AC 31's keyboard path does exercise Escalate, the note field, and Send escalation, and would fail if that path broke.
**Fix:** Include `summary` in the query. Open one disclosure and the Wait and Propose dialogs, then measure. Keep the skip for anchors that are inline in a paragraph, and for the Next dev portal.

## Medium

### 8. `byNewest` oldest-first survives every existing test
**Severity:** Medium
**Where:** `src/application/actions.ts:19-20`.
**Defect:** Inverting the timestamp comparison lists older proposals first, and vitest still passes, because API tests freeze `now()` to one instant so the comparator returns 0.
**Evidence:** Unmodified `listActions` with proposals at `2026-10-01` and `2026-10-03` returns newer then older. The inverted comparator returns older then newer. `npx vitest run tests/unit tests/api tests/data` exited 0 with that invert applied. `tests/api/validation-bounds.test.ts:77` expects `["<500 r's>", "closer rating"]`, which is newest-first only while timestamps tie and `Array.sort` stays stable on the repository order. `tests/api/actions-repository.test.ts:73` and `:121-125` do use a ticking clock, and they call the repository, not `listActions`. Reversing the shortage-action array inside `listActions` is killed: `validation-bounds.test.ts:107` expects `[accepted, "due Friday", null, null]` and failed when the array was reversed.
**Fix:** Give `listActions` two proposals with different `createdAt` values and expect the newer reason first. The same for two shortage actions if that order should not depend only on the repository.

### 9. Several user-facing strings in `messages.ts` have no assertion
**Severity:** Medium
**Where:** `src/ui/messages.ts:12-32` and `:72`. Test: `tests/unit/ui-messages.test.ts:70-78` and `:52`.
**Defect:** Changing the Wait button, the clear banner's tone and icon, and every announcement string leaves the unit tests green.
**Evidence:** Unit tests assert `BUTTONS.sending`, `BUTTONS.sendEscalation`, `EMPTY`, `CREW_STAYS`, `GIVE_REASON`, and `MANAGER_CHECK` exactly. They do not import `ANNOUNCE`. These replacements all left `tests/unit/ui-*.test.ts` at exit 0:

| Mutant | Result the tests still accept | What would kill it |
| --- | --- | --- |
| `ANNOUNCE.escalation` "Saved" | exit 0 | `scenario.spec.ts:45` expects "Escalation recorded" |
| `ANNOUNCE.replay` "Done" | exit 0 | `scenario.spec.ts:60` expects "Already recorded" |
| `ANNOUNCE.proposal` "Sent" | exit 0 | `scenario.spec.ts:82` expects "Proposal recorded" |
| `ANNOUNCE.wait` "Noted" | exit 0 | nothing in the suite or the e2e specs |
| `BUTTONS.wait` "Hold" | exit 0 | nothing; no spec looks for Wait |
| `BUTTONS.escalate` "Raise" | exit 0 | e2e `getByRole(..., /Escalate/)` |
| `BUTTONS.propose` "Use this" | exit 0 | `scenario.spec.ts:70` |
| `BUTTONS.sendProposal` "OK" | exit 0 | `scenario.spec.ts:76` |
| `BUTTONS.sendWait` "OK", `cancel` "Back", `tryAgain` "Retry" | exit 0 | nothing in e2e |
| `BUTTONS.actionsLog` "History" | exit 0 | `scenario.spec.ts:84` |
| clear banner `{tone:"danger", icon:"cross"}` with label "Crew can go" | exit 0 | nothing; `:52` checks `.label` only, and e2e does not read the icon path |

`crewStatus("clear")` itself is exact in `ui-status.test.ts:24`. The banner's own return is a separate object, and the mutant stopped calling `crewStatus`.
**Fix:** Assert every `BUTTONS` and `ANNOUNCE` value, and assert tone and icon for `readinessBanner("clear", ...)`. Add a Wait e2e if FR7's dialog is in scope.

### 10. Candidate material names and insulation are invisible to vitest
**Severity:** Medium
**Where:** `src/application/candidates.ts:80` and `:88`.
**Defect:** Replacing material names with ids, and setting every candidate's `insulationMinutes` to `null`, leaves the unit and API suites green.
**Evidence:** Unmodified `listCandidates` for `pen-b-01` returns `0451` with insulation `60` and `MAT-PUTTY` named "Fire putty pad". The mutated module returns insulation `null` and name `"MAT-PUTTY"`. Combined with the other surviving mutants, `npx vitest run tests/unit tests/api tests/data` exited 0. `tests/api/routes.test.ts:109-113` reads `internalCode` and `availability.overall` only. `scenario.spec.ts:67` would kill the name change (it expects "Fire putty pad x1 (20 on hand)"). Nothing, including that scenario, reads the candidate rating, so insulation `null` would still show "60/not claimed" via `formatRating` and every current spec would pass.
**Fix:** Assert `0451`'s material name and insulation on the candidate payload, and assert the rating line in the scenario.

### 11. `loadPage` treats only the one 404 the unit test throws
**Severity:** Medium
**Where:** `src/app/_lib/load.ts:14`. Test: `tests/unit/ui-load.test.ts:38-44`.
**Defect:** Narrowing the 404 branch to `error.code === "site_not_found"` leaves the unit test green and skips `notFound()` for a missing penetration.
**Evidence:** The test throws `new AppError(404, "site_not_found", ...)`. With the narrower check, `PenetrationNotFoundError` propagates as `Penetration not found.` and `notFound` is not called (probe on the copy). `tests/e2e/not-found.spec.ts:4-6` would kill this for `/sites/site-b/penetrations/nope`, because the substitutes page uses `loadPage`. A second survivor: moving `await connection()` to after a successful `work()` still passes `ui-load.test.ts`, because only the success test counts the call (`:27`). The unavailable path then skips `connection()`.
**Fix:** Throw `PenetrationNotFoundError` and `ShortageNotFoundError` and expect `notFound`. Assert `connection()` on the unavailable path too.

### 12. E2E stability and shared server state
**Severity:** Medium
**Where:** `playwright.config.ts:8-9` and `:26-32`. `tests/e2e/ac31-keyboard.spec.ts:7`. `tests/e2e/scenario.spec.ts:73-75`.
**Defect:** One `next dev` process and one in-memory store serve every spec, in series, with no reset between tests.
**Evidence:** `fullyParallel: false`, `workers: 1`, `reuseExistingServer: false`, command `ACTIONS_STORE=memory npx next dev`. `ac31` escalates the first shortage on site B. `scenario` escalates sealant on the same site. `ac30` does not require the chip to say "Open", so an earlier escalation does not fail it. There is no fixed `waitForTimeout`. There is `waitForLoadState("networkidle")` before the keyboard path, which waits on the dev server's idle connections. The empty-reason check treats "no POST within 1500ms" as success, so a late illegal POST passes. Axe sets its own timeout to 600000 (`accessibility.spec.ts:5`) on top of the 300000 test timeout.
**Fix:** Reset the memory store in `beforeEach`, or give each spec a fresh server. Replace `networkidle` with a locator that means hydrated. Assert the absent POST with a request listener that fails the test if a POST arrives before the next assertion, without a short timeout window.

### 13. Axe, overflow, and target size miss screens the design names
**Severity:** Medium
**Where:** `tests/e2e/support.ts:4-17`, `tests/e2e/accessibility.spec.ts:5-15`, `tests/e2e/ac32-viewport.spec.ts:4-13`.
**Defect:** Light and dark axe, the 375px overflow check, and the 44px check share one URL list and one Escalate dialog, and omit the not-found page, the error page, loading, and the Wait and Propose dialogs.
**Evidence:** `accessibility.spec.ts` emulates `light` and `dark`, runs `assertAxe` on every `screens` entry, opens the Escalate dialog, runs axe again, then Escape. That matches the section 6 demand for each main screen in both schemes and for a dialog. `screens` includes `/`, site A (clear), B (blocked), C (blockers), D (nothing planned), five substitute URLs, and two action logs. It does not include `/sites/nope`, and there is no route that renders `error.tsx` or `loading.tsx`. Overflow uses the same list plus the Escalate dialog (`ac32-viewport.spec.ts:10-13`). `assertNoOverflow` compares `scrollWidth` and `clientWidth`. `globals.css` does not set `overflow-x: hidden`, so the check is not obviously disabled. Not-found, error, and the other dialogs are unmeasured.
**Fix:** Add the not-found page to the three loops. Open Wait and Propose once per scheme for axe, overflow, and target size.

### 14. `format.ts` survivors the quantity and path tests do not see
**Severity:** Medium for a zero balance reported as unknown; Low for the rest
**Where:** `src/ui/format.ts:4`, `:5`, `:42`, `:58-63`, and the `MONTHS` table at `:1`.
**Defect:** These edits left `tests/unit/ui-format.test.ts` at exit 0.

| Mutant | Wrong result | Killing test to add |
| --- | --- | --- |
| `!Number.isFinite` replaced with `isNaN` or `+Infinity` only | `formatQuantity(Number.NEGATIVE_INFINITY)` returns `"-Infinity"` (unmodified code returns `"unknown"`) | expect `"unknown"` for `-Infinity` |
| `onHandQty === 0` treated as unknown stock | a line with 0 on hand becomes "stock unknown" | a fixture with `onHandQty: 0` |
| `sitePath` / `actionsPath` drop `encodeURIComponent` | `sitePath("a/b")` returns `"/sites/a/b"` (unmodified: `"/sites/a%2Fb"`) | the same encoding case `penetrationPath` already has at `ui-format.test.ts:90` |
| `"Feb"` changed to `"February"` | February dates change; tests only format 9 Jan and 3 Oct | one February instant |
| `1e6` rounding changed to `1e1` | values with more than one decimal place change; 2.2, 0.8, and 0.3 still pass | a quantity that needs the 6-place snap |

Removing `Object.is(rounded, -0)` also survived. That one is equivalent: `String(-0)` is already `"0"`, so the branch does not change the result the test sees.
**Fix:** Add the `-Infinity`, zero-on-hand, encoded site id, and one other month cases. The `+01:00` case at `ui-format.test.ts:46` already locks UTC for `formatAsOf`.

### 15. Date, author, and "Nothing planned" are not read in the browser
**Severity:** Medium
**Where:** `src/ui/ActionRow.tsx:22-25`. `src/app/page.tsx:26`. Spec section 9 step 7 and FR6 / FR14.
**Defect:** The scenario checks action headings and the proposal reason, and never the date line or the "By …" line. No spec reads "Nothing planned" or "Crew can go" on site A or site D.
**Evidence:** `scenario.spec.ts:84-87` expects the proposal heading, the reason, and the escalation heading. `formatRecordedAt` is unit-tested (`ui-format.test.ts:47`). If `ActionRow` dropped the date and author, the scenario would still pass. Site D is only in the axe and overflow list. `crewStatus("nothing_planned")` is exact in the unit test, and `routes.test.ts:55` expects the enum `nothing_planned` in JSON. The chip text on `/` is unasserted. A page that mapped `nothing_planned` to the clear chip would survive the e2e specs.
**Fix:** On the actions log, assert a UTC timestamp and "By" plus the author. On `/`, assert "Crew can go" for Riverside Plaza and "Nothing planned" for Old Mill Annex.

### 16. Duplicate material rows are not distinguished
**Severity:** Low
**Where:** `src/application/readiness.ts:17`.
**Defect:** Deleting `|| result[material.id]` (the duplicate-id skip) leaves the unit and API suites green.
**Evidence:** That one-line deletion was included in the combined mutant run, which exited 0. Sample material ids are unique, so the first-wins guard has no fixture.
**Fix:** Pass two catalogue rows with the same material id and different names, and expect the first name.

## Low

### 17. The shared-store test is named AC 15
**Severity:** Low
**Where:** `tests/api/shared-store.test.ts:15`. `scripts/check-ac-coverage.mjs:16-24`.
**Defect:** The test name is the shortfall rule (AC 15). The body asserts object identity of the actions repository. The coverage script counts any `AC 15` mention, so this name alone satisfies the script for that number.
**Evidence:** See the regression section below. Real AC 15 assertions do exist in `tests/unit/lifecycle.test.ts` and `tests/unit/readiness.test.ts`, so the number is also covered for real. The name on this file is still the wrong criterion.
**Fix:** Rename the test to the shared-store bug. Keep AC 15 on the shortfall tests.

## Regression guard: shared store

`tests/api/shared-store.test.ts` does reproduce two evaluations of `src/server/deps.ts` in one process. `beforeEach` calls `vi.resetModules()`, the test imports `@/server/deps`, resets again, and imports it again (`:15-19`). It expects `second.getDependencies().actions` to be the same object as `first.getDependencies().actions`.

Replacing the `globalThis` `Symbol.for` cache with a module-level `let builtOnce` made that test fail (exit 1):

```
FAIL tests/api/shared-store.test.ts > AC 15: two evaluations of the dependency module share one memory store
AssertionError: expected { …(6) } to be { …(6) } // Object.is equality
 ❯ tests/api/shared-store.test.ts:19:44
```

The two repository objects had no visible field difference and were not `Object.is` equal, which is the split-store failure. The store lives in the repository closure, so identity is the right check for "a write on one evaluation is a write on the other". The test does not itself append a row.

It does not import a page module and a route module, so it approximates Next's duplicate bundles rather than launching them. `usingOverride` in `src/server/deps.ts:10-11` stays on the module instance. Production calls `getDependencies()` without the test override, which is the path this test hits.

An implementation that stored only `actions` on `globalThis` and rebuilt the rest of `Dependencies` on every call still passed this test (exit 0). That still shares the memory store, which is the bug being guarded. It would not notice two evaluations carrying different stock stubs. `buildDependencies()` always calls `makeStubs()` with no arguments, so those stubs are stateless readers.

## Coverage honesty

`vitest.config.ts:11-13` measures `src/domain/**/*.ts` and `src/ui/*.ts` only, with a 95% floor. `src/ui/*.ts` is `format.ts`, `messages.ts`, and `status.ts`. These have no unit test, and the logic is not a straight render:

- `src/ui/decisions/api-client.ts` — HTTP status to ok/replay/error, code allowlist, fetch wrapper, announcement store.
- `src/ui/decisions/Dialog.tsx` — key created on open, in-flight lock, replay versus announce, focus return.
- `src/ui/decisions/ProposeDialog.tsx:87-91`, `WaitDialog.tsx:74-76`, `EscalateDialog.tsx:31-39` — trim and 500-character checks, destination coerced to purchasing or warehouse.
- `src/app/sites/[id]/penetrations/[pid]/page.tsx:47-52` and `:109-122` — when to offer Escalate, and for which shortage or blocker.
- `src/app/sites/[id]/page.tsx:124-127` — place label fallback to the raw penetration id.
- `src/app/error.tsx:21-22` — digest detection. The visible copy is static, and it is untested.
- `src/ui/Icon.tsx` — which path is drawn. The e2e counts the svg element.

`src/app/loading.tsx` and `src/app/not-found.tsx` are static. Not-found is covered by `tests/e2e/not-found.spec.ts`. Loading is not, and there is nothing to get wrong beyond the two words.

`STOCK_NOTICE`, `stockAsOf` (must be the stock timestamp `2026-10-03T08:00:00Z`, not `deps.now()`), and `CANDIDATE_NOTICE` are killed by `tests/api/routes.test.ts`. Those additive fields are locked. The untested additive fields are candidate `materials` names, candidate `insulationMinutes`, and listed-action `status` (findings 2 and 10).

## E2E versus the section 6 scenario

`tests/e2e/scenario.spec.ts` does walk `docs/ui-design.md` section 6: open Harbour Point from the list, escalate sealant to purchasing with a note, see Escalated and a blocked banner and no "Crew can go", open the `0438` penetration, see `0451` in stock and `0464` unmapped, reject an empty reason, propose `0451`, see both rows on the actions log, open Kingsway, see the two data-problem sentences and no "Crew can go". The forced-failure bullet in that same section is not implemented (finding 1). The `0344` empty state is section 9 of the slice spec, not the section 6 bullet, and it is also untested on screen (finding 6).

## Skip judgment in `assertTargets`

- **Inline anchors in a paragraph** (`support.ts:30-31`). Matches WCAG 2.5.8's inline-link exception. No `<a>` in the UI sits inside a `<p>` (`Notice` is a `<p>` of text). The skip hides nothing that exists today. It would hide a later link wrapped in a `<p>`.
- **`nextjs-portal` shadow host** (`:33-37`). Justified. `playwright.config.ts:29` starts `next dev`, which injects that control. A real control inside that shadow root would be ignored. App controls are not.
- **Closed `<details>` content** (`:38-42`). Closed content is not tappable, so skipping it is right. Combined with the selector bug in finding 7, the summary is not measured, and links inside an open disclosure are never measured.

## Mutation controls that the tests did kill

Exit 1, as they should:

- `format.ts` `"Oct"` changed to `"October"`.
- `crewStatus("clear")` icon `"check"` changed to `"cross"`.
- `crewStatus("blocked")` label changed to `"Crew can go"`.
- `loadPage` dropping the `UpstreamError` branch.
- `STOCK_NOTICE` shortened to `"On hand"`.
- `stockAsOf` set from `deps.now()` (`2026-10-03T12:00:00.000Z` against the expected `2026-10-03T08:00:00Z`).
- `CANDIDATE_NOTICE` set to `"Compatible"` (also caught by the forbidden-word scan in `routes.test.ts:124`).
- `listActions` reversing the shortage-action array (`validation-bounds.test.ts:107`).

`status.ts` label, tone, and icon assertions use `toEqual` on every chip the module returns. The waiting and escalated chips share tone `warning` and icon `warning`, so swapping those two icons is equivalent and would not be a useful mutant. The error-code table in `messages.ts` is one `it.each` per code, and `upstream_unavailable` and `upstream_invalid` share one sentence, so swapping those two strings is also equivalent.

## Hygiene

- No `test.only`, `describe.only`, `it.only`, or bare `.skip` under `tests/`. The six skips in the shuffled run are conditional: five Supabase repository contract tests when `SUPABASE_URL` is unset (`actions-repository.test.ts:404`, `it.skipIf`), and the AC 28 bundle scan when `.next/static` is absent (`security.test.ts:64`).
- UI unit tests pass fixed ISO strings, including `2026-10-03T09:00:00+01:00` expecting `08:00 UTC` (`ui-format.test.ts:46`). They do not read the clock or the network.
- API tests use `testDependencies()` with `now` fixed at `2026-10-03T12:00:00.000Z` (`tests/api/support.ts:10`). That freeze is why finding 8 exists.
- Shuffled order on a clean copy passed. See commands.

## Verified OK

- Crew, shortage, blocker, candidate, availability, and action chips in `src/ui/status.ts` fail a wrong label, tone, or icon (controls above).
- `apiErrorMessage` maps each designed code and uses one fallback, and does not return `"Shortage not found."` (`ui-messages.test.ts:23-39`).
- Blocked banner singular and plural for shortages and data problems, and the unavailable banner text, tone, and icon (`ui-messages.test.ts:43-67`).
- `formatNeed` for a known shortage and for null on-hand or null shortfall (`ui-format.test.ts:34-38`). Action sentences for wait, purchasing, warehouse, and a missing target (`:107-113`).
- Forbidden-word scans over the formatted strings and over `src/ui/**` (`ui-status.test.ts:140-143`).
- `loadPage` returns `unavailable` for `upstream_unavailable`, calls `notFound` for the tested 404, and rethrows `ValidationFailedError` and a generic `Error` (`ui-load.test.ts`).
- Sealant need/have/short text and the unknown-stock sentence are exact in `ac30-status-text.spec.ts:8` and `:26`.
- Scenario section 6 steps listed above, including the empty-reason guard and the in-flight disabled button.
- Not-found for an unknown site and an unknown penetration, and the link back to `/` (`not-found.spec.ts`).
- Axe runs on every URL in `screens` in light and dark, then with the Escalate dialog open, and filters to serious and critical (`support.ts:55-63`).
- AC 32's check is `scrollWidth <= clientWidth` at the configured 375px viewport, on every URL in `screens` and with the Escalate dialog open.
- Shared-store identity check kills a module-local cache (regression section).
- `STOCK_NOTICE`, `stockAsOf`, and `CANDIDATE_NOTICE` kill a wrong constant.

## Commands

Working copy: `rsync` of the repo to `/tmp/review-copy` excluding `node_modules`, `.next`, and `.git`, with Vite `cacheDir` set to `/tmp/vite-cache-review` in the copy only. Extra files left in that directory by an earlier session (`tests/api/review-*.test.ts`, `src/server/log.ts`) were removed before the runs below. Playwright was not started.

| Command | Exit | Result |
| --- | --- | --- |
| `npx vitest run tests/unit/ui-format.test.ts tests/unit/ui-messages.test.ts tests/unit/ui-status.test.ts tests/unit/ui-load.test.ts tests/api/shared-store.test.ts` | 0 | 5 files, 39 tests |
| `npx vitest run --sequence.shuffle --sequence.seed 7` | 0 | 21 files, 234 passed, 6 skipped |
| Mutation script `/tmp/mutate-review.mjs` (38 edits, vitest per edit, sources restored after each) | 0 | 37 matched the predicted kill or survive; reversing the action list was killed, not a survivor |
| Same surviving edits applied together: `npx vitest run tests/unit tests/api tests/data` | 0 | project tests stayed green while the probe printed `-Infinity`, `"/sites/a/b"`, a thrown `upstream_invalid`, a penetration 404 that did not call `notFound`, insulation `null`, material name `"MAT-PUTTY"`, action `status:"current"`, and proposals oldest-first |
| Module-local `getDependencies` cache: `npx vitest run tests/api/shared-store.test.ts` | 1 | `Object.is` failure at `shared-store.test.ts:19` |
