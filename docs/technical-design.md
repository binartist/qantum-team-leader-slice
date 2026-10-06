# Technical design

Architecture for the team-leader first slice. It builds on `slice-decisions.md` (boundary and endpoints), `business-path-data.md` (path and gaps) and `catalogue-data-model.md` (CSV). Where this file adds to those, it says so under "Additions to earlier docs".

## 1. Goal and fit

A team leader opens a site, sees what the planned penetrations need versus stock, and records one decision per shortage: **wait**, **escalate**, or **propose a substitute**. The page ends at "crew can go / crew blocked".

The slice is a small web app on the current stack. No new technology is introduced.

| Concern | Choice | Why |
| --- | --- | --- |
| UI and API | Next.js (App Router, React, TypeScript) | One deployable. Route handlers serve the endpoints in `slice-decisions.md`. Matches the web team's skills. |
| Hosting | Vercel | Already used. Preview deploy per PR. |
| Persistence | Postgres on the existing Supabase server, its own database `qantum_slice`, reached with `pg` through the Sydney transaction pooler | Already used (the same server hosts another app in its own database). Holds actions only. Supabase Auth and the Data API are not used |
| Mobile (Flutter) | Not touched | Install, pins and photos stay there. |
| Offline | Not in this slice | The leader checks before leaving, usually with signal. See section 8. |

Departure to flag: the leader app is a separate Next.js app, not a module in the existing web app. The honest reasons are that the existing web app is not available to build into for this exercise, and that a separate app can be developed, tested and deployed alone. Reading upstream over APIs does not by itself require a second deployable. The cost is a second deployable. The benefit is that the slice can be built and tested without the spec system. Folding it into the web app later is cheap because the domain core has no framework imports.

## 2. Component view

```text
Browser (React, server components + small client islands)
   |
Next.js route handlers  ── thin: parse, auth stub, call use cases, map errors
   |
Application layer (use cases)
   |  getSiteReadiness(siteId)
   |  recordWait / recordEscalation / proposeSubstitution
   |  listActions(siteId)
   |  listSubstitutionCandidates(siteId, penetrationId)
   |  listMaterialStock() / describeMaterialStock(materialId)   (pages only)
   |
Domain core (pure functions, no I/O)
   |  computeRequirements, computeShortages, applyActions,
   |  siteReadiness, findCandidates, siteMaterialNeeds
   |
Ports (interfaces)
   |  SitesPort · NominationsPort · StockPort · SolutionMaterialsPort
   |  CataloguePort · ActionsRepository
   |
Adapters
      Stub JSON (sample)      CSV catalogue      Postgres actions repo (pg)
      (swap for real HTTP      (build-time load)  (the only real DB)
       clients later)
```

Rules:

- The domain core imports nothing from Next.js, Supabase or the file system. This is what the unit tests target.
- Each upstream system sits behind one port, so replacing a stub with the real API changes one adapter and no use case.
- Route handlers contain no business logic.

## 3. Data ownership

| Data | Owner | In this app |
| --- | --- | --- |
| Solution catalogue | QAntum catalogue | Read. Loaded from the CSV into a typed in-memory map by `internal_code`. |
| Sites, penetrations, nominations | Existing spec system | Read via stub of `GET /sites`, `GET /sites/{id}/nominations`. |
| Stock balances | Upstream inventory | Read via stub of `GET /stock`. |
| Solution to material quantities | Sample (not in CSV) | Read from a clearly labelled sample file. Same port shape as a future catalogue extension. |
| Wait, escalation, substitution proposal | This app | Written to Postgres (`qantum_slice`). |

Sample data lives under `data/sample/` with a README stating it is invented. Penetrations must reference real `internal_code` values from the CSV, and a test asserts that.

## 4. Domain model

Derived, never stored:

```text
Requirement  { materialId, requiredQty, penetrationIds[] }
Shortage     { id, siteId, materialId, kind: short | unknown,
               requiredQty, onHandQty | null, shortfallQty | null,
               penetrationIds[], state, decision | null }
SiteReadiness{ siteId, crewStatus: clear | blocked | nothing_planned,
               shortages[], blockers[], asOf }
```

