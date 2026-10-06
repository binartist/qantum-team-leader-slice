# BRIEF: icon-only row marks, and Solution / Actions log tabs on the penetration page

## Role

You are the **worker** for this brief. Execute it. Do not engage another external worker or hand the brief back up. In-harness helpers (subagents) are allowed one level deep, never two editing the same file. The orchestrator reviews everything you produce and runs its own gates, including Playwright. This brief outranks any per-turn instruction that contradicts it. Do not keep a task ledger or `tasks/todo.md`. Durable notes go in `NOTES.md`. Do not run `git add`, `git commit` or any git write command: the orchestrator commits.

## Facts

- **Project**
  - The cwd is a git worktree of the repo on branch `worker/penetration-tabs`, at clean commit 3403947.
  - Stack: Next.js 16 App Router, React 19 with the React Compiler lint, strict TypeScript, Vitest, Zod 4, and Playwright with axe. Styles are CSS Modules in `src/ui/primitives.module.css`, with tokens in `src/app/globals.css`. Read `node_modules/next/dist/docs/` before using any Next API you are unsure of.
  - **Dependencies are installed. Do not run `npm install`, and do not edit `package.json` or the lockfile.**
  - No `.env.local` is needed.
- **Read first:**
  - `AGENTS.md`
  - `docs/ui-design.md`: the rows for `/sites/[id]` and `/sites/[id]/penetrations/[pid]`, and the last design notes
  - `docs/slice-specification.md` section 4: AC 34, 43 and 44
  - `src/ui/penetrations.ts`: `listFactChips`, `decisionChips`, the `DecisionChip` type
  - `src/ui/PenetrationGroups.tsx`, `src/ui/DecisionChip.tsx`, `src/ui/StatusChip.tsx`
  - `src/app/sites/[id]/page.tsx`
  - `src/app/sites/[id]/penetrations/[pid]/page.tsx`
  - `src/app/actions/actions-log.tsx` and `page.tsx`, and `src/ui/ActionRow.tsx`
  - `src/application/actions.ts` (`listActions`, `SiteActions`) and `src/application/candidates.ts` (`PenetrationDetail`, around line 87)
  - `src/ui/format.ts`: `actionLink`, `actionTarget`, `actionSentence`, `fromLogPath`, `materialPagePath`
  - `src/ui/actions-log.ts`, `src/ui/penetration-filters.ts`, `src/ui/PenetrationFilters.tsx` (the link-chip pattern)
  - `src/app/_lib/cached.ts`
  - `tests/unit/ui-penetrations.test.ts`
  - `tests/e2e/ac31-keyboard.spec.ts`, `tests/e2e/penetration-page.spec.ts`, `tests/e2e/support.ts`
- **Layering:**
  - `src/domain` is pure and is **not touched**.
  - Pages call use cases through the React `cache` wrappers in `cached.ts`, and through `loadPage`, which maps `UpstreamError` to unavailable.
  - UI code must not import `@/server`, `@/adapters`, `@/ports` or `pg`.
  - Testable UI logic lives in pure functions in `src/ui/*.ts`. Those files, and `src/domain/**`, must keep **100% statement coverage**.
- **Safety:** missing data is never zero and never "nothing recorded". A log that cannot be read says so.
- **Back controls:**
  - `BackControl` pops history when the page it names is the one underneath (`src/ui/nav-history.ts`). Otherwise it follows its link.
  - A material page opened with `?from=<penetrationId>` goes back to that penetration.
  - Pages opened from the actions log carry `?fromLog=<siteId>`, and the penetration page honours it (look at `logOrigin` / `logBack`).
- **Sample data:** site-b (Harbour Point) pen-b-01 is "L3, Riser 2", nominating 0438, with the sealant and collar shortages. Site-c (Kingsway) has data problems (for example pen-c-03, with an unknown code).
- **E2E store:** the e2e write project escalates the collar (ac31) and the sealant, and proposes 0451 on pen-b-01 (scenario). Read-only specs must not depend on a write.
- **Your sandbox cannot launch Chromium.** Update and add e2e specs carefully, make sure they typecheck and lint, and state that they were not run. `npx playwright test --list` must succeed.

## Decisions already made (approved spec, do not relitigate)

### 1. Icon-only marks on list rows (AC 44 is rewritten)

- **What a row shows.** Every chip on a site-list row becomes a small icon in its tone colour, on one line under the place line. This covers both:
  - problem marks: Unknown solution, Doesn't fit, No materials, Invalid quantity, Short material, Stock unknown
  - decision marks: Escalated, Waiting
- **Counts and order.**
  - A kind that repeats shows its count as visible text beside the icon. "Short material × 2" becomes the stop icon followed by "2". A single one shows the icon only.
  - Order is unchanged: problems first, then escalated, then waiting.
