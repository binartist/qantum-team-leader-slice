# BRIEF: responsive side menu (drawer on narrow screens, fixed collapsible menu on wide ones)

## Role

You are the **worker** for this brief. Execute it. Do not engage another external worker or hand the brief back up. In-harness helpers (subagents) are allowed one level deep, never two editing the same file. The orchestrator reviews everything you produce and runs its own gates, including Playwright. This brief outranks any per-turn instruction that contradicts it. Do not keep a task ledger or `tasks/todo.md`; durable notes go in `NOTES.md`. Do not run `git add`, `git commit` or any git write command; the orchestrator commits. **Never revert, restore or "clean up" a file you did not change.** If something outside your file list looks modified, leave it alone and mention it in the notes.

## Facts

- **Repo and tooling**
  - The cwd is a git worktree on branch `worker/responsive-nav`, at the clean commit 610c771.
  - Stack: Next.js 16 App Router, React 19 with the React Compiler lint, strict TypeScript, Vitest, and Playwright with axe. Styles are CSS Modules in `src/ui/primitives.module.css`, with tokens in `src/app/globals.css`.
  - Read `node_modules/next/dist/docs/` before using a Next API you are unsure of (for example `usePathname` in a client component under the root layout).
  - **Dependencies are installed.** Do not run `npm install`, and do not edit `package.json` or the lockfile.
- **Read first:**
  - `AGENTS.md`
  - `docs/slice-specification.md`: AC 37
  - `docs/ui-design.md`: the Navigation and Theme rows, the `/` row, and the last design notes
- **Current navigation**
  - `src/ui/NavDrawer.tsx` (client) renders `Drawer` (`src/ui/Drawer.tsx`, a native `<dialog>` opened with `showModal`) with a trigger button labelled "Open menu".
  - Its contents are: the `ITEMS` list (Sites, Materials, Actions log, with kind icons and `aria-current`); then, under a divider (`.navSecondary`), "About this demo"; then the footer `.navFooter` holding `<ThemeSwitch />`.
  - `src/ui/AppBar.tsx`:
    - `AppBar({ backHref, backName })` renders the sticky header with `BackControl` on inner pages.
    - `MenuBar({ current })` renders the header holding only `<NavDrawer current={current} />` on the top-level pages: `/` (current "about"), `/sites`, `/materials`, `/actions`.
- **Inner pages** use `AppBar`:
  - `/sites/[id]`, through `src/app/sites/[id]/site-frame.tsx`
  - `/sites/[id]/penetrations/[pid]`
  - `/materials/[materialId]`
  - `src/app/not-found.tsx`
  - check `src/app/error.tsx` and `global-error.tsx`
- **Root layout:** `src/app/layout.tsx` renders `<html suppressHydrationWarning>` with a head `<script>` holding `THEME_SCRIPT` (from `src/ui/theme.ts`), then `<body>` with `Announcer`, `NavHistory` in Suspense, and `{children}`.
- **Theme pattern to copy:** `src/ui/theme.ts`, `src/ui/ThemeSwitch.tsx` (`useSyncExternalStore`, with "system" as the server snapshot) and `tests/unit/ui-theme.test.ts`.
  - The head script stamps `data-theme` before first paint.
  - Storage failures are swallowed.
  - The CSS keys on `data-theme`.
- **Sticky offsets:** they use `--app-bar-height` (globals.css; used at primitives lines about 515, 534, 543 and 548). This covers the header, the site filter dock (`.filterDock`), and the actions log's `.stickyHeading` and section `scroll-margin-top`.
- **Kind icons:** `src/ui/KindIcon.tsx` has site, material, decision and about kinds, used by the menu items.
- **Tests to read:**
  - `tests/e2e/navigation-drawer.spec.ts` (AC 37, including the theme test)
  - `tests/e2e/support.ts` (`assertTargets`, `assertNoOverflow`, `assertAxe`, `screens`)
  - `tests/unit/ui-screens.test.ts`: a source check that top-level pages use `MenuBar` and inner pages use `AppBar`, never both
  - `tests/unit/ui-kind-icons.test.ts`
  - `playwright.config.ts`: read projects run at 375 px (chromium-375), and the write project runs after them
- **Your sandbox cannot launch Chromium.** Write the e2e specs carefully, make sure they typecheck and lint, and state that they were not run. `npx playwright test --list` must succeed.

## Decisions already made (approved spec; do not relitigate)

### 1. Below 1024 px: unchanged

