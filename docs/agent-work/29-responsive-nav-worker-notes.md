# Responsive side menu

## Tests that failed first

Before `src/ui/nav-section.ts` and `src/ui/sidebar.ts` existed, `npx vitest run tests/unit/ui-nav-section.test.ts tests/unit/ui-sidebar.test.ts` exited 1. Both files failed to load (`Cannot find package '@/ui/nav-section'` and `@/ui/sidebar`). 0 tests ran. Test files: 2 failed. Start 10:00:04, duration 177ms.

The first `npm run lint` then exited 1: `src/ui/Drawer.tsx` `react-hooks/refs` ("Cannot access refs during render") because a render prop called `children(close)` during render. Drawer was put back to its original header. See departures.

## Files

Created:

- `src/ui/nav-section.ts`
- `src/ui/sidebar.ts`
- `src/ui/NavContent.tsx`
- `src/ui/SideMenu.tsx`
- `tests/unit/ui-nav-section.test.ts`
- `tests/unit/ui-sidebar.test.ts`
- `tests/e2e/side-menu.spec.ts`

Changed:

- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/ui/AppBar.tsx`
- `src/ui/NavDrawer.tsx`
- `src/ui/messages.ts`
- `src/ui/primitives.module.css`
- `playwright.config.ts` (added `**/side-menu.spec.ts` to the read projects)
- `tests/unit/ui-screens.test.ts`
- `tests/unit/ui-kind-icons.test.ts`

Deleted: none. `src/ui/Drawer.tsx` is unchanged from 610c771.

## Shell

Root layout body is `Announcer`, `NavHistory` in Suspense, then `<div class="appShell">` with `<SideMenu />` and `<div class="appContent">{children}</div>`.

Below 1024px, `.appShell` is a flex column (`flex: 1`) and `.sideMenu` is `display: none`. From 1024px, `.appShell` is a grid: `15rem minmax(0, 1fr)`, or `4rem minmax(0, 1fr)` when `:root[data-sidebar="collapsed"]`. The side menu is an `<aside>` (`position: sticky; top: 0; height: 100dvh; overflow-y: auto; border-right: 1px solid var(--border); background: var(--bg)`). `main` is unchanged (max-width 45rem, centred, 16px gutter). The window still scrolls.

`global-error.tsx` replaces `<html>` and `<body>`, so it does not get this shell. `error.tsx` and `not-found.tsx` render inside the layout, so they do.

## Empty header and sticky offsets

`MenuBar` is `<header class="appBar menuBar" data-menu-bar>`. At ≥1024px, `.menuBar` and `.menuButton` are `display: none`.

`globals.css`:

```css
@media (min-width: 1024px) {
  :root:has([data-menu-bar]) {
    --app-bar-height: 0;
  }
}
```

`:has` matches a hidden header, so `/`, `/sites`, `/materials` and `/actions` drop the sticky offset. Inner pages keep `AppBar` and `--app-bar-height: 3.375rem`, so the site filter dock still sticks under the back bar. `error.tsx` has no header and no `data-menu-bar`, so the variable stays 3.375rem there. Nothing on that page sticks.

## Collapse, before first paint

`sidebar.ts` mirrors the theme module. `HEAD_SCRIPT` is `THEME_SCRIPT` plus the sidebar stamp, still one plain inline `<script>` in `layout.tsx` (next/script `beforeInteractive` would flash). `applySidebar` sets or removes `data-sidebar="collapsed"` and the `team-leader:sidebar` key, and still updates the attribute when storage throws.

`SideMenu` uses `useSyncExternalStore`. The server snapshot is expanded. Width, the chevron, the title, the labels and the Theme row are CSS-keyed on `data-sidebar`, so a remembered collapse does not flash open. The button name follows the store and can read "Collapse menu" until hydration. Both chevrons are in the DOM; CSS shows the left one expanded and the right one collapsed.

Labels stay in the accessibility tree via the clipped `.navLabel` rule (not the `hidden` attribute). `title={label}` is always set. Theme uses `hidden` after hydration and `display: none` from the CSS before it. Width animates only under `(min-width: 1024px) and (prefers-reduced-motion: no-preference)`, 150ms, on `grid-template-columns` and `width`. Lengths are the literals `15rem` and `4rem`.

`usePathname` in `SideMenu` did not need an extra Suspense boundary. `npm run build` prerendered `/` and generated the other routes.

## New strings

`NAV.collapse`: "Collapse menu". `NAV.expand`: "Expand menu". No other copy.

## Departures

- `NavContent` is the shared list, the About divider and Theme. The "Team leader" title stays in each shell. Putting Close into a `children(close)` render prop tripped `react-hooks/refs`. The drawer DOM and focus order are the original ones. The side menu has its own `h2` plus the collapse button (`aria-controls` points at the nav). That `h2` is before the page `h1` in document order. Axe heading-order is not in the serious/critical filter. Worth a look in the browser.
- `title={label}` is set in both states so the rail has a hover title before hydration.
- Theme pills are slightly tighter only inside `.sideMenu` (footer and option padding) so the row fits 15rem and stays at least 44px. Drawer padding is unchanged.
- The `/actions` sticky spec starts at 1280×800, then shrinks the height (width stays 1280) until Harbour Point can scroll. The empty log is shorter than 800px, so a heading cannot stick at that height. The 2px tolerance is unchanged.
- Docs were not updated. The brief forbids `docs/`. `docs/ui-design.md` still says the menu is off-canvas at every width and that theme storage is the app's only browser storage. There are now two keys (`team-leader:theme`, `team-leader:sidebar`). The orchestrator should update the Navigation and Theme rows, and the slice spec if AC 47 is added. `npm run check:ac` still reports 46 criteria.

## Existing tests changed

- `tests/unit/ui-screens.test.ts`: the AC 37 source check is renamed. Assertions are the same (top-level `MenuBar`, inner `AppBar`, never both). Added `AC 47: the root layout renders the side menu beside every page`.
- `tests/unit/ui-kind-icons.test.ts`: `kind: "decision"` and `kind="about"` are now expected in `NavContent.tsx`.

Not changed, and not executed: `tests/e2e/navigation-drawer.spec.ts` (stays at 375px). `tests/e2e/penetration-page.spec.ts` (AC 42 sets 1280×800 and checks the material heading plus `assertNoOverflow`). `tests/e2e/site-tabs.spec.ts` (sets 1280×800 and checks `assertNoOverflow`). The side menu is a grid column and `main` stays max-width 45rem, so those assertions should still hold.

## Verification (this run)

| Command | Exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run test:coverage` | 0 |
| `npm run check:ac` | 0 |
| `npm run build` | 0 |
| `npx playwright test --list` | 0 |

