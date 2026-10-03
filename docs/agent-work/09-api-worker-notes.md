# API notes

Worker notes for the orchestrator. Docs under `docs/` were not edited. No git writes. No live Supabase project was available.

## Verification

Commands run from the repo root on 2026-10-03. Exit codes are the process exit codes.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | `tsc --noEmit` clean |
| `npm run lint` | 0 | `eslint .` clean |
| `npm run test:coverage` | 0 | 12 files, 147 passed, 3 skipped |
| `npm run build` | 0 | Next.js 16.3.8, seven dynamic `/api` routes |
| `npm run check:ac` | 1 | `Acceptance criteria with no referencing test: 30, 31, 32` |

Coverage (`vitest.config.ts` include is `src/domain/**/*.ts` only; thresholds were not changed):

```text
Statements   : 100% ( 233/233 )
Branches     : 100% ( 150/150 )
Functions    : 100% ( 42/42 )
Lines        : 100% ( 191/191 )
```

The three skipped tests are the shared actions-repository contract run against `createSupabaseActionsRepository`, guarded by `it.skipIf(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)`. Both variables were unset. The Supabase repository is verified only by the pure mapping tests and a fake store (unique violation `23505` returns the existing row with `created: false`; any other client code becomes `UpstreamError` `upstream_unavailable` for system `actions_store`, with no client message). It was not run against a live database.

`tests/api/security.test.ts` was run again after the build (exit 0, 4 passed) so the `.next/static` branch of AC 28 executed. That directory had 9 files. None contained `SUPABASE_SERVICE_KEY` or `service_role`.

### File trace

`next.config.ts` sets `outputFileTracingIncludes["/api/**/*"]` to `["./data/solutions-excerpt.csv"]`.

```bash
find .next/server/app/api -name '*.nft.json' | wc -l
# 7
find .next/server/app/api -name '*.nft.json' -print0 | xargs -0 grep -l 'solutions-excerpt.csv' | wc -l
# 7
```

All seven route traces include `data/solutions-excerpt.csv`. The path is duplicated in the `files` array. The sites trace also lists a hashed copy, `assets/solutions-excerpt.1zmxeq115huv5.csv`.

### Production server

`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ACTIONS_STORE`, and `DEMO_USER_ID` were unset. `npm run start -- -p 4173` (Next sets `NODE_ENV=production`). Both calls returned 500 with `Cache-Control: no-store`:

```text
GET /api/sites
HTTP/1.1 500 Internal Server Error
cache-control: no-store
{"code":"internal_error","message":"Something went wrong."}

GET /api/sites/site-b/readiness
HTTP/1.1 500 Internal Server Error
cache-control: no-store
{"code":"internal_error","message":"Something went wrong."}
```

The server log was `{"event":"request_failed","code":"internal_error","status":500}` and nothing else about the failure. The process was stopped; port 4173 was free afterwards.

This is the production guard: with no working Supabase configuration, `buildDependencies` throws `InternalError` before constructing a memory repository. Sample outcomes (site A clear, site B blocked, and the rest of section 4) are asserted through the HTTP handlers in `tests/api/routes.test.ts` with injected stubs, not by this process.

## Response shapes

Every response, including errors, sends `Cache-Control: no-store`. Error body is only `{ "code": string, "message": string }`.

| Code | Status | Message |
| --- | --- | --- |
| `site_not_found` | 404 | `Site not found.` |
| `shortage_not_found` | 404 | `Shortage not found.` |
| `penetration_not_found` | 404 | `Penetration not found.` |
| `wait_not_allowed_for_blocker` | 422 | `Wait is not allowed for a blocker.` |
| `stale_nomination` | 409 | `The nomination has changed.` |
| `not_a_candidate` | 422 | `That solution is not a current candidate.` |
| `validation_failed` | 422 | `Invalid fields: <paths>` or `Invalid fields.` |
| `idempotency_key_required` | 400 | `Idempotency-Key is required.` |
| `payload_too_large` | 413 | `Payload is too large.` |
| `invalid_json` | 400 | `Invalid JSON.` |
| `internal_error` | 500 | `Something went wrong.` |
| `upstream_unavailable` | 502 | `<system> is unavailable.` |
| `upstream_invalid` | 502 | `<system> is invalid.` |