The drawer, the "Open menu" button on top-level pages, and the back control on inner pages behave exactly as today. All existing 375 px tests must keep passing without being weakened.

### 2. At 1024 px and wider: a fixed side menu on every page

- **Layout:** a persistent left side menu, **15rem** wide, on **every** page: top-level pages, inner pages, not-found and error pages that render inside the root layout. The page content takes the rest of the width (`main` keeps its existing max-width and centring inside that column).
  - Put the shell in the root layout, for example a `<div className={styles.appShell}>` grid with the side menu and a content column wrapping `{children}`.
  - The side menu is an `<aside>` holding a `<nav aria-label="Main">`. Below 1024 px it is `display: none`, so it leaves the accessibility tree.
- **Accessible names:** at 1024 px and wider, the drawer's trigger button is `display: none` everywhere. Exactly one element named "Main" may be in the accessibility tree at any width.
- **Same content as the drawer:**
  - the title "Team leader"
  - Sites, Materials and Actions log, with kind icons
  - a divider, then About this demo
  - at the foot, the Theme row
- **No duplicated markup:** extract the shared content into one component, for example `NavContent({ current, collapsed })` in `src/ui/NavContent.tsx`, and use it in both `NavDrawer` and the new side menu.
- **Current item** (`aria-current="page"`):
  - The side menu works it out from the path with `usePathname`, through a **pure, tested** function `navSectionForPath(pathname)` in `src/ui/nav-section.ts`.
  - Mapping:
    - `/` → about
    - `/sites` and anything under `/sites/` → sites
    - `/materials` and anything under `/materials/` → materials
    - `/actions` → actions
    - anything else → none
  - The drawer keeps the `current` prop it gets today.
- **Inner pages:** they still lead with the back control in their `AppBar` header at every width. The side menu does not replace "back to where I came from".
- **No empty header bar:** at 1024 px and wider, a top-level page's `MenuBar` header would hold only the hidden menu button, so hide it. Every sticky element must still stick in the right place:
  - Hide the `MenuBar` header at that width, and set `--app-bar-height` to `0` for pages without a visible header.
  - One way: mark the `MenuBar` header with a class or data attribute, and use `:root:has(...)` inside the media query.
  - The actions log's sticky site heading on `/actions` must then stick at the top of the viewport.
  - The site page's filter dock still sticks directly under the `AppBar`.
- **Spacing:**
  - The content column keeps the page's 16px side gutter.
  - Nothing scrolls horizontally at 1024 px or 1280 px.
  - The side menu is sticky or fixed at full viewport height, scrolls on its own if it is tall, and has a right border in `--border` on `--bg`.

### 3. Collapse to an icon rail (1024 px and wider only)

- **Button:**
  - A collapse button sits at the top of the side menu, beside the "Team leader" title.
  - Accessible name: "Collapse menu" when expanded, "Expand menu" when collapsed.
  - It has `aria-expanded` and `aria-controls` pointing at the side menu's nav.
  - Its icon is a chevron pointing left when expanded and right when collapsed (`chevron-left` and `chevron-right` exist in `Icon.tsx`).
  - It is at least 44 by 44.
- **Collapsed state:**
  - The side menu narrows to an icon rail of about 4rem.
  - The item icons stay, each still a link at least 44 by 44, named by its label. Keep the label as `srOnly` text, and add `title={label}` for hover.
  - `aria-current` stays on the current item.
  - The "Team leader" title, the Theme row and the visible labels are hidden.
  - The divider before About stays.
  - The content column widens.
- **Remembered and stamped before first paint:**
  - New `src/ui/sidebar.ts`, mirroring `theme.ts`:
    - `SIDEBAR_KEY = "team-leader:sidebar"`
    - `parseSidebar(value)` returns `"collapsed"` only for exactly `"collapsed"`, otherwise `"expanded"`
    - `readSidebar(root)`
    - `applySidebar(state, root, storage)`, which sets or removes `data-sidebar="collapsed"` on `<html>`, saves or removes the key, and still applies when storage throws
  - One combined head script: extend the existing inline script so it also stamps `data-sidebar` (or export a combined `HEAD_SCRIPT`). Keep it a plain inline `<script>` and keep the existing comment's reasoning.
  - The CSS keys on `:root[data-sidebar="collapsed"]`.
  - The button component uses `useSyncExternalStore`, with "expanded" as the server snapshot, like `ThemeSwitch`.
  - Unit tests mirror `ui-theme.test.ts`: parse, apply, blocked storage, and running the script with fake document and storage objects. Name them `AC 47: …`.
