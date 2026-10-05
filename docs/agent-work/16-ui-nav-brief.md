# BRIEF: navigation shell, bottom demo bar, labelled reference

## 1. Role

You are the **worker** for this brief. Execute it. Do not engage another external worker or hand the brief back up. Your own in-harness helpers (subagents) are allowed within limits: one level deep, and never two helpers editing the same file. The orchestrator reviews everything you produce and runs its own gates. This brief outranks any per-turn instruction that contradicts it. Do not keep your own task ledger or `tasks/todo.md`. Durable notes go in `UI-NAV-NOTES.md`. Do not run `git add`, `git commit` or any git write command: the orchestrator commits.

## 2. Facts

- Cwd is the repo root: Next.js 16.3 (read `node_modules/next/dist/docs/` before using Next APIs you are unsure of), strict TypeScript, CSS Modules plus tokens in `src/app/globals.css`. **Dependencies are installed. Do not run `npm install` and do not edit `package.json` or the lockfile.**
- The UI is built, reviewed and committed (4 screens, dialogs, pure modules at 100% coverage, 269 unit tests, 11 Playwright tests). Read first: `AGENTS.md`, `docs/ui-design.md` (sections 2, 3, 5, 9), `src/app/layout.tsx`, every `page.tsx` under `src/app`, `src/app/{loading,not-found,error,global-error}.tsx`, `src/ui/{LinkButton,SiteCard,Icon,Banner,Card}.tsx`, `src/ui/messages.ts`, `src/ui/format.ts`, `src/ui/primitives.module.css`, `src/app/globals.css`, `tests/e2e/*`, `tests/unit/ui-screens.test.ts`.
- The product owner reviewed the screens on a phone and asked for four changes. This brief is the spec for them.
- `src/domain/` is untouched. Never modify `data/*`.
- **Your sandbox cannot launch Chromium** (SIGSEGV), so you cannot run Playwright. Update the e2e specs carefully, make sure they typecheck and lint, and say in the notes that they are unrun. The orchestrator runs them.
- Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run build`, `npm run check:ac`.

## 3. The four changes (decisions made, do not relitigate)

| # | Change | Decision |
| --- | --- | --- |
| 1 | "Demo: sample data, no login" bar moves to the **bottom** | A `<footer>` in the root layout (the only `contentinfo` landmark), present on every screen including `loading`, `not-found`, `error` and `global-error`. Make `body` a column flex container with `min-height: 100dvh`, `main` growing, and the footer `position: sticky; bottom: 0`, so it sits at the bottom of short pages and stays visible on long ones without covering content. Same colours and text as today. `prefers-reduced-motion` unaffected. Dialogs (native `<dialog>`) must still cover it |
| 2 | A **navigation header** shows the page title | One `AppBar` component (`src/ui/AppBar.tsx`) rendered by every page in place of today's `LinkButton` back button and loose `<h1>`. It is a `<header>` (the only `banner` landmark; remove the old `<header>` from the layout) that is `position: sticky; top: 0`, opaque, with a bottom border, and holds the page's single `<h1>`. Titles: Sites; the site name; "Substitutes"; "Actions log"; the existing fallbacks ("This site", "Loading", "Page not found", "Something went wrong"). Long titles wrap (no truncation, no horizontal scroll at 375px). Set `scroll-padding-top` so focused elements are not hidden behind it |
| 3 | Navigation uses a **chevron back control** | On every inner screen the AppBar shows a chevron-left control at its left edge, at least 44 by 44 px, that links to the parent (same targets as today: `/` from a site, the site from substitutes and actions, `/` from not-found and unavailable branches). Add a `chevron-left` path to `Icon.tsx` (`aria-hidden`). The control's accessible name stays the existing text ("Back to sites" / "Back to site", `BUTTONS.backToSites` / `backToSite`) via `aria-label`, so the existing role-based tests still find it. The home screen has no back control. **No animation** (the approved design is no-motion); do not add view transitions or slide effects. Remove the old full-width back buttons |
| 4 | **Label the site reference code** | Anywhere the reference is shown (site cards on the home screen, the readiness screen under the title) it reads "Ref RP-A2" (word "Ref", a space, the code). Add `formatReference(reference)` to `src/ui/format.ts` with unit tests. Do not label anything else |

Other constraints:

- One `h1` per page, one `banner`, one `main`, one `contentinfo`. Axe must stay clean in light and dark (check contrast of the new bar surfaces against both themes; use existing tokens, add a token only if needed and record its ratios).
- Touch targets stay at least 44 by 44. The AppBar title is not a link.
- Keep the copy rules in `docs/ui-design.md` section 4. Do not add new visible words other than "Ref".
- Do not change any behaviour, API call, dialog or data loading. This is structure and styling.
- `global-error.tsx` replaces the whole document: give it the same footer text and an AppBar-equivalent header with the title, without importing server code.

## 4. Files you may change or create

Edit: `src/app/**`, `src/ui/**`, `tests/unit/**`, `tests/e2e/**`.
Create: `src/ui/AppBar.tsx` (and its CSS in `primitives.module.css` or a new module), `UI-NAV-NOTES.md`.
Nothing else. Do not touch `docs/`, `data/`, `.github/`, `package.json`, `package-lock.json`, `supabase/`, `src/domain/`, `src/application/`, `src/server/`, config files.

## 5. Method (test first)

Update or add tests, run the unit ones and confirm the new ones fail against current code, then implement:

1. `formatReference` unit tests (in `tests/unit/ui-format.test.ts`).
2. `tests/unit/ui-screens.test.ts` already reads page sources for expected strings; extend it so every page renders `AppBar`, none still renders `LinkButton` for back navigation, the layout has a `footer` and no `header`, and `global-error` has the footer text. Follow its existing style.
3. E2E (not runnable by you): add assertions that on `/sites/site-b` the footer demo text is below the main content and the AppBar `h1` is the site name; that the back control has the accessible name "Back to sites", is at least 44 by 44 and navigates to `/`; that the home screen shows "Ref RP-A2" and has no back control; that the footer stays visible when the page is scrolled (long page: `/sites/site-b`). Keep every existing assertion that still applies. Update tests that looked for the old banner at the top or the old back button element, without weakening them. Axe, overflow and target-size specs keep running on all screens.

## 6. Verification (run before finishing, record in `UI-NAV-NOTES.md`)

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run check:ac
npx vitest run --sequence.shuffle --sequence.seed 7
npx playwright test --list
```

All must exit 0. Coverage stays 100% on `src/domain/**` and `src/ui/*.ts`. No `any`, `@ts-ignore`, `eslint-disable`. Do not start long-running processes.

## 7. Honesty constraints

- Do not claim a command passed unless you ran it and saw the exit code. Paste exit codes and the coverage summary in the notes.
- State plainly that the e2e specs were not run in your sandbox.
- If a decision in section 3 seems wrong or impossible, implement what it says and record the disagreement.
- Do not edit docs, data, CI or config. Record needed doc changes in the notes.

## 8. UI-NAV-NOTES.md

Short and factual: which new unit tests failed first, departures and why, any new tokens with contrast ratios, what you could not verify, and what the orchestrator should check in the browser (sticky header and footer on a long page, dialog layering over the footer, 200% zoom, dark mode).
