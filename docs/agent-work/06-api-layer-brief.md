# BRIEF: API layer for the team-leader slice

## 1. Role

You are the **worker** for this brief. Execute it. Do not delegate onward and do not spawn subagents (the environment sets `GROK_SUBAGENTS=0`; if a subagent tool exists anyway, do not use it). The orchestrator reviews everything you produce and runs its own gates. This brief outranks any per-turn instruction that contradicts it. Do not keep your own task ledger or `tasks/todo.md`. Durable notes go in `API-NOTES.md`. Do not run `git commit`, `git add` or any git write command: the orchestrator commits.

## 2. Facts

- Cwd is the repo root: Next.js 16.3 App Router, React 19, strict TypeScript (`noUncheckedIndexedAccess`), Vitest, Zod 4, `@supabase/supabase-js` 2. **Dependencies are installed. Do not run `npm install` and do not edit `package.json`.**
- Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run build`, `npm run check:ac`.
- Read first, in this order: `AGENTS.md`, `docs/slice-specification.md` (section 4 acceptance criteria), `docs/technical-design.md` (sections 2 to 6, 8), `docs/sample-data-and-stubs.md` (the upstream contract, sections 5 and 6), the domain code in `src/domain/*.ts` and `src/adapters/catalogue-csv.ts`, the tests in `tests/unit/`, `supabase/migrations/0001_actions.sql`, and `data/sample/*.json`.
- Next.js 16 changed APIs. Before writing a route handler read the installed docs under `node_modules/next/dist/docs/01-app/` for route handlers and dynamic routes. In particular dynamic `params` is a **Promise** in handler context. Verify against the installed version, not memory.
- The domain core exists and is accepted: 105 tests, 100% coverage. Do not weaken any existing test.
- `src/domain/` stays pure (ESLint enforces it). Never modify `data/solutions-excerpt.csv`.
- The catalogue has 148 rows. Sample data is invented and labelled. Only `nominatedCode` values are real catalogue codes, plus the deliberate missing code `9999`.

## 3. Decisions already made (do not relitigate)

| Topic | Decision |
| --- | --- |
| Layers | `src/ports` (interfaces, Zod schemas, errors), `src/adapters` (stub, supabase, memory), `src/application` (use cases, pure orchestration), `src/server` (composition root, env, identity, logging), `src/app/api/**` (thin route handlers) |
| Route prefix | All endpoints live under `/api`. Paths below are relative to it |
| Upstream | Four ports: sites, nominations, stock, solution-materials. Stubs read the JSON in `data/sample` by static `import`, and validate with the Zod schemas in `docs/sample-data-and-stubs.md` section 5 |
| Schemas | Structure strict (missing field, wrong type or bad id means `UpstreamError` `upstream_invalid`). Values lenient on sign: negative quantities pass through so the domain's fail-closed rules apply. Numbers must be finite. Unknown extra fields are ignored. Ids match `/^[A-Za-z0-9._-]+$/` and are 1 to 64 characters, so no `:` |
| Reads by id | Stock is requested by material ids, solution-materials by codes |
| Actions store | Interface `ActionsRepository`. In-memory implementation for tests and local dev. Supabase implementation for the deployed app. Selected by env `ACTIONS_STORE` (`memory` or `supabase`). In production (`NODE_ENV === "production"`) anything other than a working `supabase` configuration fails closed with a 500 `internal_error`. It never silently falls back to memory |
| Identity | Demo identity from env `DEMO_USER_ID` (default `demo-leader`), read on the server only, behind one function `getCurrentUser()` so real auth can replace it. `createdBy` always comes from there and never from the request |
| Idempotency | Every POST requires `Idempotency-Key` (1 to 128 chars of `[A-Za-z0-9._-]`). Missing or invalid is 400 `idempotency_key_required`. Unique per `(createdBy, key)`. A repeat returns the original record with 200 and creates nothing. The first call returns 201. A repeat with a different body still returns the original (rejecting that is a production item) |
| Errors | One shape `{ "code": string, "message": string }`. Never a stack, path, SQL or row content. Unknown errors are 500 `internal_error` with a generic message. `UpstreamError` is 502 with its code (`upstream_unavailable` or `upstream_invalid`) |
| Caching | Every API response sends `Cache-Control: no-store` |
| Limits | Request body over 10,000 bytes is 413 `payload_too_large`. Invalid JSON is 400 `invalid_json`. Schema failure is 422 `validation_failed` and names only the failing field paths, never the submitted values. `note` and `reason` are at most 500 characters |
| Fail closed | An upstream failure while computing readiness never yields `clear`. It is a 502 for the readiness endpoint. In the site list a failing site gets crew status `unavailable` |
| Substitute wording | The API returns the constant notice `"Catalogue match, not verified"` with candidates. It never uses "compatible" or "approved". The proposal status is always `proposed` |
| Shared stock wording | The readiness response carries `stockNotice: "On hand, shared, not reserved"` |
| Domain changes | Allowed and listed in section 5. Keep every existing domain test green and 100% coverage on `src/domain` |
| Docs | Do not edit anything under `docs/`. The orchestrator updates them from your `API-NOTES.md` |

## 4. Files

**Create:**

```text
src/ports/schemas.ts        Zod schemas and inferred types for the upstream contract
src/ports/errors.ts         UpstreamError, AppError subclasses
src/ports/index.ts          port interfaces, re-exports
src/adapters/stub/index.ts  makeStubs(options) with modes normal|down|empty|malformed per port
src/adapters/memory/actions-repository.ts
src/adapters/supabase/actions-repository.ts
src/application/*.ts        use cases (see section 6)
src/server/deps.ts          composition root + setDependenciesForTests
src/server/env.ts           Zod-parsed env
src/server/identity.ts      getCurrentUser()
src/server/log.ts           minimal structured logger
src/server/http.ts          shared route helpers (json responses, error mapping, body and header parsing)
src/app/api/**/route.ts     the seven route handlers in section 7
src/domain/quantities.ts    shared snap and round-up helpers extracted from readiness (behaviour unchanged)
src/domain/availability.ts  candidate availability (section 5)
tests/unit/*.test.ts        for new domain code
tests/api/*.test.ts         for ports, stubs, repositories, use cases, handlers
API-NOTES.md
```

**Edit:** `src/domain/types.ts`, `src/domain/readiness.ts`, `src/domain/lifecycle.ts` (only if needed), `src/domain/index.ts`, `next.config.ts`, and the existing tests that the domain changes force.

**Do not touch:** `docs/`, `data/`, `.github/`, `package.json`, `package-lock.json`, `supabase/`, `src/app/page.tsx`, `src/app/layout.tsx`, configs other than `next.config.ts`.

## 5. Domain additions (build these first, test first)

1. **`quantities.ts`**: move the snap and round-up helpers out of `readiness.ts` (`snapQuantity`, `roundUpQuantity`, the non-negative finite check) and import them back. No behaviour change.
2. **Blockers become actionable.** Extend `Blocker` in `types.ts`:

```ts
export interface Blocker {
  id: string;                    // `${siteId}:blocker.${penetrationId}`
  reason: BlockerReason;
  penetrationId: string;
  internalCode: string;
  state: ShortageState;          // via deriveShortageState over its actions
  actions: ShortageActionView[]; // newest first
}
```

   Actions attach to a blocker when `action.siteId === input.siteId` and `action.shortageId === blocker.id`. A blocker's recorded shortfall is always null, so an action is current exactly when `shortfallQtyAtTime === null`. Update the readiness tests that compare blockers. Add tests: escalate on a blocker makes it `escalated`, crew stays `blocked`, an action for another site does not attach.
3. **`availability.ts`**:

```ts
export type AvailabilityStatus = "in_stock" | "short" | "unknown";
export interface MaterialLine { materialId: string; quantityPerInstall: number; requiredQty: number; onHandQty: number | null; status: AvailabilityStatus }
export type CandidateOverall = "in_stock" | "short" | "unknown" | "no_material_mapping" | "invalid_quantity";
export interface CandidateAvailability { internalCode: string; overall: CandidateOverall; lines: MaterialLine[] }
export function describeCandidateAvailability(internalCode: string, solutionMaterials: readonly SolutionMaterial[], stock: readonly StockBalance[]): CandidateAvailability;
```

   Rules: no rows for the code gives `no_material_mapping` with no lines. Any row negative or not finite gives `invalid_quantity` with no lines. Otherwise one line per row: `requiredQty` is the row's quantity rounded up, `onHandQty` is computed exactly as in readiness (sum of rows snapped, `null` when no rows or any invalid or non-finite row), `status` is `unknown` when `onHandQty` is null, `in_stock` when `requiredQty <= onHandQty`, else `short`. `overall`: any `short` gives `short`, else any `unknown` gives `unknown`, else `in_stock`. Lines in input order.

## 6. Ports and use cases

```ts
// src/ports/index.ts
export interface Site { id: string; name: string; reference: string; address?: string }
export interface Material { id: string; name: string; unit: string }
export interface SitesPort { listSites(): Promise<Site[]>; getSite(siteId: string): Promise<Site | null> }
export interface NominationsPort { getNominations(siteId: string): Promise<NominatedPenetration[] | null> } // null = unknown site
export interface StockPort { getStock(materialIds: readonly string[]): Promise<{ asOf: string; balances: StockBalance[] }> }
export interface SolutionMaterialsPort { getSolutionMaterials(codes: readonly string[]): Promise<{ materials: Material[]; items: SolutionMaterial[] }> }
export interface NewShortageAction { siteId; shortageId; kind; escalateTo; note; shortfallQtyAtTime; createdBy; idempotencyKey }
export interface SubstitutionProposal { id; siteId; penetrationId; fromInternalCode; toInternalCode; reason; status: "proposed"; createdBy; createdAt }
export interface NewSubstitutionProposal { siteId; penetrationId; fromInternalCode; toInternalCode; reason; createdBy; idempotencyKey }
export interface ActionsRepository {
  appendShortageAction(input: NewShortageAction): Promise<{ record: ShortageAction; created: boolean }>;
  appendSubstitutionProposal(input: NewSubstitutionProposal): Promise<{ record: SubstitutionProposal; created: boolean }>;
  listShortageActions(siteId: string): Promise<ShortageAction[]>;
  listSubstitutionProposals(siteId: string): Promise<SubstitutionProposal[]>;
}
```

`NominatedPenetration` is the domain `Penetration` plus display fields `floor` and `location`. Put `SubstitutionProposal` in `src/domain/types.ts`; ports re-export it.

`src/application` takes a `Dependencies` object (ports, catalogue, repository, `now(): Date`, `newId(): string`) so tests inject fakes. Use cases:

- `listSites(deps)` returns each site with `crewStatus` (`clear | blocked | nothing_planned | unavailable`). Compute per site in parallel, catching any failure to `unavailable`.
- `getSiteReadiness(deps, siteId)`: unknown site is `AppError` 404 `site_not_found`. Flow: nominations, then codes, then solution-materials for those codes, then material ids from the items, then stock for those ids, then the repository's shortage actions for the site, then `computeSiteReadiness`. Returns the `SiteReadiness` plus `stockNotice`, `stockAsOf`, `materials` (id to `{ name, unit }`, for materials that appear in shortages), and `penetrations` (id to `{ floor, location, nominatedCode }`, for penetrations that appear in shortages or blockers).
- `recordWait(deps, input)` and `recordEscalation(deps, input)`: compute readiness, find the target. Not found: 404 `shortage_not_found`. `wait` on a blocker id: 422 `wait_not_allowed_for_blocker`. `escalate` is allowed for shortages (including `kind: "unknown"`) and blockers. `shortfallQtyAtTime` is the shortage's `shortfallQty` (null for unknown shortages and blockers). Returns `{ record, created }`.
- `listCandidates(deps, siteId, penetrationId)`: 404 `site_not_found` or `penetration_not_found`. Returns `{ penetrationId, nominatedCode, status, notice, candidates }`, where each candidate has `internalCode, supplierRefCode, serviceType, serviceSize, integrityMinutes, insulationMinutes, availability` (from `describeCandidateAvailability`, using solution-materials and stock for the candidate codes) and `materials` names for the lines.
- `proposeSubstitution(deps, input)`: site and penetration 404 as above. `fromInternalCode` must equal the penetration's `nominatedCode`, else 409 `stale_nomination`. `toInternalCode` must be among the current candidates (status `ok`), else 422 `not_a_candidate`. Then `appendSubstitutionProposal`. Never changes anything else.
- `listActions(deps, siteId)`: returns `{ actions, proposals }`. Actions come from `classifyActionsForList` (status `current | earlier | resolved`) using current shortages **and blockers** (map blockers into the lookup so a blocker escalation is `current`), newest first. Proposals are newest first.

Application code throws `AppError` subclasses with `status` and `code`. Route handlers map them. Use cases never import Next.js.

## 7. Routes

Under `src/app/api`. Each file exports `dynamic = "force-dynamic"` and `runtime = "nodejs"`, delegates immediately to shared helpers, and contains no business logic.

| Method and path | Use case | Success |
| --- | --- | --- |
| `GET /api/sites` | `listSites` | 200 `{ sites }` |
| `GET /api/sites/[id]/readiness` | `getSiteReadiness` | 200 |
| `POST /api/sites/[id]/shortages/[shortageId]/wait` | `recordWait` | 201 or 200 on a repeat |
| `POST /api/sites/[id]/shortages/[shortageId]/escalate` | `recordEscalation` | 201 or 200 |
| `GET /api/sites/[id]/penetrations/[pid]/substitution-candidates` | `listCandidates` | 200 |
| `POST /api/sites/[id]/penetrations/[pid]/substitutions` | `proposeSubstitution` | 201 or 200 |
| `GET /api/sites/[id]/actions` | `listActions` | 200 |

- Request bodies: wait `{ note?: string }`. Escalate `{ escalateTo: "purchasing" | "warehouse", note?: string }`. Substitution `{ fromInternalCode: string, toInternalCode: string, reason: string }` (reason 1 to 500 characters). Reject unknown fields with 422.
- Path ids are validated with the same id schema. A shortage id contains `:` and arrives URL-encoded (`site-b%3AMAT-SEALANT`). Handle both encoded and decoded forms and prove it with a test. Blocker ids (`site-c:blocker.pen-c-03`) work the same way.
- Order of checks in a POST: path ids, `Idempotency-Key`, body size, JSON, schema, then the use case.
- Malformed or unknown ids are 404 `site_not_found` and similar, never a 500.

## 8. Adapters

- **Stubs** (`src/adapters/stub`): `makeStubs(options?)` returns the four ports. Per-port mode: `normal`, `down` (throws `UpstreamError` `upstream_unavailable`), `empty` (valid but empty), `malformed` (data that fails the schema, so validation throws `upstream_invalid`). `getNominations` returns `null` for a site id not in the data. `getStock` returns only requested materials. `getSolutionMaterials` returns only requested codes plus the materials those items reference. Every response is validated with the Zod schemas before use. Error messages carry a code and the system name only.
- **In-memory repository**: honours idempotency per `(createdBy, key)`, assigns ids via an injected `newId` and timestamps via an injected `now`, and returns records newest first.
- **Supabase repository** (`src/adapters/supabase/actions-repository.ts`): `createSupabaseActionsRepository({ url, serviceKey })` using `createClient(url, serviceKey, { auth: { persistSession: false } })`. Map between rows (`snake_case`, see `supabase/migrations/0001_actions.sql`) and domain records with exported **pure** functions that you unit-test. Parse every returned row with Zod. On a unique violation (Postgres code `23505`) on `(created_by, idempotency_key)`, select and return the existing record with `created: false`. Any other client error becomes `UpstreamError` `upstream_unavailable` for system `actions_store`, with no message from the client in it. The service key is read only in `src/server`, never in a module a client component can import.
- **Composition root** (`src/server/deps.ts`): builds dependencies once and caches them. The catalogue is loaded with `loadCatalogueFromCsv(path.join(process.cwd(), "data", "solutions-excerpt.csv"))`, a trusted path. Export `setDependenciesForTests(deps | null)`.
- **Vercel file tracing**: the CSV is read at runtime, so serverless output must include it. Add `outputFileTracingIncludes` for `/api/**/*` containing `./data/solutions-excerpt.csv` in `next.config.ts`. After `npm run build`, **prove** it: find the `.nft.json` trace files under `.next/server/app/api` and show that the CSV appears in them. Record the command and result in `API-NOTES.md`.
- **Env** (`src/server/env.ts`): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ACTIONS_STORE` (default `memory` outside production), `DEMO_USER_ID` (default `demo-leader`). Validate with Zod. Never log or return values.
- **Logger**: `log(event, fields)` writes one JSON line with only an event name and short codes or ids. Never notes, reasons, request bodies, keys or error messages from upstream.

