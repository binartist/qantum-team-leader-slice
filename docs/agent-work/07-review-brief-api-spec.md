# REVIEW BRIEF: API layer, spec conformance and correctness

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
Write your report to `/private/tmp/claude-501/-Users-joe-workspace-qantum-team-leader-slice/fd2e3fd1-8e45-4067-8ca8-422119e60a98/scratchpad/findings-api-spec.md` (outside the repo, allowed). For each finding: severity, file:line, one-sentence defect, concrete failing scenario or evidence, suggested fix. Order by severity. End with a "Verified OK" list of what you actively checked and found correct, and the commands you ran with exit codes. If a category has nothing, say so; do not pad. Print the report path when done.

## Your lens (only this one): spec conformance and correctness
You MAY read `docs/agent-work/06-api-layer-brief.md` for this lens only, as it states the intended behaviour.
Check behaviour against the spec and design, not against the tests. Focus on:
1. Every endpoint: status codes, bodies, error codes, order of checks (path ids, idempotency key, body size, JSON, schema, use case), `Cache-Control: no-store` on every response including errors and 404s of unknown routes' handlers.
2. Readiness flow: could any upstream failure, empty list, or ordering produce `clear` when it should not? Look at empty material-id lists, the `empty` and `malformed` stub modes, a site missing from nominations, stock for materials not requested, solution-materials for codes not requested.
3. Wait and escalate rules: shortages, unknown-stock shortages, blockers, `shortfallQtyAtTime` values, shortage id parsing (colons, URL encoding, double encoding, case), wrong-site ids, ids that start with the right site prefix but belong to another site.
4. Substitution: stale nomination, non-candidate, penetration of another site, repeated proposals, reason length, whitespace-only reasons.
5. Idempotency: ordering of key lookup versus target validation (what happens on a retry after the target disappeared), per-user scoping for **both** record types, keys with odd characters, different bodies with the same key.
6. `listActions` classification including blockers, newest-first ordering, and `listSites` partial failure.
7. Domain changes: blockers with actions, availability rules (no mapping, invalid quantity, unknown stock, dust), unchanged behaviour of existing readiness rules.
8. Anything where the code and the spec disagree: say which you think is right and why.