- **Labels.** Every mark carries its full wording as a visually hidden label, using the existing `.srOnly` class in `primitives.module.css`, for example "Short material × 2" or "Escalated". It also has a `title` with the same wording.
  - The icons differ by shape as well as colour, so colour is never the only signal.
  - The visible count is `aria-hidden`, so a screen reader hears the label once.
- **No popover; marks go back inside the row link.** They are plain spans, not buttons.
  - Delete `src/ui/DecisionChip.tsx`, the `decisions` prop of `PenetrationGroups`, the `.penetrationRow` and `.decisionChips` styles if they become unused, and every popover style.
  - `decisionChips` and its `DecisionChip` type go too, unless the penetration log (below) reuses part of them. In that case keep only what is used.
  - The row is again one link and one tap target. Remove orphaned messages and helpers.
- **The function behind the marks.** `listFactChips` becomes `rowMarks(penetrationId, shortages, blockers)` in `src/ui/penetrations.ts`. Each mark is `{ label, tone, icon, count }`, where `label` is the full wording and `count` is a number, 1 for a single one.
  - Problems are counted as today.
  - Decision marks follow the Acted filter's rule: at most one Escalated and one Waiting.
  - Rename the call site.
  - Unit test name: "AC 44: a row shows each problem and decision as an icon with its full wording".
- **New component** `src/ui/RowMark.tsx` (server component):
  - Markup: `<span className={styles.rowMark + tone} title={label}><Icon name={icon}/>{count > 1 ? <span aria-hidden="true">{count}</span> : null}<span className={styles.srOnly}>{label}</span></span>`
  - Styling: compact, no border or pill. Each mark is the icon at the chip's icon size in the tone colour (`.danger`, `.warning`, `.escalation`, `.info` tone classes exist), with the count in the same colour and weight, spaced by about 0.5rem.
  - Rows: keep the place line, the marks line and the "Substitutes ›" cue. The row may get shorter.

### 2. Penetration page tabs: Solution and Actions log (new AC 45)

- **Tab bar.**
  - Directly under the page `h1` on `/sites/[id]/penetrations/[pid]`, add a tab bar. It is a `<nav aria-label="Penetration">` holding two links. Style them like the filter chips (`styles.filterChip` and `filterBar`, or a matching new `.tabBar`/`.tab`), with `aria-current="page"` on the current one. Do not use ARIA `tablist`: these are links that navigate.
  - Labels: **"Solution"**, and **"Actions log"** followed by a count (`styles.tabCount`).
  - Tabs: Solution (default, no query) and Actions log (`?tab=log`). An unknown or repeated `tab` value means Solution.
  - The tab links keep `fromLog` when the page has a valid one. Add a pure helper, for example `penetrationTabHref(siteId, penetrationId, tab, fromLog?)` in `src/ui/format.ts` or a new `src/ui/penetration-tabs.ts`, with tests.
  - Each tab is a target of at least 44 px.
- **Solution tab:** today's content, unchanged: nominated solution, Substitutes, Escalate for a data problem.
- **Actions log tab:** this penetration's decisions and proposals, newest first, with the same entry content as `/actions`. Reuse `ActionRow` and `ProposalRow`, with card headings at `h3` under an `h2` "Actions log" that may be visually hidden. Do not show "Recorded actions" and "Proposed substitutes" subheadings; use one combined list, newest first by `createdAt`.
  - **Which decisions.** A shortage action is included when its `shortageId` is `${siteId}:${materialId}` for a material of this penetration's **nominated solution**, or is `${siteId}:blocker.${penetrationId}`.
    - The material list comes from a new **additive** field `materialIds: readonly string[]` on `PenetrationDetail` in `src/application/candidates.ts`, beside `materialNames`. `PenetrationDetail` is page-only, with no API route.
    - This rule keeps resolved decisions on the tab too.
  - **Which proposals:** those with `penetrationId === pid`.
  - **Filter function.** A pure function in `src/ui/` does the filtering and merging, for example `penetrationLog(listed, siteId, penetrationId, materialIds)`, returning a single sorted entry list. Unit test name: "AC 45: a penetration's log has its shortage, data-problem and proposal decisions, newest first". Cover:
    - another penetration's data problem is excluded
    - another material is excluded
    - a resolved decision is kept
    - the ordering
    - an unparseable date keeps the original order
- **Entry links.**
  - A material decision that is not resolved links to `materialPagePath(materialId, { siteId, penetrationId: pid })`, which gives `?from=pid#site-…`, so back returns here.
  - A resolved material decision has no link.
  - Data-problem decisions and proposals have **no link**: they are about this page.
- **Scope note.** Under a material decision's sentence, add a muted line, "Applies to all N penetrations at this site". N is the length of the current readiness shortage's `penetrationIds` for that material. Omit the line when the shortage is no longer in readiness, which happens when it is resolved. This wording is a new message.
- **Data loading.** Read the site's log with a cached `listActions` wrapper (re-add `getCachedActions(siteId)` in `cached.ts`) through `loadPage`. Load it on **both** tabs, because the tab label shows the count.
  - The count is the number of entries in this penetration's log.
  - When the read is unavailable:
    - The tab label shows no number.
    - The Actions log tab body shows an `UnavailablePanel` with a new message, "We can't load this penetration's actions right now. Try again shortly."
    - The Solution tab still renders.
    - Never show 0 or "Nothing recorded" when the log is unavailable.
  - An empty, readable log shows "Nothing recorded for this penetration yet."
