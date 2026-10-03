# BRIEF: domain core for the team-leader slice

## 1. Role

You are the **worker** for this brief. Execute it. Do not delegate onward and do not spawn subagents. The orchestrator reviews everything you produce and runs its own gates. This brief outranks any per-turn instruction that contradicts it. Do not keep your own task ledger or `tasks/todo.md`. Durable notes go in `NOTES.md`.

## 2. Facts

- Repo root is your cwd: a Next.js 16 + TypeScript (strict, `noUncheckedIndexedAccess`) project. Dependencies are **already installed**. Do not run `npm install`, do not scaffold, do not change `package.json`, configs or lockfile. If you believe a dependency is missing, say so in `NOTES.md`.
- Commands that work: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`.
- Read these first (they are the source of truth): `docs/slice-specification.md` (section 4 acceptance criteria), `docs/technical-design.md` (sections 4 to 6), `docs/glossary.md`, `docs/catalogue-data-model.md`, `docs/test-strategy.md`, `CLAUDE.md`.
- The catalogue is `data/solutions-excerpt.csv` (148 rows, header has a BOM; columns: `Internal Code, Supplier Ref. Code, Supplier, Orientation, Substrate, Service Classification, Service Type, Service Size, Integrity, Insulation, Service Type Option, Substrate Option`). **Never modify it.** A test pins its hash.
- `src/domain/` is pure: no imports from next, react, supabase, `node:*`, fs, path, adapters or app (ESLint enforces it). Only pure TypeScript.

## 3. Decisions already made (do not relitigate)

| Decision | Value |
| --- | --- |
| Stock | Shared, not reserved. On hand = sum of all balance rows for a material. No rows = **unknown**, never zero |
| Shortage id | `${siteId}:${materialId}` |
| Required quantity | Sum `quantityPerInstall` per material over the site's penetrations, **then** round up. Guard float noise: `Math.ceil(Math.round(sum * 1e6) / 1e6)` |
| Crew status | `nothing_planned` if no penetrations. Else `blocked` if any shortage or blocker. Else `clear`. Wait and escalate never change it |
| Blockers | Nominated code not in catalogue gives `unknown_solution_code`. Code in catalogue but with no solution-material rows gives `no_material_mapping`. A blocked penetration contributes no requirement |
| Matching basis | The **penetration's own** attributes, never `substrate_option` or `service_type_option` |
| Trailing comma | Never stripped. A substrate whose trimmed text ends with `,` is **incomplete** |
| Candidate language | Always "catalogue match, not verified". Never "compatible" or "approved" |
| Style | Match existing files. Named exports. No classes needed. No new dependencies |

## 4. Files you create (new files only)

You may only **create** these files. Do not edit any existing file. If an existing file seems wrong, record it in `NOTES.md`.

```text
src/domain/types.ts
src/domain/normalise.ts
src/domain/catalogue.ts
src/domain/readiness.ts
src/domain/lifecycle.ts
src/domain/candidates.ts
src/domain/index.ts            (re-exports the public API)
src/adapters/catalogue-csv.ts  (reads data/solutions-excerpt.csv with csv-parse; the only file here allowed node:fs)
tests/unit/normalise.test.ts
tests/unit/catalogue.test.ts
tests/unit/readiness.test.ts
tests/unit/lifecycle.test.ts
tests/unit/candidates.test.ts
NOTES.md
```

## 5. Public API (exact shapes; add nothing speculative)

### types.ts

```ts
export type Orientation = "Wall" | "Floor" | "Ceiling";

export interface Solution {
  internalCode: string;
  supplierRefCode: string;
  supplier: string;
  orientation: Orientation;
  substrateDetail: string;          // raw text as supplied, untouched
  substrateOption: string;
  serviceClassification: string;
  serviceType: string;              // raw
  serviceTypeOption: string;
  serviceSize: string;              // raw
  integrityMinutes: number;
  insulationMinutes: number | null; // "-" in the CSV becomes null
  key: { substrate: string; serviceType: string; serviceSize: string }; // normalised
  substrateIncomplete: boolean;
}

export interface Catalogue {
  solutions: readonly Solution[];
  byCode: ReadonlyMap<string, Solution>;
  incompleteCodes: readonly string[];
}

export interface Penetration {
  id: string;
  siteId: string;
  orientation: Orientation;
  substrateDetail: string;
  serviceType: string;
  serviceSize: string;
  requiredIntegrityMinutes: number | null;
  requiredInsulationMinutes: number | null;
  nominatedCode: string;
}

export interface SolutionMaterial { internalCode: string; materialId: string; quantityPerInstall: number }
export interface StockBalance { materialId: string; location: string; quantity: number }

export type ActionKind = "wait" | "escalate";
export type EscalateTo = "purchasing" | "warehouse";

export interface ShortageAction {
  id: string;
  siteId: string;
  shortageId: string;
  kind: ActionKind;
  escalateTo: EscalateTo | null;
  note: string | null;
  shortfallQtyAtTime: number | null;   // null when recorded against an unknown-stock shortage
  createdBy: string;
  createdAt: string;                    // ISO 8601
}
export interface ShortageActionView extends ShortageAction { current: boolean }

