# FIX BRIEF: review fixes for the domain core

## 1. Role
You are the **worker** for this brief. Execute it. Do not delegate onward and do not spawn subagents. The orchestrator reviews everything you produce and runs its own gates. This brief outranks any per-turn instruction that contradicts it. Do not keep your own task ledger. Durable notes go in `FIX-NOTES.md`.

## 2. Facts
- Cwd is the repo root. TypeScript strict, `noUncheckedIndexedAccess`. Dependencies are installed. Do not run `npm install`. Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`.
- The domain core already exists and passes 69 tests at 100% coverage: `src/domain/{types,normalise,catalogue,readiness,lifecycle,candidates,index}.ts`, `src/adapters/catalogue-csv.ts`, tests in `tests/unit/*.test.ts`. Three independent reviewers found defects. Their evidence is in these files (read them, they are the detail behind this brief):
  - `/private/tmp/claude-501/-Users-joe-workspace-qantum-team-leader-slice/fd2e3fd1-8e45-4067-8ca8-422119e60a98/scratchpad/findings-spec.md`
  - `.../scratchpad/findings-tests.md`
  - `.../scratchpad/findings-quality.md`
- Source of truth for behaviour: `docs/slice-specification.md` section 4, `docs/technical-design.md` sections 4 to 6, and `AGENTS.md`. Original API shapes are in `BRIEF.md`.
- `src/domain/` stays pure (no framework, database, fs, adapters). Never modify `data/solutions-excerpt.csv`.

## 3. Decisions already made (do not relitigate)

| Topic | Decision |
| --- | --- |
| Fail closed | Bad numbers must never produce `clear`, a covered shortage, or a candidate |
| New blocker reason | Add `"invalid_quantity"` to `BlockerReason` in `types.ts` |
| Invalid solution-material quantity | A row with `quantityPerInstall` negative or not finite makes every penetration nominating that code a blocker `invalid_quantity` (after the existing checks: unknown code first, then no mapping, then this). That penetration contributes **no** requirement at all |
| Invalid stock | Any balance row for a material with quantity negative or not finite, or a sum that is not finite, makes that material `kind: "unknown"` (onHandQty and shortfallQty null), whatever other rows say |
| Requirement overflow | If a material's required sum is not finite, throw `new RangeError("required quantity is not finite")` |
| Stock dust | Snap the stock sum like the requirement: `Math.round(sum * 1e6) / 1e6`. Compute shortfall as `Math.round((required - onHand) * 1e6) / 1e6`. Do not ceil stock |
| Ratings | In `findCandidates`: a stated requirement (integrity or insulation) that is not finite returns `{ status: "ok", candidates: [] }`. An offered rating that is not finite is rejected. Null insulation stays the only "not claimed" |
| Timestamps | Order actions newest first by `Date.parse(createdAt)`. If either side is `NaN` or the times are equal, keep input order (stable, comparator returns 0) |
| classify | `classifyActionsForList` matches a shortage by id **and** `siteId` equality. It must not reorder or mutate the caller's array |
| Catalogue objects | `buildCatalogue` deep-freezes each `Solution` (and its `key`), the `solutions` array and `incompleteCodes`. Mark `Solution`, its `key`, `Catalogue` and other interface fields `readonly` in `types.ts` where sensible. `findCandidates` returns the frozen objects, no copying |
| Unit pattern | `normaliseText` unit regex becomes case-insensitive: `/(\d)\s+mm/gi`, and lower-casing still applies |
| Numbers | `parseMinutes` and the insulation parser throw if the value is not finite |
| Errors | Parser errors must not echo more than 40 characters of a raw cell (truncate with an ellipsis). The adapter must not put the file path in error messages: wrap read errors as `new Error("catalogue file could not be read")` |
| Adapter limits | Keep the optional `path` parameter. Add a JSDoc line: the path must be trusted, never user input. Refuse files over 1 MiB with `new Error("catalogue file is too large")` (check size before reading). Pass `max_record_size: 4096` to csv-parse |
| Shortage id | Keep `${siteId}:${materialId}`. Do not re-encode |
| Docs | Do not edit anything under `docs/`. The orchestrator updates them |

## 4. Files you may change or create
Edit: `src/domain/types.ts`, `normalise.ts`, `catalogue.ts`, `readiness.ts`, `lifecycle.ts`, `candidates.ts`, `src/adapters/catalogue-csv.ts`, and the five existing files in `tests/unit/`.
Create: `tests/unit/safety.test.ts` (optional, for cross-cutting cases) and `FIX-NOTES.md`.
Nothing else. If another file seems to need a change, record it in `FIX-NOTES.md`.

## 5. Method
Test first. For each group below, add the tests, **run them and confirm they fail against the current code**, then fix. Record in `FIX-NOTES.md` which new tests failed before the fix. Keep the existing tests green; do not weaken or delete an existing assertion unless it is one of the two tautological lines in group I. Name tests with the AC number where one applies.

### A. Fail-closed numbers (code and tests)
1. Negative quantity: rows 10 and -10 of `M`, stock 0, gives blocker `invalid_quantity` and crew `blocked`, not `clear`. Also `0.4` and `-0.5`. Also a lone `-3`. Also `NaN` and `Infinity` quantity.
2. Stock `Infinity`, stock rows `1e308 + 1e308`, stock `NaN`, stock `-5`: material is `kind: "unknown"`, crew `blocked`.
3. A mapped code with a valid row and an invalid row: blocker `invalid_quantity`, and the valid row's material is not counted for that penetration.
4. Precedence: unknown code beats no mapping beats invalid quantity.
5. Required overflow (two mapped quantities of 1e308 for one material) throws `RangeError`.
6. Stock dust: ten balances of 0.1 against required 1 is covered (`clear`, no shortage). Required 5 against stock 4.2 is `kind: "short"`, onHand 4.2, shortfall 0.8, blocked.

### B. Candidates
1. `NaN` or `Infinity` stated integrity or insulation requirement returns `ok` with no candidates. A solution whose offered rating is `NaN` or `Infinity` (build via a fixture with hand-made `Solution`s) is rejected.
2. The penetration's own orientation is used: Wall penetration, nominated solution is a Floor solution with the same normalised substrate, service and size, one Wall and one Floor match. Only the Wall one is returned.
3. Null integrity requirement is satisfied by a **lower** offered rating than the nominated solution's (nominated 120, other 30).
4. Returned candidates are frozen objects: assigning to a field throws in strict mode, and a second `findCandidates` call is unaffected.

### C. Lifecycle and readiness
1. A shortage whose only current action is a wait: `state === "waiting"` **and** `crewStatus === "blocked"`.
2. `isActionCurrent` false at `recorded + 1`, and through `computeSiteReadiness` (required 6, on hand 0, action recorded at shortfall 5): state `open`.
3. Known-to-unknown: action recorded at 5, then the stock row disappears: `classifyActionsForList` gives `earlier`, and in readiness the action has `current: false` and state `open`.
4. Mixed-format timestamps order correctly: `2026-10-03T00:00:00.001Z` is newer than `2026-10-03T00:00:00Z`; `2026-10-03T12:00:00.000+02:00` (10:00 UTC) is older than `2026-10-03T11:00:00.000Z`. Equal times and an unparseable string keep input order.
5. `classifyActionsForList` does not reorder or mutate a frozen input array, and ignores an action whose `siteId` differs from the shortage's.

### D. Normalisation
`normaliseText("51 MM")` equals `normaliseText("51mm")`, and `"(51 MM )"` equals `"(51mm)"`. Existing rule tests stay.

### E. Catalogue and adapter
1. Frozen: `Object.isFrozen` is true for each solution, its `key`, the `solutions` array, and `incompleteCodes`.
2. A numeric cell that overflows (`"9".repeat(400)`) throws instead of loading.
3. Padded cells load: integrity `" 60 "` gives 60, insulation `" - "` gives null.
4. A parser error for a very long bad cell is at most about 80 characters of message and contains the truncation marker, not the whole cell.
5. The default load works when the process cwd is a directory with no `data/`. Use `process.chdir` to a temp directory in a **separate test that restores cwd in `afterEach`** and loads the adapter with a fresh import (`vi.resetModules()` then dynamic import). It must fail if the default became cwd-relative.
6. Missing explicit path: the thrown message does not contain the path. A file over 1 MiB throws "too large" (create it under the OS temp dir and delete it afterwards).

### F. AC 26 tautologies
In `tests/unit/catalogue.test.ts` remove the two comparisons that call `normaliseText` and `isIncompleteSubstrate` to compute their expected value. Replace them with literal expectations for one row not already pinned elsewhere (for example the key and flag of `0452`: key and `substrateIncomplete` false; and `0955`: `substrateIncomplete` true).

## 6. Verification (run before finishing; record in FIX-NOTES.md)
```bash
npm run typecheck
npm run lint
npm run test:coverage
```
All must exit 0. Coverage on `src/domain` at least 95% on every measure. Do not change configs or thresholds. No `any`, `@ts-ignore`, `eslint-disable`. The previous real-catalogue pins must still hold: 148 solutions, 6 incomplete codes, 8 null insulation, exactly the 20 candidate codes in `tests/unit/candidates.test.ts`.

## 7. Honesty constraints
- Do not claim a command passed unless you ran it and saw the exit code. Paste final exit codes in `FIX-NOTES.md`.
- If a decision in section 3 seems wrong or impossible, implement what it says and record the disagreement.
- If a pinned value changes, do not edit the expectation. Report the actual value and why.
- Do not touch `docs/`, `data/`, configs, CI, `package.json`, `src/app/`.

## 8. FIX-NOTES.md
Short: which new tests failed before the fix, any departure from section 3 and why, anything you could not verify, and what the orchestrator should check.
