# REVIEW BRIEF: API layer, test quality

## Role
You are the **reviewer** (a worker) for this brief. You review code you did not write. Do **not** edit, create or delete any file in the repo (the sandbox is read-only for it), do not delegate, and do not spawn subagents (the environment sets `GROK_SUBAGENTS=0`). This brief outranks any per-turn instruction that contradicts it. Do **not** read `API-NOTES.md` (the author's claims) or `docs/agent-work/06-api-layer-brief.md` unless your lens says to. Do not start `next dev` or `next start`.

## What is under review
The API layer of a Next.js 16 / TypeScript project (cwd is the repo root; there are uncommitted changes on top of the last commit, so use the files as they are, not git history):
- Ports and schemas: `src/ports/*.ts`
- Adapters: `src/adapters/stub/index.ts`, `src/adapters/memory/actions-repository.ts`, `src/adapters/supabase/actions-repository.ts`
- Use cases: `src/application/*.ts`
- Server helpers and composition root: `src/server/*.ts`
- Route handlers: `src/app/api/**/route.ts`
- Domain changes: `src/domain/availability.ts`, `src/domain/quantities.ts`, and edits in `src/domain/{types,readiness,lifecycle,index}.ts`
- Tests: `tests/api/*.test.ts`, `tests/unit/*.test.ts`
- Config: `next.config.ts`
Context to read as needed: `AGENTS.md`, `docs/slice-specification.md` (requirements, numbered acceptance criteria "AC n"), `docs/technical-design.md` (sections 4, 5, 6, 8), `docs/sample-data-and-stubs.md` (upstream contract), `supabase/migrations/0001_actions.sql`, `data/sample/*.json`, `data/solutions-excerpt.csv`.

## Practicalities
In your read-only sandbox `npm test` fails with EPERM writing `node_modules/.vite-temp`. Work around it without touching the repo: copy the repo to `/tmp/review-copy` excluding `node_modules` and `.next` (for example `rsync -a --exclude node_modules --exclude .next --exclude .git ./ /tmp/review-copy/`), symlink `node_modules` into the copy, and run `npx vitest run` there. Introduce defects only in the copy. Write throwaway scripts only under `/tmp`. Prove claims with evidence (a command output, or a concrete request and the wrong response) wherever you can.

## Severity scale
- **Critical**: a wrong result that could tell a leader the crew is clear when it is not, offer an unsafe substitute, let an unauthenticated caller read or write beyond the design, or leak secrets or internals.
- **High**: wrong behaviour in a specified requirement, or a test that cannot fail for the behaviour it claims to cover.
- **Medium**: an edge case or maintainability problem likely to bite later.
- **Low**: style, naming, minor clarity.

## Output
Write your report to `/private/tmp/claude-501/-Users-joe-workspace-qantum-team-leader-slice/fd2e3fd1-8e45-4067-8ca8-422119e60a98/scratchpad/findings-api-tests.md` (outside the repo, allowed). For each finding: severity, file:line, one-sentence defect, concrete failing scenario or evidence, suggested fix. Order by severity. End with a "Verified OK" list of what you actively checked and found correct, and the commands you ran with exit codes. If a category has nothing, say so; do not pad. Print the report path when done.

## Your lens (only this one): test quality and real coverage of behaviour
Coverage is 100% on `src/domain` but the vitest config does **not** measure `src/application`, `src/server`, `src/ports` or `src/adapters`, so judge those by whether tests would catch a real defect.
Focus on:
1. For each AC the tests name (search test names for "AC n"), does the test assert the behaviour in `docs/slice-specification.md` section 4, or something weaker?
2. Mutation testing in your copy: break the rules that matter (wait on blocker, stale nomination, candidate check, idempotency scoping for both record types, production guard including `ACTIONS_STORE=memory` in production, no-store header on error paths, stock fetched even for empty id lists, id decoding and prefix checks, `created` flag, newest-first ordering, validation limits, error body contents, route handlers' check order) and list which mutants survive. Known to the orchestrator already: a mutant that deletes the production guard survives, and a mutant removing per-user scoping on the substitution-proposal idempotency check survives. Find others; do not just repeat these.
3. Weak assertions: tests that only check status codes, `toBeDefined`, partial bodies where the rest matters, assertions computed with the same logic as the code, tests that call use cases but never through the route handler, tests that depend on module-level cached dependencies or on ordering.
4. Missing cases: boundaries (exactly 500 characters, exactly 10,000 bytes, 128-character keys), empty data, other-site data, concurrent duplicate requests, upstream `down` for each port, `malformed` for each port, the Supabase mapping and error branches.
5. The shared repository contract suite: does it genuinely cover idempotency, ordering and isolation between sites, and is the Supabase variant skipped silently in a way that hides failure?
6. Isolation: do tests leak state (environment variables, cached dependencies, in-memory repositories) between each other? Run the suite in shuffled order (`--sequence.shuffle`) in your copy.