export type BlockerReason = "unknown_solution_code" | "no_material_mapping";
export interface Blocker { reason: BlockerReason; penetrationId: string; internalCode: string }

export type ShortageState = "open" | "waiting" | "escalated";
export interface Shortage {
  id: string;
  siteId: string;
  materialId: string;
  kind: "short" | "unknown";
  requiredQty: number;
  onHandQty: number | null;
  shortfallQty: number | null;
  penetrationIds: string[];
  state: ShortageState;
  actions: ShortageActionView[];        // newest first, all actions for this shortage id
}

export type CrewStatus = "clear" | "blocked" | "nothing_planned";
export interface SiteReadiness {
  siteId: string;
  crewStatus: CrewStatus;
  shortages: Shortage[];                // sorted by materialId
  blockers: Blocker[];                  // in penetration input order
  asOf: string;                         // ISO 8601, from the `asOf` input
}

export type CandidateStatus = "ok" | "nominated_code_unknown" | "substrate_incomplete";
export interface CandidateResult { status: CandidateStatus; candidates: Solution[] }
```

### normalise.ts

```ts
export function normaliseText(s: string): string;
export function isIncompleteSubstrate(raw: string): boolean;
```

`normaliseText`: (1) trim and collapse whitespace runs to one space; (2) remove whitespace just inside parentheses, so `( 1 layer 13mm)` becomes `(1 layer 13mm)` and `(51 mm )` becomes `(51mm)` after step 3; (3) remove whitespace between a digit and `mm`; (4) lower-case. It must **not** strip commas, `Ø`, or reformat sizes. `Ø50mm` and `50mm` stay different. `isIncompleteSubstrate`: trimmed text ends with `,`.

### catalogue.ts

```ts
export type RawCatalogueRow = Record<string, string>;
export function buildCatalogue(rows: readonly RawCatalogueRow[]): Catalogue;
```

Maps CSV columns to `Solution`. Preserve raw text exactly. `Integrity` parsed to number. `Insulation` `-` becomes `null`. Throw an `Error` with a clear message on: duplicate internal code, non-numeric integrity, unknown orientation, missing column. `incompleteCodes` lists internal codes whose substrate is incomplete, in input order. `key` uses `normaliseText`.

### readiness.ts

```ts
export interface ReadinessInput {
  siteId: string;
  penetrations: readonly Penetration[];
  catalogue: Catalogue;
  solutionMaterials: readonly SolutionMaterial[];
  stock: readonly StockBalance[];
  actions: readonly ShortageAction[];
  asOf: string;
}
export function computeSiteReadiness(input: ReadinessInput): SiteReadiness;
```

Only penetrations whose `siteId` equals `input.siteId` count. Only actions whose `siteId` equals `input.siteId` and whose `shortageId` matches are attached to a shortage. A material with `required <= onHand` produces no shortage. A material with no stock rows produces `kind: "unknown"` with `onHandQty` and `shortfallQty` null. Action state and `current` come from `lifecycle.ts`. Must not mutate inputs.

### lifecycle.ts

```ts
export function isActionCurrent(action: ShortageAction, shortfallNow: number | null): boolean;
export function deriveShortageState(actions: readonly ShortageActionView[]): ShortageState;
export function viewActions(actions: readonly ShortageAction[], shortfallNow: number | null): ShortageActionView[];
export type ListedActionStatus = "current" | "earlier" | "resolved";
export function classifyActionsForList(actions: readonly ShortageAction[], shortages: readonly Shortage[]): Array<ShortageAction & { status: ListedActionStatus }>;
```

`isActionCurrent`: true iff (`shortfallQtyAtTime === null` and `shortfallNow === null`) or (both non-null and `shortfallNow <= shortfallQtyAtTime`). `deriveShortageState`: any current escalate gives `escalated`; else any current wait gives `waiting`; else `open`. `viewActions` returns newest first by `createdAt` (stable for ties, input order preserved). `classifyActionsForList`: `resolved` when no current shortage has that id; else `current` or `earlier` per `isActionCurrent`; output newest first.

### candidates.ts

```ts
export function findCandidates(penetration: Penetration, catalogue: Catalogue): CandidateResult;
```

Order of checks: (1) `nominatedCode` not in catalogue gives `nominated_code_unknown`, no candidates. (2) the penetration's substrate is incomplete gives `substrate_incomplete`, no candidates. (3) Otherwise `ok`, with every solution that satisfies **all** of: not the nominated code; `substrateIncomplete` false; same `orientation`; `key.substrate` equals `normaliseText(penetration.substrateDetail)`; `key.serviceType` equals `normaliseText(penetration.serviceType)`; `key.serviceSize` equals `normaliseText(penetration.serviceSize)`; if `requiredIntegrityMinutes !== null`, `integrityMinutes >= it`; if `requiredInsulationMinutes !== null`, `insulationMinutes !== null && insulationMinutes >= it`. A null offered insulation never satisfies a stated requirement. Return candidates in catalogue order.

### adapters/catalogue-csv.ts

```ts
export function loadCatalogueFromCsv(path?: string): Catalogue; // default: data/solutions-excerpt.csv resolved from this file, not cwd
```

Use `csv-parse/sync` with `columns: true, bom: true, skip_empty_lines: true`, then `buildCatalogue`.

## 6. Method (test first)

For each module: write the test file from the acceptance criteria and facts, **run it and see it fail**, then implement until it passes. Name tests with the AC number so a script can find them, for example `it("AC 15: an action recorded at shortfall 5 is earlier when shortfall is 8", ...)`. Use only hand-built fixtures in unit tests, except the catalogue tests which use the real CSV through the adapter.

Cover at least:

- **AC 1, 2, 3, 4, 5, 6, 7, 8:** shortage maths (20 needed vs 15 on hand, shortfall 5), covered site is clear, two locations 6 and 9 sum to 15, 2.2 rounds up to 3, unknown stock has null quantities, both blocker reasons with crew blocked, no penetrations is `nothing_planned`.
- **AC 10:** two sites each needing 10 of M with 15 on hand each compute `clear` when evaluated separately (shared, unreserved).
- **AC 14, 15:** escalate then wait stays `escalated` with both actions listed; action recorded at 5 is not current at 8, so state is `open`; unknown-to-known transition is not current; `classifyActionsForList` gives `resolved`.
- **AC 18 to 22 (real catalogue).** Build each penetration from the solution's own fields with requirements equal to its own rating (null insulation requirement stays null):
  - `0438` candidates are exactly `0451`, `0464`.
  - `0789` candidates are exactly `0790`, `0791`.
  - `0434` candidate is exactly `0435`.
  - `0344` has none (`ok`, empty).
  - `0943` gives `substrate_incomplete`.
  - A penetration nominating a code not in the catalogue gives `nominated_code_unknown`.
  - A null-insulation candidate is never offered for a stated insulation requirement (build a penetration requiring insulation 30 from a solution whose only same-key peers have null insulation, or construct a small fixture catalogue with `buildCatalogue`).
- **AC 25:** exactly **20** of the 148 solutions have at least one candidate, using the construction above and skipping incomplete solutions. Pin the 20 exactly, and assert the set of 20 internal codes equals: `0334, 0434, 0438, 0451, 0452, 0464, 0465, 0646, 0707, 0708, 0722, 0724, 0733, 0736, 0743, 0789, 0791, 0804, 0813, 0968`.
- **AC 26:** 148 solutions, raw `substrateDetail` and `serviceType` preserved byte for byte for every row (compare against the parsed CSV), exactly 6 `incompleteCodes` equal to `0853, 0943, 0944, 0946, 0952, 0955`, exactly 8 solutions with null insulation.
- **Normalisation, one case per real row:** `0375` double space in service type, `0452` and `0479` space inside brackets, `0734` `(51 mm)`, case difference, trailing comma not stripped, `Ø50mm` not equal `50mm`, `0534` and `0535` not equal after normalisation.
- **Errors:** `buildCatalogue` throws on duplicate code, bad integrity, bad orientation, missing column.
- **Purity:** inputs are not mutated (deep-freeze fixtures in at least the readiness tests).

Property checks over the real catalogue for every solution with candidates: no candidate has lower integrity than required, none has null insulation when insulation is required, none equals the nominated code, all share orientation and normalised keys.

## 7. Verification (run before you finish, record results in NOTES.md)

```bash
npm run typecheck
npm run lint
npm run test:coverage
```

All must pass. Coverage on `src/domain` must be at least 95% lines, branches, functions and statements. Do not weaken thresholds or config. Do not use `any`, `@ts-ignore` or `eslint-disable`. The lint rule that bans framework and I/O imports in `src/domain` must stay satisfied without disabling it.

## 8. Honesty constraints

- Do not invent catalogue data, products or quantities. Use only the real CSV and small test fixtures.
- Do not claim a command passed unless you ran it and saw it pass. Paste the final exit codes and the coverage table summary in `NOTES.md`.
- Do not change tests to make them pass if the test is derived from this brief. If you think the brief is wrong, implement what the brief says and record the disagreement in `NOTES.md`.
- If the 20 candidates, 6 incomplete rows or any listed expected value does not come out of your implementation, **do not adjust the expectation**. Report the actual values and the reason in `NOTES.md`.
- Do not touch `data/`, `docs/`, `src/app/`, configs, CI files, `package.json` or `package-lock.json`.

## 9. NOTES.md requirement

Write `NOTES.md` at repo root with: decisions you made, departures from this brief and why, what you could not verify, anything ambiguous in the brief, and what the orchestrator should check. Keep it short and factual.

## 10. Environment

- Sandbox is `workspace`: you can write inside this directory and temp. You cannot write to `~/.npm` or similar, which is fine because nothing needs installing.
- Network and services are not needed. Do not start servers or databases.
- If a tool fails with a permission error, do not look for a workaround outside the repo. Record it in `NOTES.md`.
