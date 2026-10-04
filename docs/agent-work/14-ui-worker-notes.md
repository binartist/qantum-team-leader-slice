# UI notes

## Decisions

- Pages are server components. They call use cases through `getDependencies()` after `connection()`, with `dynamic = "force-dynamic"`. Writes are client islands that `fetch` `/api` and then `router.refresh()`.
- A polite live region reads an in-memory store (`useSyncExternalStore`) so a repeat announcement can clear and be spoken again. The same text is copied to `sessionStorage` key `team-leader:announce`. A `fetch` patch announces "Already recorded" when a POST to `/api/` returns 200 with `created: false`. The idempotency key is `crypto.randomUUID()` when a dialog opens, kept until it closes, and exposed as `data-idempotency-key`.
- A failed `fetch` (no response) is shown as `upstream_unavailable`. Response codes are accepted only if they match `^[a-z0-9_]{1,80}$`. Raw server text is not shown.
- Purchasing is the initial escalate choice. Notes and reasons are checked in the dialog (trim, 500). Empty note is omitted. Reason is required. Primary button text is "Sending…" and disabled while the request is in flight. Focus returns to the opener. Escape uses the native dialog close.
- `requiredIntegrityMinutes` and `requiredInsulationMinutes` on the new penetration summary are `number | null`, matching the domain. The brief's type omitted null.
- Crew status on an upstream failure uses the approved banner "Can't check this site right now…", including the sites list chip "Can't check". The slice text "stock unavailable" was not used.
- Dark secondary text uses `#c4c8ce` (the dark neutral text). The palette did not name a separate dark secondary colour.
- No link sits inside a paragraph. The AC 31 inline-link exception list is empty.
- `src/adapters/catalogue-csv.ts` no longer resolves the default CSV path at module scope with `new URL("…csv", import.meta.url)`. Next's page-data collection rewrote that pattern and `next build` failed (`fileURLToPath` received a URL, then `Invalid URL` for a `/_next/static/media/…csv` path). The default path is now computed only when `loadCatalogueFromCsv()` is called without a path, from the module file via `path.join`. `getDependencies()` still passes `process.cwd()/data/solutions-excerpt.csv`. The production memory-store guard is unchanged.

## Additive API fields

`listCandidates` adds `penetration`: `{ id, floor, location, serviceType, serviceSize, nominatedCode, requiredIntegrityMinutes, requiredInsulationMinutes }` with minutes `number | null`.

`listActions` adds `materials` (every material referenced by that site's solution-material items, `{ name, unit }`) and `penetrations` (every penetration on the site, `{ floor, location, nominatedCode }`). The readiness HTTP body is unchanged: its maps stay limited to current shortages and blockers.

`docs/api.md` does not describe these fields. It needs an update. Not edited here.

## Copy written for cases the design did not spell out

- Sites title and h1 "Sites". Readiness h1 is the site name. Substitutes h1 "Substitutes". Actions h1 "Actions log". Fallback h1 when the site cannot be loaded: "This site".
- "Rating 60/30" and "not claimed" for a null minute (including a null integrity, which the sample data does not use). "Nominated solution 0438". Service line "PEX Pipe, Ø25mm".
- "Affects 12 penetrations" / "Affects 1 penetration". "Show affected penetrations".
- "Recorded actions" and "Proposed substitutes". "By demo-leader" (the demo user id). The stored note is shown on its own line when present.
- Dialog titles "Wait: {target}", "Escalate: {target}", "Propose {code}". Labels "Send to", "Note", "Reason". Options "Purchasing" and "Warehouse". Count "{n} of 500 characters".
- Buttons "Send wait" and "Send proposal" (alongside the designed "Send escalation").
- Loading: h1 and body "Loading". Not found: "Page not found" / "That page does not exist." Error page: "Something went wrong" and "Try again". It does not say "Nothing was recorded" and it does not render `error.message` or the digest.
- "Give a reason." and "A manager has to verify this catalogue match."
- Action lines such as "Escalated to purchasing: Intumescent sealant, 310 ml cartridge" and "Proposed substitute: 0438 to 0451". A missing name falls back to the id. Place fallback is "{floor}, {location}".

"Catalogue match, not verified" and "On hand, shared, not reserved" are rendered from the API fields `notice` and `stockNotice`.

## Verification

| Command | Exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run test:coverage` | 0. 234 passed, 5 skipped. Statements, branches, functions, and lines 100% (348/348, 238/238, 68/68, 284/284) on `src/domain/**/*.ts` and `src/ui/*.ts` |
| `npm run build` | 0 after the catalogue-path change. An earlier build exited 1 during page-data collection (see Decisions) |
| `npm run check:ac` | 0. "All 32 acceptance criteria are referenced by tests." |
| `npm run test:e2e` | 1. Chromium did not launch. Every test failed in about 1ms with `browserType.launch: Target page, context or browser has been closed`. The headless shell logged `Received signal 11 SEGV_ACCERR` and exited with `SIGSEGV` (`chrome-headless-shell` under `~/Library/Caches/ms-playwright/chromium_headless_shell-1243`). `kill` then returned `EPERM`. The UI was not exercised. Specs typecheck and lint. No workaround outside the repo was attempted |
| Playwright `chromium.launch()` probe (later, same shell) | 1. Same `SEGV_ACCERR` / `SIGSEGV` from `chromium_headless_shell-1243`. No page was opened |

Token pairs in `src/app/globals.css` were checked with the WCAG relative-luminance formula. The lowest light pair is link `#0b57d0` on surface `#f6f7f8` at 5.95:1. The lowest dark pair is link `#8ab4f8` on surface `#1b1d21` at 8.01:1. All listed text pairs are above 4.5:1. Axe itself was not run.

Lint probes, removed afterwards: `src/application/lint-probe.ts` importing `react`, and `src/ui/lint-probe.ts` importing `@/server/deps`. `npx eslint` on those files exited 1 with `no-restricted-imports` for both. A later `npm run lint` on the tree exited 0.

No dev server was left running.

## Files changed outside the create list

- `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`: layering rules, UI coverage include, dev-server e2e config (`ACTIONS_STORE=memory`, `npx next dev -p 3100 -H 127.0.0.1`, one Chromium project at 375×812, `workers: 1`, `fullyParallel: false`, `reuseExistingServer: false`).
- `src/server/log.ts` deleted; `src/application/log.ts` added. Imports updated in `src/application/sites.ts`, `src/server/http.ts`, `tests/api/security.test.ts`.
- `src/application/readiness.ts`, `candidates.ts`, `actions.ts`, `index.ts`, and `tests/api/routes.test.ts`: additive fields above.
- `src/adapters/catalogue-csv.ts`: build break described above.
- `src/app/layout.tsx`, `src/app/page.tsx`: shell and sites list.
- `tests/unit/ui-format.test.ts`: also asserts `formatQuantity(-0)` is `"0"`.

## What the orchestrator should check

- Run `npm run test:e2e` outside this sandbox. Expect axe (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`) in light and dark, including an open escalate dialog; 44×44 targets via `boundingBox`; no horizontal scroll at 375px; the write scenario (sealant escalate, replay "Already recorded", propose `0451`, Kingsway data problems).
- Update `docs/api.md` for `penetration`, `materials`, and `penetrations`. `docs/agent-work/reviews/findings-quality.md` still quotes the old top-level catalogue `new URL`.
- `next.config.ts` traces `./data/solutions-excerpt.csv` only for `/api`. Page routes call `getDependencies()` and were not given a trace include, because that file was not to be edited. `next dev` reads the CSV from the repo. A deployed page bundle may not.
