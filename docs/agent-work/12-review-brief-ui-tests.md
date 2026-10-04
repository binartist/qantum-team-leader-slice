# REVIEW BRIEF: UI, test quality

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
Write your report to `/private/tmp/claude-501/-Users-joe-workspace-qantum-team-leader-slice/fd2e3fd1-8e45-4067-8ca8-422119e60a98/scratchpad/findings-ui-tests.md` (outside the repo, allowed). For each finding: severity, file:line, one-sentence defect, concrete failing scenario or evidence, suggested fix. Order by severity. End with a "Verified OK" list of what you actively checked and found correct, and the commands you ran with exit codes. If a category has nothing, say so; do not pad. Print the report path when done.

## Your lens (only this one): test quality and coverage
1. **AC mapping**: for AC 30, 31 and 32 and every UI-relevant FR, find the test that proves it and judge whether it could actually fail. Name tests that pass for the wrong reason (assert something always true, wait for the wrong thing, check only the loading state).
2. **Mutation probing (in your copy only)**: break the pure modules `src/ui/format.ts`, `src/ui/messages.ts`, `src/ui/status.ts` (flip a comparison, swap a message, change a tone or icon, drop a case) and run the unit tests. List every mutant that survives and what test would kill it. Do the same for `src/app/_lib/load.ts` and the additive fields in `src/application/*.ts`. You cannot run Playwright here; reason about the e2e specs by reading them, and say which behaviours they would miss if a component were broken (for example: an error message mapped wrongly, a dialog that does not reuse its idempotency key, a non-current action shown as current, a failure shown as clear).
3. **Coverage honesty**: the coverage gate includes `src/domain/**` and `src/ui/*.ts` at 100%. Which UI logic lives outside that include (components, `src/app/**`, dialogs) and has no unit test, and is that logic non-trivial?
4. **E2E quality**: stability (fixed sleeps, order dependence, shared in-memory state between tests, reliance on the dev server cold start), whether the scenario test walks the demonstration scenario in `docs/ui-design.md` section 6, whether axe runs on every screen in both colour schemes and with a dialog open, whether the 44 by 44 check and the no-horizontal-scroll check cover every screen and skip only what they should (look at `tests/e2e/support.ts`: it skips inline links in paragraphs, Next dev tooling, and content in closed disclosures; judge each skip), whether the forced-failure case (stock down shows the "can't check" banner and never "Crew can go") is tested anywhere.
5. **Test hygiene**: names carry the AC number where one applies, no `.only`/`.skip` left behind, no weakened assertions, shuffled order passes (`npx vitest run --sequence.shuffle --sequence.seed 7` in your copy), no test depends on the real clock or network.
6. **Regression guard**: `tests/api/shared-store.test.ts` covers a bug where pages and API routes saw different in-memory stores. Does it really reproduce that failure mode?