Coverage: statements 100% (881/881), functions 100%, lines 100%. Branches 99.85% (673/674). The uncovered branch is the pre-existing one in `src/ui/decisions/api-client.ts` line 83. Vitest: 52 files, 433 passed. `check:ac`: "All 46 acceptance criteria are referenced by tests." Playwright list: 40 tests in 16 files, including the 6 tests in `side-menu.spec.ts` under `chromium-375`.

## Not verified

Playwright was not run. This sandbox cannot launch Chromium. The new specs were typechecked and linted, and `npx playwright test --list` lists them. No browser pass of the layout.

## Orchestrator should check in the browser

- 375px: drawer, "Open menu" on top-level pages, back control on inner pages. Existing 375px specs, including the theme test in `navigation-drawer.spec.ts`.
- 1024px and 1280px, expanded and collapsed: one navigation named "Main", no empty banner on `/sites`, back control still on inner pages, no horizontal scroll, targets at least 44px, axe serious/critical clean.
- `/actions` at 1280px: Harbour Point's `h2` sticks at the top of the viewport (within 2px). The log may need a short viewport before it scrolls.
- A site page: the filter dock sticks directly under the `AppBar`, not under a second offset.
- Reload while collapsed: the rail is already narrow before interaction (no jump back to 15rem). The button name may read "Collapse menu" until hydration, then "Expand menu".
- `tests/e2e/penetration-page.spec.ts` and `tests/e2e/site-tabs.spec.ts` at 1280×800, left unchanged.
