# REVIEW BRIEF: UI, spec and design conformance

## Role
You are the **reviewer** (a worker) for this brief. You review code you did not write. Do **not** edit, create or delete any file in the repo (the sandbox is read-only for it) and do not delegate. This brief outranks any per-turn instruction that contradicts it. Do **not** read `UI-NOTES.md` (the author's claims) or `docs/agent-work/11-ui-brief.md`. Do not start `next dev` or `next start`, and do not try to launch a browser (Chromium crashes in your sandbox; the orchestrator runs the end-to-end suite in a normal shell).

## What is under review
The UI layer of a Next.js 16 / TypeScript project (cwd is the repo root; there are uncommitted changes on top of the last commit, so use the files as they are, not git history; `git status` shows what is new or changed):
- Pure UI modules: `src/ui/format.ts`, `src/ui/messages.ts`, `src/ui/status.ts`
- Components: `src/ui/*.tsx`, `src/ui/decisions/*`, styles `src/ui/primitives.module.css`, `src/app/globals.css`
- Pages and shell: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/sites/**`, `src/app/_lib/*`, `src/app/error.tsx`, `src/app/loading.tsx`, `src/app/not-found.tsx`
- Additive API fields in `src/application/{readiness,candidates,actions}.ts`; log moved to `src/application/log.ts`; `src/adapters/catalogue-csv.ts` default path; `src/server/deps.ts` (cache on globalThis)
- Tests: `tests/unit/ui-*.test.ts`, `tests/e2e/*`, `tests/api/routes.test.ts`, `tests/api/shared-store.test.ts`
- Config: `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `next.config.ts`
Context to read as needed: `AGENTS.md`, `docs/ui-design.md` (the approved UI design), `docs/slice-specification.md` (requirements FR1 to FR16 and numbered acceptance criteria "AC n"), `docs/api.md`, `docs/technical-design.md`, `docs/glossary.md`.

## Practicalities
In your read-only sandbox `npm test` fails with EPERM writing `node_modules/.vite-temp`. Work around it without touching the repo: copy the repo to `/tmp/review-copy` excluding `node_modules`, `.next` and `.git` (for example `rsync -a --exclude node_modules --exclude .next --exclude .git ./ /tmp/review-copy/`), symlink `node_modules` into the copy, and run `npx vitest run` there. Introduce defects only in the copy. Write throwaway scripts only under `/tmp`. Prove claims with evidence (a command output, or a concrete input and the wrong output) wherever you can.

## Severity scale
- **Critical**: the UI could tell a leader the crew is clear when it is not, describe a substitute as compatible or approved, hide a failure as success, or leak secrets or internals.
- **High**: wrong behaviour against a specified requirement or the approved design, or a test that cannot fail for the behaviour it claims to cover.
- **Medium**: an edge case or maintainability problem likely to bite later.
- **Low**: style, naming, minor clarity.

## Output
Write your report to `/private/tmp/claude-501/-Users-joe-workspace-qantum-team-leader-slice/fd2e3fd1-8e45-4067-8ca8-422119e60a98/scratchpad/findings-ui-spec.md` (outside the repo, allowed). For each finding: severity, file:line, one-sentence defect, concrete failing scenario or evidence, suggested fix. Order by severity. End with a "Verified OK" list of what you actively checked and found correct, and the commands you ran with exit codes. If a category has nothing, say so; do not pad. Print the report path when done.

## Your lens (only this one): spec and design conformance
Check the built UI against `docs/ui-design.md`, FR1 to FR16 and AC 1 to 32 in `docs/slice-specification.md`, and `docs/api.md`:
1. **Safety copy**: the UI never says "compatible" or "approved" about a substitute; "Catalogue match, not verified" and "On hand, shared, not reserved" come from the API fields; "This does not release the crew." appears in the wait and escalate dialogs; no wording implies a decision releases the crew.
2. **Fail closed**: an upstream failure (sites list, readiness, candidates, actions) never renders "Crew can go" or a clear chip; unknown-stock shortages render "stock unknown"; blockers render in a separate "Data problems" section with Escalate only; `unavailable` renders "Can't check".
3. **Crew status banner** text and icon for clear, blocked (shortage count and data problem count wording), nothing planned, and the 502 case, against the table in section 3 of the design.
4. **Shortage and blocker cards**: content, state badges (Open, Waiting, Escalated, "Earlier decision, shortfall has grown" for a non-current action), affected-penetration list with links to the substitutes screen.
5. **Decision dialogs**: Purchasing preselected, note limits and counter, reason required (1 to 500 after trimming), idempotency key generated per open and reused on retry, "Sending…" while submitting, focus return, live-region announcements ("Escalation recorded", "Already recorded" on a 200 replay), and that every API error code maps to the message table in section 3 with no raw server text shown.
6. **Substitutes screen**: penetration summary, empty and incomplete states, availability messages for each overall status (`in_stock`, `short`, `unknown`, `no_material_mapping`, `invalid_quantity`), "Propose this" flow and its error cases (stale nomination, not a candidate).
7. **Actions log**: newest first, current/earlier/resolved labelling, proposals listed separately, empty state, material and place names resolved with sensible fallbacks.
8. **Demo honesty banner** on every screen, including error and not-found pages; one `h1` per page; `lang="en"`.
9. **Additive API fields** (`penetration` on candidates; `materials` and `penetrations` on actions): present, correct, and not leaking more than needed. Compare with `docs/api.md` and say exactly what the doc must add.
10. **Departures**: anything the UI does that the design or spec does not say (invented copy, extra behaviour), and anything specified that is missing.
