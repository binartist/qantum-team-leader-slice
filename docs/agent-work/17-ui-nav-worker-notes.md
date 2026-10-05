# Navigation shell notes

## Tests that failed first

`npx vitest run tests/unit/ui-format.test.ts tests/unit/ui-screens.test.ts` exited 1 before the implementation. 6 failed, 16 passed.

- `formatReference` is not a function (`labels the code with the word Ref`, and the forbidden-words case that calls it).
- `global-error.tsx` had no `<footer`.
- No screen source contained `<AppBar` (`page.tsx` was the first file in the loop).
- `layout.tsx` had no `<footer`.
- `SiteCard.tsx` did not call `formatReference(reference)`.

## What landed

- `AppBar` (`src/ui/AppBar.tsx`) is the only `<header>` and the only `<h1>`. Inner screens pass `backHref` and `backLabel` (`BUTTONS.backToSites` / `backToSite`). The control is a 44×44 link with `aria-label` and a `chevron-left` icon (`aria-hidden` on the svg). Home, loading, and both error screens have no back control. The actions-log `LinkButton` is unchanged.
- Root layout: announcer, page, then the only `<footer>` with the existing demo sentence and colours. `global-error.tsx` repeats that footer text and an `AppBar` title, and does not import server code.
- Site cards and the readiness screen (including the readiness-unavailable branch) show `formatReference`, which returns `Ref ${reference}`.

## Departure

`min-height: 100dvh`, `main` growing, and `footer { position: sticky; bottom: 0 }` are all set. Sticky does not pull a footer that follows long content up into the viewport, so a long document scroll would hide the bar until the end. `body` also has `height: 100dvh`, and `main` is the vertical scroller (`flex: 1 1 auto`, `min-height: 0`, `overflow: auto`). The footer then stays on screen and does not cover `main`. The header is the flex sibling above `main` (top-level banner), with `position: sticky; top: 0`, an opaque `--bg` background, and a bottom border. It stays put because `main` scrolls under it. `html` has `scroll-padding-top: 6.5rem` (about three wrapped title lines). That padding is on the document scrollport; focused controls in `main` are not under the header.

`tests/e2e/support.ts` `assertNoOverflow` still checks `documentElement` and also checks `main`, so the inner scroller cannot hide sideways overflow.

No new colour tokens. App bar text is `--text` on `--bg`: light `#1a1a1a` / `#ffffff` 17.40:1, dark `#ececec` / `#121316` 15.72:1. Demo bar is unchanged `--warning-text` on `--warning-bg`: light `#6b4500` / `#fff4d6` 7.74:1, dark `#ffd98a` / `#3d2e08` 9.76:1. The bar's border is the existing `--border` on `--bg` (light 1.43:1, dark 1.58:1), the same separator the cards use.

## Docs not edited

The brief forbids `docs/` edits. These are now stale:

- `docs/ui-design.md` §2 (demo line is a footer, not a top banner), §3 (chevron back control; reference reads `Ref ` plus the code), §5 (banner is the app bar, contentinfo is the demo footer, the single `h1` is in the app bar).
- `docs/submission-checklist.md` test count: unit/API is 273 passed and 5 skipped; Playwright list is 12 tests.

## Not verified here

Playwright was not run. Chromium cannot be launched in this sandbox. `npx playwright test --list` exited 0 (12 tests). No existing e2e asserted the demo line was at the top. Back links were already queried by accessible name (`Back to sites` / `Back to site`) and those assertions were left in place. The new assertions are in `tests/e2e/home-status.spec.ts`.

## Orchestrator should check in the browser

- Sticky header and footer on `/sites/site-b` while `main` is scrolled: both stay visible, the footer does not cover the last card, and the footer stays below `main`.
- An open dialog (escalate, wait, propose) covers the footer. Dialogs use `showModal`, so they are in the top layer above the footer's `z-index: 1`.
- 200% zoom and a 375px width: titles wrap, no sideways scroll, back control still at least 44×44. Short screens with no control inside `main` (not-found, loading) should still be readable if `main` starts to scroll.
- Dark mode: app bar and demo bar contrast, and axe in light and dark.
- AC 32 with a dialog open, now that `main` is the scroller.
