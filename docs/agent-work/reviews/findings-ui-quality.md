# UI review: code quality, accessibility, security

Reviewer lens only. The working tree was read as it is. No repo file was edited. Playwright and `next dev` / `next start` were not run. Browser behaviour that needs a real Chromium (axe, focus after `router.refresh()`, 375px scroll) was not re-checked here.

Severity uses the brief: Critical would be a clear crew, a substitute described as compatible or approved, a failure shown as success, or a secret leak. None of those are present in the current render path. Four High findings follow.

## Findings

### High — A decision response is not tied to the dialog session that sent it

`src/ui/decisions/Dialog.tsx:36-67`

`onClose` clears `sendingRef` as soon as the native dialog closes, and `send` applies whatever response comes back to whatever dialog is open at that moment. Escape still closes the dialog while "Sending…" is up (there is no `onCancel` handler). The design allows Escape, and it also requires that a successful write refresh the page and announce. Those two paths disagree.

Concrete trace of those branches (same order of assignments as `send` / `onClose` / `openDialog`; not a React render):

- Response arrives while the dialog stays closed: result is `dropped K1`. `announced` stays empty, `refreshed` stays 0, `sendingRef` is false. The POST may already have been stored. The next open mints a new `crypto.randomUUID()`, so a retry is a new idempotency key and a second row.
- Response arrives after the leader reopens: the old success is `applied K1` onto the new session (`announced` = "Escalation recorded", `refreshed` = 1, dialog forced shut). The newer request, still in flight under `K2`, then finishes as `dropped K2`.

A double-click while `sendingRef` is still true is guarded. The hole is the close.

Suggested fix: capture the idempotency key (or a generation) for that `send`, and ignore a response whose key is no longer the open dialog's key. On a real success, announce and `router.refresh()` even if the dialog has already closed. Do not clear the in-flight lock in `onClose`.

### High — The live region repeats the previous success on every full load

`src/ui/decisions/api-client.ts:17-33` and `:124-137`, read by `src/ui/Announcer.tsx:8-14`

`announce` writes the text to `sessionStorage` under `team-leader:announce` and never clears it. `getAnnouncement` returns that stored string whenever the module-level counter is still 0. `getServerAnnouncement` returns `""`, so hydration itself is stable, and React then re-renders from the client snapshot (`updateStoreInstance` in `react-dom-client.development.js` calls `getSnapshot` and forces a store rerender when they differ). A polite live region then speaks a success that did not just happen, including on a later site.

Probe (`tests/unit/review-probe.test.ts` in the copy, real module): after `announce("Escalation recorded")`, a fresh evaluation of the module returns `getAnnouncement() === "Escalation recorded"` while `getServerAnnouncement() === ""`.

Storage failures are safe: `setItem` / `getItem` throwing still lets `announce("Wait recorded")` publish from memory and does not throw. The stored value is not checked against `ANNOUNCE`, so any string left in that key is spoken. Today the only writer passes the four fixed sentences, so this is a false status message, not an XSS sink (the text is a React child). `ANNOUNCE_EVENT` is dispatched and has no listener.

Suggested fix: do not seed the live region from storage on a new page load. If storage is only there to survive a remount, clear it after the announcement is published, and ignore any value that is not one of the four `ANNOUNCE` strings.

### High — The layering checks do not stop client code from reaching the server

`eslint.config.mjs:41-51`, `tests/api/security.test.ts:28-56`

The current client graph is clean. Entries are `src/app/error.tsx`, `src/ui/Announcer.tsx`, and the four decision modules. Transitive imports stay inside `src/ui` plus `react` and `next/navigation`. No `@/server`, `@/adapters`, `@/ports`, or `@supabase/supabase-js`. `.next/static` has no `SUPABASE_SERVICE_KEY`, `service_role`, or `NEXT_PUBLIC_` (scanned read-only). `createClient` in those chunks is Next's `createClientParams`, not Supabase.

The checks that are supposed to keep it that way do not. In the copy only:

- `src/app/error.tsx` (`"use client"`) was given `import { reachedServer } from "./_lib/leak-probe"`, and that file imports `getDependencies` from `@/server/deps`. `npx eslint` on those files exited 0. `npx vitest run tests/api/security.test.ts -t "no client module imports"` exited 0.
- `src/ui/rel-probe.ts` imports `../server/deps`. `src/ui/supa-probe.ts` imports `@supabase/supabase-js`. Same eslint run exited 0. The UI rule only matches the `@/server` and `@/adapters` specifiers, and only under `src/ui`. It does not match a relative path, the Supabase package, or a client module under `src/app`.
- A `"use client"` file that itself imported `../server/deps` did fail the unit test (`src/app/client-probe.tsx -> ../server/deps`). The test sees a direct specifier in a file that contains the directive. It does not walk the next file, and it never treats `@supabase/supabase-js` as forbidden.