- `requiredQty` = sum of `quantityPerInstall` over the site's penetrations, grouped by material, snapped to 6 decimals and rounded up to whole units. A required sum that is not finite throws a `RangeError` instead of returning a result.
- `onHandQty` is snapped to the same 6 decimals before comparison (no rounding up), so decimal dust cannot create a false shortage. Stock rows that are negative or not finite, or a sum that is not finite, make the material `unknown`.
- **Stock is shared and not reserved (decision).** `onHandQty` is the sum of the material's balances across every location the leader can reach (warehouse and van). It is the same figure for every site. Two sites can therefore each look covered when together they are not. The readiness screen says "On hand, shared, not reserved" next to every figure, and over-commit across sites is a listed limitation with allocation as a later iteration.
- A `short` shortage exists when `requiredQty > onHandQty`, and `shortfallQty` is the difference.
- **Shortage id is deterministic:** `${siteId}:${materialId}`. A derived record needs a stable key so that an action recorded today can still be found tomorrow.
- **Actions have a lifecycle.** An id can reappear after a shortage ends and later returns. To avoid an old decision silently applying to a new problem:
  - An action is *current* only if the shortfall now is no larger than `shortfall_qty_at_time`. Otherwise the UI shows it as "Earlier decision, shortfall has grown" and the shortage reads `open`.
  - Every action is shown with its date and who made it, so a recurrence at the same size is visible to the leader.
- `state` is `open`, `waiting` or `escalated`, taken from current actions. If any current escalation exists the state is `escalated` even if a later wait was recorded, and both are listed. `resolved` is not a shortage state. It only appears in `GET /actions`, for actions whose shortage no longer exists.
- **Crew status is blocked while any shortage or blocker exists**, whatever its action state. Wait and escalate record intent. They do not unblock the crew. Only stock, or an approved substitution that changes the nomination upstream, does. This matches "crew stays blocked until stock changes".
- **Missing data is a first-class state, not zero.** It is never treated as zero stock or zero requirement.
  - A material with no stock record becomes a shortage of `kind: unknown` with null quantities. It is **actionable**: the leader can wait or escalate it, which is the natural way to ask the warehouse "do we have this?".
  - A nominated code with no solution-material mapping, one that is not in the catalogue, or one whose mapped quantity is negative or not finite, becomes a **blocker** with a stated reason (`no_material_mapping`, `unknown_solution_code`, `invalid_quantity`). Order of checking: unknown code, then a solution that does not fit (next bullet), then no mapping, then invalid quantity. A blocked penetration adds no requirement, so a bad value can never cancel another penetration's need. It cannot be waited on, because there is nothing to wait for. The leader can only escalate it as a data problem.
  - A nominated solution that does not fit its penetration is a blocker `solution_mismatch` (`fit.ts`). It does not fit when orientation differs, the normalised substrate, service type or size differs (same normalisation as substitute matching; a substrate cut off after the family name, on either side, never fits, because it cannot identify a build-up; blank text never matches), or a stated integrity or insulation requirement is not met (a missing insulation claim never meets one; a requirement that is not a non-negative finite number fails closed). The blocker lists the failing fields in `mismatches`. Order of checking: unknown code, then mismatch, then no mapping, then invalid quantity. Like every blocker it adds no requirement and can only be escalated.
  - A site with no nominations is `nothing_planned`, never "clear".

Stored (Postgres), append-only:

```text
shortage_action
  id uuid pk, site_id text, shortage_id text,
  kind  'wait' | 'escalate',
  escalate_to 'purchasing' | 'warehouse' null,
  note text null, shortfall_qty_at_time numeric null,   -- null for unknown-stock
  created_by text, created_at timestamptz,
  idempotency_key text,
  check ((kind = 'escalate') = (escalate_to is not null)),
  unique (created_by, idempotency_key)

substitution_proposal
  id uuid pk, site_id text, penetration_id text,
  from_internal_code text, to_internal_code text,
  reason text not null,
  status 'proposed' check (status = 'proposed'),
  created_by text, created_at timestamptz,
  idempotency_key text,
  unique (created_by, idempotency_key)
```

Design choices:

- **Append-only, latest wins.** A leader can wait, then escalate. History is kept and nothing is overwritten.
- `shortfall_qty_at_time` snapshots what the leader saw, so a later reader can tell what the decision was based on.
- No foreign keys to sites, penetrations or catalogue, because those live elsewhere. Integrity is enforced at write time by checking the upstream ports and the catalogue.
- `status` is constrained to `proposed`. This app cannot mark a substitute approved.

## 5. Interfaces

Endpoints from `slice-decisions.md`, with behaviour pinned down:

