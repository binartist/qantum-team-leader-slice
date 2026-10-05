# UX usability fixes

Worker notes for the orchestrator. Docs were not edited. No git writes. `src/domain/` and `data/` were not touched.

`skf sync --check` exited 1 (`skill-forge.lock.json` is stale). Sync was not run (it would edit files outside the allowlist). Vendored skills were used as-is.

## Tests that failed first

`npx vitest run tests/unit/ui-format.test.ts tests/unit/ui-status.test.ts tests/unit/ui-messages.test.ts tests/api/routes.test.ts --reporter=json` before the implementation: `success: false`, 19 failed, 47 passed. The piped first run exited 0 only because `tail` consumed the pipe; the JSON run is the one that counts.

- `api/routes.test.ts` — AC 10: sites A and B are computed independently, A clear and B blocked, with the shared-stock notice
- `api/routes.test.ts` — matches the sample outcomes for shortages, blockers, and candidates
- `api/routes.test.ts` — AC 9: stock down is 502 and never clear, malformed stock is upstream_invalid, and one failing site stays unavailable
- `unit/ui-format.test.ts` — quantities formats a known shortage and an unknown-stock shortage
- `unit/ui-format.test.ts` — quantities pluralises a unit from the shortfall, and omits each
- `unit/ui-format.test.ts` — times states the age of the stock snapshot against the request time, in UTC
- `unit/ui-format.test.ts` — times does not invent an age when the snapshot is in the future or not a date
- `unit/ui-format.test.ts` — ratings, counts, and paths prints a fire rating in minutes and names a missing part
- `unit/ui-format.test.ts` — ratings, counts, and paths prints a supplier reference only when one is present
- `unit/ui-format.test.ts` — ratings, counts, and paths names a penetration row and groups rows when more than one solution is nominated
- `unit/ui-format.test.ts` — forbidden words no formatted string contains compatible or approved
- `unit/ui-messages.test.ts` — banners and empty states has the approved empty states and the fixed decision lines
- `unit/ui-messages.test.ts` — forbidden words no message contains compatible or approved
- `unit/ui-status.test.ts` — shortage state AC 30: maps no decision yet, waiting, and escalated, including an earlier decision
- `unit/ui-status.test.ts` — home chip names shortages and data problems on a blocked site, and leaves other statuses alone
- `unit/ui-status.test.ts` — rating comparison meets when both candidate minutes cover the requirement, and a null requirement is met by anything
- `unit/ui-status.test.ts` — rating comparison is below when a candidate minute misses a stated requirement, including a null or non-finite minute
- `unit/ui-status.test.ts` — action status AC 15: maps current, earlier, and resolved
- `unit/ui-status.test.ts` — forbidden words no user-facing status string contains compatible or approved

## API additions

`GET /api/sites` items. Both integers are always present. Both are `0` unless `crewStatus` is `"blocked"` (including when the site is `unavailable`).

```ts
{ id, name, reference, crewStatus, shortageCount: number, dataProblemCount: number }
```

Sample: site-a clear 0/0, site-b blocked 2/0, site-c blocked 1/2, site-d nothing_planned 0/0.

`GET /api/sites/:id/readiness` `penetrations[id]` gains two strings from the nomination, raw (double spaces kept):

```ts
{ floor, location, nominatedCode, serviceType: string, serviceSize: string }
```

Sample: pen-b-01 `PEX Pipe` / `Ø25mm`; pen-b-05 `KELOX Pipe  - 13mm PE` / `Ø32mm`.

Side effect: `GET /api/sites/:id/actions` `penetrations` uses the same type (`src/application/actions.ts` is outside the allowlist and assigns `loaded.sitePenetrations`). Those two fields are therefore on the actions payload too. `tests/api/routes.test.ts` asserts them on pen-b-01. Not a third intentional contract.

## New copy

Strings live in `src/ui/messages.ts` or formatters in `src/ui/format.ts` / `src/ui/status.ts`.

- `No decision yet` (open). `Waiting` and `Escalated` unchanged. Rendered as a flat label (no border, no chip padding) on shortage and blocker cards, including the earlier-decision badge on those cards.
- Actions log: `Still applies` (neutral, dashed circle, no check), `Shortfall has grown since` (warning), `Shortage resolved` (success, check). Unknown stays `Unknown`. `earlierDecision()` on shortage cards stays `Earlier decision, shortfall has grown`.
- `Fire rating: {n} min integrity, {n} min insulation`. A null minute is `no integrity rating` or `no insulation rating`.
- `Meets the required rating` (success, check icon). `Below the required rating` (warning, warning icon).
- `Supplier ref {code}` — omitted when the code is empty or whitespace.
- `Penetrations and substitutes ({n})` with a chevron that rotates 90° when open. `prefers-reduced-motion` sets `transition: none`; the open rotation still applies.
- `Open a penetration to see possible substitutes.`
- Row line 1: `{floor}, {location} · {serviceType} {serviceSize}`. Line 2: `Solution {nominatedCode}`. The row is one link. Visible word `Substitutes` plus a trailing chevron.
- Group subheading only when a shortage spans more than one nominated solution: `Solution {code} · {count}`.
- `Stock figures from {D Mon YYYY, HH:MM UTC} ({age})`. Age is floored: under 1 hour `N minutes old` (`1 minute old`), under 24 hours `N hours old` (`1 hour old`), then `N days old` (`1 day old`). `0 minutes old` is plural.
- `Stock figures from an unknown time` when `stockAsOf` is not a date. A future snapshot, or an unreadable `asOf` with a readable stock stamp, prints the stamp and no age.
- `These stock figures are more than a day old. Check with the warehouse before relying on them.` Shown only when the snapshot is strictly older than 24 hours. Crew status does not change.
- Blocked chip: `Blocked · {n} shortage(s)`; `Blocked · {n} shortage(s), {m} data problem(s)`; `Blocked · {m} data problem(s)`. Both counts 0 stays `Blocked`. Other statuses ignore the counts.
- `This records your decision here. Nobody is notified automatically yet.` Under the crew line in Wait and Escalate only. Announcements unchanged. Not on Propose.
- Need line: unit `each` and empty unit omitted (`Need 4, have 2, short 2`). Other units pluralise from the shortfall when that number is not 1 (`cartridge`/`cartridges`, `tube`/`tubes`, `metre`/`metres`). Fractions stay plural (`2.5 metres`). Unknown stock stays `Need N, stock unknown` with no unit.
- `Try again` is the existing `BUTTONS.tryAgain`, now a button that calls `window.location.reload()` on upstream-unavailable screens.

