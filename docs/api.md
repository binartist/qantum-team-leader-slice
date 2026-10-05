# API reference

The app's own HTTP API, as built. Requirements are in `slice-specification.md`, design in `technical-design.md`. Everything is under `/api`. Responses are JSON with `Cache-Control: no-store`, including errors.

## Conventions

- **Identity.** One demo identity, `DEMO_USER_ID` (default `demo-leader`), set on the server. The author of every record comes from there, never from the request. A `createdBy` field in a body is rejected.
- **Idempotency.** Every POST needs `Idempotency-Key` (1 to 128 characters of `A-Z a-z 0-9 . _ -`), else 400 `idempotency_key_required`. Keys are unique per user.
  - A repeat for the **same target** returns the original record with 200 and `created: false`, even if the note or reason differs, and even if the shortage has since disappeared or the nomination changed.
  - A repeat for a **different target** is 409 `idempotency_key_reused` and stores nothing. A shortage target is site, shortage id and kind (wait then escalate is a different target). A proposal target is site and penetration.
  - A request that fails validation or a business rule stores nothing, so a later valid request with the same key succeeds.
  - Rejecting a repeat whose note or reason differs is a production item.
- **Limits.** Body at most 10,000 bytes, enforced while streaming whether or not `Content-Length` is present (413). `note` is trimmed and at most 500 characters (empty after trimming is stored as null). `reason` is trimmed and 1 to 500 characters.
- **Order of checks for a POST.** Path ids, `Idempotency-Key`, body size, JSON, schema, then the use case. A bad site id is 404 even when the key is missing.
- **Ids.** Site and penetration ids match `[A-Za-z0-9._-]{1,64}`. A shortage id is `siteId:materialId` and arrives URL-encoded (`site-b%3AMAT-SEALANT`) or plain. A blocker id is `siteId:blocker.penetrationId`. A bad or foreign id, or a bad percent-escape, is 404, never 500.
- **Upstream failures** are 502 with `upstream_unavailable` or `upstream_invalid` and the failing system name. They never produce a "clear" status.

## Endpoints

| Method and path | Purpose | Success |
| --- | --- | --- |
| `GET /api/sites` | Sites with crew status | 200 |
| `GET /api/sites/{id}/readiness` | Shortages, blockers and crew status for a site | 200 |
| `POST /api/sites/{id}/shortages/{shortageId}/wait` | Record a wait | 201, or 200 on a repeat |
| `POST /api/sites/{id}/shortages/{shortageId}/escalate` | Record an escalation | 201, or 200 |
| `GET /api/sites/{id}/penetrations/{pid}/substitution-candidates` | Catalogue-similar substitutes | 200 |
| `POST /api/sites/{id}/penetrations/{pid}/substitutions` | Record a proposed substitute | 201, or 200 |
| `GET /api/sites/{id}/actions` | Recorded actions and proposals | 200 |

### `GET /api/sites`

```ts
{ sites: Array<{ id, name, reference, address?,
  crewStatus: "clear" | "blocked" | "nothing_planned" | "unavailable",
  shortageCount: number, dataProblemCount: number }> }
```

`shortageCount` and `dataProblemCount` are always present and are 0 unless `crewStatus` is `blocked`, so the list can say why a site is blocked.

`unavailable` means that site's readiness could not be computed. It is logged and never shown as clear. A failure of the sites source itself is a 502.

### `GET /api/sites/{id}/readiness`

```ts
{ siteId, crewStatus: "clear" | "blocked" | "nothing_planned",
  asOf, stockAsOf,
  stockNotice: "On hand, shared, not reserved",
  shortages: Shortage[],      // id siteId:materialId, kind short | unknown, required/onHand/shortfall, state, actions
  blockers: Blocker[],        // id, reason, penetrationId, internalCode, state, actions
  materials: Record<id, { name, unit }>,
  penetrations: Record<id, { floor, location, nominatedCode, serviceType, serviceSize }> }
```

`serviceType` and `serviceSize` are the nomination's raw text (catalogue spacing kept); the screen collapses repeated spaces for display only.

Blocker reasons: `unknown_solution_code`, `no_material_mapping`, `invalid_quantity`. A shortage of kind `unknown` has null on hand and null shortfall.

### Wait and escalate

- Wait body `{ note? }`. Escalate body `{ escalateTo: "purchasing" | "warehouse", note? }`. Unknown fields are 422.
- The target must currently exist, else 404 `shortage_not_found`. Wait on a blocker is 422 `wait_not_allowed_for_blocker`. Escalate is allowed on shortages (including unknown-stock ones) and blockers.
- Response `{ record, created }` where `record` is `{ id, siteId, shortageId, kind, escalateTo, note, shortfallQtyAtTime, createdBy, createdAt }`. Neither action changes crew status.