- **Back controls** (check the existing behaviour holds).
  - From the log tab, a material entry opens the material page with `?from=pid`. Its back control names the penetration, and because that page is underneath, back pops to `?tab=log`.
  - The penetration's own back control is unchanged: to the site, or to the actions log when `fromLog` is valid.

### Out of scope

- No API, domain, database or sample-data change.
- No change to `/actions`.
- No client-side tab state.
- No tab for data problems.

## Files you may change or create

Edit or create under `src/app/**`, `src/ui/**`, `src/application/candidates.ts` (only the additive `materialIds`), `tests/**`, and `NOTES.md`. Delete `src/ui/DecisionChip.tsx` and any other file that becomes orphaned; list each deletion in the notes.

Do **not** touch `docs/`, `data/`, `src/domain/`, `src/ports/`, `src/adapters/`, `src/server/`, `scripts/`, `.github/`, `package*.json`, or config files. The orchestrator writes the docs and the spec ACs.

## Method (test first)

For every pure function, write or update the unit test first, run it and see it fail, then implement. Record in `NOTES.md` which tests failed first. Name the tests with the AC number: **AC 44** for row marks, **AC 45** for the tabs and the penetration log. Unit tests that assert removed things (decision chips, popover) are rewritten, not deleted silently. Say in the notes which ones.

E2E (do not weaken assertions; rewrite each one to the new design):

- `tests/e2e/ac31-keyboard.spec.ts`
  - Replace the decision-chip popover block with:
    - the pen-b-01 row link (`a[href$='/penetrations/pen-b-01']`) contains the hidden label text "Escalated", and has an svg mark
    - the row link has no `button` descendants
  - Then open `/sites/site-b/penetrations/pen-b-01?tab=log`, and check:
    - the "Actions log" tab is `aria-current="page"` and has a count
    - the log shows "Escalated to purchasing: Pipe collar for 25 mm pipe", "Noted from the keyboard" and "Applies to all 4 penetrations at this site"
  - Click that entry, and check:
    - the URL is `/materials/MAT-COLLAR-25?from=pen-b-01#site-site-b`
    - "Back to L3, Riser 2" returns to `/sites/site-b/penetrations/pen-b-01?tab=log`
  - `assertTargets` passes on the log tab.
- **Read-only checks** (new tests in `tests/e2e/penetration-page.spec.ts`, named `AC 45: …`):
  - on `/sites/site-c/penetrations/pen-c-03`, both tabs are present, Solution is current, and the content is unchanged
  - `?tab=log` before any write shows "Nothing recorded for this penetration yet."
  - a junk value, `?tab=junk`, shows Solution
  - the tab links keep `fromLog=site-c` when it is given
  - `assertTargets`, `assertNoOverflow` and `assertAxe` pass on the log tab at 375 px
- **Stock-down project** (`tests/e2e/stock-down.spec.ts`): with stock down, the site's log is unreadable, so the penetration page cannot load readiness either. Assert whatever the page actually shows: it must never show "Nothing recorded" or a 0 count. Record in the notes what it shows.
- **`tests/e2e/scenario.spec.ts`:** keep it passing. If it asserts row chip text or the popover, adapt it to the hidden labels.
- **`tests/e2e/support.ts`:** add `/sites/site-b/penetrations/pen-b-01?tab=log` to `screens`.

## Verification (run before finishing; record exit codes in NOTES.md)

```bash
npm run typecheck
npx eslint . --ignore-pattern '.next-e2e-pop/**'
npm run test:coverage
npm run check:ac
npm run build
npx playwright test --list
```

All must exit 0, with 100% statement coverage on `src/domain/**` and `src/ui/*.ts`.

- Do not use `any`, `@ts-ignore` or `eslint-disable`.
- Do not start long-running processes: no `npm run dev`, no Playwright run.
- `check:ac` counts the ACs in the spec, which you do not edit. That is fine: it only checks that every spec AC has a test.

## Honesty constraints

- Do not claim a command passed unless you ran it and saw the exit code.
- Say plainly that the e2e specs were not run.
- If a decision above seems wrong or impossible, implement the closest faithful version and record the disagreement.
- If an expected value does not come out, report the actual value. Do not change the expectation to fit.

## NOTES.md

Keep it short and factual. Include:

- the tests that failed first
- the files created, changed and deleted
- every new user-visible string
- departures from the brief, and why
- what the stock-down penetration page shows
- what you could not verify
- what the orchestrator should check in the browser: row marks at 375 px, the tab bar, and back from a material page to `?tab=log`
