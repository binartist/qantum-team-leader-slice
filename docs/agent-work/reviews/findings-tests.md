# Test quality review

Reviewed `src/domain/*.ts`, `src/adapters/catalogue-csv.ts`, `tests/unit/*.test.ts`, and `tests/data/catalogue-file.test.ts` against `docs/slice-specification.md` section 4 and `docs/technical-design.md` sections 4–6. The current domain code matches the pinned catalogue figures (checked with a separate script, below). The gaps are tests that stay green when that behaviour is broken. Mutants were applied only under `/tmp/tl-review` (a copy). The repo was not modified.

An independent pass over `data/solutions-excerpt.csv` (same normalisation and match rules as the design, not imported from `src/domain`) reproduced the pins exactly: sha256 `cc01d2ab3fd65a29d95ef42fd04648682e116b1142700300fab9074a30b5e805`, 148 rows, incomplete `0853, 0943, 0944, 0946, 0952, 0955`, null insulation `0334, 0335, 0722, 0724, 0804, 0811, 0813, 0968`, and the same 20 codes. `0438` → `0451, 0464`; `0789` → `0790, 0791`; `0434` → `0435`; `0344` → none; `0943` → `substrate_incomplete`. No candidate failed the rating rules. Allowing a null insulation to satisfy a stated requirement adds `0347`, `0454`, and `0959`. Matching on the coarse options yields 43 codes. Ignoring service size yields 48. Removing the parenthesis-space rule drops `0452` and `0465` (18). `0943` would otherwise match `0952`.

## Findings

### Critical — a current wait marks the crew clear, and no test fails

`tests/unit/readiness.test.ts:379`

Every readiness case that records a wait also records an escalation, so the shortage state is `escalated`. `deriveShortageState` is tested for `waiting` (`tests/unit/lifecycle.test.ts:75`) without ever calling `computeSiteReadiness`. Replacing the crew rule with "blocked only when a shortage is not `waiting`" left all 69 tests passing (exit 0).

Probe, required 10, on hand 0, one wait recorded at shortfall 10: `crewStatus` `"clear"`, `state` `"waiting"`, `shortfallQty` 10. The design says a wait does not unblock the crew. AC 14 still passes because that case is escalated, so the crew stays blocked for a different reason.

Fix: add a readiness case whose only current action is a wait, and assert `state === "waiting"` and `crewStatus === "blocked"`.

### Critical — rounding on-hand up clears a real shortage, and no test fails

`tests/unit/readiness.test.ts:132`

Stock boundaries in the suite are the integers 0, 14, 15, and 16. AC 4 rounds the requirement only. Summing balances with `Math.ceil` left all 69 tests passing (exit 0), because every stock fixture is already an integer.

Probe, required 5, one balance of 4.2: `crewStatus` `"clear"` and `shortages` `[]`. The sum is 4.2, which is short of 5, so the crew is blocked and the shortfall is 0.8. Ceil turns 4.2 into 5, the exact-cover rule treats it as covered, and the leader is told the crew is clear.

Fix: assert on hand 4.2 against required 5 is `kind: "short"`, `onHandQty: 4.2`, `shortfallQty: 0.8`, crew blocked. Keep the existing exact-integer clear case.

### Critical — orientation is taken from the nominated solution, and the test that claims otherwise still passes

`tests/unit/candidates.test.ts:107`

That test nominates `0943` while keeping `0438`'s substrate, service, size, and rating, and it does lock those fields (`0943` is 120/90 and `Blank` / `50mm`; the expected candidates are `0438, 0451, 0464`). Both solutions are `Wall`, and every fixture builds the penetration orientation from the nominated row. Comparing orientation to the nominated solution instead of the penetration left all 69 tests passing (exit 0).

Probe: a Wall penetration, substrate `Plasterboard, 1 layer 13mm`, nominating `FLOOR_NOM` (Floor), with `WALL_MATCH` (Wall) and `FLOOR_MATCH` (Floor) otherwise identical. Result: `["FLOOR_MATCH"]`. The penetration is a wall, so the floor solution is not a candidate and `WALL_MATCH` is. This offers a floor system for a wall. Ignoring orientation entirely does not change the real-catalogue count of 20, because substrate text already differs by wall and floor; the synthetic fixture at `tests/unit/candidates.test.ts:238` is the only lock, and it never separates the penetration's orientation from the nominated row's.

Fix: in that test, or a sibling, set `penetration.orientation` to `Wall` and the nominated solution to `Floor` with the same normalised substrate, service, and size. Assert the wall solution is returned and the floor solution is not.

### High — shortfall one above the recorded value stays current

