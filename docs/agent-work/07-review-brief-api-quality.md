# REVIEW BRIEF: API layer, code quality and security

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
Write your report to `/private/tmp/claude-501/-Users-joe-workspace-qantum-team-leader-slice/fd2e3fd1-8e45-4067-8ca8-422119e60a98/scratchpad/findings-api-quality.md` (outside the repo, allowed). For each finding: severity, file:line, one-sentence defect, concrete failing scenario or evidence, suggested fix. Order by severity. End with a "Verified OK" list of what you actively checked and found correct, and the commands you ran with exit codes. If a category has nothing, say so; do not pad. Print the report path when done.

## Your lens (only this one): code quality and security
Focus on:
1. **Security of the public write surface**: unauthenticated POSTs, body size and parsing limits (is the byte limit enforced before the body is fully read, and is `Content-Length` trusted?), header handling, id and path parameter handling (injection, traversal, encoding), response headers, anything that echoes user input, CORS defaults, HTTP method handling for unsupported methods, error and log hygiene (stack traces, paths, SQL, notes, reasons, keys, upstream messages in responses or logs).
2. **Secrets**: how `SUPABASE_SERVICE_KEY` and URLs flow. Can any module that a client component could import reach `src/server` or the service key? Does any error or log path include them? Is `.env.example` consistent with `src/server/env.ts`?
3. **Supabase adapter**: query construction (any string interpolation into filters), handling of every error code, the unique-violation branch and its race behaviour, row parsing, use of the service role.
4. **Fail-closed behaviour**: the composition root, caching of failed builds, production guard, what happens with partial configuration, and what an attacker controlling env-like inputs (headers, query strings) could change.
5. **Code quality**: readability of the use cases and route helpers, duplicated logic (for example id validation repeated), over-engineering for this size, unclear names, dead code, error class hierarchy, any `any`, unsafe casts, `as` assertions, non-null assertions, or lint suppressions.
6. **Architecture**: layers respected (domain pure; application does not import Next; routes thin; client code cannot import server code), no hidden global state besides the cached dependencies, testability of the composition root.
7. **Performance**: per-request work in `listSites` (N sites each doing nominations, materials and stock calls), repeated catalogue loading, quadratic loops, anything that matters at 200 penetrations per site.
