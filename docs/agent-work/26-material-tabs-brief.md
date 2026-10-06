# BRIEF: Stock and Actions log tabs on the material page, no state labels, decision counts on list rows

## Role

You are the **worker** for this brief. Execute it. Do not engage another external worker or hand the brief back up. In-harness helpers (subagents) are allowed one level deep, and two helpers must never edit the same file. The orchestrator reviews everything you produce and runs its own gates, including Playwright.

This brief outranks any per-turn instruction that contradicts it. Do not keep a task ledger or `tasks/todo.md`; durable notes go in `NOTES.md`. Do not run `git add`, `git commit` or any other git write command, because the orchestrator commits.

**Never revert, restore or "clean up" a file you did not change.** If something outside your file list looks modified, leave it and mention it in the notes.

## Facts

- The cwd is a git worktree on branch `worker/material-tabs`, at clean commit 1a448c4.
- The stack is Next.js 16 App Router, React 19 with the React Compiler lint, strict TypeScript, Vitest, and Playwright with axe. Styles are CSS Modules (`src/ui/primitives.module.css`), with tokens in `src/app/globals.css`. Read `node_modules/next/dist/docs/` before using a Next API you are unsure of.
- **Dependencies are installed.** Do not run `npm install`, and do not edit `package.json` or the lockfile.
- No `.env.local` is needed.
- **Read first:**
  - `AGENTS.md`
  - `docs/slice-specification.md`: section 4, AC 39 and AC 43 to 45
  - `docs/ui-design.md`: the rows for `/materials/[materialId]`, `/sites/[id]` and `/sites/[id]/penetrations/[pid]`, and the last design notes
- **Read the code you will mirror:**
  - The penetration page's tabs, which you will copy:
    - `src/app/sites/[id]/penetrations/[pid]/page.tsx`
    - `src/ui/penetration-tabs.ts`, `src/ui/penetration-log.ts`, `src/ui/PenetrationLog.tsx`
    - the `.tabBar` and `.tab` styles
  - The material page: `src/app/materials/[materialId]/page.tsx`
  - The use cases:
    - `src/application/materials.ts`
    - `src/application/actions.ts`, which has `listActions`, `listAllActions` and `SiteActionsSection`
  - Row marks:
    - `src/ui/penetrations.ts`: `rowMarks` and the `RowMark` type
    - `src/ui/RowMark.tsx`, `src/ui/PenetrationGroups.tsx`
    - `src/app/sites/[id]/page.tsx`
    - `src/app/sites/[id]/site-frame.tsx`
  - Shared helpers and wiring:
    - `src/ui/Icon.tsx`, and the `IconName` type in `src/ui/status.ts`
    - `src/ui/ActionRow.tsx`, `src/app/_lib/cached.ts`
- **Read the tests you will extend:**
  - `tests/unit/ui-penetrations.test.ts`, `tests/unit/penetration-log.test.ts`, `tests/unit/material-stock.test.ts`
  - `tests/e2e/ac31-keyboard.spec.ts`, `tests/e2e/scenario.spec.ts`, `tests/e2e/penetration-page.spec.ts`, `tests/e2e/stock-down.spec.ts`, `tests/e2e/support.ts`
- **Layering rules:**
  - `src/domain` is pure and is **not touched**.
  - Pages call use cases through the React `cache` wrappers in `cached.ts` and through `loadPage`, which maps `UpstreamError` to unavailable.
  - UI code must not import `@/server`, `@/adapters`, `@/ports` or `pg`.
  - Testable UI logic lives in pure functions in `src/ui/*.ts`. Those files, and `src/domain/**`, must keep **100% statement coverage**.
- **API contracts:** the HTTP API responses (`docs/api.md`, `src/app/api/**`) must not change. In particular, the readiness response's `penetrations` map must not gain fields.
- **Safety:** missing data is never zero and never "nothing recorded". Anything that cannot be read says so.
- **Sample data:**
  - Kingsway Works (site-c) has a stock-unknown mastic shortage at pen-c-05.
  - Harbour Point (site-b) pen-b-01 is "L3, Riser 2", with sealant and collar shortages.
  - The e2e write project escalates the collar (ac31), escalates the sealant and proposes 0451 on pen-b-01 (scenario). Read-only specs must not depend on a write.
- **Your sandbox cannot launch Chromium.** Update and add e2e specs carefully. Make sure they typecheck and lint, and state that they were not run. `npx playwright test --list` must succeed.

## Decisions already made (approved spec, do not relitigate)