| Endpoint | Behaviour |
| --- | --- |
| `GET /sites` | App-facing proxy of the upstream `GET /sites` read in `slice-decisions.md`. |
| `GET /sites/{id}/readiness` | Addition. Returns `SiteReadiness`. This is what the main screen needs. |
| `POST /sites/{id}/shortages/{shortageId}/wait` | 404 if the shortage does not currently exist. Not allowed for blockers. Body: optional note. |
| `POST /sites/{id}/shortages/{shortageId}/escalate` | Body: `escalateTo`, `note`. 404 if no current shortage. 422 on a bad `escalateTo`. |
| `GET /sites/{id}/penetrations/{pid}/substitution-candidates` | Addition. Read-only suggestions, see section 6. |
| `POST /sites/{id}/penetrations/{pid}/substitutions` | Body: `fromInternalCode`, `toInternalCode`, `reason`. 409 if `from` is not the penetration's current nomination. 422 if `to` is not among the current candidates. |
| `GET /sites/{id}/actions` | Lists waits, escalations and proposals for the site, newest first. |

Cross-cutting:

- **Validation at the boundary** with a schema validator (Zod). Reject unknown fields and over-long notes.
- **Idempotency.** Every POST requires an `Idempotency-Key`, unique per user (`unique (created_by, key)`). The key is looked up before any business check, so a retry returns the original record even if the shortage has since resolved. A key reused for a different target (site, shortage and kind, or site and penetration) is rejected with 409. Rejecting a repeat whose note or reason differs is left to production. Full contract in `api.md`.
- **No caching.** Readiness and actions responses send `Cache-Control: no-store`, and the UI shows an "as of" time. A cached "Crew can go" after stock has fallen is the failure this design most wants to avoid.
- **Errors** use one shape: `{ code, message }`. Stack traces and internals are never returned.
- **Upstream failure** returns 502 with a clear code. The UI shows "stock unavailable" and does not show "clear". Failing safe means never showing a crew as clear on missing data.

## 6. Substitution suggestions (and why they are not approvals)

`findCandidates` returns catalogue solutions that are similar to the nominated one. It exists to save the leader time, not to decide compliance.

**Match on the penetration, not on the nominated solution.** The penetration record carries its own orientation, substrate, service type, size and required integrity and insulation (see `business-path-data.md`, section 1). Matching against those means a wrong nomination does not spread into the suggestions. The nominations stub must therefore include the two requirement fields. A null requirement is satisfied by any offered value.

A candidate must satisfy all of:

- `orientation` equal
- normalised `substrate_detail` equal (not `substrate_option`, which merges different build-ups)
- normalised `service_type` equal (not `service_type_option`, which merges sockets with pipes and blanks with "other")
- normalised `service_size` equal
- `integrity_minutes` at least the required integrity
- `insulation_minutes` at least the required insulation. A null (not claimed) never satisfies a stated requirement.
- not the currently nominated code itself

**Normalisation rule (exact).** Applied to substrate, service type and service size before comparing:

1. Trim, and collapse runs of whitespace to one space.
2. Remove whitespace just inside parentheses: `( 1 layer 13mm)` becomes `(1 layer 13mm)`.
3. Remove whitespace between a number and its unit: `51 mm` becomes `51mm`.
4. Compare case-insensitively.
5. Do **not** strip trailing commas. A substrate that is only a family name followed by a comma (`FR plasterboard,`, `Unlined Timber,`) is **incomplete**: it has no candidates and shows "Catalogue substrate incomplete". Stripping the comma would make unrelated tests look identical.

Service size formats also vary (`Ø50mm`, `80mm`, `1100x10mm`, `900mm x 50mm`). Sizes compare only after rule 1 to 4, so differently formatted sizes do not match. That is a deliberate safe miss.

**Validate on write.** Saving a proposal re-runs matching on the server. The `to` code must be among the current candidates and the `from` code must be the penetration's current nomination. The client's view is never trusted. Repeat proposals for the same penetration are allowed and listed, newest first.

**Empty state.** When there are no candidates the UI says "No catalogue match for this penetration." and, when the penetration has a data problem, adds "Escalate instead." with the escalate action (a material shortage is decided on its material page). A nominated code that is not in the catalogue says so and gives the same option. Against the supplied CSV only 20 of 148 solutions have any candidate (section 9), so this is the common case, not an edge.

Each candidate also shows whether its materials are in stock, since a substitute that needs a different missing material does not help. A material the site is already short of counts as `short` for every candidate that uses it, and one with unknown site stock counts as `unknown`, whatever one install needs. The check does not net off what the swap would free from the nominated solution: that would be a reservation model, which this slice excludes, and erring towards "short" never implies a crew can go. Material mappings for candidates are seeded in the sample data for the demo codes only. Others show "No material mapping".

