# Code quality and security review

No Critical findings. The domain flow from penetration to shortage is short and readable, and the usual prototype-pollution keys are stored in `Map`s. The problems below are unvalidated numbers that can report the crew clear, an adapter that will load any path, a test that does not lock the safe default path, and shared writable catalogue objects.

## Findings

### 1. High — `src/domain/readiness.ts:83`

A negative or non-finite quantity can make `computeSiteReadiness` return `crewStatus: "clear"` while a positive install quantity is uncovered.

`roundUpQuantity` (`readiness.ts:31-33`) rounds to the nearest millionth and then applies `Math.ceil`. `Math.ceil` moves negatives toward zero, and `buildShortage` drops the material when `requiredQty <= onHand` (`readiness.ts:82-83`). Nothing rejects a negative `quantityPerInstall` or a non-finite stock balance before that comparison.

Evidence:

- `quantityPerInstall` `0.4` and `-0.5` for material `M`, stock `0`. The sum is about `-0.1`, `roundUpQuantity` returns `0`, and `0 <= 0`, so the shortage is omitted. Probe of `computeSiteReadiness`: `crewStatus` `"clear"`, `shortages` `[]`. The same call with only `0.4` would require `1` and block.
- `10` and `-10` of `M` with stock `0`: probe returned `"clear"` and no shortages.
- A lone `quantityPerInstall` of `-3` with stock `0`: probe returned `"clear"`.
- The same branch clears when on-hand is `Infinity`, because `1 <= Infinity` is true (`node -e`, exit 0). `stockOnHand` (`readiness.ts:45-51`) adds `quantity` with no `Number.isFinite` check.

Fix: reject a non-finite or negative `quantityPerInstall` or stock `quantity` before summing. Record a blocker for that penetration (or throw a typed error the boundary maps to "not clear"). Do not let that value reduce `requiredQty` or inflate `onHandQty`.

### 2. High — `src/adapters/catalogue-csv.ts:10`

`loadCatalogueFromCsv` reads the supplied path with `readFileSync` and parses the whole buffer, with no directory jail and no size cap. A caller-controlled path can load any file the process can read as the catalogue.

`path` is passed straight through (`catalogue-csv.ts:11`). Relative paths are resolved from `process.cwd()`, not from this module and not from `data/`. `csv-parse` is called without `max_record_size`, and the library treats that default as unlimited (`max_record_size === 0` means "do not enforce"). The default argument is safe: it is `fileURLToPath(new URL("../../data/solutions-excerpt.csv", import.meta.url))` (`catalogue-csv.ts:8`). No file under `src/app` calls this function; tests and the adapter do.

Evidence, cwd `/private/tmp`:

- `loadCatalogueFromCsv()` with no argument returned 148 solutions. The default does not follow cwd.
- `loadCatalogueFromCsv(<absolute path outside the repo>)` on a one-row CSV returned internal code `SENTINEL`.
- `loadCatalogueFromCsv("cwd-trap.csv")` returned internal code `FROMCWD` from `/tmp/cwd-trap.csv`.
- A row whose integrity cell was 2,000,000 nines was accepted. The parser did not raise `CSV_MAX_RECORD_SIZE`. That cell becomes `Infinity` (finding 5) and is then a legal candidate.

Fix: keep the module-relative default. For an explicit path, `realpath` it and require the result to stay under a fixed catalogue directory. Refuse files over a byte cap before buffering, and set `max_record_size`. A path that fails those checks must not be parsed into `Solution`s.

### 3. High — `tests/unit/catalogue.test.ts:82`

The test named "resolves the default CSV from the adapter file, not the process cwd" never changes cwd, so a default of `data/solutions-excerpt.csv` resolved from the repo root would still pass.

