# BRIEF: UI for the team-leader slice

## 1. Role

You are the **worker** for this brief. Execute it. Do not engage another external worker or hand the brief back up. Your own in-harness helpers (subagents) are allowed within limits: one level deep, and never two helpers editing the same file. The orchestrator reviews everything you produce and runs its own gates. This brief outranks any per-turn instruction that contradicts it. Do not keep your own task ledger or `tasks/todo.md`. Durable notes go in `UI-NOTES.md`. Do not run `git add`, `git commit` or any git write command: the orchestrator commits.

## 2. Facts

- Cwd is the repo root: Next.js 16.3 App Router, React 19, strict TypeScript, Vitest, Playwright 1.63 with `@axe-core/playwright`. **Dependencies are installed. Do not run `npm install` and do not edit `package.json`.** Playwright's Chromium is already installed in `~/Library/Caches/ms-playwright`.
- The backend is built and accepted: domain core, ports, stubs, use cases and seven `/api` routes, 196 tests. Read `docs/api.md` for the contract and `AGENTS.md` for the rules.
- **The design is approved. Read `docs/ui-design.md` fully before anything else.** It fixes the screens, routes, copy, empty and error states, the API error to message table, the dialogs and the accessibility rules. This brief adds only technical decisions and the work order. Also read `docs/slice-specification.md` (FR1 to FR15, AC 30 to 32), `docs/glossary.md`, and the vendored guidance `.agents/skills/frontend-engineering/` and `.agents/skills/ui-portability-baseline/` (follow it for tokens, primitives, themes and basic accessibility).
- Next.js 16 differs from older versions (async `params`, caching defaults). Read the installed docs under `node_modules/next/dist/docs/01-app/` for pages, layouts, `error.tsx`, `not-found.tsx`, `loading.tsx` and client components before writing them.
- Existing code to build on: `src/application/index.ts` exports `listSites`, `getSiteReadiness`, `listCandidates`, `listActions`, `STOCK_NOTICE`, `CANDIDATE_NOTICE` and the view types. `src/server/deps.ts` exports `getDependencies()`. Pages run on the server and may import those. The current `src/app/layout.tsx` and `page.tsx` are placeholders.
- `src/domain/` stays pure. Never modify `data/*`, `supabase/*`, `.github/*`, `package.json` or the lockfile.

## 3. Decisions already made (do not relitigate)