System tokens are fixed: `sites`, `nominations`, `stock`, `solution_materials`, `actions_store`. Validation paths come from the Zod issue path and, for unknown keys, from `unrecognized_keys` `keys`. A path that fails `/^[A-Za-z0-9._]{1,80}$/` is dropped, so a submitted value is not echoed.

### `GET /api/sites` → 200

```ts
{ sites: Array<{ id: string; name: string; reference: string; address?: string; crewStatus: "clear" | "blocked" | "nothing_planned" | "unavailable" }> }
```

`crewStatus` is the readiness status, or `unavailable` when that site's readiness throws.

### `GET /api/sites/[id]/readiness` → 200

`SiteReadiness` plus four fields. `asOf` is `deps.now()` (computation time). `stockAsOf` is the stock payload's `asOf` (`2026-10-03T08:00:00Z` in the sample).

```ts
{
  siteId: string
  crewStatus: "clear" | "blocked" | "nothing_planned"
  asOf: string
  stockNotice: "On hand, shared, not reserved"
  stockAsOf: string
  shortages: Shortage[]          // domain shape, actions newest first
  blockers: Blocker[]            // id `${siteId}:blocker.${penetrationId}`, state, actions
  materials: Record<string, { name: string; unit: string }>
  penetrations: Record<string, { floor: string; location: string; nominatedCode: string }>
}
```

`materials` lists only materials that appear on a shortage and that the solution-materials port returned. `penetrations` lists penetrations that appear on a shortage or a blocker. Names are not invented.

### `POST .../wait` and `POST .../escalate` → 201 or 200

Body `{ record: ShortageAction, created: boolean }`. 201 when `created` is true, 200 on an idempotent repeat.

`ShortageAction`: `{ id, siteId, shortageId, kind: "wait" | "escalate", escalateTo: "purchasing" | "warehouse" | null, note: string | null, shortfallQtyAtTime: number | null, createdBy, createdAt }`. The idempotency key is not on the record.

Request bodies are strict. Wait: `{ note?: string }` (max 500). Escalate: `{ escalateTo: "purchasing" | "warehouse", note?: string }`. Omitted `note` is stored as `null`. `createdBy` is `getCurrentUser().id` (`DEMO_USER_ID`, default `demo-leader`).

`shortfallQtyAtTime` is the shortage's `shortfallQty` (null for an unknown shortage and for a blocker). Wait on a blocker id is 422 `wait_not_allowed_for_blocker`. Escalate is allowed for shortages, including `kind: "unknown"`, and for blockers.

### `GET .../substitution-candidates` → 200

```ts
{
  penetrationId: string
  nominatedCode: string
  status: "ok" | "nominated_code_unknown" | "substrate_incomplete"
  notice: "Catalogue match, not verified"
  candidates: Array<{
    internalCode: string
    supplierRefCode: string
    serviceType: string
    serviceSize: string
    integrityMinutes: number
    insulationMinutes: number | null
    availability: {
      internalCode: string
      overall: "in_stock" | "short" | "unknown" | "no_material_mapping" | "invalid_quantity"
      lines: Array<{ materialId: string; quantityPerInstall: number; requiredQty: number; onHandQty: number | null; status: "in_stock" | "short" | "unknown" }>
    }
    materials: Record<string, { name: string; unit: string }>
  }>
}
```

For `pen-b-01` / `0438` the candidates are `0451` (`in_stock`) and `0464` (`no_material_mapping`). The notice is the constant above. The payload does not contain "compatible" or "approved".

### `POST .../substitutions` → 201 or 200

Body `{ record: SubstitutionProposal, created: boolean }`. `status` is always `"proposed"`. Record fields: `id, siteId, penetrationId, fromInternalCode, toInternalCode, reason, status, createdBy, createdAt`. Request: `{ fromInternalCode, toInternalCode, reason }` with `reason` length 1 to 500 and both codes length 1 to 64. Unknown fields are 422. Readiness is not modified.