The body loads the default (`catalogue.test.ts:33`, while Vitest's root is the repo) and `loadCatalogueFromCsv(csvPath.pathname)` for the same file, then compares internal codes (`catalogue.test.ts:82-87`). Both calls read that file when cwd is the repo. The implementation itself is cwd-independent: from cwd `/private/tmp`, the no-argument load returned 148 rows (finding 2). This test does not lock that.

Fix: `chdir` to a directory that has no `data/solutions-excerpt.csv`, call `loadCatalogueFromCsv()` with no argument, and expect 148 solutions. A second case should show that a relative argument follows cwd, if that parameter stays public.

### 4. Medium — `src/domain/candidates.ts:34`

`findCandidates` returns the live `Solution` objects stored on the catalogue, and those fields are writable, so one assignment changes later matching.

`buildCatalogue` pushes a solution and `byCode.set`s the same object (`catalogue.ts:89-90`). `Catalogue.solutions` is a `readonly` array and `byCode` is a `ReadonlyMap` (`types.ts:20-23`), but `Solution` fields are not `readonly` (`types.ts:3-18`), and neither the array nor the objects is frozen. `ReadonlyMap` is erased at runtime.

Evidence:

- `findCandidates` for nominated `LOW` (integrity 30) returned `HIGH`. `candidate === catalogue.byCode.get("HIGH")` and `candidate === catalogue.solutions[1]` were both true.
- Setting that candidate's `integrityMinutes` to `10` left `catalogue.byCode.get("HIGH").integrityMinutes` at `10`, and the next `findCandidates` offered no one.
- Setting the catalogue object's `LOW.integrityMinutes` from `30` to `90`, then searching with nominated `HIGH` and required integrity `80`, offered `LOW`. `LOW` was below the bar before the write.
- `Object.isFrozen` was false for both the solutions array and the solution.

Input rows are not mutated, and a later readiness call builds new shortage objects. The alias is the catalogue entries and the candidate list.

Fix: in `buildCatalogue`, freeze each solution and its `key`, and freeze the `solutions` array (or copy on the way out of `findCandidates`). Mark `Solution` fields `readonly` so `candidate.integrityMinutes = ...` does not typecheck.

### 5. Medium — `src/domain/catalogue.ts:43`

A numeric cell that passes `/^\d+(?:\.\d+)?$/` and overflows to `Infinity` is stored as the rating, and `findCandidates` then treats it as meeting every finite requirement.

`parseMinutes` returns `Number(trimmed)` with no `Number.isFinite` check (`catalogue.ts:38-44`). The candidate check is `solution.integrityMinutes < requiredIntegrity` (`candidates.ts:13`). `Infinity < 240` is false, so the row stays in the list. The same parser is used for insulation.

Evidence: `buildCatalogue` on integrity `"9".repeat(400)` plus a nominated row at 60. The huge solution's `integrityMinutes` was non-finite, and `findCandidates` with required integrity `240` and insulation `60` returned `["HUGE"]`. `node -e` reported `Number("9".repeat(400))` non-finite and `Infinity < 240` false. The 2,000,000-digit cell in finding 2 was accepted by the full loader.

A finite value such as `99999` would also pass the rating check. This defect is the load succeeding on a value that is not a number of minutes.

Fix: after `Number(trimmed)`, throw if `!Number.isFinite(value)`. Do not insert that row.

### 6. Medium — `src/domain/catalogue.ts:41` and `src/adapters/catalogue-csv.ts:11`

Parser and filesystem failures put the absolute path, or the entire raw cell, on the thrown `Error`.

`readFileSync` is not wrapped, so Node's message is the one callers see. `parseMinutes`, `parseOrientation`, and the duplicate-code check interpolate the raw cell with `JSON.stringify` and no length cap (`catalogue.ts:35`, `catalogue.ts:41`, `catalogue.ts:65`).

Evidence:

- Missing file: `ENOENT: no such file or directory, open '/var/folders/.../catalogue-probe-gi7Vwb/missing.csv'`. The message contained the temp directory.
- Integrity cell `NOT-A-NUMBER-SENTINEL`: message was `non-numeric integrity "NOT-A-NUMBER-SENTINEL" for internal code "0334"`.
- An unclosed quote did not echo the cell (`CSV_QUOTE_NOT_CLOSED`, message names the line only, `raw` empty). A headerless text file failed as `missing column "Internal Code" on catalogue row 1` and the probe's sentinel was not in that message. The leak is the filesystem path and the domain numeric/orientation/duplicate messages, not every csv-parse failure.

Fix: throw a small error with a code and a short message. Say that the catalogue file was not found, without the path. Cap any quoted cell at a few dozen characters.

### 7. Low — `src/domain/normalise.ts:6`

Unit spacing is removed only for lowercase `mm`, and lowercasing happens after that, so `50 MM` does not match `50 mm`.

`normaliseText` applies `/(\d)\s+mm/g` and then `toLowerCase()` (`normalise.ts:6-7`). The spec's comparison is case-insensitive (`docs/technical-design.md` section 6, step 4). The supplied CSV has no `MM` / `Mm` token (scan of 148 rows, count 0), so this is a miss on new penetration text, not on the current file. It fails closed: the sizes do not match, so no candidate is offered.

Evidence from `normaliseText`: `50 mm` → `50mm`, `50 MM` → `50 mm`, `50MM` → `50mm`, `(51 MM )` → `(51 mm)`, `(51 mm )` → `(51mm)`. `normaliseText("50 mm") === normaliseText("50 MM")` was false.

Fix: lowercase first, or add the `i` flag to the unit pattern, then compare.

### 8. Low — `src/domain/readiness.ts:86` and `src/domain/lifecycle.ts:38`

The shortage id `` `${siteId}:${materialId}` `` is not unique once either field contains `:`, and `classifyActionsForList` keeps one shortage per id.

`computeSiteReadiness` still filters actions with `action.siteId === input.siteId` (`readiness.ts:57`) before the id lookup. A probe with site `site`, material `a:b` (id `site:a:b`) and an escalate action whose `siteId` was `site:a` left the shortage `open` with no actions. Single-site readiness does not import the other site's decision.

`classifyActionsForList` does not look at `siteId`. Two shortages that share `site:a:b` collapse in the `Map`, and the later one wins (`lifecycle.ts:38`). Probe: an action for site `site` recorded at shortfall `5`, with the matching shortage's shortfall `5` and a second shortage of shortfall `9` under the same id. The listed status was `"earlier"`. For the first shortage alone, shortfall `5` would still be current (`5 <= 5`).

Fix: build the id from encoded parts (`encodeURIComponent` of each field, or a length prefix) so the two pairs cannot share a key. When classifying, ignore an action whose `siteId` does not equal the shortage's `siteId`.

## Verified OK

- A new engineer can trace penetration plus stock to shortage in one pass. `computeSiteReadiness` filters penetrations by `siteId`, `blockersAndRequirements` checks `catalogue.byCode` then the material map, `addMaterial` sums `quantityPerInstall`, `roundUpQuantity` runs once per material, `stockOnHand` sums every location, and the shortage id selects that site's actions. Crew status is `blocked` when any shortage or blocker remains. Wait and escalate do not clear the crew. Functions stay small and there is no framework indirection.
- `src/domain/*.ts` imports only sibling domain modules and types. No `node:fs`, `next`, or `react`. `buildCatalogue` left its input row unchanged (probe). The readiness tests freeze inputs and compare them to a `structuredClone` snapshot.
- Shortage `penetrationIds` are copied (`readiness.ts:96`). `viewActions` copies each action before adding `current` (`lifecycle.ts:27-31`).
- `Map` keys `__proto__`, `constructor`, and `prototype` do not pollute `Object.prototype`. After `buildCatalogue` and a readiness call whose material id was `__proto__`, `( {}).polluted` was null, `byCode.get("__proto__")` returned that solution, and crew status was `"blocked"` with shortage material `__proto__`. csv-parse stores a `__proto__` column with `Object.defineProperty`; the row had an own property `"owned-value"`, its prototype was still `Object.prototype`, and `Object.prototype` was not polluted.
- `parse<RawCatalogueRow>` matches csv-parse's `parse<T>(..., OptionsWithColumns): T[]`. `cast` is left off, so cells stay strings. `noUncheckedIndexedAccess` is on (`tsconfig.json`). `cell()` treats a missing column as `undefined` and throws (`catalogue.ts:25-30`). Production `src/domain` and `src/adapters/catalogue-csv.ts` have no `any` and no non-null assertion. The only `as` in those files is `as const`.
- Short rows throw `CSV_RECORD_INCONSISTENT_COLUMNS` (`got 1` column on a 12-column header) and do not load. A quoted comma stayed inside `substrateDetail`. Insulation `"-"` is stored as null (the probe log printed `missing` only because of `??` on null).
- The 1e-6 dust step is intentional. `node -e` reproduced `roundUpQuantity(1.0000001) === 1` and `roundUpQuantity(2.2) === 3`, which is what `tests/unit/readiness.test.ts` locks. With on-hand `0`, required `1` does not clear.
- Performance at and past the stated size is fine. In-process timings: `buildCatalogue` of 2,000 identical-shape rows, 3.65 ms; readiness for 200 penetrations and two materials each, 0.26 ms; `findCandidates` for those 200 penetrations against the 2,000-row catalogue (399,800 matches, the heavy case), 15.09 ms. The `penetrationIds.includes` scan does not matter at 200 penetrations.
- The real excerpt has a UTF-8 BOM. The loader sets `bom: true`, and the 148-row tests pass, including column names. A Python scan found no mixed-case `mm` token in the 148 rows.
- Domain behaviour covered by the 69 passing tests and not contradicted by the probes: exact cover is clear; a missing stock row is `unknown` with null quantities, not zero; unknown codes and missing mappings block; another site's penetrations do not count; an action recorded at a smaller shortfall is not current; null insulation is not offered against a stated insulation requirement; the nominated code is excluded; incomplete substrates are excluded.

## Commands

- `npm run typecheck` in the repo. Exit 0.
- `npm run lint` (`eslint .`). Exit 0.
- `npm test` (`vitest run` with the repo config). Exit 1. Vitest could not open `node_modules/.vite-temp/...mjs` (`EPERM`). The suite did not start.
- `vitest run --config /tmp/vitest-review/vitest.config.ts` with `cacheDir` under `/tmp` and the same includes as the repo config. Exit 0. 6 files, 69 tests passed.
- Probe scripts ` /tmp/vitest-review/probe.ts` and `probe2.ts` via that Vitest runner, cwd `/private/tmp`, `--disableConsoleIntercept`. Exit 0. Results cited above.
- `node -e` rounding and `Infinity` comparisons. Exit 0. `0.4 + -0.5` rounds to required `0` and clears against on-hand `0`; `1 <= Infinity` is true; `Number("9".repeat(400))` is non-finite and is not `< 240`.