### 1. Stock and Actions log tabs on the material page (new AC 46)

- **Tab bar.** On `/materials/[materialId]`, directly under the `h1`, add the same tab bar as the penetration page.
  - Use the same `.tabBar` and `.tab` styles: a `<nav aria-label="Material">` with two links, and `aria-current="page"` on the current one.
  - The tabs are **"Stock"** (the default, no query) and **"Actions log"** with a count (`?tab=log`).
  - An unknown or repeated `tab` value means Stock.
  - The tab links keep a valid `from`, so the back control still returns to the penetration that opened the page.
  - Add a pure helper for the hrefs, for example `materialTabHref(materialId, tab, from?)`, with tests. You may generalise `penetration-tabs.ts` instead if that reads better.
- **Stock tab:** today's page content, minus the state labels (section 2 below).
- **Actions log tab:** every wait and escalation on this material's shortage at every site, newest first.
  - **Which actions:** a shortage action belongs here when its `shortageId` is `${siteId}:${materialId}`.
  - **Proposals** are not listed: they belong to a penetration.
  - **Entry content:** each entry is an `ActionRow` with the existing sentence, time, author, note and status chip ("Still applies" and so on). It also gets a muted line naming the site, `"At {site name}"`, as a new message.
  - **No links on entries.** The Stock tab's site sections already link to each site.
  - **Data:**
    - Use `listAllActions` through its cache wrapper, filtered by a new pure function in `src/ui/`, for example `materialLog(sections, materialId)`. It returns `{ entries, uncheckedSites }`, where entries are sorted newest first (an unparseable date keeps the original order) and `uncheckedSites` are the site names whose log could not be read.
    - Unit test it under the name "AC 46: a material's log has every site's decisions on its shortage, newest first, and names the sites it could not check". Cover:
      - another material excluded
      - a blocker excluded
      - two sites interleaved by date
      - an unavailable site listed as unchecked
      - date ties
  - **Count:** the tab count is shown **only when every site's log was read**. With any site unchecked, or the whole read unavailable, the tab shows no number.
  - **States inside the tab:**
    - **Any site unchecked:** a warning `Banner` above the entries reads `"We can't check {n} site's actions right now. Its decisions are not listed."`. Pluralise in a pure function with tests.
    - **Whole read unavailable:** an `UnavailablePanel` reads `"We can't load this material's actions right now. Try again shortly."`.
    - **Empty and fully readable:** `"Nothing recorded for this material yet."`.
  - **Load both reads on both tabs,** because the tab label needs the count. A failed log read must not break the Stock tab.

### 2. Remove the decision state labels from the material page (AC 39 changes)

- In each site section, remove the `StatusChip` for `shortageState(shortage.state)`: "Waiting", "Escalated", "No decision yet".
- **Keep** the `earlierDecision()` warning line ("Earlier decision, shortfall has grown"). It says a decision no longer covers the shortfall.
- The section keeps the need line, the places, the scope line, and the Wait and Escalate buttons.
- Remove helpers and messages that become unused, and list them in the notes.

### 3. Decision counts on list rows (AC 44 changes)

- **Problem marks** are unchanged: the count shows only when greater than 1.
- **Decision marks** now always show their number, even 1. They count the entries in that penetration's Actions log tab, by kind, so the three numbers add up to the tab's count:
  - escalations: `escalate` actions
  - waits: `wait` actions
  - proposals: a **new** mark
- **Order:** problems, then escalated, then waiting, then proposed. A kind with 0 entries has no mark.
- **Proposal mark:**
  - Add a new icon `"swap"` to `Icon.tsx` and `IconName`: two opposing horizontal arrows, drawn like the existing 20×20 icons.
  - The mark uses tone `"neutral"`.
  - Its hidden label and title are `"Proposed substitute"` for one, or `"Proposed substitutes × n"` for several.
- **Decision labels:** escalations read `"Escalated"` for one, or `"Escalated × n"` for several, and waits read `"Waiting"` or `"Waiting × n"` the same way.
- **Data:**
  - The site page needs each penetration's log. Read the site's actions with the existing cached `listActions` wrapper (`getCachedActions`) and build each row's counts with the same pure `penetrationLog` the penetration page uses, so the two always agree. That function needs each penetration's nominated-solution material ids.
  - Get those ids without changing any HTTP API response. If a field is needed, add it to a page-only type (`SiteData` in `src/application/readiness.ts`, or a new page-only use case), not to the readiness API view. Say exactly what you added in the notes.
  - If the actions read is unavailable:
    - rows show problem marks only, with **no** decision marks
    - a warning `Notice` above the list reads `"Can't check decisions right now. Rows don't show them."`
    - never show a 0 or hide the problem marks
