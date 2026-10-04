# UI fix notes

Worker session. E2E specs were not run. This sandbox cannot launch Chromium. `npx playwright test --list` only listed specs.

## Commands seen this turn

| Command | Exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run test:coverage` | 0 |
| `npm run build` | 0 |
| `npm run check:ac` | 0 (`All 32 acceptance criteria are referenced by tests.`) |
| `npx vitest run --sequence.shuffle --sequence.seed 7` | 0 (30 files, 269 passed, 5 skipped) |
| `npx playwright test --list` | 0 (11 tests, 4 projects) |

Coverage (`npm run test:coverage`, thresholds unchanged at 95):

```
Statements   : 100% ( 428/428 )
Branches     : 99.65% ( 292/293 )
Functions    : 100% ( 95/95 )
Lines        : 100% ( 352/352 )
```

Uncovered branch: `src/ui/decisions/api-client.ts` line 83, the empty `catch` in `noticeReplay` when a 200 body is not JSON. `src/domain/**` and `src/ui/*.ts` stayed at 100% (v8 omits fully covered files).

`node /tmp/ui-layer-probe.mjs` exited 1 on purpose. It built a temp tree, not the repo. Walker offenders: `error.tsx -> @/server/deps` via `src/app/_lib/leak-probe.ts`, `../server/deps`, and `@supabase/supabase-js`. ESLint `errorCount` 2. `leak-probe.ts` is ignored by ESLint because it is not a client entry; the walker catches that edge. The durable check is `tests/api/client-boundary.test.ts`, which passed inside the coverage run.

## New unit tests that failed first

Targeted vitest run of the new tests before the production edits (`/tmp/ui-red.json`): 20 failed, 65 passed, `success: false`. Twelve files failed to pass.

Failed:

- `tests/api/shared-store.test.ts` — "a test override set on one evaluation is what the next evaluation returns" (two different objects).
- `tests/api/stub-stock-mode.test.ts` — "down and malformed fail closed..." (stock resolved instead of rejecting).
- `tests/unit/list-actions.test.ts` — "classifies the shortage actions already loaded with the site" (expected 1 call, got 2).
- `tests/unit/ui-api-client.test.ts` — rejected fetch was not `transport_failed`; `getAnnouncement` replayed sessionStorage ("Escalation recorded"); a publish wrote sessionStorage; replay restore compared a bound fetch to the original.
- `tests/unit/ui-character-count.test.ts` — `characterCountLabel` was not a function.
- `tests/unit/ui-empty-catalogue.test.ts` — `emptyCatalogueLabel` was not a function.
- `tests/unit/ui-form.test.ts` — suite failed to load: cannot find `@/ui/decisions/form`.
- `tests/unit/ui-format.test.ts` — material line still included "(20 on hand)".
- `tests/unit/ui-messages.test.ts` — unknown code fell through to "Something went wrong. Nothing was recorded."; zero shortages plus data problems still said "Blocked: 0 shortages (and 2 data problems...)"; unknown crew status returned "Crew can go".
- `tests/unit/ui-page-cache.test.ts` — suite failed to load: cannot find `@/app/_lib/cached`.
- `tests/unit/ui-screens.test.ts` — sites sentence missing; substitutes page had no `emptyCatalogueLabel`; actions page had no `BUTTONS.backToSites`; `global-error.tsx` missing; no `--input-border`.
- `tests/unit/ui-status.test.ts` — unknown shortage mapped to "Escalated"; unknown action mapped to "Resolved".

Passed in that same run (did not fail first): `tests/api/routes.test.ts` (including `status: "earlier"` and the 0451 payload) and `tests/unit/ui-load.test.ts` (including `upstream_invalid`, `PenetrationNotFoundError`, `ShortageNotFoundError`, and `connection()`). Inside the failing files, these also passed first: shared memory store, production ignores `STUB_STOCK_MODE`, newest-first action ordering, the postDecision 201/200/409/422/non-JSON/unsafe-code cases, the other format cases, the AC 9 site banner, and the known status / BUTTONS / ANNOUNCE cases.

Follow-ups, not in that JSON:

- After the stock-mode fix, `instanceof UpstreamError` failed across `vi.resetModules()` (two class identities). The test now imports `UpstreamError` after `resetModules`. Behaviour assertion is unchanged.
- `tests/api/client-boundary.test.ts`, added before `client-boundary.mjs` existed, failed to load with `ERR_MODULE_NOT_FOUND`. The shell exit of that attempt was masked by a trailing `tail` (reported 0). The vitest output was the failure.

## Departures

- Decision 12 asked for a second Playwright project. There are four: `chromium-375` (read, port 3100), `chromium-375-write` (depends on `chromium-375`, so AC 30 sees "Open" before writes), `stock-down` (3101, `STUB_STOCK_MODE=down`, dist `.next-e2e-stock-down`), `stock-malformed` (3102, `STUB_STOCK_MODE=malformed`, dist `.next-e2e-stock-malformed`). One dev server cannot be both stock modes. `--list` showed all four.
- Decision 6 changed the material-summary assertion. Old value began `Fire putty pad x1 (20 on hand), ...`. New value is `Fire putty pad x1, Intumescent sealant, 310 ml cartridge x1, MAT-GONE x2`. On-hand 0 is `Pad x1`. `onHandQty` is still on the input type and is not printed.
- No e2e for "Earlier decision, shortfall has grown". Sample stock cannot change during a run. Covered at the API: an action recorded below the live shortfall lists as `status: "earlier"` on `GET .../actions`. The assertion was not weakened to "current".
- `NEXT_DIST_DIR` is read in `next.config.ts` and is not in `.env.example` (e2e-only). `.gitignore` was not in the allowlist, so `.next-e2e`, `.next-e2e-stock-down`, and `.next-e2e-stock-malformed` are not ignored. ESLint ignores them. They appear when Playwright starts the dev servers.
- When `E2E_BASE_URL` is set, `webServer` is omitted. The stock projects still request `http://127.0.0.1:3101` and `:3102`.

## New copy (document these)

- `SITES_UNAVAILABLE`: "Can't check the sites right now. Don't assume any site is clear. Try again." Used on `/` only when `listSites` throws. Stock-down does not throw there: `listSites` catches each site, so `/` shows a "Can't check" chip per site, not this sentence. The single-site banner is unchanged: "Can't check this site right now. Don't assume it's clear. Try again."
- Empty catalogue, no related shortage or blocker: "No catalogue match for this penetration."
- Empty catalogue with a related decision (unchanged): "No catalogue match for this penetration. Escalate instead."
- Blocker-only: "Blocked: N data problem(s). Hold the crew until they are sorted." At least one shortage keeps the shortage sentence. Zero shortages and zero blockers stays "Blocked: 0 shortages. Hold the crew until stock arrives."
- Unknown shortage state and unknown action status: label "Unknown", tone neutral, icon dashed-circle. Never "Escalated" or "Resolved". Unknown crew status uses the unavailable banner, not "Crew can go".
- `transport_failed`: "Couldn't reach the server. The decision may not have been recorded. Send again to retry; it won't be recorded twice."
- Character counter: `` `${value.trim().length} of 500 characters` ``.
- `global-error.tsx`: title and h1 "Something went wrong", paragraph "Try again.", button "Try again", and the literal demo banner "Demo: sample data, no login". `error` is unused. No message, no digest.
- `DEMO_BANNER` is the same visible sentence as before, now a shared constant. The global-error file also contains the literal, because the screen test reads that file.

## Environment

- `STUB_STOCK_MODE`: `normal` (default), `down`, `empty`, `malformed`. Read in `buildDependencies` only when `NODE_ENV !== "production"`. Anything else, including omitted, stays `normal`. Production test expects balances even when the variable is `down`. Documented in `.env.example`. Not a new dependency.
- `NEXT_DIST_DIR`: optional dist directory name. Must match `^[A-Za-z0-9._-]+$` and must not contain `..`, else `.next`.

## Contrast (sRGB, (Lhi+0.05)/(Llo+0.05))

Input border token `--input-border`. Soft `--border` is still used on cards.

| Token | On | Ratio |
| --- | --- | --- |
| light `#5c6570` | `--bg` `#ffffff` | 5.91 |
| light `#5c6570` | `--surface` `#f6f7f8` | 5.51 |
| dark `#8b939e` | `--bg` `#121316` | 5.98 |
| dark `#8b939e` | `--surface` `#1b1d21` | 5.44 |
| light `--danger-text` `#8a1c13` (invalid border) | `#ffffff` / `#f6f7f8` | 9.31 / 8.68 |
| dark `--danger-text` `#ffb3ab` | `#121316` / `#1b1d21` | 10.87 / 9.88 |

## Left as decided

- Decision 2: AC 9 banner copy not changed. Orchestrator edits the spec.
- Decision 11: `docs/api.md` not edited.
- Decision 14: `in_stock` still uses the crew-clear icon and "Materials in stock". The page notice stays "Catalogue match, not verified".
- Decision 21: no `visibilitychange` refresh. A background tab can keep a stale banner until the next navigation.
- Decision 24: no shared form shell for the three dialogs.
- `server-only` was not added.

## Docs the orchestrator still owns

`docs/` was not edited. Needed updates: AC 9 wording (decision 2); additive API fields (decision 11); the new sentences above; `formatMaterialSummary` no longer prints on-hand counts; `STUB_STOCK_MODE` if env vars are documented beyond `.env.example`.

## What the orchestrator should run

Playwright, all four projects, 11 specs. Not run here:

- `chromium-375`: `ac30-status-text`, `ac32-viewport`, `accessibility`, `not-found`, `home-status`, `substitutes-empty`.
- `chromium-375-write` (after the read project): `ac31-keyboard` (writes only the collar `site-b:MAT-COLLAR-25`), `idempotency-key` (aborts both POSTs on site-c `pen-c-03`; same `idempotency-key`; transport sentence; no success announcement), `scenario` (writes sealant `site-b:MAT-SEALANT` and a proposal on pen-b-01).
- `stock-down` and `stock-malformed`: `/` and `/sites/site-b` show can't-check text and never "Crew can go".

Hydration wait is `document.documentElement.dataset.hydrated === "true"`, set by `Announcer`. `networkidle` is gone. Each spec comments its own target. `reuseExistingServer` is false.

AC 30 expectations taken from the sample, not from a browser: sealant "Affects 12 penetrations"; collar "Affects 4 penetrations" with expanded labels "L3, Riser 2" for pen-b-01..pen-b-04; site-c mastic "Affects 1 penetration", "L1, Stair core". Untouched cards' state word is exactly "Open" on the inner span. The only `AC 30` test reference is `tests/e2e/ac30-status-text.spec.ts`. If a rendered count differs, report the actual value.

`error.tsx` and `global-error.tsx` are not in the axe or target-size routes. There is no safe URL that renders them without throwing. Not-found (`/sites/nope`), Wait, Propose, and one disclosure are included.

`assertTargets` includes `summary`. The scenario "no POST" check is a request listener, not a 1500 ms wait.
