# Exercise submission checklist

Living checklist against the "What to submit" and "What we will assess" sections of `docs/passive-fire-exercise.md`. Update it as work lands. Tick only with evidence (file, URL, or CI run), recorded in the Evidence column.

Last updated: 2026-10-03

Legend: `[x]` done, `[~]` partial, `[ ]` not started.

## 1. Submission items

| # | Item | Status | Evidence / next step |
| --- | --- | --- | --- |
| 1 | GitHub repository link | [x] | https://github.com/binartist/qantum-team-leader-slice (public, default branch `main`). |
| 2 | Public URL for the working experience | [x] | https://qantum-team-leader-slice.vercel.app (Vercel, functions in `syd1`, actions in Postgres database `qantum_slice`). |
| 3 | Try-it instructions | [x] | README "Try it": a two-minute walk through the live demo. |
| 4 | README: run locally | [x] | README "Run locally": `npm ci`, `npm run dev`, memory store, no credentials. |
| 5 | README: run tests | [x] | README "Tests": typecheck, lint, coverage, AC check, Playwright, database contract. |
| 6 | README: deploy | [x] | README "Deploy": database setup and migration, Vercel settings, GitHub secrets. |
| 7 | README: demo scenario | [x] | README "Try it", following spec section 9. |
| 8 | README: sample data and known limitations | [x] | README "Sample data" and "Known limitations"; `data/sample/README.md` labels the data invented. |
| 9 | Iteration plan (md) | [x] | `docs/iteration-plan.md`: slice rationale, 6 iterations, uncertainties. Awaiting your review. |
| 10 | First-slice specification (md) | [x] | `docs/slice-specification.md`: 16 FRs, 34 acceptance criteria, NFRs, assumptions, exclusions. Awaiting your review. |
| 11 | Technical design (md) | [x] | `docs/technical-design.md`. Section 11 additions awaiting confirmation. |
| 12 | Test strategy (md) | [x] | `docs/test-strategy.md`: layers, all 32 ACs mapped, risks, CI gates. Awaiting your review. |
| 13 | Agent instructions and context files | [x] | `AGENTS.md` (tool-neutral; `CLAUDE.md` imports it), 11 Skill Forge skills in `.agents/skills` (`skill-forge.json`, lock file), and every brief, review brief, review report and worker note in `docs/agent-work/`. |
| 14 | Working application code | [x] | Domain core, stubs, Postgres and memory stores, use cases, seven-route API, four screens. Live and proven against the real database. |
| 15 | Automated tests | [x] | 289 unit and API tests, 5 database contract tests on Postgres 17, 12 Playwright tests with axe at 375px; all 32 ACs referenced; all run in CI. |
| 16 | CI/CD config | [x] | `.github/workflows/ci.yml`: checks (typecheck, lint, coverage, build, bundle credential scan, audit, gitleaks), db (contract suite on Postgres 17), e2e (Playwright, axe, AC check), and on `main` a Vercel prebuilt deploy plus smoke test. |
| 17 | Pipeline inspectable, with successful deploy evidence | [x] | Green run with deploy and smoke: https://github.com/binartist/qantum-team-leader-slice/actions/runs/37309054947. Live check 2026-10-06: `x-vercel-id` syd1, smoke ok, an escalation recorded through the live API survived a production redeploy. |
| 18 | Agentic coding account | [x] | `docs/agentic-approach.md`: tools, planning, verification ladder, corrections, cost. |

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
- API layer built by Grok fast ($2.82), independently reviewed by three fresh sessions ($4.83) with no Critical findings but one High (idempotency checked after business rules) and 24 surviving mutants. Fix round on fast ($3.47) accepted after orchestrator re-ran mutants (13 of 15 killed, 2 equivalent) and a live HTTP walk.
- Agent (me) accepted the worker's per-key idempotency design at first; review showed a retry after resolution returned 404. Redesigned as lookup-first with 409 on target mismatch.
- Agent (me) rejected two reviewer suggestions with reasons: module-relative catalogue path (breaks in bundled output) and a `server-only` import (needs a new dependency).
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
| 2026-10-03 | Spec and design said 24 substitute candidates | The count included rows with truncated substrates that must get none; exactly 20 solutions have candidates | Corrected in spec, design and test strategy before the domain brief was dispatched |
| 2026-10-03 | Domain build accepted negative, infinite or NaN quantities and ratings | Bad numbers failed open: a negative need could cancel another penetration's need | Review found it; fix round added the `invalid_quantity` blocker and unknown-stock handling; 19 mutants killed |
| 2026-10-03 | Own sample-data generator stamped `siteId` as `a` and `b` | Caught by running the real domain over the data; every penetration silently dropped | Fixed and guarded by a contract test |
| 2026-10-04 | API build checked idempotency after business rules, let a reused key drop a decision, and buffered the whole body before the size check | Reviewers showed a retry could fail after the shortage had cleared, and a 10 kB cap that was not a cap | Lookup-first idempotency with 409 on target mismatch; streaming body limit; whitespace-only reasons rejected |
| 2026-10-04 | Reviewer suggested a module-relative catalogue path, `server-only`, and a CSV path jail | The relative path breaks in bundled output; `server-only` needs a new dependency; the path is trusted configuration | Rejected with reasons. `server-only` recorded as a production item |
| 2026-10-04 | UI worker reported its Playwright specs as written but unrun | Its sandbox crashes Chromium, so the UI had never been exercised | Orchestrator ran them outside the sandbox: two failed. The app was right in one case (pages and API routes held different in-memory stores, so a recorded escalation never showed) and the test helper was wrong in the others (it matched `<body>`) |
| 2026-10-04 | UI build passed its own gates with 100% coverage | Reviewers found `pen-a-01` offered "Escalate instead" with nothing to escalate, a closed dialog dropped its refresh after a write, a repeat announcement on page load, 1.4:1 input borders, and unknown values failing open to "Crew can go" | Fix round with 25 triaged decisions; reviewer mutants re-run and killed |
| 2026-10-04 | Navigation worker (fast model) made `<main>` an inner scroller, claiming a sticky footer cannot stay in view on a long page | Measured in a browser: window-scroll sticky header and footer stay pinned at top, middle and end. The inner scroller would break scroll restoration on back and mobile browser behaviour | Orchestrator switched back to window scrolling and fixed three racy assertions in its e2e spec |
| 2026-10-05 | Built UI passed every gate and three code reviews | A usability walk against the brief's UX question found what tests could not: indistinguishable penetration rows, substitution buried two levels down, unexplained "Rating 60/30", two-day-old stock with no warning, a green check on a still-blocking escalation, and a "Try again" with no button | Usability round (docs/agent-work/18). Orchestrator then removed a duplicated stock-time line and a repeated solution code on every row, and collapsed raw catalogue spacing for display |
| 2026-10-06 | Request to reuse the tour-agent Vercel project and Supabase project with a new database | A Vercel project holds one app, so reusing it would replace tour-agent; and supabase-js only reaches the platform `postgres` database | Agreed with the user: new Vercel project in the same team, new database `qantum_slice` on the same server via `pg`, app role limited to select and insert |
| 2026-10-05 | Navigation worker was dispatched on the fast model by default | The user wanted non-fast | Run stopped after 84 events with no files changed and re-dispatched on the default model |
| 2026-10-06 | Substitutes screen showed `0451` as "Materials in stock" (built from the spec's FR11 wording) | Found by walking the demo after delivery: `0451` uses sealant, which the same site is already short of; the check compared one install with raw on hand. The blocked banner also told the leader to wait for stock when data problems blocked the crew too | Spec gap, not a coding slip. FR11 clarified, AC 33 and 34 added; a site shortage now makes every candidate using that material `short` |
| 2026-10-04 | Reviewer suggested a shared dialog form shell and refreshing a stale tab on focus | Real but outside this slice | Recorded as limits, not built |

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
| 2026-10-03 | Sample data proposed (data/sample/*.json, docs/sample-data-and-stubs.md), verified by running the real domain over it. Caught own generator bug (siteId mismatch). Approved and committed. |
| 2026-10-04 | API layer accepted and documented (docs/api.md). Gates: typecheck, lint, 196 tests, build, prod audit, CSV traced in all 7 routes, shuffled run, live HTTP walk. |
| 2026-10-04 | UI defaults proposed (docs/ui-design.md, screens drawn in conversation). Approved. Chromium installed, frontend-engineering and ui-portability-baseline added. |
| 2026-10-04 | UI built by Grok (116 turns, $3.29), then three fresh review sessions ($4.10) and a fix round (108 turns, $3.24). Orchestrator gates: typecheck, lint, 269 tests, 100% coverage, build, `check:ac`, 11 Playwright tests stable over three runs, reviewer mutants killed, CSV traced in all 11 routes. Docs updated: api.md, ui-design.md section 9, spec AC 9, test strategy. |
| 2026-10-04 | Navigation shell after phone review (docs/agent-work/16-ui-nav-brief.md): bottom demo bar, sticky title header, chevron back control, "Ref" label. Built by Grok on the fast model (41 turns, $2.39). Gates and 12 e2e tests green over repeated runs. ui-design.md updated. |
| 2026-10-05 | Usability round from a UX review against the brief (docs/agent-work/18-ui-usability-brief.md), built by Grok on the default model (45 turns, $1.34). Two additive API fields (site counts; service and size on readiness penetrations). 281 tests, 12 e2e green over repeated runs. api.md and ui-design.md updated. Skill lock re-synced (registry pointer only, no skill content changed). |
| 2026-10-06 | PR #1 merged; CI on main deployed to https://qantum-team-leader-slice.vercel.app with a green smoke test. Orchestrator verified the live region, idempotent replay through Postgres (201 then 200), and that the action survives a redeploy (AC 7 of the delivery spec). |
| 2026-10-06 | Public repo github.com/binartist/qantum-team-leader-slice created (gitleaks clean over all commits, first CI green). Skills vercel-deploy, supabase-postgres, data-migration added. Storage moved from supabase-js to pg on a new database with an append-only app role (Grok, default model, 50 turns, $1.42); contract suite on real Postgres 17; CI gains db, e2e and deploy jobs. Docs updated. |
| 2026-10-06 | Post-delivery walkthrough: substitute availability now accounts for site shortages (AC 33) and the blocked banner names data problems in its next step (AC 34). Spec, design, api.md, ui-design.md, test strategy and README updated. |
| 2026-10-06 | Site reference removed from the sites list (names already tell sites apart) and kept on the site screen as "Job ref", where an escalation would quote it. API unchanged. |
