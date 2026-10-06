# BRIEF: actions log in the side menu, decision-chip popover

## Role

You are the **worker** for this brief. Execute it. Do not engage another external worker or hand the brief back up. In-harness helpers (subagents) are allowed one level deep, never two editing the same file. The orchestrator reviews everything you produce and runs its own gates, including Playwright. This brief outranks any per-turn instruction that contradicts it. Do not keep a task ledger or `tasks/todo.md`; durable notes go in `NOTES.md`. Do not run `git add`, `git commit` or any git write command: the orchestrator commits.

## Facts

- Cwd is a git worktree of the repo on branch `worker/actions-menu`, at a clean commit. Next.js 16 App Router (read `node_modules/next/dist/docs/` before using a Next API you are unsure of), React 19 with the React Compiler lint, strict TypeScript, Vitest, Zod 4, Playwright with axe, CSS Modules (`src/ui/primitives.module.css`) and tokens in `src/app/globals.css`. **Dependencies are installed. Do not run `npm install`; do not edit `package.json` or the lockfile.** No `.env.local` is needed: outside production the actions store defaults to memory and the stubs to normal.
- Read first: `AGENTS.md`, `docs/ui-design.md`, `docs/slice-specification.md` sections 4 and 9, then the files named below.
- Layering: `src/domain` is pure and is **not touched**. Pages call use cases through React `cache` wrappers in `src/app/_lib/cached.ts` and `loadPage` (`src/app/_lib/load.ts`), which maps `UpstreamError` to unavailable. UI code must not import `@/server`, `@/adapters`, `@/ports` or `pg` (lint enforces). Testable UI logic lives in pure functions in `src/ui/*.ts`, which have a **100% statement coverage bar** (`npm run test:coverage`), as does `src/domain/**`.
- Safety rules: missing data is never zero or "none". A site whose data cannot be read says it cannot be checked; it never reads as "nothing recorded".
- Navigation rule: a page links down to its children or up to its parent, never sideways back to the page that opened it.
- **Current actions log:** a right-hand drawer opened by an "Actions log N" button in the header of the site page and the penetration page.
  - `src/app/sites/[id]/site-actions.tsx` (`SiteActionsButton`) loads `getCachedActions(siteId)` and renders `src/ui/ActionsDrawer.tsx`, which wraps `src/ui/Drawer.tsx`.
  - The content is `src/app/sites/[id]/actions-log.tsx` (`ActionsLog`). Its rows are `src/ui/ActionRow.tsx`.
  - Data comes from `listActions(deps, siteId)` in `src/application/actions.ts` (type `SiteActions`).
  - Placement: `site-frame.tsx` puts it in `AppBar`'s `end` slot. The penetration page `src/app/sites/[id]/penetrations/[pid]/page.tsx` builds `const actions = <SiteActionsButton …/>` and passes it to `unavailable(...)` too.
  - `?log=open` opens it, through `logIsOpen` in `src/ui/penetration-filters.ts`.
  - `src/app/sites/[id]/actions/page.tsx` redirects to `?log=open`.
- **Side menu:** `src/ui/NavDrawer.tsx`, a left `Drawer`.
  - `NavSection = "sites" | "materials"`, with an `ITEMS` list and `aria-current` on the current item.
  - Strings are in `NAV` in `src/ui/messages.ts`.
  - `MenuBar({ current })` in `src/ui/AppBar.tsx` is the header of top-level pages.
- **Cross-site page to copy the pattern from:** `src/application/materials.ts` and `src/app/materials/[materialId]/page.tsx`.
  - The use case walks `deps.sites.listSites()`. A site that throws `UpstreamError` or `SiteNotFoundError` becomes `{ status: "unavailable" }` and is logged. If every site is unavailable, it throws `UpstreamError`.
  - The page renders one `<section id={siteAnchor(siteId)} aria-labelledby=…>` per site. Each has an h2 using `styles.headingLink` that links to the site with a chevron. An unavailable site gets a warning `Banner`.
- **List rows:** `src/ui/PenetrationGroups.tsx`. Each `<li>` is one `<Link className={styles.penetrationLink}>`, containing the place line, the chips from `chips(penetrationId)`, and a "Substitutes ›" cue.
  - The chips come from `listFactChips` in `src/ui/penetrations.ts`: problem chips first, then an "Escalated" chip (`shortageState("escalated")`) and/or a "Waiting" chip. The site page `src/app/sites/[id]/page.tsx` passes `readiness.shortages` and `readiness.blockers`.
  - Each `Shortage` and blocker in `readiness` carries `actions: ShortageActionView[]`, newest first. A `ShortageActionView` has `kind: "wait" | "escalate"`, `escalateTo`, `note`, `createdBy`, `createdAt` and `current: boolean`. Its `state` is "open", "waiting" or "escalated".
  - `readiness.materials` (names) and `readiness.penetrations` (places) let `actionTarget` and `actionSentence` in `src/ui/format.ts` build "Escalated to purchasing: Pipe collar for 25 mm pipe".
