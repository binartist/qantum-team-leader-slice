# BRIEF: usability fixes from the UX review

## 1. Role

You are the **worker** for this brief. Execute it. Do not engage another external worker or hand the brief back up. Your own in-harness helpers (subagents) are allowed within limits: one level deep, and never two helpers editing the same file. The orchestrator reviews everything you produce and runs its own gates. This brief outranks any per-turn instruction that contradicts it. Do not keep your own task ledger or `tasks/todo.md`. Durable notes go in `UI-UX-NOTES.md`. Do not run `git add`, `git commit` or any git write command: the orchestrator commits.

## 2. Facts

- Cwd is the repo root: Next.js 16.3 (read `node_modules/next/dist/docs/` before using Next APIs you are unsure of), strict TypeScript, Vitest, Zod 4, Playwright, CSS Modules plus tokens in `src/app/globals.css`. **Dependencies are installed. Do not run `npm install` and do not edit `package.json` or the lockfile.**
- The app works and is fully tested: 273 unit and API tests, 100% coverage on `src/domain/**` and `src/ui/*.ts`, 12 Playwright tests. The working tree has **uncommitted** navigation changes (`AppBar` with title header and a back row below it, bottom demo footer, "Ref" label). They are correct; build on them, do not revert them.
- A UX review against the exercise brief asked: *can a team leader understand the information and take the intended action, including when information is missing or work is blocked?* This brief fixes what it found. Users are construction team leaders on a phone before sending a crew to site; they know passive fire terms like "penetration" but not internal catalogue codes or rating shorthand.
- Read first: `AGENTS.md`, `docs/ui-design.md` (all, especially sections 3, 4 and 9), `docs/api.md`, `docs/glossary.md` (integrity, insulation, nominated solution), `src/application/{readiness,sites,candidates,actions}.ts`, `src/app/**/page.tsx`, `src/ui/**`, `tests/unit/ui-*.test.ts`, `tests/api/routes.test.ts`, `tests/e2e/*`.
- Sample data: material units are `each`, `cartridge`, `metre`, `tube`. Readiness `asOf` is the request time; `stockAsOf` is the stock snapshot time (fixed in the sample at 3 Oct 2026, 08:00 UTC).
- `src/domain/` is not touched. Never modify `data/*`.
- **Your sandbox cannot launch Chromium** (SIGSEGV). Update e2e specs carefully, make sure they typecheck and lint, and say they are unrun. The orchestrator runs them.
- Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run build`, `npm run check:ac`.

## 3. Changes (decisions made, do not relitigate)

Keep the copy rules in `docs/ui-design.md` section 4 (plain words, sentence case, no "please", no "successfully", never "compatible" or "approved"). Put every new string in `src/ui/messages.ts` or a pure formatter in `src/ui/*.ts`, with unit tests.

| # | Problem | Change |
| --- | --- | --- |
| 1 | Affected-penetration rows are indistinguishable (four "L3, Riser 2") | **Additive API field:** readiness `penetrations` map entries gain `serviceType` and `serviceSize` (from the nomination). Each row reads `"{floor}, {location} · {serviceType} {serviceSize}"` on line one and `"Solution {nominatedCode}"` on line two, and the whole row is the link to its substitutes screen with a trailing chevron and the visible words "Substitutes". Cover the new fields in `tests/api/routes.test.ts` |
| 2 | Substitution is buried | Rename the disclosure summary to `"Penetrations and substitutes ({n})"` and give it a visible chevron that rotates when open (no animation if `prefers-reduced-motion`; a static marker is fine). Inside, group rows by nominated solution with a small subheading `"Solution 0438 · 4"` when the shortage spans more than one nominated solution; with one solution, no subheading. Add one sentence above the rows: `"Open a penetration to see possible substitutes."` Do not add counts of candidates (no new API call) |
| 3 | "Rating 60/30" and bare codes are unexplained | Replace every "Rating X/Y" with `"Fire rating: X min integrity, Y min insulation"`; a null minute reads `"no insulation rating"` (or `"no integrity rating"`). On candidate cards add the supplier reference as a second line (`"Supplier ref {supplierRefCode}"`, omitted when empty) and a comparison line against the penetration's required minutes: `"Meets the required rating"` when both candidate minutes are at least the required ones (a null requirement is met by anything; a null candidate minute never meets a stated requirement), otherwise `"Below the required rating"` with a warning tone. Pure function with tests. Never say "compatible" or "approved" |
| 4 | Stale stock is not flagged | Under the "as of" line show the age of `stockAsOf` relative to `asOf`: `"Stock figures from 3 Oct 2026, 08:00 UTC (2 days old)"` (minutes under 1 hour, hours under 1 day, then days). When older than 24 hours show a warning notice: `"These stock figures are more than a day old. Check with the warehouse before relying on them."` Warning only: crew status does not change. Keep UTC (no client-side time zone work). Pure functions with tests |
| 5 | "Current" has a green check | Actions-log status labels: current `"Still applies"` (neutral tone, no check icon), earlier `"Shortfall has grown since"` (warning tone), resolved `"Shortage resolved"` (success tone). Unknown stays `"Unknown"` neutral |
| 6 | "Open" looks like a button and is ambiguous | Shortage and blocker state labels: `"No decision yet"`, `"Waiting"`, `"Escalated"`. Render state as a flat label (no border, no button-like padding, tone colour text plus icon), clearly different from buttons. AC 30 tests that look for "Open" must look for `"No decision yet"` |
| 8 | "Escalation recorded" may be read as "Purchasing was told" | In the Wait and Escalate dialogs, under the crew line, add `"This records your decision here. Nobody is notified automatically yet."` Announcements stay as they are |
| 10 | Home "Blocked" chip does not say why | **Additive API field:** `GET /api/sites` items gain `shortageCount` and `dataProblemCount` (integers; both 0 unless `crewStatus` is `blocked`; absent values not allowed). Chip text for blocked: `"Blocked · 2 shortages"`, `"Blocked · 1 shortage, 2 data problems"`, `"Blocked · 2 data problems"`. Other statuses unchanged. API tests for the counts |
| 12 | "Try again" has no button | On every unavailable screen add a `"Try again"` button (client island) that reloads the page (`window.location.reload()`); the banner text stays |
| L1 | Units read badly | Quantities: unit `each` is omitted (`"Need 4, have 2, short 2"`); other units pluralise when the number is not 1 (`cartridge`→`cartridges`, `tube`→`tubes`, `metre`→`metres`); fractions keep the unit plural (`"2.5 metres"`). Pure function with tests |
| L2 | Actions log repeats the site name | Remove the extra site-name line under the back row |
| L3 | Irrelevant lines on a nothing-planned site | When crew status is `nothing_planned`, do not show the stock notice, the "as of" line or the stale warning |
| L4 | "Catalogue match, not verified" with no matches | Show the notice only when at least one candidate is listed |

Out of scope (do not build): different escalation targets for data problems, a "substitute proposed" marker on shortage cards, a "what was checked" summary on clear sites, candidate counts per group, client-side local time, animations.

## 4. Files you may change or create

Edit: `src/application/{readiness,sites}.ts` (additive fields only), `src/ui/**`, `src/app/**`, `tests/**`.
Create: new files under `src/ui`, `src/app`, `tests`, and `UI-UX-NOTES.md`.
Nothing else. Do not touch `docs/`, `data/`, `.github/`, `package.json`, `package-lock.json`, `supabase/`, `src/domain/`, `src/server/`, `src/ports/`, `src/adapters/`, config files.

## 5. Method (test first)

For each change, add or update the unit test, run it and confirm it fails against the current code, then implement. Record which new tests failed first in `UI-UX-NOTES.md`. Update e2e specs for changed copy ("Open", "Rating", "Current", chip text) without weakening them, and add e2e assertions for: distinguishable penetration rows on `/sites/site-b` (expanded), the stale-stock warning on `/sites/site-b`, the blocked chip counts on `/`, the Try again button on the stock-down projects, and "Fire rating:" plus "Meets the required rating" on `/sites/site-b/penetrations/pen-b-01`. Name tests with the AC number where one applies. Coverage on `src/domain/**` and `src/ui/*.ts` stays 100%.

## 6. Verification (run before finishing, record in `UI-UX-NOTES.md`)

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run check:ac
npx vitest run --sequence.shuffle --sequence.seed 7
npx playwright test --list
```

All must exit 0. No `any`, `@ts-ignore`, `eslint-disable`. Do not start long-running processes.

## 7. Honesty constraints

- Do not claim a command passed unless you ran it and saw the exit code. Paste exit codes and the coverage summary in the notes.
- State plainly that the e2e specs were not run in your sandbox.
- If a decision in section 3 seems wrong or impossible, implement what it says and record the disagreement. If an expected value does not come out, report the actual value; do not change the expectation to fit.
- Do not edit docs. List every new string and both API field additions in the notes so the orchestrator can document them.

## 8. UI-UX-NOTES.md

Short and factual: tests that failed first, departures and why, new copy strings, the two API additions with their exact shapes, what you could not verify, and what the orchestrator should check in the browser.
