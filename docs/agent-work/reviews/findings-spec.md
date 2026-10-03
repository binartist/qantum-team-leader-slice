# Spec conformance and correctness

No Critical findings. On the real catalogue and on the specification's own examples (integer quantities, shared stock, blockers, action lifecycle, the 20 candidate codes), the domain matches `docs/technical-design.md` sections 4 and 6 and the acceptance criteria that sit in this layer. The defects below are numeric and ordering holes. Three of them can clear a crew or offer a candidate that does not meet a stated rating, but only when a quantity or a rating is negative, non-finite, or not a canonical timestamp. `buildCatalogue` on `data/solutions-excerpt.csv` does not produce those values.

## Findings

### 1. High — A negative `quantityPerInstall` can cancel a real need and return `clear`

`src/domain/readiness.ts:71` (the sum) and `src/domain/readiness.ts:83` (the covered check).

The requirement is the raw sum of every `quantityPerInstall` for that material, then `Math.ceil`. A negative row is a credit. Nothing rejects it.

Failing scenario, two penetrations, stock one location at 0:

- `S1` / penetration `needs`: quantity 10 of `M`
- `S2` / penetration `credit`: quantity -10 of `M`

`computeSiteReadiness` returns `crewStatus: "clear"`, `shortages: []`, `blockers: []`. Penetration `needs` still requires 10 and nothing is on hand.

Same shape with a smaller credit: `+10` and `-3`, 7 on hand. Reported requirement is 7, 7 <= 7, crew `clear`. The positive penetration still needs 10, and 7 does not cover 10.

The written rule is "sum `quantityPerInstall`". The code does that. I think fail-closed is the right behaviour anyway: a negative quantity is not a real credit against another penetration, and technical design section 5 says missing or bad data must not show a crew as clear. The spec never says quantities are positive, so this is a hole, not a mis-reading of the sum.

Suggested fix: if any counted `quantityPerInstall` is negative or non-finite, do not add it. Raise a blocker for that penetration (or an unknown shortage) and keep the positive rows.

### 2. High — Non-finite on-hand stock satisfies `requiredQty <= onHand` and the crew is `clear`

`src/domain/readiness.ts:49` (the sum) and `src/domain/readiness.ts:83`.

`Infinity <=` comparisons are true for every finite requirement, so the material is treated as covered and no shortage is emitted.

Failing scenario: one penetration needs 5 of `M`. Two balance rows, each `1e308`. `1e308 + 1e308` is `Infinity` (`Number.isFinite` is false). `computeSiteReadiness` returns `crewStatus: "clear"` and no shortages. Passing `Infinity` directly does the same.

`NaN` stock does not clear: the crew stays `blocked`. The shape is still wrong. `NaN <= 5` is false, so a shortage is emitted with `kind: "short"`, `onHandQty: NaN`, `shortfallQty: NaN`, not `kind: "unknown"`. A `NaN` `quantityPerInstall` does the same to `requiredQty` and `shortfallQty` and also stays blocked. `JSON.stringify` turns those `NaN`s into `null`, which is easy to mistake for the unknown-stock nulls.

The spec says on hand is the sum of the balance rows, and unknown means there are no rows. It does not mention overflow. Summing two finite numbers into `Infinity` and then calling the site covered breaks the fail-closed rule. I think the safety rule is the one to follow.

Suggested fix: if any balance, or the sum, is not finite, treat that material as `kind: "unknown"` with null quantities. Do the same for a non-finite requirement. Never take the `requiredQty <= onHand` branch unless both sides are finite.

### 3. High — `NaN` ratings pass the candidate comparison, so a solution that does not meet the requirement is offered

`src/domain/candidates.ts:13` and `src/domain/candidates.ts:16-18`.

The checks are `offered < required` and `offered === null`. In IEEE, `NaN < x` is false and `NaN === null` is false, so a `NaN` offered rating is treated as good enough, and a `NaN` requirement does not reject anything.

