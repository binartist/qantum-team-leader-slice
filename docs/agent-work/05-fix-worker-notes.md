# Fix notes

## Tests that failed before the fix

Run: `npm test` against the unchanged production code, after the new tests were added. Exit 1. 26 failed, 78 passed (104 tests).

- `normaliseText > treats a spaced uppercase unit as the same size`
- `buildCatalogue errors > freezes each solution, its key, the solutions array, and incompleteCodes`
- `buildCatalogue errors > throws when a numeric cell overflows instead of loading a non-finite rating`
- `buildCatalogue errors > truncates a very long bad cell in the parser error`
- `catalogue file boundaries > does not include the path when the catalogue file is missing`
- `catalogue file boundaries > refuses a catalogue file over 1 MiB`
- `findCandidates fixtures > a non-finite stated requirement returns ok with no candidates`
- `findCandidates fixtures > rejects a solution whose offered rating is not finite`
- `findCandidates fixtures > returns frozen catalogue solutions and a later search is unaffected`
- `classifyActionsForList > orders mixed timestamp formats newest first and keeps equal and unparseable timestamps in input order`
- `classifyActionsForList > does not reorder or mutate a frozen array and ignores another site`
- `fail-closed quantities > rows of 10 and -10 do not clear the crew`
- `fail-closed quantities > rows of 0.4 and -0.5 do not clear the crew`
- `fail-closed quantities > a lone negative quantity is an invalid_quantity blocker and the crew is blocked`
- `fail-closed quantities > a lone NaN quantity is an invalid_quantity blocker and the crew is blocked`
- `fail-closed quantities > a lone Infinity quantity is an invalid_quantity blocker and the crew is blocked`
- `fail-closed quantities > a mapped code with one invalid quantity contributes no requirement`
- `fail-closed quantities > unknown code beats no mapping beats invalid quantity`
- `fail-closed quantities > throws RangeError when the required quantity is not finite`
- `fail-closed quantities > Infinity stock is unknown and the crew is blocked`
- `fail-closed quantities > overflow stock is unknown and the crew is blocked`
- `fail-closed quantities > NaN stock is unknown and the crew is blocked`
- `fail-closed quantities > negative stock is unknown and the crew is blocked`
- `fail-closed quantities > one invalid stock row makes the material unknown whatever the other rows say`
- `fail-closed quantities > ten balances of 0.1 cover a requirement of 1`
- `fail-closed quantities > stock 4.2 against a requirement of 5 is short by 0.8`

## New tests that already passed

These locked behaviour the code already had. They were green on that same pre-fix run.

- AC 14: a wait with no escalation stays `waiting` and the crew stays `blocked`
- AC 15: `isActionCurrent` is false at recorded + 1, and readiness (required 6, on hand 0, recorded at 5) is `open`
- AC 15: known-to-unknown is `earlier` in `classifyActionsForList`, and readiness reports `current: false` and `open`
- `findCandidates` uses the penetration's orientation
- a null integrity requirement accepts a lower offered rating (nominated 120, other 30)
- padded integrity `" 60 "` and insulation `" - "`
- default catalogue load after `chdir` to a directory with no `data/`
- AC 26 literals for `0452` (key and `substrateIncomplete: false`) and `0955` (`substrateIncomplete: true`)

`snap-overflow stock` (a single balance of `1e308`) was added with the fix, so it was not in the pre-fix failure list.

## Departures

- Cell preview is 30 characters plus `…`, not 40. Section 3 caps a raw cell at 40. The long-cell message is then exactly 80 characters (`non-numeric integrity "NOT-A-NUMBER-XXXXXXXXXXXXXXXXX…" for internal code "0334"`). A 40-character preview makes that same sentence 90 characters.
- A finite stock sum whose 1e6 snap is not finite is `kind: "unknown"`. One balance of `1e308` is finite, and `Math.round(1e308 * 1e6) / 1e6` is `Infinity`. Treating that as on hand would clear the crew. The two-row `1e308 + 1e308` case is still the non-finite sum from section 3.
- Shortage ids stay `` `${siteId}:${materialId}` ``. `classifyActionsForList` matches on id and `siteId` by scanning, so two shortages that share an id but not a site do not collapse. The quality review's `encodeURIComponent` change was not made.

## Residuals for the orchestrator

- Docs were not edited. `invalid_quantity`, the number rules, `Date.parse` ordering, frozen solutions, the adapter errors, and the case-insensitive unit pattern are not in `docs/` yet.
- One install quantity of `1e308` is finite, so it does not throw. `roundUpQuantity` becomes `Infinity`, the shortage is `kind: "short"`, and the crew stays blocked.
- The adapter still accepts any trusted path. There is no directory jail. A missing file is caught at `statSync`. The `readFileSync` catch (stat succeeded, read failed) is not separately tested.
- Real-catalogue pins were not edited and still pass: 148 solutions, incomplete codes `0853, 0943, 0944, 0946, 0952, 0955`, null insulation `0334, 0335, 0722, 0724, 0804, 0811, 0813, 0968`, and the same 20 candidate codes.
- No `tests/unit/safety.test.ts`. The cases live in the five existing unit files.

## Gates (final tree)

- `npm run typecheck` — exit 0
- `npm run lint` — exit 0
- `npm run test:coverage` — exit 0. 6 files, 105 tests passed. `src/domain` statements 193/193, branches 134/134, functions 34/34, lines 163/163.
