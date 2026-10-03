# Exercise submission checklist

Living checklist against the "What to submit" and "What we will assess" sections of `docs/passive-fire-exercise.md`. Update it as work lands. Tick only with evidence (file, URL, or CI run), recorded in the Evidence column.

Last updated: 2026-10-03

Legend: `[x]` done, `[~]` partial, `[ ]` not started.

## 1. Submission items

| # | Item | Status | Evidence / next step |
| --- | --- | --- | --- |
| 1 | GitHub repository link | [~] | Local repo on branch `dev` with 4 per-intent commits, verified from a fresh clone (npm ci, typecheck, lint, 105 tests, build). No remote and nothing pushed. Creating the GitHub repo and pushing need your go-ahead. |
| 2 | Public URL for the working experience | [ ] | Vercel deploy. Record URL here. |
| 3 | Try-it instructions | [ ] | In README. |
| 4 | README: run locally | [~] | README is a stub. |
| 5 | README: run tests | [ ] | |
| 6 | README: deploy | [ ] | |
| 7 | README: demo scenario | [ ] | Shortage, then escalate, crew stays blocked. |
| 8 | README: sample data and known limitations | [ ] | Sample data to live in `data/sample/` with a README stating it is invented. |
| 9 | Iteration plan (md) | [x] | `docs/iteration-plan.md`: slice rationale, 6 iterations, uncertainties. Awaiting your review. |
| 10 | First-slice specification (md) | [x] | `docs/slice-specification.md`: 16 FRs, 32 acceptance criteria, NFRs, assumptions, exclusions. Awaiting your review. |
| 11 | Technical design (md) | [x] | `docs/technical-design.md`. Section 11 additions awaiting confirmation. |
| 12 | Test strategy (md) | [x] | `docs/test-strategy.md`: layers, all 32 ACs mapped, risks, CI gates. Awaiting your review. |
| 13 | Agent instructions and context files | [~] | Repo guidance in `AGENTS.md` (tool-neutral; `CLAUDE.md` is a one-line `@AGENTS.md` import), plus six Skill Forge skills vendored in `.agents/skills` (declared in `skill-forge.json`, locked in `skill-forge.lock.json`). Add per-task briefs (domain core `BRIEF.md`, review briefs) to the repo before submission. |
| 14 | Working application code | [~] | Domain core and CSV adapter done (src/domain, src/adapters). API, upstream stubs, screens still to build. | |
| 15 | Automated tests | [~] | 105 unit and data tests, 100% coverage of src/domain, ACs 1-8, 10, 14, 15, 18-22, 25, 26 referenced. API, DB, e2e still to write. | |
| 16 | CI/CD config | [~] | `.github/workflows/ci.yml` runs typecheck, lint, tests with coverage, build, prod audit, secret scan. DB tests, Playwright, AC check and Vercel deploy still to add. |
| 17 | Pipeline inspectable, with successful deploy evidence | [ ] | Link a green run and the deployment. |
| 18 | Agentic coding account | [ ] | See section 3. |

## 2. Assessment criteria

| Criterion | Status | What reviewers need to see |
| --- | --- | --- |
| Business understanding | [x] | Path, gaps and assumptions in `business-path-data.md`, `glossary.md` and the iteration plan. |
| Slicing | [x] | Slice chosen against alternatives, boundary stated, six iterations in `iteration-plan.md`. |
| Specification and agent guidance | [ ] | Spec with testable acceptance criteria. Agent instruction files. |
| Technical judgement | [x] | Design with trade-offs and production-vs-exercise table. |
| User experience | [ ] | Working screens covering missing data and blocked states. |
| Engineering quality | [ ] | Deployed slice, tests, pipeline. |
| Ownership | [ ] | Be able to trace a user action end to end and explain limits. |

## 3. Agentic coding account (collect as we go)

Logged so far:
- Delegated the domain core to Grok (grok-4.7, in-tree, new-files-only because nothing was committed). Orchestrator gates, write-scope diff and 14 mutation checks done in own shell. Worker cost $0.669, 26 turns.
- Agent (me) wrote the brief with an expected value of 24 candidate solutions; recomputing under the design's own final rules gave 20 (24 included truncated substrates the design forbids). Corrected in spec, design and test strategy before dispatch.
- Agent chose ESLint 10 with `eslint-config-next`; lint crashed (plugin incompatibility). Pinned ESLint 9 instead of forcing a workaround.
- Agent's first Postgres validation ran before the server was ready and silently skipped the role and RLS checks. Caught by reading the output, re-run properly.
- Agent's `npm audit` showed 5 high findings. Checked they are dev-only (`braces` under `eslint-config-next`), refused `audit fix --force`, and scoped the CI audit to production dependencies.
- Subagent (Opus) design review corrected the agent's design in several places (shared stock, truncated substrates, action lifecycle). See change log.