How suitability and approval work:

- Every candidate is labelled **"catalogue match, not verified"**. The UI never says "compatible" or "approved".
- Matching fields are necessary, not sufficient. The CSV has no product list, installation constraints or test-report scope. A manager checks those against the supplier assessment.
- Saving writes `status = proposed` and a mandatory free-text reason. The leader can only choose a code from the catalogue, never type one.
- Approval is assumed to happen in the web app, which would then update the nomination. The brief does not show that approval queue existing, so it is a downstream dependency we do not build. Until it happens the penetration stays on its original solution and the shortage remains.

## 7. User experience

Mobile-first, because leaders are on site, but a plain responsive web page. The screens (detail in `ui-design.md`):

1. **Sites**, **Materials** and the **Actions log**, the three top-level pages, reached from a drawer menu. The landing page uses the same menu, with About this demo marked. Sites shows a status chip for each site; Materials shows each material's shared stock against every site's need; the Actions log lists every site's decisions and proposals.
2. **Site.** The planned penetrations, with filter chips for shortages, data problems and recorded decisions; a row's Escalated or Waiting chip opens its latest decision. A clear site says "Crew can go"; missing data is never shown as zero or clear.
3. **Penetration.** The nominated solution beside the penetration, field by field; each shortage as a line with this site's figures that opens its material page; substitutes, labelled not verified, with Propose; Escalate for a data problem.
4. **Material.** The shared stock once, then one section per site that plans it, where that site's shortage is waited on or escalated (choose purchasing or warehouse, add a note). A confirmation names the effect in plain words ("This does not release the crew").

Requirements: keyboard and screen-reader usable, status never conveyed by colour alone, tap targets at least 44px, and a clear error state for every call.

## 8. Non-functional decisions

| Area | Exercise | Production change |
| --- | --- | --- |
| Auth | One demo identity set on the server. No login. `created_by` is always set server-side, never taken from the request. | Supabase Auth, or the web app's session (a separate origin cannot reuse that session without SSO or a shared cookie domain). Leader role required to write. |
| DB access | A separate database `qantum_slice` on the shared server. The app connects as role `qantum_slice`, which has only `SELECT, INSERT` on the two tables, so append-only is enforced by the database; tables are owned by the admin that runs migrations. No Data API, no anon key. Credentials live in Vercel env, server-side only; a lint rule and a test keep `pg` and server code out of client bundles. TLS is `require` (encrypted, server not authenticated) because the pooler chain is not in Node's trust store; `verify-full` is supported with a CA. | Per-user JWT and RLS policies by site membership, so the database enforces access. |
| Public write abuse | Cap note and reason length. Accepted risk: anyone with the URL can add demo actions. | Authenticated users only, a dedicated database role, rate limiting and alerting. |
| Secrets | Env vars, none in the repo. `.env.example` lists names only. | Same, with a secret manager. |
| Offline | Not supported. Readiness and actions are never cached (`no-store`). | Queue writes with the idempotency key and replay. The Flutter app's sync pattern is the reference. |
| Performance | Catalogue (148 rows) is in memory. Target readiness under 1 s for a site with 200 penetrations. | Catalogue from a service with caching. |
| Audit | Append-only tables with actor and timestamp. | Feed into the golden-thread audit trail. |
| Observability | Structured logs without notes or PII. | Tracing across upstream calls, alert on upstream error rate. |

## 9. Trade-offs