## 9. Method (test first, in this order)

1. Domain additions (section 5) with tests in `tests/unit`. Confirm new tests fail first.
2. `ports/schemas.ts`, errors, stubs, with tests in `tests/api` including the contract tests below.
3. In-memory repository, then the shared contract suite, then the Supabase repository mapping tests.
4. Use cases with injected fakes.
5. Route handlers, `server/` helpers, and handler tests that call the exported `GET` and `POST` functions directly with `Request` objects and `{ params: Promise.resolve({ ... }) }`, using `setDependenciesForTests` with the stubs and the in-memory repository.
6. `next.config.ts` tracing, build, and the trace proof.

Name tests with the AC numbers they cover (for example `it("AC 13: ...")`). Cover at least:

- **AC 5, 6 (HTTP half):** wait and escalate are accepted for an unknown-stock shortage. For `unknown_solution_code`, wait is 422 `wait_not_allowed_for_blocker` and escalate is accepted.
- **AC 9:** stock stub `down` returns 502 `upstream_unavailable` from the readiness endpoint and never `clear`. `malformed` returns 502 `upstream_invalid`. In the site list a failing site is `unavailable` while others still resolve.
- **AC 10:** readiness carries `stockNotice`. Sites A and B computed independently show A `clear` and B `blocked` (shared stock).
- **AC 11, 12, 13:** 201 and state `waiting`, crew still `blocked`. `escalateTo` missing or invalid is 422. A shortage that does not exist is 404 `shortage_not_found`.
- **AC 16:** a repeat with the same key returns the original with 200 and one stored row. Missing key is 400. The same key for a different user creates a new record.
- **AC 17:** a note over 500 characters is 422. A body over 10,000 bytes is 413.
- **AC 23, 24:** non-candidate `to` is 422 `not_a_candidate`. `from` not equal to the nomination is 409 `stale_nomination`. A successful proposal is `proposed`, stores the reason, and leaves readiness unchanged.
- **AC 27 (contract):** every sample JSON file validates against its schema. Every nominated code exists in the catalogue except `9999`. Every penetration's `siteId` equals the key it sits under. Every mapped `materialId` exists in `materials`. No id contains `:`.
- **AC 28:** a static test that no file with `"use client"` imports from `src/server`, `src/adapters` or `src/ports`, that no `NEXT_PUBLIC_` variable holds a secret name, and, when `.next/static` exists, that its contents contain neither `SUPABASE_SERVICE_KEY` nor `service_role`.
- **AC 29:** `Cache-Control: no-store` on every API response, including errors.
- **Scenario test:** the outcomes in `docs/sample-data-and-stubs.md` section 4 hold through the HTTP handlers: site A clear, site B blocked with sealant short 2 and collar-25 short 2, site C blocked with `unknown_solution_code`, `no_material_mapping` and an unknown mastic shortage, site D `nothing_planned`. Candidates for `0438` are `0451` and `0464` with availability `in_stock` and `no_material_mapping`.
- **Errors:** no response body for any failure contains a stack, a file path, `node_modules`, SQL, or the submitted `reason` or `note`. Test this with a forced internal error.
- **Production guard:** with `NODE_ENV=production` and no Supabase configuration, requests return 500 `internal_error`, not memory-backed data.
- **Encoding:** a shortage id sent as `site-b%3AMAT-SEALANT` and as `site-b:MAT-SEALANT` both work.
- **Repository contract suite**: one function taking a factory, run against the in-memory repository. Add the Supabase variant guarded by `it.skipIf(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)` so it runs only when a test project is configured.