`src/server` is not marked `server-only` (already noted in `docs/api.md`). Next usually replaces a non-public `process.env.*` in a client bundle, so this is a hole in the control, not a key found in `.next/static`.

Suggested fix: resolve every import from a `"use client"` file until the graph leaves the repo, and fail on `server`, `adapters`, `ports`, and `@supabase/supabase-js`. Point the eslint rule at the same set, including relative paths and `src/app/**`. Import `server-only` from `src/server/deps.ts` and `src/server/env.ts`.

### High — Text field borders fail non-text contrast in both themes

`src/app/globals.css:6` and `:31`, `src/ui/decisions/decisions.module.css:41-50`

`--border` is the only edge on the note and reason fields. Their background is `--bg`, the same as the dialog, so the fill does not separate them either.

Computed WCAG ratios (sRGB):

| Pair | Light | Dark | AA bar |
| --- | --- | --- | --- |
| Field border `--border` on `--bg` | 1.43 | 1.58 | 3:1 (1.4.11) |
| Field border on `--surface` | 1.33 | 1.43 | 3:1 |

Text, chips, banners, links, primary buttons, field-error text, and the disabled button all clear 4.5:1 in both themes (lowest text pair is light links and the light primary button at 6.39:1; disabled is 7.38 light and 8.92 dark). The focus ring is `#0b57d0` / `#8ab4f8` at 6.39 and 8.81 against the page background. It is the same colour as the primary button fill, and `outline-offset: 2px` (`globals.css:123-125`) puts the ring on the page background rather than on the fill, so the ring itself passes. The unfocused input does not.

Suggested fix: give inputs a border token that is at least 3:1 against `--bg` in both themes. Keep the lighter `--border` for cards and dividers if you want.

### Medium — Unexpected status values fail open to "Crew can go" or "Resolved"

`src/ui/messages.ts:51-72`, `src/ui/status.ts:17-28` and `:80-84`

`readinessBanner` handles `blocked`, `unavailable`, and `nothing_planned`, then returns `crewStatus("clear")`. `crewStatus` itself maps anything else to "Can't check". The same bad value would therefore read "Can't check" on the sites list and "Crew can go" on the site banner. `actionStatus` maps anything other than `current` or `earlier` to "Resolved". `shortageState` maps anything other than `open` or `waiting` to "Escalated".

Probe, calling the real functions: `readinessBanner("bogus", 2, 1).label` is `Crew can go`; `crewStatus("bogus").label` is `Can't check`; `actionStatus("bogus").label` is `Resolved`; `shortageState("bogus").label` is `Escalated`.

Current callers pass the domain union, and `computeSiteReadiness` only emits `blocked` or `clear` (`src/domain/readiness.ts:178`). This is not a wrong banner on the sample data. It is the wrong default in the safety-critical mapper.

Suggested fix: make the banner default the unavailable copy ("Can't check this site right now…"). Map an unknown action or shortage state to a neutral label, not Resolved or Escalated.

### Medium — The substitutes failure screen has no control that leaves it

`src/app/sites/[id]/penetrations/[pid]/page.tsx:41-52` and `:100-106`

`unavailable()` renders a heading and the can't-check banner and nothing else. The site and actions failure screens still render "Back to sites" or "Back to site". A keyboard user on this branch has no in-page link. The other screens already show the pattern.

Suggested fix: render the same back link as the ready substitutes page before returning `unavailable`.

### Medium — Each page repeats use-case work, and the actions list is read twice

`src/application/sites.ts:13-16`, `src/application/readiness.ts:73-86`, `src/application/actions.ts:23-28`, `src/app/sites/[id]/page.tsx:22-37` and `:51`, `src/app/sites/[id]/penetrations/[pid]/page.tsx:22-50`

There is no `React.cache` around the use cases, so one navigation does the work again.

