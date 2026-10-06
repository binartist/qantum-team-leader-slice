# Penetration tabs and row marks

## Tests that failed first

`npx vitest run tests/unit/ui-penetrations.test.ts tests/unit/penetration-tabs.test.ts tests/unit/penetration-log.test.ts tests/unit/penetration-detail.test.ts tests/unit/ui-kind-icons.test.ts --coverage.enabled=false` at 08:05:44, before the functions existed.

Vitest: Test Files 5 failed (5). Tests 9 failed | 19 passed (28). The shell exit was 0 only because the output was piped to `tail` without `pipefail`.

The visible failures were `TypeError: rowMarks is not a function` in the compact-mark and AC 44 cases. The other files failed to load: `penetration-tabs` and `penetration-log` were missing, `materialIds` was not on the detail, and `RowMark.tsx` was not in the kind-icon list. The same five files passed on the re-run (33 tests).

## Rewritten tests (not deleted)

`tests/unit/ui-penetrations.test.ts` replaced the old AC 44 chip/popover cases:

- "a decision chip carries the latest decision of its kind that still applies"
- "lets the newer escalation win and skips an action that no longer applies"
- "uses a blocker decision, named by its place"
- "lists escalated before waiting"
- "omits the chip when no current action of that kind exists"
- "keeps the first action when the dates tie or cannot be read"
- "names the chip with the place"

Marks now follow shortage and blocker state (the Acted rule), not the newest action text. `tests/unit/ui-kind-icons.test.ts` now checks row marks instead of decision chips.

`tests/e2e/scenario.spec.ts` was left as it is. It asserts chip wording with `toContainText` on the row link. Playwright 1.63 includes the visually hidden label in that text. It was not run.

## Files

Created: `src/ui/RowMark.tsx`, `src/ui/PenetrationLog.tsx`, `src/ui/penetration-log.ts`, `src/ui/penetration-tabs.ts`, `tests/unit/penetration-log.test.ts`, `tests/unit/penetration-tabs.test.ts`.

Changed: `src/ui/penetrations.ts`, `src/ui/PenetrationGroups.tsx`, `src/ui/ActionRow.tsx`, `src/ui/messages.ts`, `src/ui/primitives.module.css`, `src/app/sites/[id]/page.tsx`, `src/app/sites/[id]/penetrations/[pid]/page.tsx`, `src/app/_lib/cached.ts`, `src/application/candidates.ts` (`materialIds` only), `tests/unit/ui-penetrations.test.ts`, `tests/unit/ui-kind-icons.test.ts`, `tests/unit/penetration-detail.test.ts`, `tests/e2e/ac31-keyboard.spec.ts`, `tests/e2e/penetration-page.spec.ts`, `tests/e2e/stock-down.spec.ts`, `tests/e2e/support.ts`.

Deleted: `src/ui/DecisionChip.tsx`. Popover, `.penetrationRow` and `.decisionChips` styles went with it. `.factChips` stayed (materials page).

An earlier pass also edited `README.md` and `docs/` (AC 44 rewrite, AC 45, design note). Those files are outside this brief, so they were restored to HEAD.

## New user-visible strings

- "We can't load this penetration's actions right now. Try again shortly."
- "Nothing recorded for this penetration yet."
- "Applies to all N penetrations at this site"
- Tab label "Solution". "Actions log" is the existing nav label. A readable log shows its count, including 0. An unreadable log shows no number.

Removed with the popover: "latest decision for".

## Departures

- The scope line is `materialDecisionScope` / `appliesToPenetrations`, called from the page with the current readiness shortages. `penetrationLog` does not take shortages, so a resolved decision (no longer in readiness) gets no line.
- Marks are 0.5rem apart. The icon and its count are 0.15rem apart. `.rowMark` clears the tone background and is `position: relative`, so the mark is not a pill and the hidden label stays in the row.
- Docs and README were restored to HEAD. The committed spec still describes decision chips and the popover, and it has 44 criteria. The orchestrator owns that update.

## Stock-down penetration page

Inferred from the load order, not from a browser run. `getCachedCandidates` calls stock before the page loads the log. With stock down that throws, and the page returns the existing site-unavailable screen: h1 "Harbour Point, Levels 3 to 5", banner "Can't check this site right now. Don't assume it's clear. Try again.", no Penetration tab bar, no count, no "Nothing recorded". `tests/e2e/stock-down.spec.ts` asserts that.

## Gates

- `npm run typecheck` — exit 0
- `npx eslint . --ignore-pattern '.next-e2e-pop/**'` — exit 0
- `npm run test:coverage` — exit 0. Statements 100% (798/798) on the coverage include. Branches 99.83% (611/612); the uncovered branch is the existing `src/ui/decisions/api-client.ts` line 83. Tests 413 passed, 1 skipped.
- `npm run check:ac` — exit 0. "All 44 acceptance criteria are referenced by tests." (After the docs restore. An earlier run, while the spec edit was still in the tree, reported 45.)
- `npm run build` — exit 0
- `npx playwright test --list` — exit 0. 32 tests in 15 files.

## Not verified

Playwright specs were not run. This sandbox cannot launch Chromium. No dev server was started.

In the browser, check: row marks at 375px (icon, count, one link, no button), the Solution / Actions log tab bar, and back from a material entry on `?tab=log` to `/sites/site-b/penetrations/pen-b-01?tab=log`.