- **Sample data, e2e:** site-b (Harbour Point, Levels 3 to 5) has shortages on pen-b-01. The e2e write project records an escalation on `site-b:MAT-COLLAR-25` (ac31) and on sealant (scenario). Tests share one memory store per server, so read-only specs must not depend on a write.
- **Your sandbox cannot launch Chromium.** Update and add e2e specs carefully, make sure they typecheck and lint, and say they are unrun. `npx playwright test --list` must succeed.

## Decisions already made (approved spec, do not relitigate)

### 1. Actions log page `/actions`, in the side menu

- **Menu.** `NavSection` gains `"actions"`. `ITEMS` becomes Sites, Materials, Actions log, with `NAV.actions = "Actions log"`. The menu link points to the new constant `ACTIONS_PATH = "/actions"` in `src/ui/format.ts`.
- **Use case.** New page-only `listAllActions(deps): Promise<AllActions>` in `src/application/actions.ts`, exported from `src/application/index.ts`. It has no API route.
  - Return type: `AllActions = { sites: readonly SiteActionsSection[] }`.
  - Section type: `SiteActionsSection = { status: "ready"; siteId; siteName; listed: SiteActions } | { status: "unavailable"; siteId; siteName }`.
  - Sections are in `listSites` order, and an unavailable site keeps its place.
  - Each site is read with the existing `listActions`. An `UpstreamError` or `SiteNotFoundError` makes that site unavailable and logs `actions_unchecked` with `siteId` and `code`, through `log` from `./log`, the same way `readOrUnchecked` does in materials.ts. Any other error is rethrown.
  - If there is at least one site and every one is unavailable, throw `UpstreamError("upstream_unavailable", "sites")`.
  - Add a cache wrapper `getCachedAllActions` in `cached.ts`, and remove `getCachedActions` if nothing else uses it.
- **Page.** New `src/app/actions/page.tsx`, with `export const dynamic = "force-dynamic"` as the other pages have.
  - Header: `<MenuBar current="actions" />`. Title: `<h1>Actions log</h1>`.
  - When the page is unavailable, show the h1 and `UnavailablePanel` with a new `ACTIONS_LOG.unavailable` = "We can't load the actions log right now. Try again shortly."
  - For each site, render a section like the material page's: `id={siteAnchor(siteId)}`, and an h2 heading link to the site page (`sitePath`) with a chevron.
  - Inside a ready section, render the moved actions-log content:
    - `src/app/sites/[id]/actions-log.tsx` moves to `src/app/actions/actions-log.tsx`.
    - Sub-headings "Recorded actions" and "Proposed substitutes" stay h3. Entry cards become h4, so extend `Card`'s `heading` prop to accept `"h4"` and pass it from `ActionRow` and `ProposalRow`.
    - An empty site shows `EMPTY.actions` ("Nothing recorded for this site yet.").
  - An unavailable section shows a warning `Banner` with `ACTIONS_LOG.siteUnavailable` = "We can't check this site's actions right now."
  - With zero sites, show `ACTIONS_LOG.empty` = "No sites to show."
- **Entry links.** Change `actionLink` in `format.ts`:
  - A material decision that is not resolved goes to `materialPagePath(materialId, { siteId })`, the cross-site material page at that site's section: `/materials/MAT-X#site-site-b`. That is where it was decided.
  - A blocker goes to its penetration, as now.
  - A resolved material decision has no link, as now.
  - Remove `siteMaterialPath` if it becomes unused, and its tests.
  - A proposal links to its penetration, as now.
- **Remove the header log.**
  - Delete `src/ui/ActionsDrawer.tsx` and `src/app/sites/[id]/site-actions.tsx`.
  - Remove the `end` slot use from `site-frame.tsx` and the penetration page, along with the `logOpen` prop of `SiteFrame` and the `log` search param on both pages.
  - Delete `logIsOpen` and its tests.
  - Keep `AppBar`'s optional `end` prop only if something still uses it. Otherwise remove it, along with `backControlBeside`, if that becomes unused.
  - `Drawer.tsx` stays, because NavDrawer uses it. Remove orphaned CSS (`.actionsButton`, `.drawerRight` and the right-side variant) and orphaned messages (`FILTERS.actions` if unused).
  - Update the `src/ui/*` file list in `tests/unit/ui-kind-icons.test.ts`.