## 10. Verification (run before finishing, record in `API-NOTES.md`)

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run check:ac
```

All except `check:ac` must exit 0. `check:ac` must list **only** AC 30, 31 and 32 as missing (those are UI criteria for a later brief). Coverage on `src/domain` stays at 100% (floor 95%). Do not change thresholds or configs other than `next.config.ts`. No `any`, `@ts-ignore` or `eslint-disable`. After `npm run build`, also start the app (`npm run start` in the background on a free port), call `GET /api/sites` and `GET /api/sites/site-b/readiness` with `curl`, record the results, and stop the server. Do not leave processes running.

## 11. Honesty constraints

- Do not claim a command passed unless you ran it and saw the exit code. Paste exit codes and the coverage summary in `API-NOTES.md`.
- **You cannot reach a real Supabase project.** State plainly in `API-NOTES.md` that the Supabase repository is verified only by mapping tests and the (skipped) conditional contract suite, not against a live database.
- Do not invent upstream data. Use only `data/sample`.
- If a decision in section 3 seems wrong or impossible, implement what it says and record the disagreement.
- If an expected value in this brief does not come out, do not change the expectation. Report the actual value and why.
- Do not edit docs, data, CI, `package.json`, the lockfile or the migration. If something there needs a change, record it in `API-NOTES.md`.

## 12. API-NOTES.md

Short and factual: decisions you made, departures from this brief and why, the exact response shapes you implemented for each endpoint (the orchestrator documents them), what you could not verify, ambiguities, and what the orchestrator should check.