- Home calls `getSiteReadiness` once per site, and each call reloads nominations, stock, and actions.
- A site page calls `getSite` in `generateMetadata`, again in the page, and again inside `loadSiteData`.
- Substitutes calls `listCandidates` in `generateMetadata` and again in the page. With no candidates it then calls `getSiteReadiness` for the whole site.
- `listActions` calls `loadSiteData` (which already calls `listShortageActions`) and then calls `listShortageActions` again. A write between the two reads can classify the second list against the first readiness.

A shortage that affects 200 penetrations is one card plus a closed `<details>` list, not 200 dialogs. The decision client chunk in the existing `.next/static` build is 18,818 bytes (`static/chunks/0ub-bn53bt76q.js`) and contains the announcement copy and `idempotency-key`. The heavy cost is the repeated server work.

Suggested fix: wrap `getSite`, `getSiteReadiness`, and `listCandidates` in `cache()` for the request. Use the actions already loaded in `loadSiteData` for the log.

### Medium — The test override does not follow the shared dependency cache

`src/server/deps.ts:10-37`

The built store does. `Symbol.for("qantum.team-leader.dependencies")` on `globalThis` is shared, and the copy's AC 15 test passed: two evaluations return the same `actions` object. `usingOverride` and `override` are ordinary module bindings. `setDependenciesForTests` clears the global slot and then stores the fake only in that copy.

Probe: evaluation A `setDependenciesForTests(override)` returns that override; evaluation B `getDependencies()` returns a different object whose `actions.listShortageActions` is a real function, and that object is what gets written back onto `globalThis`.

Suggested fix: keep the override on the same `globalThis` holder as the cache, and make `getDependencies` read it from there.

### Medium — An open tab keeps the crew banner it loaded

`src/app/layout.tsx` and the decision `send` in `src/ui/decisions/Dialog.tsx:64-66`

Nothing listens for `visibilitychange`, `pageshow`, or window focus (the only `focus` calls are field focus and dialog focus return). `router.refresh()` runs only after this tab's own successful submit, and its return type is `void`, so the caller neither waits nor handles a failed refresh. Pages are `force-dynamic` and call `connection()`, and API responses set `Cache-Control: no-store`, so the next navigation is fresh. A tab that already says "Crew can go" keeps saying it, and the "as of" line stays stale, until that navigation. That is the snapshot the design tried to keep off caches, held in the open document instead.

Suggested fix: call `router.refresh()` when the document becomes visible. After a submit, refresh even if the dialog has closed (see the first finding), and move focus to a stable id once the refresh has painted. `onClose` focuses the opener node synchronously, and the refresh then replaces that node.

### Low

- No `src/app/global-error.tsx`. A render error in the root layout, including `Announcer` which sits outside `{children}` (`src/app/layout.tsx:14-18`), uses Next's built-in page, which prints `ERROR ${digest}` (`node_modules/next/dist/client/components/builtin/global-error.js:80-85`). The segment `error.tsx` does not. It records only `data-digest="present"|"absent"` and renders neither `error.message` nor the digest. Next 16 passes `retry` (`error-boundary.js:110-115`); the button calls that.
- `candidateStatus("ok")` (`src/ui/status.ts:63-67`) is the empty-state sentence "No catalogue match…". The substitutes page only renders it when `needsEscalate` is true, so the screen is right and the function name is a trap.
- `.siteCard` text is a `span`. `overflow-wrap: anywhere` in `globals.css:69-75` covers headings, `p`, and `li`, not `span`. A long unbroken site name can stick out at 375px. Sample names have spaces.
- `assertTargets` (`tests/e2e/support.ts:25`) measures `a, button, input, select, textarea` and skips links inside a `p`. It never measures `<summary>`. The summary CSS does set 44px (`primitives.module.css:136-142`); the test would not notice if that class were dropped.
- Wait, Escalate, and Propose repeat the same submit, error, and button row (`WaitDialog.tsx`, `EscalateDialog.tsx`, `ProposeDialog.tsx`). Three copies is enough to share one form shell. Coverage (`vitest.config.ts:11`) includes `src/ui/*.ts` only, so the 95% floor does not include any of those components.

## Verified OK