Capture these while working, not afterwards.

- [ ] Tools used (Claude Code, which models, which skills or subagents).
- [ ] How work was planned and directed (spec first, tiering, approval points).
- [ ] How outputs were verified (gates, tests, review lenses).
- [ ] Examples where an agent suggestion was corrected or rejected. Log each one below.

Corrections log:

| Date | Agent suggestion | What was wrong | Decision |
| --- | --- | --- | --- |
| | | | |

## 4. Decisions awaiting confirmation

From `technical-design.md` section 11 and 12.

- [ ] `GET /sites/{id}/readiness` added.
- [ ] `GET .../substitution-candidates` added.
- [ ] Shortage id is derived `siteId:materialId`.
- [ ] Crew stays blocked after wait or escalate.
- [ ] Sample `solution_material` file accepted as the quantity source.
- [ ] Open: does an approved substitute release the crew, or only the upstream nomination change?
- [x] Stock is shared and not reserved, summed across locations (decided 2026-10-03).
- [x] Substitution tightened: exact normalisation rule, match on penetration, validate on write, empty state, demo codes from matchable set (decided 2026-10-03).
- [x] Action lifecycle and write surface fixes applied to design (decided 2026-10-03).
- [ ] Re-confirm design section 11 items 6 to 12 (new divergences added after review).

## 5. Pre-submission checks

- [ ] CI green on the default branch (lint, typecheck, unit, API, DB, end-to-end).
- [ ] Public URL loads and the demo scenario works from a clean browser.
- [ ] No secrets in the repo or history. `.env.example` lists names only.
- [ ] Sample data clearly labelled as invented. Every sample penetration references a real `internal_code`.
- [ ] Docs match the built behaviour (design, spec, README, endpoints).
- [ ] Known limitations list is current (auth, offline, real stock system, approval workflow).
- [ ] Repo link and URL tested from outside the author's account.

## 6. Change log

| Date | Change |
| --- | --- |
| 2026-10-03 | Checklist created (as handover-checklist, renamed to submission-checklist). Technical design marked done. |
| 2026-10-03 | Glossary added (docs/glossary.md). Design review by Opus subagent received; fixes not yet applied. |
| 2026-10-03 | Design updated after Opus review: shared stock, substitution rule, action lifecycle, write surface. Data-quality notes added to catalogue-data-model.md. |
| 2026-10-03 | Decision: Supabase persistence kept, write-surface security trimmed (RLS deny-all, server-set author, length caps, no-store). Rate limit, reset script, dedicated role, request-hash idempotency moved to production list. |
| 2026-10-03 | Spec written (docs/slice-specification.md). Upstream data findings added to catalogue-data-model.md. CSV comparison with ~/Downloads blocked by macOS permission. |
| 2026-10-03 | CSV verified: repo copy and ~/Downloads copy are identical (SHA-256 cc01d2ab3fd65a29d95ef42fd04648682e116b1142700300fab9074a30b5e805). |
| 2026-10-03 | Iteration plan written (docs/iteration-plan.md). Business understanding and slicing criteria marked done pending review. |
| 2026-10-03 | Test strategy written (docs/test-strategy.md). All planning docs now exist; next is repo setup and build. |
| 2026-10-03 | Scaffold: Next.js 16 + TS strict, Vitest, Playwright, ESLint with domain-purity rule, CI skeleton, Supabase migration (validated in Postgres 16), repo CLAUDE.md, git init (no commit). |
| 2026-10-03 | Domain core built by Grok and accepted: 69 tests, 100% coverage, mutation spot checks pass. Spec/design/test-strategy candidate count corrected from 24 to 20. |
| 2026-10-03 | Skill Forge profile added: coding-discipline, security-baseline, code-quality, testing-strategy, external-worker-delegation, grok-build-harness (`skf sync --check` exit 0, no shadowing against $HOME). Gates still green. |
| 2026-10-03 | Agent guidance moved to AGENTS.md; CLAUDE.md now only imports it (`@AGENTS.md`), as umbrella-workspace scaffolds it. |
| 2026-10-03 | Independent review (3 fresh Grok sessions, $2.97) found fail-open numeric paths and test gaps. Fixed by a second worker session ($0.784, 28 turns): 105 tests, 100% domain coverage, 19 mutants killed incl. all reviewer survivors. Spec, design, test strategy and AGENTS.md updated with the `invalid_quantity` rule and number handling. |
| 2026-10-03 | Committed locally on `dev` in four per-intent commits (docs and data, scaffold, skills, domain core). Fresh-clone gates pass. Not pushed. |
