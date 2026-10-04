# FIX BRIEF: review fixes for the UI layer

## 1. Role

You are the **worker** for this brief. Execute it. Do not engage another external worker or hand the brief back up. Your own in-harness helpers (subagents) are allowed within limits: one level deep, and never two helpers editing the same file. The orchestrator reviews everything you produce and runs its own gates. This brief outranks any per-turn instruction that contradicts it. Do not keep your own task ledger or `tasks/todo.md`. Durable notes go in `UI-FIX-NOTES.md`. Do not run `git add`, `git commit` or any git write command: the orchestrator commits.

## 2. Facts

- Cwd is the repo root: Next.js 16.3, strict TypeScript, Vitest, Zod 4, Playwright. **Dependencies are installed. Do not run `npm install` and do not edit `package.json` or the lockfile.**
- The UI layer exists. The orchestrator ran all gates in a normal shell: typecheck, lint, 235 unit tests, 100% coverage on `src/domain` and `src/ui/*.ts`, build, `check:ac`, and 6 of 6 Playwright tests. Three independent reviewers then found the defects and test gaps below. **Read their reports first; they hold the evidence and the probes:**
  - `/private/tmp/claude-501/-Users-joe-workspace-qantum-team-leader-slice/fd2e3fd1-8e45-4067-8ca8-422119e60a98/scratchpad/findings-ui-spec.md`
  - `.../scratchpad/findings-ui-tests.md`
  - `.../scratchpad/findings-ui-quality.md`
