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
  crewStatus: "clear" | "blocked" | "nothing_planned" | "unavailable" }> }
```

`unavailable` means that site's readiness could not be computed. It is logged and never shown as clear. A failure of the sites source itself is a 502.

### `GET /api/sites/{id}/readiness`

```ts
{ siteId, crewStatus: "clear" | "blocked" | "nothing_planned",
  asOf, stockAsOf,
  stockNotice: "On hand, shared, not reserved",
  shortages: Shortage[],      // id siteId:materialId, kind short | unknown, required/onHand/shortfall, state, actions
  blockers: Blocker[],        // id, reason, penetrationId, internalCode, state, actions
  materials: Record<id, { name, unit }>,
  penetrations: Record<id, { floor, location, nominatedCode }> }
```

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
    materials: Record<id, { name, unit }> }> }
```

Candidate lines are one per material (quantities summed per material). The notice is present whatever the status. The API never says "compatible" or "approved".

### `POST .../substitutions`

Body `{ fromInternalCode, toInternalCode, reason }`. `from` must be the penetration's current nomination, else 409 `stale_nomination`. `to` must be a current candidate, else 422 `not_a_candidate`. Response `{ record, created }` with `status` always `proposed`. Nothing else changes.

### `GET .../actions`

```ts
{ actions: Array<ShortageAction & { status: "current" | "earlier" | "resolved" }>, // newest first
  proposals: SubstitutionProposal[] }                                              // newest first
```

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
| `ACTIONS_STORE` | `memory` or `supabase`. Outside production the default is `memory`. In production anything but a working `supabase` configuration returns 500, never memory |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Server-side only. In production the URL must be `https:` |
| `DEMO_USER_ID` | Demo identity, default `demo-leader` |

Config failures return a generic 500 and log one fixed reason token (`config_invalid`, `store_forbidden`, `supabase_unconfigured`, `supabase_url_insecure`), never a value.

## Known limits

- The Supabase repository has not run against a live database. It is covered by row-mapping tests, a fake store and a conditional contract suite that runs when `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set. Set `REQUIRE_SUPABASE_CONTRACT=1` to make a skipped run fail.
- No login. Anyone with the URL can add demo actions.
- `src/server/*` is not yet marked `server-only` (needs a dependency). Nothing client-side imports it today, and a test enforces that.