### `GET .../substitution-candidates`

```ts
{ penetrationId, nominatedCode,
  status: "ok" | "nominated_code_unknown" | "substrate_incomplete",
  notice: "Catalogue match, not verified",
  candidates: Array<{ internalCode, supplierRefCode, serviceType, serviceSize,
    integrityMinutes, insulationMinutes,
    availability: { internalCode,
      overall: "in_stock" | "short" | "unknown" | "no_material_mapping" | "invalid_quantity",
      lines: Array<{ materialId, quantityPerInstall, requiredQty, onHandQty, status }> },
    materials: Record<id, { name, unit }> }>,
  penetration: { id, floor, location, serviceType, serviceSize, nominatedCode,
    requiredIntegrityMinutes: number | null, requiredInsulationMinutes: number | null } }
```

`penetration` is the summary the substitutes screen shows. `id` and `nominatedCode` repeat the top-level fields. It carries no substrate, orientation or stock.

Candidate lines are one per material (quantities summed per material). The notice is present whatever the status. The API never says "compatible" or "approved".

### `POST .../substitutions`

Body `{ fromInternalCode, toInternalCode, reason }`. `from` must be the penetration's current nomination, else 409 `stale_nomination`. `to` must be a current candidate, else 422 `not_a_candidate`. Response `{ record, created }` with `status` always `proposed`. Nothing else changes.

### `GET .../actions`

```ts
{ actions: Array<ShortageAction & { status: "current" | "earlier" | "resolved" }>, // newest first
  proposals: SubstitutionProposal[],                                               // newest first
  materials: Record<id, { name, unit }>,                                           // every material mapped to a nominated solution on the site
  penetrations: Record<id, { floor, location, nominatedCode, serviceType, serviceSize }> } // every penetration on the site
```

`materials` and `penetrations` let the log name what an action was about. They are present even when `actions` and `proposals` are empty, and they are wider than the readiness maps, which hold only current shortages and blockers.

## Errors

Every error is `{ code, message }` and nothing else: no stack, path, SQL, note or reason.

| Code | Status |
| --- | --- |
| `site_not_found`, `penetration_not_found`, `shortage_not_found` | 404 |
| `idempotency_key_required`, `invalid_json` | 400 |
| `validation_failed` (names failing fields only) | 422 |
| `wait_not_allowed_for_blocker`, `not_a_candidate` | 422 |
| `stale_nomination`, `idempotency_key_reused` | 409 |
| `payload_too_large` | 413 |
| `upstream_unavailable`, `upstream_invalid` | 502 |
| `internal_error` | 500 |

## Configuration

| Variable | Meaning |
| --- | --- |
| `ACTIONS_STORE` | `memory` or `postgres`. Outside production the default is `memory`. In production it defaults to `postgres`, and anything but a complete `postgres` configuration returns 500, never memory |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Postgres connection, server-side only. Deployed: the Supabase transaction pooler (port 6543), user `qantum_slice`, database `qantum_slice`. `DB_PORT` defaults to 5432 |
| `DB_SSL`, `DB_SSL_CA` | `require` (default: encrypted, server not authenticated, a recorded compromise because the pooler chain is not in Node's trust store), `verify-full` with a PEM CA, or `disable` (refused in production) |
| `DB_POOL_MAX` | Connections per function process, 1 to 10, default 1 (the pooler holds the real sessions) |
| `DEMO_USER_ID` | Demo identity, default `demo-leader` |
| `STUB_STOCK_MODE` | Testing only: `normal` (default), `down`, `empty` or `malformed` for the stock stub. Read outside production only, ignored in production. Used by the end-to-end stock-failure projects |

Config failures return a generic 500 and log one fixed reason token (`config_invalid`, `store_forbidden`, `db_unconfigured`, `db_tls_insecure`), never a value. A successful start logs `db_config` with host, port, user, database, TLS mode and whether a password is present, never the password.

## Known limits

- The Postgres store is proven by a contract suite against a real Postgres 17 (locally and in CI): appends, idempotent replay, ordering, constraints, and that the app role cannot update, delete, truncate or create tables. Set `REQUIRE_DB_CONTRACT=1` to make a skipped run fail.
- No login. Anyone with the URL can add demo actions.
- `src/server/*` is not yet marked `server-only` (needs a dependency). Nothing client-side imports it today, and a test enforces that.