| Topic | Decision |
| --- | --- |
| Look and tech | As approved in `docs/ui-design.md` section 2: plain utilitarian look, CSS Modules plus CSS custom properties, no new dependencies, server components with small client islands |
| Tokens | Define all colours, spacing, radius and focus ring as CSS custom properties in `src/app/globals.css`. Light is the default and `@media (prefers-color-scheme: dark)` overrides them. Components use only the tokens. A starting palette (adjust if axe finds a contrast failure): light text `#1a1a1a` on `#ffffff`, secondary text `#55595e`, surface `#f6f7f8`, border `#d5d8dc`, focus `#0b57d0`; success `#e6f4ea` / `#0d5c27`, danger `#fdecea` / `#8a1c13`, warning `#fff4d6` / `#6b4500`, neutral `#f1f2f4` / `#4a4f55`. Dark text `#ececec` on `#121316`, surface `#1b1d21`, border `#34383e`, focus `#8ab4f8`; success `#12351e` / `#8fe0a5`, danger `#3b1512` / `#ffb3ab`, warning `#3d2e08` / `#ffd98a`, neutral `#24272c` / `#c4c8ce` |
| Icons | Small inline SVG components in `src/ui`, always `aria-hidden`, never the only signal |
| Dialogs | The native `<dialog>` element opened with `showModal()`. Purchasing is preselected in the escalate dialog. The idempotency key is a `crypto.randomUUID()` created when a dialog opens and reused until it closes |
| Writes | Client islands `fetch` the real `/api` routes. Reads are server components calling use cases through `getDependencies()` (no HTTP self-request). After a successful write call `router.refresh()` and announce through a polite live region. Status 200 on a replay announces "Already recorded" |
| Escaping | Build shortage ids into URLs with `encodeURIComponent` |
| Pure modules | Status, copy and formatting logic lives in plain `.ts` modules (no JSX, no React) under `src/ui/`, with unit tests. Components stay thin |
| Unavailable data | A server page that hits an `UpstreamError` renders the "Can't check this site right now" state and never "Crew can go". An `AppError` 404 calls `notFound()`. Anything else is rethrown to `error.tsx` |
| Penetration summary | Add an additive `penetration` field to the `listCandidates` result: `{ id, floor, location, serviceType, serviceSize, nominatedCode, requiredIntegrityMinutes, requiredInsulationMinutes }`. It is needed for the substitutes screen |
| Actions lookups | Add additive `materials` (every material the site's solution-material items reference) and `penetrations` (every penetration of the site, same shape as readiness) lookups to the `listActions` result, so the log can name materials and places, including for resolved shortages and blockers. Plumb them from the data readiness already fetches. Update the existing API tests for the new fields |
| Layering | Move `src/server/log.ts` to `src/application/log.ts` (the logger has no framework imports) and update every import. Add ESLint `no-restricted-imports` rules: `src/application/**` and `src/ports/**` may not import `@/server/*`, `@/app/*`, `next`, `next/*`, `react`, `react-dom`; `src/ui/**` may not import `@/server/*` or `@/adapters/*`. The rules must pass on the current tree and fail on a deliberate violation (prove it, then remove the violation) |
| Coverage | Extend `vitest.config.ts` coverage `include` to also cover the pure modules `src/ui/*.ts` (not `.tsx`), keeping the 95% floor and reaching 100% like the domain |
| E2E server | `playwright.config.ts` must start the **dev** server with `ACTIONS_STORE=memory` (for example `npx next dev -p 3100` with `env`), on its own port, not `next start`. Production correctly refuses a memory store, and that guard must not be weakened. Add a project at 375x812 using Chromium, `workers: 1`, `fullyParallel: false`, and generous timeouts for the first compile. Tests share one in-memory store, so only the scenario test writes and every other test must not depend on the store being empty |
| Fixed wordings | "Catalogue match, not verified" and "On hand, shared, not reserved" come from the API response, never retyped. The UI never uses the words "compatible" or "approved" |

## 4. Files

**Create:**

```text
src/app/globals.css
src/app/sites/[id]/page.tsx
src/app/sites/[id]/penetrations/[pid]/page.tsx
src/app/sites/[id]/actions/page.tsx
src/app/error.tsx
src/app/not-found.tsx
src/app/loading.tsx
src/app/_lib/load.ts            small helper mapping use-case outcomes to page states
src/ui/status.ts                pure: crew status, shortage state, blocker reason, availability, candidate status to {label, tone, icon}
src/ui/messages.ts              pure: API error code to message, banner text, empty-state text
src/ui/format.ts                pure: quantities, "as of" time in UTC, material lines for candidates
src/ui/*.tsx + *.module.css     components: Icon, StatusChip, Banner, Notice, Card, Button, LinkButton, SiteCard, ShortageCard, BlockerCard, CandidateCard, ActionRow, Announcer
src/ui/decisions/*.tsx          client islands: Dialog, WaitDialog, EscalateDialog, ProposeDialog, api-client
src/application/log.ts          moved logger
tests/unit/ui-*.test.ts         tests for the pure modules
tests/e2e/*.spec.ts             Playwright specs
UI-NOTES.md
```

**Edit:** `src/app/layout.tsx`, `src/app/page.tsx`, `src/application/*.ts` (for the additive fields and the logger move), `src/server/*.ts` (imports after the logger move), `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, and the existing API tests that the additive fields force.

**Do not touch:** `docs/`, `data/`, `supabase/`, `.github/`, `package.json`, `package-lock.json`, `src/domain/` (unless a UI need forces it, then record it in the notes first), `next.config.ts`.

## 5. Work order (test first where tests exist)

1. **Layering.** Move the logger, add the lint rules, prove they catch a violation, keep all existing tests green.
2. **Pure modules and unit tests** (`status.ts`, `messages.ts`, `format.ts`). Cover every case in the tables of `docs/ui-design.md`: each crew status, shortage state including "earlier decision", each blocker reason, each candidate status and availability, every API error code and the generic fallback, the unavailable banner, all empty states, quantity and date formatting (UTC, deterministic). A test asserts no user-facing string contains "compatible" or "approved". Confirm the tests fail before the code exists.
3. **Additive API fields** (`penetration` on candidates, `materials` and `penetrations` on actions) with API tests, then update the notes.
4. **Global styles and primitives.** `globals.css` tokens, layout with header and the permanent "Demo: sample data, no login" banner, `Announcer` live region.
5. **Pages** in this order: Sites, Site readiness, Substitutes, Actions log, plus `loading`, `error` and `not-found`. Each uses `generateMetadata` or `metadata` for a distinct `<title>`.
6. **Client islands**: dialogs and the API client, with error handling per the approved message table, a disabled-while-sending primary button ("Sending…"), field-level validation messages, character counts, focus return, and announcements.
7. **E2E**: the specs in section 6.
8. **Verification** (section 7).

### Screen details beyond `docs/ui-design.md`

- Sites list: one `<ul>` of linked cards. The whole card is the link (at least 44px tall).
- Site readiness: shortages sorted as the API returns them. Unknown-stock shortages read `Need X, stock unknown`. The affected penetrations are a native `<details>` list; each item shows floor, location and a link to its substitutes screen. A "Data problems" section appears only when there are blockers. A link to the actions log sits below the cards.
- Substitutes: penetration summary from the new `penetration` field, the notice from the API, then candidate cards (code, rating `integrity/insulation` with "not claimed" for a null insulation, availability chip, a one-line material summary built from `availability.lines` and the `materials` names such as `Fire putty pad x1 (20 on hand)`, and a "Propose this" button). When there are no candidates, show the approved message and, for every current shortage or blocker that includes this penetration, an Escalate button for it. Candidates with status `substrate_incomplete` or `nominated_code_unknown` show the approved messages and the same Escalate buttons.
- Actions log: each action shows kind and target in plain words (for example "Escalated to purchasing: Intumescent sealant"), the time (UTC), who, and a status badge: Current, "Earlier decision, shortfall has grown", or Resolved. Proposals are listed separately with `from` to `to` and the trimmed reason. Names come from the new lookups. If a name is missing fall back to the id.
- Use semantic HTML throughout: one `h1` per page, ordered headings, `header` and `main`, lists for lists, buttons for actions and links for navigation.

## 6. Tests

**Vitest unit tests** for the pure modules, in `tests/unit/ui-*.test.ts`, 100% coverage of `src/ui/*.ts`.

**Playwright specs** in `tests/e2e/`, name each test with the AC number it covers:

- **Scenario (writes):** open Sites, open Harbour Point (blocked), escalate the sealant shortage to Purchasing with a note, see state Escalated and the banner still blocked, see the line "This does not release the crew" in the dialog before sending, open substitutes for `0438`, see `0451` (materials in stock) and `0464` (no material mapping), propose `0451` with a reason, see it in the actions log, then open Kingsway Works and see the data problems and no "Crew can go". Also: the dialog's validation (empty reason blocked), and a replay announcing "Already recorded" when the same dialog submits twice (simulate by submitting once and re-sending the identical key through the page's fetch).
- **AC 30:** each shortage card shows material, need, have, short, affected count and state as text, and status chips contain text and an icon, not colour alone (assert the accessible text).
- **AC 31:** complete the escalate flow with the keyboard only. Every `button`, `a` and form control on each screen measures at least 44 by 44 CSS px (use `boundingBox`), except inline text links inside paragraphs, which you list and justify in the notes.
- **AC 32:** at 375px width, `document.documentElement.scrollWidth <= clientWidth` on every screen, including with the dialog open.
- **Accessibility:** axe (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` tags) reports no serious or critical violations on each screen, in light and dark (`page.emulateMedia({ colorScheme })`), and with a dialog open.
- **Failure path in the browser:** none is possible (no public fault switch). The "can't check" state is covered by the pure unit tests and the loader helper's tests.
- **Not-found:** `/sites/nope` and `/sites/site-b/penetrations/nope` render the not-found page with a link back.

If Chromium cannot launch inside your sandbox (it has crashed under sandboxes before), do not look for a workaround outside the repo. Write the specs anyway, confirm they type-check and lint, state plainly in `UI-NOTES.md` that you could not run them, and say what the failure was. The orchestrator will run them in its own shell.

## 7. Verification (run before finishing, record in `UI-NOTES.md`)

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run check:ac
npm run test:e2e          # if Chromium can launch in your sandbox
```

All must exit 0, **including `check:ac`**, which must now report no missing acceptance criteria. Coverage on `src/domain` and on `src/ui/*.ts` stays at or above 95% (aim for 100%). No `any`, `@ts-ignore` or `eslint-disable`. Do not leave dev servers running. Do not change thresholds. List every file you changed outside the "Create" list and why.

## 8. Honesty constraints

- Do not claim a command passed unless you ran it and saw the exit code. Paste exit codes in `UI-NOTES.md`.
- Do not invent copy. Use the wordings in `docs/ui-design.md` and the API. If the doc has no wording for a case, choose plain words in the same voice and list them in the notes.
- Do not add dependencies, fonts, icon packs or images from the network. Everything is local.
- If a decision in section 3 seems wrong or impossible, implement what it says and record the disagreement.
- If an expected value does not come out, do not change the expectation. Report the actual value and why.
- Do not edit docs. Record needed doc changes in `UI-NOTES.md`.

## 9. UI-NOTES.md

Short and factual: decisions you made, departures from this brief and why, the final shape of the additive API fields, any copy you had to write, anything you could not verify (especially the e2e run), accessibility issues found by axe and how you fixed them, and what the orchestrator should check.