- No `"use client"` module imports the server, adapters, ports, or the Supabase client. No `dangerouslySetInnerHTML` under `src`. No `NEXT_PUBLIC_` identifier under `src`. Notes and reasons are React text (`ActionRow.tsx:24`, `ProposalRow.tsx:45`), and `readCode` refuses a code that is not `^[a-z0-9_]{1,80}$`. A 500 HTML body and a JSON body whose `code` is `<script>…` both become `{ ok: false, code: "internal_error" }` and the fixed fallback sentence, with the HTML not present in the result.
- The fetch patch does not send data anywhere. It announces the fixed "Already recorded" string only for a POST whose URL contains `/api/`, whose status is 200, and whose JSON has `created === false`. A thrown `sessionStorage` does not break `announce`.
- Idempotency: the key is a UUID created in `openDialog` and reused for a retry that does not close the dialog. The header name is `idempotency-key`. The UUID matches the server pattern `[A-Za-z0-9._-]{1,128}`. The gap is a close during the request, above.
- Unavailable data on a page goes through `loadPage`: `UpstreamError` becomes the can't-check banner, a 404 `AppError` calls `notFound()`, and anything else hits the error page. `listSites` turns a per-site throw into `crewStatus: "unavailable"`. The not-found page renders a fixed sentence and a back link, not an internal message. The copy does not say "compatible" or "approved". Candidate lists pass through `CANDIDATE_NOTICE` ("Catalogue match, not verified") and readiness passes through `STOCK_NOTICE`.
- API `json()` sets `Cache-Control: no-store`. Page modules set `dynamic = "force-dynamic"` and `loadPage` calls `connection()`. Production dynamic responses with `revalidate === 0` get `private, no-cache, no-store, max-age=0, must-revalidate` (`next/dist/server/lib/cache-control.js:14-15`).
- One `h1` on each page. Shortage cards are `h2`, the "Data problems" section is `h2`, blocker and action cards under it are `h3`. `lang="en"`. Landmarks are `header` and `main`. Status chips and banners use text plus an `aria-hidden` icon. Wait, Escalate, and Propose buttons include the material, place, or code in `aria-label`, and that name contains the visible label. Text fields have visible labels, `aria-invalid`, and `aria-describedby` for the count and the error. `<dialog>` is native (`showModal`), so the trap and Escape come from the browser; `onClose` focuses the opener when that node is still connected. `<details>` is native. Author CSS has no animation; `prefers-reduced-motion` only sets `scroll-behavior: auto`. Buttons, the site card, block links, the summary, the select, and the textarea set `min-width` and `min-height` to 44px. Colours in components come from the tokens in `globals.css`.
- The catalogue default path is resolved from the adapter file (`catalogue-csv.ts:12-14`), and the unit test loads it after `chdir` to an empty directory. `buildDependencies` passes a cwd path instead (`deps.ts:48`). A missing file throws a fixed "catalogue file could not be read" with no path, and that is not an `UpstreamError`, so the page becomes the error screen rather than "Crew can go".
- No `any`, no `eslint-disable`, and no `NEXT_PUBLIC_` secret. The only non-null assertion in the UI layer is `MONTHS[date.getUTCMonth()]` in `format.ts:19`, which is in `0..11`.

## Commands

Run from a copy at `/tmp/review-copy` (rsync excluding `node_modules`, `.next`, `.git`; `node_modules` symlinked; vitest `cacheDir` set to `/tmp/review-vite` in the copy only). Mutations below were applied only in that copy.

| Command | Exit |
| --- | --- |
| `npx vitest run tests/unit/ui-messages.test.ts tests/unit/ui-status.test.ts tests/unit/ui-format.test.ts tests/unit/ui-load.test.ts tests/api/shared-store.test.ts tests/api/security.test.ts` | 0 (49 passed, 1 skipped: `.next/static` absent in the copy) |
| Contrast script over the tokens in `globals.css` | 0 (ratios in the border finding) |
| Client import walk | 0 (no server, adapter, port, or Supabase edge) |
| `npx eslint` on a UI relative server import, a UI Supabase import, and the transitive client import | 0 (not reported) |
| `npx vitest run tests/api/security.test.ts -t "no client module imports"` with only the transitive leak | 0 (test stayed green) |
| Same test with a `"use client"` file that directly imported `../server/deps` | 1 (caught that one specifier) |
| `npx vitest run tests/unit/review-probe.test.ts` (announcement replay, storage throw, non-JSON body, fail-open mappers, dependency override) | 0 (5 passed; these assert the defects) |
| Dialog branch trace (node) | 0 (`dropped K1` while closed; `applied K1` then `dropped K2` after reopen) |
| Read-only scan of `/Users/joe/workspace/qantum-team-leader-slice/.next/static` | 0 (no `SUPABASE_SERVICE_KEY`, `service_role`, or `NEXT_PUBLIC_`) |

Playwright, `next dev`, and `next start` were not run.