`tests/unit/lifecycle.test.ts:38`

AC 15 is specified as current while the shortfall is no larger than the recorded value. The tests use 4 (current), 5 (current), and 8 (not current). `return shortfallNow <= recorded + 1` left all 69 tests passing (exit 0).

Probe for a value recorded at 5: current at 4, 5, and 6; not current at 8. Shortfall 6 is a larger shortage, so the action is not current and the shortage state is `open`. The displayed AC 15 case (5 versus 8) still fails closed. Changing `<=` to `<` does fail the suite (4 tests, exit 1), so equality is locked; the first integer above the record is not.

Fix: assert `isActionCurrent` is false at `recorded + 1`, and assert the same through `computeSiteReadiness` (required 6, on hand 0, action recorded at 5) with `state === "open"`.

### High — a known-shortfall action stays current after the stock record disappears

`tests/unit/lifecycle.test.ts:141` and `tests/unit/readiness.test.ts:433`

`isActionCurrent` does assert both directions (`tests/unit/lifecycle.test.ts:48`: null stays current only while the shortfall is still null; a record of 5 against null is false). The two callers do not. The classify test named "only" passes a null `shortfallQtyAtTime` and expects `current`. The readiness test covers unknown-to-known only. Both of these mutants left 69 tests passing (exit 0):

- `classifyActionsForList`: if `shortfallQty === null`, status is always `"current"`. Probe, action recorded at 5, shortage now unknown: status `"current"`. It should be `"earlier"`.
- `computeSiteReadiness`: after `viewActions`, force `current = true` when the shortfall is null. Probe, same shape, no stock row: `kind` `"unknown"`, `current` true, `state` `"escalated"`. It should be not current and `open`. The crew stays blocked, and the screen says the escalation still applies.

Fix: for each caller, record an action at shortfall 5, drop the stock record, and assert `earlier` / `current: false` and shortage state `open`.

### High — "a null requirement is satisfied by any offered value" is only true for a higher rating

`tests/unit/candidates.test.ts:173`

The fixture's nominated row is integrity 30 and the other row is integrity 120. Falling back to the nominated solution's integrity when `requiredIntegrityMinutes` is null still returns `ANY`, so all 69 tests passed (exit 0).

Probe: nominated integrity 120, other solution integrity 30, both insulation null, penetration requirements null. Result: `[]`. Section 6 says a null requirement is satisfied by any offered value, so `LOW` is a candidate. The same fixture does lock null insulation: `ANY` has null insulation and is accepted, so "reject every null insulation" would fail.

Fix: add a third row with integrity 30 and assert it is returned when the integrity requirement is null.

### High — the cwd test passes when the default catalogue path follows the process cwd

`tests/unit/catalogue.test.ts:82`

`loadCatalogueFromCsv()` is called with no argument and compared with an explicit `fileURLToPath` load. Vitest's cwd is the project root, and the test never changes it. Replacing the adapter default with `resolve("data/solutions-excerpt.csv")` left 69 tests passing (exit 0), including this test. Forcing the worker cwd to `/tmp` before import failed the file load with `ENOENT: open '/private/tmp/data/solutions-excerpt.csv'` (exit 1). The same mutant, cwd left as the project, passed `tests/unit/catalogue.test.ts` (18 tests, exit 0).

The implementation under review resolves the CSV from `import.meta.url` (`src/adapters/catalogue-csv.ts:8`). The test would not catch a regression to a cwd-relative default. The suite itself is not cwd-bound: from shell cwd `/`, `vitest run --root` on the copy passed 69 tests (exit 0).

Fix: in that test, `chdir` to a directory that does not contain `data/` before a fresh import of the adapter (or spawn a worker that does), and expect the default load to return 148 solutions.

### Medium — two AC 26 assertions call the same functions as the code

`tests/unit/catalogue.test.ts:55`

Inside the raw-text test, `solution.key` is compared to `normaliseText(...)` and `substrateIncomplete` to `isIncompleteSubstrate(...)`, both imported from `@/domain`. Replacing `normaliseText` with the identity function left that test passing (`vitest run tests/unit/catalogue.test.ts -t "preserves raw text"`, exit 0, 1 passed, 17 skipped). The full suite then failed 11 tests (exit 1), including AC 25 (18 codes, because `0452`/`0465` need the parenthesis rule) and the literal rows `0375`, `0452`, `0479`, `0734`, `0485`/`0970`, and `0943`. The raw-text comparisons of substrate, service type, and service size are real and would fail if those strings were rewritten. The key and incomplete-flag lines cannot fail on their own.

