# REVIEW BRIEF: test quality

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
Write your report to `/private/tmp/claude-501/-Users-joe-workspace-qantum-team-leader-slice/fd2e3fd1-8e45-4067-8ca8-422119e60a98/scratchpad/findings-tests.md` (outside the repo, allowed). For each finding: severity, file:line, one-sentence defect, concrete failing scenario or evidence, suggested fix. Order by severity. End with a short "Verified OK" list of the things you actively checked and found correct, and the commands you ran with exit codes. If you find nothing in a category say so; do not pad. Do not report style nits unless your lens is code quality. Finish by printing the path of the report.

## Your lens (only this one): test quality and coverage of behaviour
Judge whether the tests would actually catch real defects, not whether coverage is high (it is 100% on `src/domain`; that proves little).
Focus on:
1. For each acceptance criterion the tests claim to cover (search test names for "AC n"), does the test assert the behaviour in `docs/slice-specification.md` section 4, or something weaker? List criteria whose tests could pass with a wrong implementation.
2. Weak assertions: `toBeDefined`, length-only checks, assertions on a mock or on a value computed with the same logic as the code, tests that restate the implementation, snapshot-free but order-insensitive checks that should be ordered.
3. Missing cases: boundary values (exactly equal, one below), the failure paths in `buildCatalogue`, empty and single-element inputs, other-site data, mutation of inputs, equal timestamps, unknown-to-known transitions.
4. Do the real-catalogue tests pin the right expected values (20 solutions with candidates, 6 incomplete substrates, 8 null insulation) and would they fail if the catalogue or rules changed?
5. Do the tests depend on each other, on ordering, on the current working directory, or on files outside the repo?
6. Try to disprove a test: reason about a plausible bug in the code and check whether any test would fail. You may copy the repo's `src/domain` to `/tmp`, introduce a defect there, and run the tests against the copy to demonstrate a survivor. Never change the repo itself.