- **Derived shortages vs stored.** Deriving avoids stale copies of upstream data. The cost is the deterministic-id rule and recomputation per request, which is cheap at this size.
- **Ports with stubs vs calling real APIs now.** The real APIs do not exist for this exercise. Ports keep the stubs honest and replaceable. They prove the domain logic and the contract shape, but not real latency, auth or data quality.
- **Candidates on exact fields vs the coarse options.** Exact matching shows fewer candidates and misses valid ones. That is the safer error for a compliance product, since the leader can still ask a manager. Measured on the supplied CSV (requirement assumed equal to the solution's own rating): **20 of 148 solutions (14%) have at least one candidate** under the final rules in section 6 (incomplete substrates excluded; 24 if they were wrongly allowed to match each other). The other 86% get the empty state and the escalate option. The sample nominations used for the demo are therefore chosen from the matchable set, for example `0438` (to `0451`, `0464`), `0789` (to `0790`, `0791`) and `0434` (to `0435`), and a unit test pins the 20 figure.
- **Shared, unreserved stock vs allocation.** One shared figure is simple and matches "stock balance is read-only upstream". It can over-promise across sites, so the screen says so. Allocation needs a reservation model that belongs to the inventory system, and is a later iteration.
- **Append-only vs update-in-place.** Slightly more query work to find the latest action. In return there is history and no lost decisions.
- **Separate app vs a module of the web app.** See section 1.

## 10. Test targets (detail in the test strategy)

- Unit: requirement and shortage maths, id stability, crew status, missing-data states, candidate matching (including null insulation and the coarse-field traps), CSV parsing and normalisation.
- Contract: each upstream stub validates against its schema. Sample penetrations reference real catalogue codes.
- API: validation failures, 404 for non-existent shortages, idempotent repeats, upstream failure returns 502 and never "clear".
- Database: constraints (`status = proposed`, `escalate_to` required for escalate), idempotent replay and the app role's refused update, delete, truncate and DDL, against a real Postgres 17 (podman locally, a service container in CI).
- End to end: the demo scenario, shortage to escalate to a blocked crew that stays blocked.

## 11. Additions to earlier docs

These go beyond `slice-decisions.md` and `business-path-data.md`. Confirm them before building.

1. `GET /sites/{id}/readiness`, the aggregate the main screen needs.
2. `GET .../substitution-candidates`, a read-only suggestion endpoint.
3. Deterministic shortage id `siteId:materialId`. This changes the meaning of `shortageId` in the path from an opaque stored id to a derived key.
4. Crew stays blocked after wait or escalate. Only stock or an upstream nomination change releases it.
5. Sample `solution_material` file, labelled invented, which resolves the gap noted in `slice-decisions.md`.
6. Shared, unreserved stock (decision), summed across locations. Stock is not allocated to sites.
7. Crew status is site-wide and all-or-nothing: one shortage blocks the whole site. Partial dispatch for unaffected penetrations is a later iteration.
8. `blocked` and `ready` moved from each penetration (`business-path-data.md`) to a site-level crew status. The stored crew schedule is dropped. This slice only reports blocked or clear.
9. New blocker reasons (`unknown_solution_code`, `solution_mismatch`, `no_material_mapping`, `invalid_quantity`), the `nothing_planned` status, and `unknown`-stock shortages that can be actioned.
10. Action lifecycle: an action is current only while the shortfall has not grown beyond what it was when recorded.
11. Idempotency-Key header required on every POST, unique per user.
12. Nominations stub carries required integrity and insulation per penetration, and substitution matches on the penetration's attributes.
13. Materials across sites (pages only, no API route). `listMaterialStock` and `describeMaterialStock` read every site's inputs, then the stock once for all of them, and compute each site's readiness from that one read, so the page's on-hand figure and every site's shortage agree. A listed site whose data is missing or unavailable is unchecked, never a 404. Each view makes about four upstream calls per site plus one stock read; that suits the sample's four sites, and real data at scale would want a batched or aggregate port (a known limit, like the sites list). `siteMaterialNeeds` gives each site's need for every material, short or not, by the readiness rules: a penetration that is a data problem adds no need, and the total is rounded up once per site. The across-sites total is that sum, shown as information only; each site's crew status is unchanged, because stock is shared and not reserved. A site that cannot be read is kept as unchecked: it never counts as not short, and the total is then left out. With every site unreadable the page is unavailable; a material no checked site plans is not found (`material_not_found`, 404), but with a site unchecked it is unavailable instead, since that site may plan it.
14. Actions log across sites (page only, no API route). `listAllActions` reads each site's log with `listActions`, so each site's statuses (still applies, grown, resolved) come from that site's own readiness. A site whose log cannot be read is unavailable in its section, never empty; with every site unreadable the page is unavailable. It makes one site read per listed site on each request, the same known limit as item 13. List-row decision chips need no extra read: each shortage and data problem already carries its actions, newest first, with `current` set.

## 12. Open questions

- Should a proposed substitute stop the shortage counting as blocking once approved, or only when the nomination changes upstream? This design says only on nomination change.
- Who receives escalations in practice? Purchasing and warehouse are assumed values and the exercise only records them.
- Which locations count towards "in stock" for a leader? The design sums every location the leader can reach. Confirm.
- Does a recurrence of a shortage at the same or smaller size need a fresh decision? The design shows the old action with its date and leaves the call to the leader.