The count of 20 also does not move if only case-folding, only whitespace collapsing, or only the `51 mm` rule is removed (oracle). Those three are locked by the literal row tests, not by AC 25.

Fix: delete the two derived comparisons, or replace them with literals for one row that the other tests do not already pin.

### Medium — AC 6 is named, and the 422 / escalate half is not asserted

`tests/unit/readiness.test.ts:262`

The test locks `unknown_solution_code`, an empty shortage list, and `crewStatus === "blocked"`, including when a material mapping exists for the missing code. AC 6 also says wait is rejected with 422 and escalate is accepted. Nothing in `tests/unit` or `tests/data` asserts that. The domain has no accept/reject function, so this suite cannot fail if a later route allows wait on a blocker.

Fix: when the route exists, assert 422 for wait and a recorded escalate for `unknown_solution_code`. Until then, do not treat the unit test as covering that sentence.

### Medium — `classifyActionsForList` can reorder the caller's array

`tests/unit/lifecycle.test.ts:119`

`viewActions` freezes its input and asserts the original order (`tests/unit/lifecycle.test.ts:98`). `classifyActionsForList` copies with `[...actions]` and has no such assertion. Sorting the argument in place (`actions.sort(...)` instead of the copy) left 69 tests passing (exit 0). Probe input `["old", "new"]` was `["new", "old"]` after the call.

Fix: freeze the array passed to `classifyActionsForList` and assert the ids are unchanged, the same way `viewActions` does.

### Medium — padded minutes and a padded dash are untested success paths

`tests/unit/catalogue.test.ts:152`

Failure tests use `"sixty"`, `""`, `"none"`, `"Roof"`, and a deleted column. The dash success test uses `"-" ` and `"60"` with no surrounding spaces (`tests/unit/catalogue.test.ts:178`). The real CSV has no padding (oracle: no integrity or insulation cell differs from its trim). Removing `.trim()` from `parseMinutes` and `parseInsulation` left 69 tests passing (exit 0). Probe on the mutant, integrity `" 60 "`: throws `non-numeric integrity " 60 "`. The restored parser accepts `" 60 "` and stores insulation `" - "` as null.

Fix: one success row with integrity `" 60 "` and insulation `" - "`, asserting minutes 60 and null insulation.

## Acceptance criteria the named tests do not fully lock

These are the AC numbers that appear in test names. A wrong implementation of the listed clause still passes.

| AC | What is locked | What still passes if wrong |
| --- | --- | --- |
| 1 | 12+8 → required 20, on hand 15, shortfall 5, blocked, penetrations `p1, p2` | — |
| 2 | Exact cover (15 = 15) is clear | — |
| 3 | Locations 6 and 9 sum to on hand 15 | Fractional balances (finding above) |
| 4 | 1.1+1.1 and 2.2 both required 3; 1.0000001 stays 1 | — |
| 5 | Missing stock is `unknown` with null on-hand and shortfall; a null-shortfall wait and escalate stay current and the state is escalated | A numeric action after the stock row disappears (finding above). "Wait and escalate are accepted" is not an HTTP assertion |
| 6 | Blocker `unknown_solution_code`, crew blocked, mapping ignored | Wait 422 and escalate accepted |
| 7 | Blocker `no_material_mapping`, crew blocked | — |
| 8 | No penetrations, and other sites' penetrations, are `nothing_planned` | — |
| 10 | Two separate evaluations with the same 15 on hand are each clear; the shared stock array is frozen | Screen label "on hand, shared, not reserved" |
| 14 | Escalate then a later wait stays `escalated`, both listed newest first, crew blocked | A wait with no escalation clearing the crew (finding above) |
| 15 | Recorded 5 is not current at 8; equal and one-below stay current; unknown-to-known on the predicate and on readiness | Recorded 5 at shortfall 6; known-to-unknown on the two callers |
| 18 | `0438` → exactly `0451`, `0464` in that order | — |
| 19 | `0789` → `0790`, `0791`; `0434` → `0435` | — |
| 20 | `0344` → `{ status: "ok", candidates: [] }` | The sentence "the empty state offers escalate" (no domain field holds that copy) |
| 21 | `0943` → `substrate_incomplete` and no candidates | The English sentence. Deleting the early return would fail this test, because `0943` would match `0952` |
| 22 | Null insulation is not offered: fixture returns only `OK`; on the real file, allowing it adds `0347`, `0454`, `0959` to the 20 | — |
| 25 | The set of 20 codes, order-independent | A normaliser change that does not change membership (case, plain whitespace, `51 mm`); those are locked by the literal row tests |
| 26 | 148 rows, raw field text, the six codes in order, the eight null-insulation codes in order, file sha256 | The key / `substrateIncomplete` lines (finding above); a cwd-relative default path (finding above) |