Failing scenarios, fixture catalogue, same substrate / service / size / orientation:

- Nominated solution is 120/60. The other solution's `integrityMinutes` and `insulationMinutes` are both `NaN`. `findCandidates` returns that solution. It does not meet 120/60.
- Requirements are `NaN` / `NaN`. A solution rated 30/15 is returned.

Section 6 says integrity and insulation must be at least the requirement, and a null insulation never satisfies a stated requirement. `NaN` is not "at least 120" and it is not the specified null. The code is wrong here. The spec is right.

`buildCatalogue` cannot emit `NaN`: non-numeric integrity or insulation throws. The real file is safe. The hole is the public `findCandidates` function, which is what a nominations parser will call if it does `Number(cell)` on a blank or a dirty value (`Number(undefined)` and `Number("n/a")` are `NaN`). A stated requirement of `0` is handled correctly: null insulation is rejected (`!== null`, not a truthiness check).

Suggested fix: if a stated requirement is not finite, return no candidates. If an offered rating is not finite, reject that solution. Keep null as the only "not claimed" insulation value.

### 4. Medium — Fractional stock is not dust-guarded, so a covered material is reported short

`src/domain/readiness.ts:31-33` guards the requirement sum. `src/domain/readiness.ts:45-50` sums stock with raw `+`.

Failing scenario: required quantity 1, ten balance rows of `0.1`. Mathematical on hand is 1. The IEEE sum is `0.9999999999999999`. `1 <= 0.9999999999999999` is false, so the crew is `blocked` with `kind: "short"`, `onHandQty: 0.9999999999999999`, `shortfallQty: 1.1102230246251565e-16`.

The same ten `0.1` values on the requirement side snap back to 1 and, against a stock row of 1, the site is `clear`. The brief's `1e6` guard was applied only to the requirement. Integer examples in the spec (6 + 9 = 15, shortfall 5) are exact and are fine.

I did not find a false **clear** from ordinary decimals. A sweep of 1 to 30 additions of 0.1 through 0.9 produced no case where the mathematical sum was under the rounded requirement and the float sum was over it. `roundUpQuantity` also matched `Math.ceil` for representable `10^n + fraction` up to `10^22`. The overflow case is finding 2, not this one.

Suggested fix: round the stock sum with the same `1e6` snap before comparing and before subtracting the shortfall, so both sides share one scale.

### 5. Medium — `createdAt` is ordered as text, so mixed ISO 8601 timestamps are not newest-first

`src/domain/lifecycle.ts:5-8`, used by `viewActions` (`lifecycle.ts:28`) and `classifyActionsForList` (`lifecycle.ts:39`).

Failing scenarios, newest-first:

- `2026-10-03T00:00:00.001Z` is later than `2026-10-03T00:00:00Z`, but the list comes back `["earlier-z", "later-millis"]`. The `.` in the fractional seconds sorts before `Z`.
- `2026-10-03T12:00:00.000+02:00` is 10:00 UTC. `2026-10-03T11:00:00.000Z` is 11:00 UTC and is newer. The list comes back `["plus2-10utc", "utc-11"]`.

Section 4 and the actions list say newest first. String comparison is chronological only for one fixed format (`Date.toISOString()` is fine). Equal timestamps do keep input order: two actions at `2026-10-01T00:00:00.000Z` stay `["first", "second"]`. Shortage state does not depend on this order. Any current escalate still wins, including when a later wait is also current.

Suggested fix: compare `Date.parse` results, and treat an unparseable timestamp as a tie (or reject it at the boundary). Do not use `<` on the raw strings.

### 6. Medium — `findCandidates` returns the catalogue's own solution objects

`src/domain/candidates.ts:34`.

`filter` keeps the same object references stored on `catalogue.solutions`. Writing a field changes every later match in the process.