- **No motion by default:** the width change animates only under `prefers-reduced-motion: no-preference`, and at most 150 ms.

### 4. Strings

Add to `NAV` in `messages.ts`: `collapse: "Collapse menu"` and `expand: "Expand menu"`. No other new copy.

### Out of scope

- No change to the API, the data, page content, the drawer's narrow-screen behaviour, or the back controls.
- No hover-to-expand.
- No tablet-specific layout beyond the single 1024 px breakpoint.

## Files you may change or create

- Edit or create under `src/app/**` (only the layout and pages' header usage), `src/ui/**` and `tests/**`, plus `NOTES.md`.
- You may edit `playwright.config.ts` **only** to add a new spec file to the read projects' list.
- Do **not** touch `docs/`, `README.md`, `data/`, `src/domain/`, `src/application/`, `src/ports/`, `src/adapters/`, `src/server/`, `src/app/api/**`, `scripts/`, `.github/`, `package*.json`, or other config files.

## Method (test first)

- For every pure function (`navSectionForPath`, `sidebar.ts`), write the unit test first, run it and see it fail, then implement. Record in `NOTES.md` which tests failed first.
- Update `tests/unit/ui-screens.test.ts` to the new rule: top-level pages use `MenuBar`, inner pages use `AppBar` (never both in one page source), and the root layout renders the side menu. Name the tests `AC 37` and `AC 47`.

### E2E

**Add `tests/e2e/side-menu.spec.ts`** to the read projects. It is read-only. Use `page.setViewportSize({ width: 1280, height: 800 })` at the start of each test, and cover:

- `/sites`:
  - A `navigation` named "Main" is visible, and "Sites" in it is `aria-current="page"`.
  - The "Open menu" button is hidden.
  - There is no `banner` containing only the menu button. Assert `page.getByRole("banner")` has count 0 on `/sites`.
- `/sites/site-b/penetrations/pen-b-01`:
  - The side menu marks Sites.
  - The header shows "Back to Harbour Point, Levels 3 to 5".
- `/materials/MAT-SEALANT` marks Materials. `/actions` marks Actions log. `/` marks About this demo.
- Collapse and reload:
  - Click "Collapse menu". The button becomes "Expand menu" with `aria-expanded="false"`, and `<html>` has `data-sidebar="collapsed"`.
  - The Sites link is still named "Sites" and is at least 44 by 44.
  - The Theme group is hidden.
  - Reload. The page is still collapsed before any interaction: check the attribute right after `goto`.
  - Expand again, and the attribute is removed.
- On `/actions` at 1280 px:
  - Scroll so that Harbour Point's section is mid-page.
  - Its h2's `getBoundingClientRect().top` is about 0, within 2 px, while it sticks.
- `assertAxe`, `assertTargets` and `assertNoOverflow` pass:
  - at 1280 px, both expanded and collapsed, on `/sites` and on `/sites/site-b`
  - at 1024 px, expanded, on `/sites/site-b`

**Existing specs:**

- `navigation-drawer.spec.ts` keeps running at 375 px unchanged. If a test there sets a wider viewport (one in AC 42 sets 1280×800 in `penetration-page.spec.ts`), check it still holds with the side menu present, and adjust only what the new layout legitimately changes. List every such change in the notes.

## Verification (run before finishing; record exit codes in NOTES.md)

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run check:ac
npm run build
npx playwright test --list
```

- All of these must exit 0, with 100% statement coverage on `src/domain/**` and `src/ui/*.ts`.
- Do not use `any`, `@ts-ignore` or `eslint-disable`.
- Do not start long-running processes.
- AC 47 tests are allowed before the spec has AC 47.

## Honesty constraints

- Do not claim a command passed unless you ran it and saw the exit code.
- Say plainly that the e2e specs were not run.
- If a decision above seems wrong or impossible, implement the closest faithful version and record the disagreement.
- Do not change an expectation to fit an actual value.

## NOTES.md

Keep it short and factual. Include:

- the tests that failed first
- files created, changed and deleted
- how the shell is laid out
- how the empty header and the sticky offsets are handled
- new strings
- departures from this brief and why
- existing tests you changed and why
- what you could not verify
- what the orchestrator should check in the browser:
  - 375, 1024 and 1280 px
  - collapsed and expanded
  - the sticky heading on `/actions`
  - the filter dock on a site
  - no layout jump on reload