## Departures

- Exactly 24 hours is `1 day old` and is not stale. The warning is only when the age is strictly greater than 24 hours.
- A future or unreadable timestamp does not invent an age and is not called stale.
- A blocked site with 0 shortages and 0 data problems stays `Blocked`. The domain should not produce that pair.
- An unknown unit pluralises with a trailing `s` (`box` → `boxs`). The unit follows the shortfall, not each of the three numbers.
- `error.tsx` and `global-error.tsx` already have Try again via Next `retry()`. They were left alone. Reload is only on upstream-unavailable screens (home list, site load, readiness, actions, substitutes).
- `Meets the required rating` uses success plus a check icon, matching `Materials in stock`. The brief specified a warning tone only for the below case. The words `compatible` and `approved` are not used. Change the icon if a check reads as approval.
- The catalogue notice is hidden when `candidates.length === 0`, even if the use case still returns the notice string.
- Clear sites still show the stock notice, the as-of line, the age line, and the stale warning. Only `nothing_planned` hides them.
- pen-b-01 through pen-b-04 are still the same text after the specified format (same floor, location, service, size, and code). Distinguishable rows are on the sealant list (12 penetrations, several solutions). The collar disclosure has no `Solution … · n` subheading because it is one solution. The specified format was implemented anyway.
- `stock-malformed.spec.ts` also expects the Try again button. Same unavailable screen as stock-down.
- Playwright `testMatch` is an allowlist in `playwright.config.ts` (not edited). New assertions went into existing specs. `npx playwright test --list` still shows 12 tests in 11 files.

## Verification

Commands run in this session after the implementation. All exited 0. E2E specs were not executed.

| Command | Exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run test:coverage` | 0 |
| `npm run build` | 0 |
| `npm run check:ac` | 0 (`All 32 acceptance criteria are referenced by tests.`) |
| `npx vitest run --sequence.shuffle --sequence.seed 7` | 0 |
| `npx playwright test --list` | 0 (lists 12 tests in 11 files; Chromium not launched) |

Coverage (`npm run test:coverage`): Test Files 30 passed. Tests 281 passed, 5 skipped (286). Statements 100% (516/516). Branches 99.72% (360/361). Functions 100% (113/113). Lines 100% (423/423). The one uncovered branch is pre-existing `src/ui/decisions/api-client.ts` line 83 (catch of a non-JSON replay body). `src/domain/**` and `src/ui/*.ts` are 100% statements, branches, functions, and lines. The five skips are pre-existing (`skipIf` for Supabase and the bundle scan).

`npm run build`: Next.js 16.3.8 compiled successfully. Routes unchanged.

## Not verified

The sandbox cannot launch Chromium (SIGSEGV). Playwright specs were typechecked, linted, and listed. They were not run. The UI was not exercised in a browser.

Orchestrator should check on a phone-width viewport, light and dark:

- Home chips: Harbour Point `Blocked · 2 shortages`; Kingsway `Blocked · 1 shortage, 2 data problems`. Riverside stays clear. Old Mill stays nothing planned.
- Site-b: stale warning sentence, age line `Stock figures from 3 Oct 2026, 08:00 UTC (N days old)` (1 day before 08:00 UTC on 5 Oct, 2 days from 08:00 UTC). Collar disclosure `Penetrations and substitutes (4)` with no solution subheading; its four rows still read the same. Sealant disclosure `(12)` with `Solution 0438 · 4` and `Solution 0434 · 3`, and pen-b-01 vs pen-b-05 differing (`PEX Pipe Ø25mm` vs `KELOX Pipe  - 13mm PE Ø32mm`). Chevron rotates when open; no transition under reduced motion. `Open a penetration to see possible substitutes.` Whole row is the link, visible word Substitutes.
- Site-d: no stock notice, no as-of line, no stock-figures line, no stale warning.
- `/sites/site-b/penetrations/pen-b-01`: `Fire rating:`, `Supplier ref V21.27-22SFR00053-158-E`, `Meets the required rating`.
- Empty substitute pages (pen-a-01, pen-b-10, pen-c-01): no `Catalogue match, not verified`.
- Wait and Escalate dialogs show the records-only sentence under the crew line. Announcements unchanged.
- Actions log: `Still applies` with no check; no extra site-name line under the back row.
- Shortage and blocker state is flat text `No decision yet`, not a button. Contrast of warning text without a tinted chip, including the earlier-decision badge.
- Stock-down (and stock-malformed) unavailable screen: Try again reloads the page. Banner text stays.
- Axe on the sealant disclosure (the existing axe spec only opens the collar, which has no group heading).