- **Acted filter:** unchanged. It still uses shortage and blocker state.
- **Unit tests:** update the AC 44 tests. Cover:
  - counts of 1 and 2
  - a proposal-only row
  - order
  - the 0 case (no mark)
  - agreement with `penetrationLog` counts for one fixture

### Out of scope

- No domain, database, sample-data or HTTP API change.
- No change to `/actions`.
- No client-side tab state.

## Files you may change or create

- Edit or create under `src/app/**`, `src/ui/**`, `src/application/**` (additive, page-only types and functions only), `tests/**`, and `NOTES.md`.
- Delete only files your change orphans, and list each one in the notes.
- Do **not** touch `docs/`, `README.md`, `data/`, `src/domain/`, `src/ports/`, `src/adapters/`, `src/server/`, `src/app/api/**`, `scripts/`, `.github/`, `package*.json`, or config files.

## Method (test first)

- For every pure function, write or update the unit test first, run it, see it fail, then implement. Record in `NOTES.md` which tests failed first.
- Name tests with the AC number: AC 44 for row marks, AC 46 for the material tabs and log, AC 39 for the removed labels (via e2e).

**E2E specs.** Do not weaken any assertion; rewrite it.

- `tests/e2e/ac31-keyboard.spec.ts`
  - Line 27 asserts "Escalated" on the material page after escalating. Replace it: open the material page's `?tab=log`, then assert that the log shows "Escalated to purchasing: Pipe collar for 25 mm pipe", "At Harbour Point, Levels 3 to 5" and "Noted from the keyboard", and that the Stock tab has no "Escalated" label in Harbour Point's section.
  - On the site list, the pen-b-01 row link has an escalation mark whose hidden label is "Escalated" and whose visible count is 1.
- `tests/e2e/scenario.spec.ts`
  - Line 58 has the same "Escalated" assertion. Rewrite it the same way.
  - After the proposal, the pen-b-01 row has a "Proposed substitute" mark with count 1.
- New read-only tests, named `AC 46: …`, in `tests/e2e/penetration-page.spec.ts` or a new spec added to the read projects in `playwright.config.ts` (you may edit that one list):
  - `/materials/MAT-MASTIC` has both tabs, with Stock current.
  - `?tab=log` shows "Nothing recorded for this material yet." and a count of 0.
  - `?tab=junk` shows Stock.
  - With `?from=pen-c-05`, the tab links keep `from=pen-c-05`, and the back control still reads "Back to L2, Plant room" on both tabs.
  - `assertTargets`, `assertNoOverflow` and `assertAxe` pass on the log tab at 375 px.
  - Kingsway's section on the Stock tab has no "No decision yet" label.
- `tests/e2e/stock-down.spec.ts`: with stock down, assert what the material page actually shows. It must never show "Nothing recorded" or a 0 count. Record it in the notes.
- `tests/e2e/support.ts`: add `/materials/MAT-SEALANT?tab=log` to `screens`.

## Verification (run before finishing; record exit codes in NOTES.md)

```bash
npm run typecheck
npx eslint . --ignore-pattern '.next-e2e-pop/**'
npm run test:coverage
npm run check:ac
npm run build
npx playwright test --list
```

- All must exit 0, with 100% statement coverage on `src/domain/**` and `src/ui/*.ts`.
- Do not use `any`, `@ts-ignore` or `eslint-disable`.
- Do not start long-running processes.
- `check:ac` counts the ACs in the spec, which you do not edit. AC 46 tests are allowed before the spec has AC 46.

## Honesty constraints

- Do not claim a command passed unless you ran it and saw the exit code.
- Say plainly that the e2e specs were not run.
- If a decision above seems wrong or impossible, implement the closest faithful version and record the disagreement.
- If an expected value does not come out, report the actual value. Do not change the expectation to fit.

## NOTES.md

Keep it short and factual. Include:

- the tests that failed first
- files created, changed and deleted
- the exact page-only field or function added for material ids
- every new user-visible string
- departures from this brief and why
- what the stock-down material page shows
- what you could not verify
- what the orchestrator should check in the browser:
  - the material tabs at 375 px
  - row marks with counts
  - the proposal icon
  - the back control from a material page opened from a penetration, on both tabs