- **Redirect.** `src/app/sites/[id]/actions/page.tsx` now redirects to `` `${ACTIONS_PATH}#${siteAnchor(id)}` ``, keeping the IdSchema check and `notFound`.
- **About page.** In `src/app/page.tsx`, the step text "Open the Actions log in the header, then Materials from the menu on the sites list." becomes "Open the menu on the sites list for Materials and the Actions log."

### 2. Decision chips with a popover, on list rows

- **Split the chips.** `listFactChips` stops adding the Escalated and Waiting chips; it returns problem chips only. Update its AC 34 test.
  - New pure function in `src/ui/penetrations.ts`: `decisionChips(penetrationId, shortages, blockers, names)`. The `names` argument is `{ materials, penetrations, siteId }`, enough for `actionTarget`. It returns at most two `DecisionChip` items, escalated first.
  - Item shape: `{ state: "escalated" | "waiting"; chip: StatusView /* shortageState(state) */; latest: { sentence: string; recordedAt: string; createdBy: string; note: string | null } }`.
  - Which items appear follows the Acted filter's rule exactly. An item for a state appears when any shortage that lists the penetration, or the penetration's own blocker, has that `state`.
  - **`latest`:** the newest action with `current: true` and the matching kind (`escalate` for escalated, `wait` for waiting), across the shortages and blockers covering the penetration whose `state` is that state. Newest is by `Date.parse(createdAt)`; on a tie or an unparseable date, keep the first one found.
  - `sentence` is `actionSentence(kind, escalateTo, actionTarget(siteId, shortageId, materials, penetrations))`. The shortage's or blocker's `id` is the `shortageId`.
  - If, unexpectedly, no current action of that kind exists, omit the item. Never show an empty popover.
  - Unit test name, for example: "AC 44: a decision chip carries the latest decision of its kind that still applies". Cover:
    - two shortages, where the newer escalation wins
    - an earlier, non-current action that is skipped
    - a blocker decision
    - an open problem with no chip
    - the escalated-before-waiting order
- **Row markup.** `PenetrationGroups` gains an optional `decisions?: (penetrationId) => readonly DecisionChip[]` prop, which the site page fills.
  - The `<li>` becomes the card, with new `.penetrationRow` styling that takes over the border and background currently on `.penetrationLink`. It contains the existing `<Link>` (place line, problem chips and the cue, unchanged), then a sibling `<div className={styles.decisionChips}>` when there are decisions.
  - The decision row sits under the link inside the same card, left-aligned with the place text. **A button must never be inside the link.**
- **Decision chip component.** New server component `src/ui/DecisionChip.tsx`, with no script. It uses the native popover API, which React 19 supports as the `popover` and `popoverTarget` attributes.
  - The trigger is `<button type="button" popoverTarget={id} className={styles.decisionChip}>`. It looks like the current chip (icon plus label, same tone colours, via `StatusChip` or the same classes) and has a tap area of at least 44×44 px; the visible chip can stay compact inside it.
  - Accessible name: the visible label followed by the place, for example "Escalated, latest decision for L3, Riser 2 · PEX Pipe Ø25mm". Use `aria-label` beginning with the visible text, and get the place from `penetrationLine`.
  - The popover is `<div id={id} popover="auto" role="dialog" aria-label={…same…} className={styles.decisionPopover}>`, where `id = `decision-${penetrationId}-${state}``. Ids are IdSchema-safe.
  - Content: the sentence as bold text (not a heading), `formatRecordedAt(recordedAt)`, `By {createdBy}` muted, then the note if present. No links. No close button is needed: the native popover closes on Escape and outside click. If you add one, it is `popoverTarget={id} popoverTargetAction="hide"` and at least 44 px.
  - Styling: a surface panel with a border, radius and shadow tokens, a max width of `min(20rem, calc(100vw - 2rem))`, and readable at 375 px.
  - Position: next to its chip using CSS anchor positioning inside `@supports (anchor-name: --a)`. Give each trigger a unique `anchor-name` through an inline style custom property, and give the popover `position-anchor`, `top: anchor(bottom)` and `left: anchor(left)` with `position-try-fallbacks: flip-block`.
  - Fallback: without anchor support, fix it at the bottom of the viewport, `inset: auto 1rem 1rem 1rem; margin: 0`, respecting the safe area.
  - Motion: no animation unless `prefers-reduced-motion: no-preference`.
  - Messages: add the "latest decision for" wording to `messages.ts`, or build it in a pure tested function.

