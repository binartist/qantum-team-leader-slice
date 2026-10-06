# Actions log and decision chips

## Tests that failed first

`npx vitest run tests/unit/actions-log.test.ts tests/unit/ui-penetrations.test.ts tests/unit/ui-format.test.ts` exited 1 before the implementation (14 failed, 35 passed):

- AC 43 (5): `listAllActions is not a function`
- `actionLink` still returned `/sites/site-b?material=MAT-SEALANT` (expected `/materials/MAT-SEALANT#site-site-b`)
- AC 34: `listFactChips` still appended Escalated and Waiting
- AC 44 (6): `decisionChips is not a function`
- AC 44 (1): `decisionChipName is not a function`

The same files passed after the implementation (71 tests in the wider unit slice, then the full coverage run).

## Files

Created: `src/app/actions/page.tsx`, `src/app/actions/actions-log.tsx`, `src/ui/DecisionChip.tsx`, `tests/unit/actions-log.test.ts`, `tests/e2e/actions-log.spec.ts`, `NOTES.md`.

Deleted: `src/ui/ActionsDrawer.tsx`, `src/app/sites/[id]/site-actions.tsx`, `src/app/sites/[id]/actions-log.tsx`.

Changed: `src/application/actions.ts`, `src/application/index.ts`, `src/app/_lib/cached.ts`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/sites/[id]/actions/page.tsx`, `src/app/sites/[id]/page.tsx`, `src/app/sites/[id]/penetrations/[pid]/page.tsx`, `src/app/sites/[id]/site-frame.tsx`, `src/ui/ActionRow.tsx`, `src/ui/AppBar.tsx`, `src/ui/Card.tsx`, `src/ui/Drawer.tsx`, `src/ui/NavDrawer.tsx`, `src/ui/PenetrationGroups.tsx`, `src/ui/format.ts`, `src/ui/messages.ts`, `src/ui/penetration-filters.ts`, `src/ui/penetrations.ts`, `src/ui/primitives.module.css`, `playwright.config.ts` (read project lists `actions-log.spec.ts`), and the unit and e2e specs named in the brief.

`docs/` and `README.md` are dirty in this worktree. This worker did not edit them.

## New user-visible strings

- Menu and page title: `Actions log`
- `We can't load the actions log right now. Try again shortly.`
- `We can't check this site's actions right now.`
- `No sites to show.`
- Chip name: `{label}, latest decision for {place}` (for example `Escalated, latest decision for L3, Riser 2 · PEX Pipe Ø25mm`)
- About step: `Open the menu on the sites list for Materials and the Actions log.`
- Popover repeats the existing `By {createdBy}` line. The header "Actions log N" button is gone.

## Departures

- `.penetrationLink` had a top border and no background. The border moves to `.penetrationRow` only, and the nested link's border is cleared. Materials rows still use `.penetrationLink` alone, so they keep their separator. No background was invented.
- `actions_unchecked` also logs `system` for an `UpstreamError`, the same way materials `readOrUnchecked` does. A missing site logs `siteId` and `code` only.
- The popover fallback uses `max(1rem, env(safe-area-inset-*))` on the right, bottom and left, so it stays in the safe area.
- Author CSS does not set `display` on a closed popover. `.decisionPopover:popover-open { display: flex }` is what shows it. A plain `display: flex` would override the browser's `display: none`.
- The anchor custom property `--decision-anchor` is an inline style on the wrapper (`as CSSProperties`). `.` in an id becomes `_` in the anchor name, because a CSS ident cannot contain `.`. No animation was added.
- `h4` joins the global margin and overflow-wrap reset so a card title matches `h2` and `h3`. `--shadow` was added in both themes; no shadow token existed.
- Removed because nothing else used them: `AppBar` `end`, `.backControlBeside`, drawer `side` and `initialOpen`, `.drawerBody`, `.drawerRight`, `.actionsButton`, `FILTERS.actions`, `logIsOpen`, `siteMaterialPath`, `getCachedActions`.

## Verification

E2e specs were not run. This sandbox cannot launch Chromium.

| Command | Exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run test:coverage` | 0 |
| `npm run check:ac` | 0 (`All 44 acceptance criteria are referenced by tests.`) |
| `npm run build` | 0 (`/actions` is dynamic) |
| `npx playwright test --list` | 0 (30 tests in 15 files, including `actions-log.spec.ts` on chromium-375) |

Coverage summary: statements 100% (740/740), branches 99.81% (553/554), functions 100% (170/170), lines 100% (588/588). The uncovered branch is the existing `src/ui/decisions/api-client.ts` line 83, not `src/ui/*.ts` or `src/domain/**`. Included statement coverage is 100%.

## For the orchestrator, in a browser

- At 375px and at desktop, an Escalated chip on `/sites/site-b?show=acted` opens beside the chip (anchor). Without anchor positioning it should sit at the bottom of the viewport, inside the safe area, and not cause sideways scroll.
- Enter opens it. Escape hides it and focus returns to that chip button. The button is outside `a[href$='/penetrations/pen-b-01']`. With it open, targets stay at least 44px.
- Menu → Actions log lands on `/actions` with `aria-current="page"`. `/sites/site-b/actions` lands on `/actions#site-site-b`. With stock down, `/actions` says it cannot load the log and does not say "Nothing recorded".