- Read also: `AGENTS.md`, `docs/ui-design.md`, `docs/slice-specification.md` (FR and AC), `docs/api.md`, and the code under `src/ui`, `src/app`, `src/application`, `src/server/deps.ts`, plus `tests/unit/ui-*.test.ts`, `tests/e2e`, `tests/api`.
- Already fixed by the orchestrator (do not redo): the `globalThis` dependency cache in `src/server/deps.ts` with `tests/api/shared-store.test.ts`; the `tabTo`, closed-disclosure and Next dev-tool handling in `tests/e2e/support.ts`; `next.config.ts` traces the CSV for all routes.
- `src/domain/` stays pure and is not touched. Never modify `data/solutions-excerpt.csv` or `data/sample/*`.
- **Your sandbox cannot launch Chromium** (it crashes with SIGSEGV), so you cannot run Playwright. Write the e2e specs carefully, make sure they typecheck and lint, and say in `UI-FIX-NOTES.md` that they are unrun. The orchestrator runs them. Unit tests you can and must run.
- Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run build`, `npm run check:ac`.

## 3. Decisions already made (do not relitigate)

| # | Finding (report) | Decision |
| --- | --- | --- |
| 1 | Substitutes screen says "Escalate instead" but offers no control when the penetration has no shortage or blocker (spec 1) | The API can only escalate a shortage or blocker, so none exists for `pen-a-01`. When `status` is `ok`, there are no candidates and **no related shortage or blocker**, show only "No catalogue match for this penetration." (no "Escalate instead"). When a related decision exists, keep the sentence "No catalogue match for this penetration. Escalate instead." with the control. Add e2e/page tests for `pen-a-01` (no control, no "Escalate instead") and `pen-b-10` (control present) |
| 2 | AC 9 wording (spec 2) | Orchestrator edits the spec. Do not change the banner copy |
| 3 | Sites list failure reuses the single-site sentence (spec 3) | Add `SITES_UNAVAILABLE` in `messages.ts`: "Can't check the sites right now. Don't assume any site is clear. Try again." Use it on `/` when the list fails. Keep the "Can't check" chip for one unavailable site |
| 4 | Unavailable screens drop the back link (spec 4, quality) | Every unavailable branch keeps the same back link as the ready screen (`/` when the site did not resolve) |
| 5 | Blockers have no link to the substitutes screen (spec 5) | Link the blocker place to the substitutes screen like shortage rows do |
| 6 | Substitute cards print on-hand counts without the shared label (spec 6) | Drop the on-hand counts from `formatMaterialSummary`; keep name and quantity per install. Update the scenario assertion |
| 7 | `aria-invalid` has no visible style (spec 7) | Style `[aria-invalid="true"]` with a visible border colour (use a token that passes 3:1) in both themes |
| 8 | Dialog response not tied to the session; Escape while sending (spec 8, quality 1) | While a request is in flight, prevent the dialog from closing (cancel the `cancel` event, Cancel stays disabled). Do not clear the in-flight lock in `onClose` while sending. When a response arrives, always announce and `router.refresh()`. Capture the key per `send` |
| 9 | Network failure shown as "Nothing was recorded" (spec 9) | Add a transport-failure sentence: "Couldn't reach the server. The decision may not have been recorded. Send again to retry; it won't be recorded twice." Keep the same idempotency key for retries in the same dialog. Never announce success on a failure |
| 10 | Live region replays the last announcement on a new load (spec 10, quality 2) | Remove the `sessionStorage` use and the unused `ANNOUNCE_EVENT`. The in-memory store alone is enough. The live region starts empty on every full load |
| 11 | `docs/api.md` additive fields (spec 11) | Orchestrator edits docs |
| 12 | Stock-down never reaches a rendered page (spec 12, tests 1) | Add a stub-mode switch: in `buildDependencies`, when `NODE_ENV !== "production"`, read `STUB_STOCK_MODE` (`normal`, `down`, `empty`, `malformed`, default `normal`) and pass it to the stub for stock. **Ignored in production** (test it). Add a second Playwright project that runs its own dev server with `STUB_STOCK_MODE=down` on port 3101 and a separate build dir (read `NEXT_DIST_DIR` in `next.config.ts` for `distDir`; this is the only change allowed in `next.config.ts`). Specs: `/` and `/sites/site-b` show the can't-check text and never "Crew can go"; also malformed stock. Extend `ui-load.test.ts` to `upstream_invalid` |
| 13 | Blocker-only wording "Blocked: 0 shortages" (spec 13) | When there are zero shortages and at least one data problem, word it "Blocked: N data problem(s). Hold the crew until they are sorted." Add unit tests |
| 14 | `in_stock` uses the crew-clear icon (spec 14) | Keep as is. The page notice says "Catalogue match, not verified". Record in notes |
| 15 | Counter shows raw length (spec 15) | Show `value.trim().length` in "N of 500 characters" for notes and reasons |
| 16 | Layering checks miss relative imports, `src/app` client files, `@supabase/supabase-js` (quality 3) | Extend the ESLint rules to forbid `server`, `adapters`, `ports` (relative and alias forms) and `@supabase/supabase-js` in `src/ui/**` and in any file with `"use client"` under `src/app/**` (use a path rule for `src/app/error.tsx` and an `src/app/**/*client*` convention only if you must; otherwise move client files under `src/ui`). Make the security test walk the transitive imports of every `"use client"` file and fail on those edges. Prove with a probe in a temp copy, not the repo. Do **not** add `server-only` (new dependency; production item) |
| 17 | Border contrast (quality 4) | Add an input border token at least 3:1 on `--bg` and `--surface` in both themes; keep the soft border for cards. Compute and record the ratios in the notes |
| 18 | Fail-open mappers (quality) | `readinessBanner` default is the unavailable banner; unknown action status and unknown shortage state map to a neutral "Unknown" label, never "Resolved" or "Escalated". Use exhaustive switches with a safe default. Unit tests with bogus values |
| 19 | Repeated use-case work, double actions read (quality) | Fix the double `listShortageActions` read in `listActions` (reuse what `loadSiteData` loaded). Wrap `getSite`, `getSiteReadiness` and `listCandidates` for page use in `React.cache` inside `src/app/_lib` (not in `src/application`). No behaviour change |
| 20 | Test override not on the shared holder (quality) | Keep `override` and `usingOverride` on the same `globalThis` holder. Add a test with two module evaluations |
| 21 | Tab keeps a stale banner (quality) | **Not now.** Record as a limitation in the notes. Do not add `visibilitychange` refresh |
| 22 | No `global-error.tsx` (quality low) | Add `src/app/global-error.tsx` with fixed copy, the demo banner text and a retry button; no message or digest |
| 23 | `.siteCard` span can overflow (quality low) | Apply `overflow-wrap: anywhere` to span text in cards |
| 24 | Shared form shell for three dialogs (quality low) | **Not now.** Record only |
| 25 | All test findings 1 to 13 | Accept all. See section 5 |

## 4. Files you may change or create

Edit: `src/ui/**`, `src/app/**`, `src/application/*.ts`, `src/server/deps.ts`, `src/server/env.ts` (only if needed for `STUB_STOCK_MODE`), `src/adapters/stub/index.ts` (only if needed), `eslint.config.mjs`, `vitest.config.ts` (extend the coverage include to `src/ui/decisions/api-client.ts` and any new pure `.ts` you add under `src/ui`), `playwright.config.ts`, `next.config.ts` (only `distDir` from `NEXT_DIST_DIR`), `tests/**`, `.env.example` (document `STUB_STOCK_MODE`, non-production only).
Create: new files under `src/ui`, `src/app`, `tests`, and `UI-FIX-NOTES.md`.
Nothing else. Do not touch `docs/`, `data/`, `.github/`, `package.json`, `package-lock.json`, `supabase/`, `src/domain/`.

## 5. Method (test first)

For each group, add the test, **run it and confirm it fails against the current code** (unit tests only; e2e you cannot run), then fix. Record which new tests failed first in `UI-FIX-NOTES.md`. Keep existing tests green. Do not weaken an existing assertion unless it contradicts a decision in section 3 (say which). Name tests with the AC number where one applies. Coverage on `src/domain/**` and `src/ui/*.ts` stays 100%.

Test work from the tests report (all accepted):

1. Stock-down and malformed stock rendered through pages (decision 12).
2. API test: an action recorded below the live shortfall lists as `status: "earlier"` on `GET .../actions`, and an e2e that shows "Earlier decision, shortfall has grown" and not "Current" for that row. (You can create the situation through the API with a replayed request before the stock changes; if the sample stock cannot change, test it at the API and unit level and say so.)
3. AC 30 e2e: assert the "Open" state word on untouched cards, the real affected counts for both cards, and the expanded penetration labels. The AC 30 reference must not be satisfied by a different test.
4. Idempotency key reuse e2e: open a dialog once, make the first submit fail (route abort), resubmit, and assert both POSTs carry the **same** `Idempotency-Key`. A failed fetch must not announce success.
5. Unit tests for `postDecision` (201, 200 replay, 409 `stale_nomination`, 422, non-JSON body, rejected fetch, unsafe `code` token) with a mocked `fetch`, and for the dialogs' error mapping where it is pure. Render-free: no DOM library. Extract pure logic into `src/ui/decisions/*.ts` if needed. Test that `error.tsx` copy contains no `error.message` (read the file's exported strings or extract them).
6. On-screen fixed phrases: scenario asserts "On hand, shared, not reserved" and "Catalogue match, not verified"; open `pen-b-10` and `pen-c-01` and assert the empty-state and incomplete-substrate sentences; `pen-a-01` per decision 1.
7. `assertTargets` includes `summary`; open one disclosure and the Wait and Propose dialogs for measurement.
8. `listActions`: two proposals with different `createdAt` expect newest first; same for two shortage actions.
9. Assert every `BUTTONS` and `ANNOUNCE` value and the tone and icon of `readinessBanner("clear", ...)`.
10. Candidate payload: assert `0451` material name and insulation, and the rating line in the scenario.
11. `loadPage`: throw `PenetrationNotFoundError` and `ShortageNotFoundError` and expect `notFound`; assert `connection()` is called on the unavailable path.
12. E2E stability: replace `networkidle` with a real hydration signal (for example the client `Announcer` sets `document.documentElement.dataset.hydrated = "true"` in an effect, and specs wait for it). Make each spec touch its own target (state in a comment) so no spec depends on another's writes; the dev server is fresh per run (`reuseExistingServer: false`). Replace the "no POST within 1500 ms" check with a request listener that records any POST and asserts none arrived after the validation message is visible.
13. Axe, overflow and target size also on: not-found, `global-error`/`error` if a route can render it safely (otherwise say why not), and the Wait and Propose dialogs.

## 6. Verification (run before finishing, record in `UI-FIX-NOTES.md`)

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run check:ac
```

All must exit 0. Run `npx vitest run --sequence.shuffle --sequence.seed 7` once and record the result. Also run `npx playwright test --list` to prove the specs and both projects load (this does not launch a browser). Do not change thresholds. No `any`, `@ts-ignore`, `eslint-disable`. Do not start long-running processes.

## 7. Honesty constraints

- Do not claim a command passed unless you ran it and saw the exit code. Paste exit codes and the coverage summary in the notes.
- State plainly that the e2e specs were not run in your sandbox.
- If a decision in section 3 seems wrong or impossible, implement what it says and record the disagreement. If an expected value does not come out, report the actual value; do not change the expectation to fit.
- Do not edit docs, data, CI, `package.json`, the lockfile or the migration. Record needed doc changes in the notes.

## 8. UI-FIX-NOTES.md

Short and factual: which new unit tests failed first, departures from section 3 and why, new copy strings (the orchestrator documents them), new environment variables, what you could not verify, and what the orchestrator should check (especially the unrun e2e specs).
