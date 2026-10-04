# REVIEW BRIEF: UI, code quality, accessibility and security

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
Write your report to `/private/tmp/claude-501/-Users-joe-workspace-qantum-team-leader-slice/fd2e3fd1-8e45-4067-8ca8-422119e60a98/scratchpad/findings-ui-quality.md` (outside the repo, allowed). For each finding: severity, file:line, one-sentence defect, concrete failing scenario or evidence, suggested fix. Order by severity. End with a "Verified OK" list of what you actively checked and found correct, and the commands you ran with exit codes. If a category has nothing, say so; do not pad. Print the report path when done.

## Your lens (only this one): code quality, accessibility, security
Use the activated guidance in `.agents/skills/` (`frontend-engineering`, `ui-portability-baseline`, `security-baseline`, `code-quality`, `testing-strategy` where relevant).
1. **Security**: nothing secret or server-only reaches client components (check every `"use client"` file and what it imports, transitively; check the eslint layering rules actually forbid `src/ui` and client code importing `src/server`, `src/adapters` or the Supabase client); no `dangerouslySetInnerHTML`; user-supplied text (notes, reasons) rendered as text only; no `NEXT_PUBLIC_` use; error and not-found pages never render `error.message`, digests or stack; the client `fetch` patch and the `sessionStorage` use (`team-leader:announce`): can they leak or be abused, and are they safe if storage throws?; responses and pages never cached (`dynamic`, no-store); the idempotency key handling.
2. **Accessibility (WCAG 2.2 AA)**: heading order and one h1 per page, landmarks, accessible names for repeated buttons ("Wait", "Escalate" per card), `<dialog>` focus management and return of focus, labels and error association (`aria-describedby`, `aria-invalid`), live-region design (the in-memory store plus `useSyncExternalStore`), status shown by text and icon not colour alone, disclosure (`details`) affordance and keyboard behaviour, focus visibility, contrast of the tokens in `src/app/globals.css` in light and dark (compute the ratios for text, chips, banners, focus ring, disabled states), `prefers-reduced-motion`, zoom and reflow at 375px and 200%, touch target sizes in CSS.
3. **Architecture**: server components for reads, client islands only where needed, no data fetching duplicated between layers, the `getDependencies()` global cache in `src/server/deps.ts` (is the `globalThis` symbol approach sound; does `setDependenciesForTests` still behave), the `src/adapters/catalogue-csv.ts` default-path change, layering rules in `eslint.config.mjs`, one-way imports (`domain` <- `application` <- `server`/`app`/`ui`).
4. **Code quality**: readability, duplication between cards and dialogs, over-engineering for this size, names, dead code, any `any`, unsafe casts, non-null assertions, lint suppressions, CSS tokens used consistently versus hard-coded values, styles that could break in dark mode, copy strings scattered outside `src/ui/messages.ts`.
5. **Robustness**: double submit, closing a dialog mid-request, a slow or failing `router.refresh()`, an API response that is not JSON, offline, a stale page after another tab wrote an action.
6. **Performance**: pages with many penetrations (the sealant shortage affects 12; imagine 200), repeated use-case calls per page, bundle weight of client islands (look at `.next` output if present, read-only).