No test in this set claims AC 9, 11–13, 16, 17, 23, 24, or 27–32. Those are API, database, and UI criteria. `scripts/check-ac-coverage.mjs` counts any `AC n` mention, so a weaker test still satisfies that script.

## Verified OK

- AC 1 sums per penetration. Applying every material row to every penetration would require 40, and the test expects 20.
- AC 2 is the exact-equality boundary. One unit over (16) is clear and one unit under (14) is shortfall 1 (`tests/unit/readiness.test.ts:132`). Replacing `<=` with `<` on action currency fails 4 tests, so "no larger" equality is locked even though shortfall 6 is not.
- AC 4 distinguishes sum-then-round from round-then-sum: two installs of 1.1 expect required 3, not 4.
- AC 5 keeps a sibling material that has stock out of the shortage list, and a stock row of quantity 0 is `short`, not `unknown`.
- Unknown codes do not consume a material mapping (AC 6). A known code with no mapping is a blocker even when another code's material is fully stocked (AC 7). Other-site penetrations and other-site actions do not create a shortage or clear the site (AC 8, and the foreign actions in the AC 15 readiness case).
- Readiness freezes the input and compares it to a structured clone. `viewActions` checks that a tied `createdAt` keeps input order and does not add `current` onto the original object.
- AC 18–22 and 25 pin the right codes. The property loop would fail if a returned candidate had a lower rating, a null insulation against a stated requirement, a different orientation, or a different normalised key. Self-matches are excluded. Coarse `substrate_option` / `service_type_option` matching is rejected by the fixture at `tests/unit/candidates.test.ts:197` and would also move the set of 20 to 43 codes.
- AC 26's raw strings, the six incomplete codes, the eight null-insulation codes, and the file hash are the right values and are not computed from the production helpers. Identity normalisation fails the literal row tests and AC 25, so those rules are not only tautologies.
- `buildCatalogue` throws on a duplicate code, non-numeric integrity (including empty), non-numeric insulation, an unknown orientation, and a missing column, and it returns an empty catalogue for no rows.
- Empty and single-element inputs are covered: no penetrations, `deriveShortageState([])`, `buildCatalogue([])`, and `0434` → one candidate.
- Tests do not depend on each other. Shuffle seed 42 passed 69/69. They do not read files outside the repo; the CSV path is `import.meta.url` relative to the test or the adapter.
- No data leak is in this layer. Catalogue tests print codes and rule results, not notes from outside the fixtures.

## Commands

| Command | Exit | Result |
| --- | --- | --- |
| `node /tmp/catalogue-oracle.mjs` | 0 | Pins reproduced; unsafe candidate count 0 |
| `npx vitest run` in `/tmp/tl-review` | 0 | 6 files, 69 tests passed |
| `npx vitest run --sequence.shuffle --sequence.seed 42` | 0 | 69 passed |
| `npx vitest run --root /tmp/tl-review` from shell cwd `/` | 0 | 69 passed |
| Mutant `shortfallNow < recorded` | 1 | 4 failed, 65 passed |
| Mutant: waiting does not block the crew | 0 | 69 passed; probe `clear` / `waiting` / shortfall 10 |
| Mutant: `Math.ceil` on each stock sum | 0 | 69 passed; probe crew `clear`, no shortage, for on hand 4.2 vs required 5 |
| Mutant: `shortfallNow <= recorded + 1` | 0 | 69 passed; probe current at 6, not at 8 |
| Mutant: null shortfall ⇒ classify status `current` | 0 | 69 passed; probe `["current"]` for an action recorded at 5 |
| Mutant: readiness forces `current` when shortfall is null | 0 | 69 passed; probe `escalated`, `current: true` |
| Mutant: orientation and null integrity taken from the nominated solution | 0 | 69 passed for each mutant; probe `["FLOOR_MATCH"]` and `[]` |
| Mutant: `classifyActionsForList` sorts its argument | 0 | 69 passed; probe order `["new","old"]` |
| Mutant: `normaliseText` returns the input unchanged, test name filter `preserves raw text` | 0 | 1 passed, 17 skipped |
| Same mutant, full `vitest run` | 1 | 11 failed, 58 passed |
| Mutant: no trim on integrity or insulation | 0 | 69 passed; `" 60 "` throws |
| Mutant: default CSV path `resolve("data/solutions-excerpt.csv")` | 0 | 69 passed |
| Same mutant with worker `chdir("/tmp")` | 1 | `ENOENT` `/private/tmp/data/solutions-excerpt.csv` |