### `GET .../actions` → 200

```ts
{
  actions: Array<ShortageAction & { status: "current" | "earlier" | "resolved" }>
  proposals: SubstitutionProposal[]
}
```

Both lists are newest first. Blockers are passed into `classifyActionsForList` with `shortfallQty: null`, so a blocker escalation whose `shortfallQtyAtTime` is null is `current`.

## Decisions

- Idempotency is checked inside the repository, after the use case has confirmed the target still exists. A repeat while the shortage, blocker, or nomination is still there returns the original record with 200, including when the body differs. A repeat after the target has disappeared returns 404, 409, or 422 and does not replay the stored row. The brief leaves rejecting a different body as a later production item.
- The same key for two `createdBy` values creates two rows. The same key on a shortage action and a substitution proposal is independent.
- POST check order is path ids, `Idempotency-Key`, body size, JSON, schema, then the use case. A numeric `Content-Length` over 10,000 is 413 before the body is parsed. The actual byte length is checked as well. A bad site id is 404 even when the key is missing.
- Path ids are decoded once with `decodeURIComponent`. Site and penetration ids must match `/^[A-Za-z0-9._-]{1,64}$/`. A shortage id must match `/^[A-Za-z0-9._-]{1,64}:[A-Za-z0-9._-]{1,80}$/` and start with `${siteId}:`. The second segment allows 80 characters so `blocker.` plus a 64-character penetration id fits. A bad or mismatched id is 404, not 500. `site-b%3AMAT-SEALANT` and `site-b:MAT-SEALANT` both work. A double-encoded `%253A` decodes to `%3A`, fails the pattern, and is 404. Next may already have decoded the param once; a second decode of a literal colon is a no-op.
- `getSiteReadiness` always calls solution-materials and stock, even when the code or material-id list is empty, so stock `down` is 502 and never `clear`. `listCandidates` does not call those ports when there are no candidate codes.
- Nominations stub mode `empty` is `{ bySite: {} }`. `getNominations` returns null for every id, because null means the site is not in the data. The site list then marks those sites `unavailable`. It does not mean "nothing planned". Site D is `nothing_planned` only in `normal` mode, where its key is present and the array is empty.
- `listSites` turns any per-site throw into `unavailable`. If `sites.listSites()` itself throws, the request fails (502 for an `UpstreamError`).
- In production, `ACTIONS_STORE` defaults to `supabase`. Anything other than `supabase`, or `supabase` without both URL and service key, throws `InternalError` before a memory repository is built. The failed build is not cached. Outside production the default is `memory`.
- `createdBy` comes only from `getCurrentUser()`. `escalateTo` is constrained by the HTTP schema; the use case trusts the `EscalateTo` type.
- Action ids and timestamps are assigned by the repository (`newId` / `now` injected into the memory repository, `crypto.randomUUID` / `new Date` in the composition root). Use cases do not call `deps.newId`. Readiness `asOf` uses `deps.now()`.
- Upstream Zod objects strip unknown keys. Request bodies use `z.strictObject` and reject them. Negative finite quantities pass the upstream schemas. Non-finite numbers fail them.
- The service key is read only in `src/server/env.ts` and passed into the Supabase factory from `src/server/deps.ts`. No file contains `"use client"`. The logger writes one JSON line and keeps only an event name plus short codes or ids (`siteId`, `shortageId`, `penetrationId`, `code`, `system`, `kind`, `status`, `created`).

## For the orchestrator

- `.env.example` has no `ACTIONS_STORE`. It was left unchanged because it is outside the brief's edit set. Document `memory` | `supabase`, default `memory` outside production.
- UI criteria AC 30, 31, and 32 are the only ones `check:ac` reports as missing.
- Coverage does not include `src/application`, `src/server`, `src/ports`, or `src/adapters`. The domain floor stayed at 100%.
- A live Supabase contract run needs `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`. RLS on the migration has no policies; the service role bypasses RLS, which is what the repository uses.
- `npm run start` will keep returning 500 until a real Supabase configuration is present. Do not point it at the memory store in production; that path is rejected on purpose.
