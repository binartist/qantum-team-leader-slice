# REVIEW BRIEF: spec conformance and correctness

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
Write your report to `/private/tmp/claude-501/-Users-joe-workspace-qantum-team-leader-slice/fd2e3fd1-8e45-4067-8ca8-422119e60a98/scratchpad/findings-spec.md` (outside the repo, allowed). For each finding: severity, file:line, one-sentence defect, concrete failing scenario or evidence, suggested fix. Order by severity. End with a short "Verified OK" list of the things you actively checked and found correct, and the commands you ran with exit codes. If you find nothing in a category say so; do not pad. Do not report style nits unless your lens is code quality. Finish by printing the path of the report.

## Your lens (only this one): spec conformance and correctness
Check the implementation against the requirements and design, not against the tests. You MAY read `BRIEF.md` for this lens only, because it states the intended API shapes.
Focus on:
1. Does each rule in technical-design.md section 4 (shortage maths, deterministic shortage id, shared unreserved stock, unknown stock, blockers, crew status, action lifecycle "current only while shortfall has not grown", escalate-then-wait stays escalated) behave exactly as written?
2. Does matching follow section 6 exactly (penetration attributes, normalisation rule steps 1 to 5, trailing comma never stripped, incomplete substrate gets no candidates, null insulation never satisfies a stated requirement, integrity and insulation at or above requirement)?
3. Hunt for edge cases that produce a wrong "clear" or a wrong candidate: duplicate penetrations, penetration for another site, zero or negative quantities, a material with one location at zero quantity, floating point sums, actions for another site or shortage, equal timestamps, empty inputs, `NaN`, very large numbers, a solution-material row for a code not in the catalogue, one material required by both a blocked and an unblocked penetration.
4. Does `buildCatalogue` preserve raw text and handle the CSV's quirks (BOM, `-` insulation, double spaces)? Try the real file.
5. Anything where the code and the spec disagree: say which one you think is right and why.
