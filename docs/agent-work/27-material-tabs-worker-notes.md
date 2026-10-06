# Material tabs, decision counts

Branch `worker/material-tabs`. No git writes. E2E specs were not executed.

## Tests that failed first

`npx vitest run tests/unit/material-tabs.test.ts tests/unit/material-log.test.ts tests/unit/penetration-material-ids.test.ts tests/unit/ui-penetrations.test.ts --reporter=verbose` (non-zero, before the helpers existed):

- `material-tabs` / `material-log`: cannot find `@/ui/material-tabs` and `@/ui/material-log`.
- `penetration-material-ids`: `penetrationMaterialIds` was undefined on site data.
- AC 44 in `ui-penetrations`: marks ignored the fourth argument (no Escalated × 2, Waiting, or Proposed substitutes × 2); a proposal-only row returned `[]`; the agreement case threw `logCounts is not a function`. The other 17 tests in that file passed.

The same four files then passed (25 tests).

## Files

Created:

- `src/ui/material-tabs.ts`
- `src/ui/material-log.ts`
- `src/ui/MaterialLog.tsx`
- `tests/unit/material-tabs.test.ts`
- `tests/unit/material-log.test.ts`
- `tests/unit/penetration-material-ids.test.ts`

Changed:

- `src/app/materials/[materialId]/page.tsx`
- `src/app/sites/[id]/page.tsx`
- `src/app/sites/[id]/site-frame.tsx`
- `src/application/readiness.ts`
- `src/ui/Icon.tsx`
- `src/ui/RowMark.tsx`
- `src/ui/messages.ts`
- `src/ui/penetrations.ts`
- `src/ui/status.ts` (`IconName` gained `"swap"`)
- `tests/e2e/ac30-status-text.spec.ts`
- `tests/e2e/ac31-keyboard.spec.ts`
- `tests/e2e/penetration-page.spec.ts`
- `tests/e2e/scenario.spec.ts`
- `tests/e2e/stock-down.spec.ts`
- `tests/e2e/support.ts`
- `tests/unit/ui-penetrations.test.ts`

Deleted: none. No file outside this list was modified.

Removed as unused:

- `noteDecision` in `src/ui/penetrations.ts` (the function; the file stays).
- The material-page `StatusChip` for `shortageState` ("Waiting", "Escalated", "No decision yet"). `shortageState` itself stays; `decisionMark` still uses it. The "Earlier decision, shortfall has grown" chip stays.

## Page-only material ids

`SiteData.penetrationMaterialIds: Readonly<Record<string, readonly string[]>>` on `src/application/readiness.ts`.

Filled in `buildSiteData` by `penetrationMaterialIds()`, which calls `nominatedMaterialIds()`: first occurrence of each material id for the nominated code, in solution-material mapping order. Threaded through `SiteFrameData` (`{}` when the site load failed). Not on `SiteReadinessView`. `getSiteReadiness` still returns only `.readiness`.

Row counts use `logCounts(penetrationLog(...))` with those ids, so they match the penetration Actions log.

## New user-visible strings

- `Stock`
- `At {site name}`
- `We can't check 1 site's actions right now. Its decisions are not listed.`
- `We can't check {n} sites' actions right now. Their decisions are not listed.`
- `We can't load this material's actions right now. Try again shortly.`
- `Nothing recorded for this material yet.`
- `Can't check decisions right now. Rows don't show them.`
- `Proposed substitute` / `Proposed substitutes × n`
- Decision marks `Escalated` / `Escalated × n` and `Waiting` / `Waiting × n` (the words existed; the count is now always shown, including 1)

`Actions log` is the existing `NAV.actions` label. Status chips on `ActionRow` ("Still applies" and so on) are unchanged.

## Departures

- `materialTabHref(materialId, tab, from?, fromLog?)` keeps `fromLog` as well as `from`, so a page opened from the actions log still returns there after a tab click. The brief's example had three arguments.
- Tab links do not keep a hash. Clicking a tab drops `#site-site-b`. Back still uses `from`.
- Only a `from` the material use case accepted (`detail.back.penetrationId`) is put on the tab links. When the detail read is unavailable, the tabs omit `from` and `fromLog`.
- `tests/e2e/ac30-status-text.spec.ts` was not in the brief. It asserted "No decision yet" on the collar and Kingsway sections. Those assertions now expect a count of 0. Need, scope, and Wait/Escalate stay. The test title still says "and its state as text".
- `docs/` was not edited. Spec AC 39 still describes the state labels, and AC 44 does not mention proposal counts. `check:ac` still requires AC 1–45 only.
- `tests/e2e/stock-malformed.spec.ts` was left as it was. It still expects the stock unavailable panel on `/materials/MAT-SEALANT` and does not visit `?tab=log`.

## Stock-down material page

Implemented, not browser-checked. With stock down, both the material detail and `listAllActions` are unavailable.

`/materials/MAT-SEALANT`: h1 "Material"; Stock is current; Actions log has no number; panel "Can't check stock right now. Don't assume any material is in stock. Try again."; no Wait or Escalate; no "Needs"; no "Nothing recorded"; no exact "0".

`?tab=log`: "We can't load this material's actions right now. Try again shortly." The Actions log tab still has no number. No "Nothing recorded" and no exact "0".

## Verification

E2E specs were not run. `npx playwright test --list` listed 34 tests in 15 files, including the new AC 39 / AC 46 material-tab test.

| Gate | Command | Exit |
|---|---|---|
| typecheck | `npm run typecheck` | 0 |
| lint | `npx eslint . --ignore-pattern '.next-e2e-pop/**'` | 0 |
| coverage | `npm run test:coverage` | 0 (424 passed, 50 files; statements 100% 858/858; branches 99.84% 651/652, the gap is the existing `src/ui/decisions/api-client.ts` line 83; functions 100%; lines 100%) |
| AC coverage | `npm run check:ac` | 0 (all 45 spec ACs referenced) |
| build | `npm run build` | 0 (Next.js 16.3.8) |
| playwright list | `npx playwright test --list` | 0 |

## Not verified

- No Chromium run. Playwright, axe, 375 px layout, and the write specs were not executed.
- The partial-site banner ("We can't check N site's actions…", no tab count, no empty sentence) is unit-tested only.
- The swap icon was not seen in a browser.

## Orchestrator browser check

- Material tabs at 375 px (Stock and Actions log, count only when every site was read, including a readable 0).
- Site-list row marks with counts, including a count of 1. Order: problems, escalated, waiting, proposed. Problems still hide a count of 1.
- The proposal icon (two opposing arrows, neutral).
- Back from a material page opened from a penetration, on both tabs ("Back to L2, Plant room" for `?from=pen-c-05`, and "Back to L3, Riser 2" after the scenario tab click, which must keep `from=pen-b-01`).