### Out of scope

- No change to the HTTP API, the domain, the database or sample data.
- No action buttons in the popover.
- No per-site log page.

## Files you may change or create

Edit or create under `src/app/**`, `src/ui/**`, `src/application/actions.ts`, `src/application/index.ts`, `tests/**`, and `NOTES.md`.

Delete only the files named above.

Do not touch `docs/`, `data/`, `src/domain/`, `src/ports/`, `src/adapters/`, `src/server/`, `scripts/`, `.github/`, `package*.json`, or any config files. The orchestrator writes the docs and the spec ACs.

## Method (test first)

For every pure function and use case, write or update the unit test first, run it, see it fail, then implement. Record which tests failed first in `NOTES.md`. Name tests with the AC number:

- **AC 43**: the `/actions` page and `listAllActions`.
- **AC 44**: the decision chips.

Unit tests for `listAllActions` go in a new `tests/unit/actions-log.test.ts`. Use `testDependencies` from `tests/api/support.ts`, and the `withSiteDown` style from `tests/unit/material-stock.test.ts`, for:

- every site in order
- a missing or upstream-failing site becoming unavailable
- all sites down throwing `UpstreamError`
- a non-upstream error rethrown
- zero sites

**E2E updates.** Do not weaken assertions; rewrite each to the new flow.

- Remove or rewrite every use of the header "Actions log" button or dialog in:
  - `tests/e2e/site-tabs.spec.ts`, including the "stays in the header" test, `/sites/site-c/actions` and "Actions log 0"
  - `scenario.spec.ts`, which should now open the menu, then Actions log
  - `ac32-viewport.spec.ts`
  - `accessibility.spec.ts`
  - `penetration-page.spec.ts` line 21
  - `stock-down.spec.ts`: with stock down, every site's log is unreadable, so `/actions` shows `ACTIONS_LOG.unavailable`. Assert that, and that there is no "Nothing recorded".
- In `tests/e2e/support.ts` `screens`, replace `/sites/site-b/actions` and `/sites/site-d/actions` with `/actions`.
- Add `tests/e2e/actions-log.spec.ts` to the **read** projects' spec list in `playwright.config.ts`. You may edit this one config line; check how `navigation-drawer.spec.ts` is listed. It covers AC 43 and checks that:
  - the menu has "Actions log" and opening it lands on `/actions` with aria-current on the item
  - there is a section per site, with the site heading linking to `/sites/site-x`
  - `/sites/site-b/actions` redirects to `/actions#site-site-b`
  - axe, `assertTargets` and `assertNoOverflow` pass at 375 px
- AC 44 needs a recorded decision, so add it to the **write** flow, extending `tests/e2e/ac31-keyboard.spec.ts` after it escalates the collar. On `/sites/site-b?show=acted`, the pen-b-01 row has an "Escalated, latest decision for …" button **outside** the row link. Check that:
  - `page.locator("a[href$='/penetrations/pen-b-01'] button")` has count 0
  - focusing it and pressing Enter shows the popover with "Escalated to purchasing: Pipe collar for 25 mm pipe" and "Noted from the keyboard"
  - Escape hides it and focus is back on the chip button
  - `assertTargets` passes with it open
- The ac31 line asserting that the pen-b-01 link contains "Escalated" must change: the chip is no longer inside the link. Assert it on the row `li`.

## Verification (run before finishing; record exit codes in NOTES.md)

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run check:ac
npm run build
npx playwright test --list
```

All must exit 0, with 100% statements on `src/domain/**` and `src/ui/*.ts`. Do not use `any`, `@ts-ignore` or `eslint-disable`. Do not start long-running processes (no `npm run dev`, no Playwright run). `npm run build` writes `.next`; that is fine here.

## Honesty constraints

- Do not claim a command passed unless you ran it and saw the exit code. Paste the exit codes and the coverage summary.
- State plainly that the e2e specs were not run.
- If a decision above seems wrong or impossible, implement the closest faithful version and record the disagreement. Do not silently redesign.
- If an expected value does not come out, report the actual value. Do not change an expectation to fit.

## NOTES.md

Short and factual. Include:

- tests that failed first
- files created, changed and deleted
- every new user-visible string
- departures from this brief and why
- what you could not verify
- what the orchestrator should check in the browser (popover position at 375 px and desktop, focus return)
