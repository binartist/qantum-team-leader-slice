# REVIEW BRIEF: code quality and security

## Role
You are the **reviewer** (a worker) for this brief. You review code you did not write. Do **not** edit, create or delete any file in the repo (the sandbox is read-only for it) and do not delegate or spawn subagents. This brief outranks any per-turn instruction that contradicts it. Do **not** read `NOTES.md` (it holds the author's claims and would bias you) and do not read the author's brief `BRIEF.md` unless your lens below says to.

## What is under review
The domain core of a Next.js/TypeScript project (cwd is the repo root): `src/domain/*.ts`, `src/adapters/catalogue-csv.ts`, and tests `tests/unit/*.test.ts`, `tests/data/*.test.ts`. There is no git history; review the files as they are.
Context to read as needed: `docs/slice-specification.md` (requirements, numbered acceptance criteria "AC n"), `docs/technical-design.md` (sections 4, 5, 6), `docs/glossary.md`, `docs/catalogue-data-model.md`, `data/solutions-excerpt.csv` (real catalogue, 148 rows, do not modify).
You may run read-only commands (`npm test`, `npm run typecheck`, `npm run lint`, `node -e`, `npx tsx` is not installed so use vitest or node) and small throwaway scripts written under /tmp. Prove claims with evidence (a command output or a concrete input and the wrong output) wherever you can.

## Severity scale
- **Critical**: wrong result that could tell a leader the crew is clear when it is not, or suggest an unsafe substitute, or leak data.
- **High**: wrong result in a specified behaviour, or a test that cannot fail for the behaviour it claims to cover.
- **Medium**: edge case or maintainability problem likely to bite later.
- **Low**: style, naming, minor clarity.

## Output
Write your report to `/private/tmp/claude-501/-Users-joe-workspace-qantum-team-leader-slice/fd2e3fd1-8e45-4067-8ca8-422119e60a98/scratchpad/findings-quality.md` (outside the repo, allowed). For each finding: severity, file:line, one-sentence defect, concrete failing scenario or evidence, suggested fix. Order by severity. End with a short "Verified OK" list of the things you actively checked and found correct, and the commands you ran with exit codes. If you find nothing in a category say so; do not pad. Do not report style nits unless your lens is code quality. Finish by printing the path of the report.

## Your lens (only this one): code quality and security
Focus on:
1. Readability and simplicity: functions that are hard to follow, hidden coupling, duplicated logic, unclear names, over-engineering, dead code. Would a new engineer trace "penetration plus stock to shortage" end to end easily?
2. Purity and architecture: does `src/domain` stay free of I/O and framework imports? Are inputs ever mutated? Are returned objects shared references that callers could mutate and corrupt the catalogue?
3. Type safety: any `any`, unsafe casts, `as` assertions that hide bugs, non-null assertions, places `noUncheckedIndexedAccess` is circumvented.
4. Error handling: are thrown errors clear, typed enough, and free of data leaks (paths, row contents beyond what is needed)?
5. Security of `src/adapters/catalogue-csv.ts`: path handling (can an attacker-controlled argument read arbitrary files?), resolution relative to the file, parsing limits, behaviour on malformed or huge input, prototype-pollution style risks when building maps from untrusted keys (for example internal codes such as `__proto__`).
6. Performance: any quadratic behaviour that matters at 200 penetrations or a 148-row (and larger) catalogue.