Failing scenario, real catalogue, penetration built from `0438` (candidates `0451` then `0464`, both integrity 60): set `result.candidates[0].integrityMinutes = 1`. The next `findCandidates` for that same penetration returns only `0464`. `0451` has been dropped because its stored rating is now 1. The reverse write (raising a weak solution's rating) would start offering it.

Readiness does not mutate a frozen input (`deepFreeze` then `computeSiteReadiness` did not throw). This leak is only on the candidate path. The spec does not require copies. It does require that a candidate meet the penetration's rating, and a shared mutable object can break that for a later call. In a long-lived server the catalogue is the obvious module-level value.

Suggested fix: return shallow copies of each matching solution. Do not hand out the objects inside `catalogue.solutions` or `byCode`.

### 7. Low — A space before `MM` is not removed, so `51 MM` does not match `51mm`

`src/domain/normalise.ts:5`.

The unit replace is `/(\d)\s+mm/g` and it runs before `toLowerCase()`. `normaliseText("51 MM")` is `"51 mm"`. `normaliseText("51mm")` is `"51mm"`. They are not equal.

The supplied CSV has no `MM`, `Mm`, or `mM` in substrate, service type, or service size (scan of all 148 rows). Lowercase `51 mm`, `(51 mm )`, and `( 1 layer 13mm)` all normalise as section 6 describes. This is a missed match, not an extra one, so it cannot suggest a bad substitute.

The code matches the brief's step order ("remove a space before `mm`, then lower-case"). Section 6 step 4 says the comparison is case-insensitive, which would also fold the unit. I think the design is the one to follow if a later file uses `MM`. I would not change it for this excerpt.

Suggested fix, if you want the design reading: lower-case first, or make the unit pattern `/(\d)\s+mm/gi`.

## Verified OK

Checked against the design and the real file, not only against the tests.

- Shortage maths for the spec's integers. Two penetrations at 10, stock 6 and 9: required 20, on hand 15, shortfall 5, id `site-a:M`, state `open`, crew `blocked`. Exact cover (15 required, 15 on hand) is `clear`. `1.1 + 1.1` is 2.2 and the required quantity is 3. Sum, then round up, not round each line.
- Stock is shared and not reserved. Sites `site-a` and `site-b` each need 10 with 15 on hand. Each call, given both penetrations, is `clear` and does not reduce the other site's stock.
- One location at quantity 0 is `kind: "short"`, on hand 0, shortfall equal to the requirement. It is not `unknown` and it is not `clear`. Unknown is only when that material has no balance rows, and then `onHandQty` and `shortfallQty` are null.
- A blocked penetration adds no requirement. An unknown code with a solution-material row of 100, plus a mapped penetration that needs 10 with 10 on hand: the 100 is ignored, there is no shortage, and the crew is `blocked` by `unknown_solution_code`. A catalogue code with no mapping is `no_material_mapping` and also blocks, even when every mapped material is covered. Blockers follow penetration order. Unknown code wins over "no mapping".
- Penetrations and actions for another site are ignored. An escalate whose `shortageId` is this site's id but whose `siteId` is the other site does not change state. No penetrations, or only another site's penetrations, is `nothing_planned`, not `clear`.
- Duplicate penetration ids are both summed (required 20 from two rows of 10 against 15 on hand, shortfall 5, crew `blocked`). The id is listed once. That fails closed. It does not clear a short site.
- A mapped quantity of 0 with no stock row is an unknown shortage and the crew is `blocked`. That matches "no stock record is unknown" with no `required > 0` exception. It does not clear.
- Action lifecycle. Escalate then wait, both recorded at shortfall 8, now 8: state `escalated`, both actions listed newest first, both `current`, crew stays `blocked`. Escalate recorded at 5, then a wait recorded at 8, now 8: the escalate is not current and the state is `waiting`. That matches "any **current** escalation", not "the historical escalate wins after the shortfall has grown". Equal shortfall and a smaller shortfall stay current. A larger shortfall does not. Null recorded against null now is current. Null against a number, and a number against null, are not. `classifyActionsForList` returns `resolved` when no current shortage has that id. `deriveShortageState([])` is `open`.
- Substitution on all 148 solutions, each penetration built from that solution's own fields and its own rating. The 20 codes with at least one candidate are exactly `0334, 0434, 0438, 0451, 0452, 0464, 0465, 0646, 0707, 0708, 0722, 0724, 0733, 0736, 0743, 0789, 0791, 0804, 0813, 0968`, in catalogue order. No rule breaks: not self, not incomplete, same orientation, same normalised substrate / service type / service size, integrity at least the requirement, and when insulation is required the offer is non-null and at least the requirement.
- The safety pairs that would be unsafe substitutes are rejected. `0347` (copper Ø100mm, 60/60) does not get `0334` (same key, insulation not claimed). `0454` (60/45) does not get `0813` (null insulation). `0959` (120/120) does not get `0804` (null). `0740` (120/120) does not get `0743` (120/60). `0964` (120/60) does not get `0968` (90, null). The other direction is allowed when the requirement is the weaker or the null rating: `0438` → `0451`, `0464`; `0434` → `0435`; `0789` → `0790`, `0791`; `0791` → `0790` only; `0790` and `0344` have none. `0722` and `0724` match each other because both requirements have null insulation, which section 6 allows.
- Incomplete substrates. Independent of the flag, the six rows whose trimmed substrate ends with a comma are `0853, 0943, 0944, 0946, 0952, 0955`, in file order. Each returns `substrate_incomplete` and no candidates. `0944` and `0946` share a normalised key and would match if the comma were stripped. Four incomplete solutions would gain a candidate (`0943`, `0944`, `0946`, `0955`). 20 + 4 = 24, which is the figure in technical design section 9. Trailing comma is not stripped: `0943`'s key is `fr plasterboard,`.
- Normalisation on the real rows. `0375` keeps the double space in raw `serviceType` and the key is `copper pipe - 50mm fibreglass`. `0452` / `0465` match once the space inside `( 1 layer 13mm)` is removed; the service is PEX-AL, not PEX, so they do not join the `0438` group. `0734`'s `(51 mm)` becomes `(51mm)` and its substrate key equals `0335`'s, but the service types differ (PVC conduit vs copper pipe), so they are not candidates. `0534` and `0535` stay different (`concrete` vs not). `Ø50mm` does not equal `50mm`. `0393` keeps the comma inside the service type; service size is `60`, integrity 90, insulation 60. No column shift.
- Catalogue load. UTF-8 BOM is present on the file. `loadCatalogueFromCsv()` and `buildCatalogue` of a `csv-parse` with `bom: true` both return 148 solutions. First code is `0334` with no BOM character. Every raw text field matches the parsed cell (0 mismatches), including substrate, service type, and service size. Null insulation is exactly the eight dash rows: `0334, 0335, 0722, 0724, 0804, 0811, 0813, 0968`. Orientations are only Wall, Floor, Ceiling. Integrity is 30, 60, 90, 120, 180, 240. Insulation is those plus 15, 45, and null.
- Matching uses the penetration's orientation, substrate, service type, and service size. It does not read `substrateOption` or `serviceTypeOption`. An incomplete catalogue row is never returned as a candidate (`substrateIncomplete`).

## Commands

- `npx vitest run --configLoader native --config /tmp/probe-vitest.config.mjs` (catalogue and edge probe): exit 0.
- Same runner on the numeric follow-up: exit 0. `node -e` check that `1e308 + 1e308` is `Infinity`: exit 0.
- `npx vitest run --configLoader native --config /tmp/unit-vitest.config.mjs`: exit 0. 6 files, 69 tests passed. Plain `npm test` exits 1 in this sandbox before any test runs (`EPERM` writing `node_modules/.vite-temp`). The suite itself passes when the Vite cache is outside the repo.
- `npx tsc --noEmit --incremental false --tsBuildInfoFile /tmp/tsconfig.tsbuildinfo`: exit 0.
- `npx eslint .`: exit 0.
