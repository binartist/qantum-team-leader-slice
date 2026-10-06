# Exercise submission checklist

Living checklist against the "What to submit" and "What we will assess" sections of `docs/passive-fire-exercise.md`. Update it as work lands. Tick only with evidence (file, URL, or CI run), recorded in the Evidence column.

Last updated: 2026-10-07

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
| 10 | First-slice specification (md) | [x] | `docs/slice-specification.md`: 17 FRs, 44 acceptance criteria, NFRs, assumptions, exclusions. Awaiting your review. |
| 11 | Technical design (md) | [x] | `docs/technical-design.md`. Section 11 additions awaiting confirmation. |
| 12 | Test strategy (md) | [x] | `docs/test-strategy.md`: layers, all 44 ACs mapped, risks, CI gates. Awaiting your review. |
| 13 | Agent instructions and context files | [x] | `AGENTS.md` (tool-neutral; `CLAUDE.md` imports it), 11 Skill Forge skills in `.agents/skills` (`skill-forge.json`, lock file), and every brief, review brief, review report and worker note in `docs/agent-work/`. |
| 14 | Working application code | [x] | Domain core, stubs, Postgres and memory stores, use cases, seven-route API, seven screens (landing, sites, materials, material, actions log, site, penetration). Live and proven against the real database. |
| 15 | Automated tests | [x] | 413 unit and API tests, 5 database contract tests on Postgres 17, 31 Playwright tests with axe at 375px; all 44 ACs referenced; all run in CI. |
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

Human decisions that differed from the AI's suggestion or default (log each as it happens):

| Date | AI suggested or did | I decided | Why |
| --- | --- | --- | --- |
| 2026-10-04 | Fan out review subagents over the UI, after naming the model to use | Skipped the fan-out and gave my own phone observations instead | Faster and more direct than a review round; my observations drove the navigation rework |
| 2026-10-04 | Demo bar at the top, a full-width Back button, an unlabelled site code | Demo bar at the bottom, title in the header, a chevron back control, the code labelled "Ref" | A phone navigation pattern people already know; an unlabelled code means nothing to a reader |
| 2026-10-04 | Chevron back control inside the header | Back row directly below the header, the header holding only the title | One clear title line; back stays near the content it returns from |
| 2026-10-05 | Navigation worker dispatched on the fast Grok model by default | Default (non-fast) model unless I ask for fast on a run | Quality over speed for build work; fast is opt-in per run |
| 2026-10-06 | Keep the site reference everywhere, labelled "Ref" | Asked whether it is needed at all. Agreed outcome: off the sites list, kept on the site screen as "Job ref" | Site names already tell sites apart on the list; the job number matters where an escalation quotes it |
| 2026-10-06 | "Open sites" placed after the intro on the landing page, so it sits above the fold | Stick it to the bottom of the screen | Always in view and in the thumb zone, whatever the reader has scrolled to |
| 2026-10-06 | Specified job-ref page URLs (`/sites/hp-345`) with redirects from the old ones, at my request | Dropped it before any code | Team leaders tap through screens and never read the URL; a new lookup, redirects and a uniqueness assumption for no user-facing gain |
| 2026-10-06 | Site screen as one long page (banner, stock notes, shortage cards, data problems) with the actions log as a separate page behind a button at the bottom | Tabs on the site screen: Shortages, Data problems, Actions log. Agreed outcome: route-based tabs with counts, the blocked banner above the tabs on every tab, stock notes on the Shortages tab | Each view one tap from the top on a phone, and recorded decisions sit next to the work. The banner and counts keep data problems from being missed |
| 2026-10-06 | Back control in its own row below the header (the earlier choice) | Put the back icon and label in the nav header | User call. Built as a two-row nav header: back and Demo tag on top, title below, so a long back label and title both fit at 375px and back stays in reach while scrolling |
| 2026-10-06 | Keep the title in the header on one line, cut with an ellipsis | Move the title into the page body | A full, wrapping title means two similar site names never look alike, and the header shrinks to one slim row |
| 2026-10-06 | A detailed blocked banner (counts and next step, AC 34 as first written) | Make the banner simple, since the tabs show the details | The tab counts already say how many shortages and data problems; the banner only needs to say hold the crew. AC 34 rewritten |
| 2026-10-06 | Tab bar scrolls away with the page | Stick the tabs below the nav header when scrolling | The counts ("Data problems 2") stay in view down a long shortage list, and tabs can be switched from anywhere |
| 2026-10-06 | Icons only for status (can go, blocked, warning, no decision) | Add icons that show each entity's kind. Agreed outcome: outline, muted, decorative icons for site, material shortage, data problem, solution and decision, using no status shape or colour; none on penetration rows, tabs or banners | Kinds become recognisable at a glance, without being mistaken for a status |
| 2026-10-06 | A cross (✕) icon for blocked and short | Use a better icon: the cross reads as dismiss. Agreed outcome: a stop sign (octagon with a bar) everywhere the cross meant blocked or short | A team leader should read "stop", not "close this"; the octagon is unlike the warning triangle and the circles |
| 2026-10-06 | Asked whether the tick for "Crew can go" should change too; AI suggested keeping it, with an optional solid green circle to pair with the stop sign | Keep the tick | A tick has no second meaning, and the same tick marks every other "OK" fact |
| 2026-10-06 | Site screen showed penetrations only through shortage cards and data problems | Show the units of work. Agreed outcome: a planned-work line under the job ref ("12 penetrations, 5 solutions"); no per-penetration ready marks; a full Penetrations tab skipped for now | The leader sees how much work was checked, including on a clear site; shared stock means no single penetration can honestly be called ready |
| 2026-10-06 | Planned-work line as plain text; full penetration list skipped | Make "12 penetrations, 5 solutions" a link that pushes in a list page. Agreed outcome: `/sites/[id]/penetrations`, grouped by solution, each row linking to its substitutes, showing only per-penetration facts (data problem reason, uses a short material), no ready marks | The whole unit of work is one tap away without a fourth tab that would not fit at 375px |
| 2026-10-06 | Shortage cards expand an inline list of their penetrations | Link to the Penetrations page filtered to that material. Agreed outcome: "Affects N penetrations ›" pushes in `/sites/[id]/penetrations?material=…` with a Show all link; data problem cards keep their direct link, since each is one penetration | One list design instead of two, shorter cards, and a filtered view that can be shared |
| 2026-10-06 | A data problem's title opened a screen titled "Substitutes" | Questioned why a problem opens Substitutes. AI proposed making it the penetration's own page (title = place, its facts, then a Substitutes section) | Every link into one penetration should land on a page about that penetration |
| 2026-10-06 | An Actions log button at the foot of the Substitutes page | Remove it from that page, including the path from a data problem | The log is a tab on the site screen, one tap back; the button duplicated it |
| 2026-10-06 | Penetration page as a flat run of plain lines under the title "Substitutes" | Colour-code the text and split it into sections. Agreed outcome: title is the place; sections Penetration, Nominated solution (its problems as colour-coded status lines with icons) and Substitutes; the list page uses the same status lines | Easier to read on site, and status is never colour alone |
| 2026-10-06 | A small secondary Escalate button on the penetration page | Style it better, full width. Agreed outcome: full-width primary where escalating is the page's main action (the penetration page); the compact Wait and Escalate pair stays on shortage and data problem cards | The one action that matters on that screen should be obvious and easy to hit |
| 2026-10-06 | Actions log entries as plain text | Link them to penetrations. Agreed outcome: a proposal and a data problem decision link to their penetration's page; a material shortage decision links to the Penetrations list filtered to that material (no link once resolved); proposals name their place ("for L3, Riser 2") | Every logged decision leads back to the work it is about, and identical-looking penetrations can be told apart |
| 2026-10-06 | Waiting and Escalated shown identically (amber with a warning triangle) | Different colours for wait and escalate. Agreed outcome: Waiting is blue with a clock, Escalated is purple with an up arrow; the Wait and Escalate buttons carry the same icons but stay neutral; log entries use the decision's icon | A decision is neither "can go" nor an alarm, and the two decisions must be told apart at a glance |
| 2026-10-06 | Penetration page showing only the nominated code | Show the full penetration and solution details and highlight mismatches; chose option B: a mismatch is also a data problem that blocks the crew (Tier 3) | A nominated solution that does not fit the penetration means the crew would fit the wrong seal |
| 2026-10-06 | Keep a Demo tag in every header (earlier agreed outcome) | Remove the Demo chip: it is annoying | The landing page at `/` remains the one place that explains the demo |
| 2026-10-06 | Approved spec let a cut-off substrate match an identical cut-off one (two reviewers flagged it against catalogue-data-model.md) | Option A: fail closed, a cut-off substrate on either side never fits. Sample change approved: pen-c-01 (0943) becomes a data problem; new invented pen-c-05 (L2, Plant room, 0348, fire mastic x1) keeps the stock-unknown example (AC 5) | Two identical cut-off texts cannot prove the build-up; never imply a fit without evidence |
| 2026-10-06 | Permanent bottom demo bar on every screen | Replace it with a landing page that explains the demo. Agreed outcome: landing page at `/`, sites list at `/sites`, a small Demo tag in every header linking back to it | The bar took space on every screen; the explanation belongs in one place. The tag keeps deep-linked screens honest |
| 2026-10-06 | The red "Uses short material" line was text only | Make it open a per-material stock page. Agreed outcome: `/sites/[id]/materials/[materialId]` shows the amount (`Need X, have Y, short Z`), the shared-stock notice, and how many planned penetrations use it. Stock unknown stays text | The line named the material and not the figures. The count is the site's planned work, not one opening |
| 2026-10-06 | Site screen as three tabs (Shortages, Data problems, Actions log), with the penetration list on its own page | The site page is the penetration list. Shortages, data problems, escalated and waited are filter chips. The actions log is a header panel on the site and penetration pages. Wait and Escalate for a shortage move to its stock page; a data problem is still escalated on the penetration | The work is the list. Filters narrow it without hiding the banner. The log stays one tap away on every site screen |
| 2026-10-06 | Separate Escalated and Waited filter chips | One Acted chip. A penetration matches when a shortage that lists it, or its data problem, is waiting or escalated, and it counts once. `?show=escalated` and `?show=waited` still select that chip | The two chips asked the same question. The actions log is where the kind of action is told apart |
| 2026-10-06 | Filter chips and a blocked banner above the penetration list | Take the blocked banner off. The chips stay: they narrow the list, which the row highlights do not. A clear site still says "Crew can go." Stock age and "shared, not reserved" stay | The banner repeated the red lines. The chips are how you look at one kind of row |
| 2026-10-06 | Material stock page: Wait and Escalate under an unscoped `Need X, have Y, short Z`, then "Planned on N penetrations" as one unlabelled line per penetration (four identical "L3, Riser 2" lines) | Questioned the buttons (we act per penetration) and the missing site, since stock is shared across sites. After the AI explained a shortage is per site and material (one escalation covers every penetration, per-penetration buttons would raise duplicate requests), kept the buttons with their scope stated: "For all 4 penetrations at this site". Named the site in the need line ("Harbour Point … needs 4, on hand 2 (shared with other sites), short 2") and the heading ("Planned at Harbour Point …") | The need is the site's, the stock on hand is shared; the page must not read as either one alone |
| 2026-10-06 | AI proposed making each place on the material page a link to its penetration | No: the penetration page links to the material page, so row links would be circular. Agreed outcome: places stay text, identical ones grouped ("L3, Riser 2 · PEX Pipe Ø25mm ×4"), and one link goes up to the site list filtered to the material ("Show these on the site list") | A page links down to its children or up to its parent, never back across to the page that opened it, so the back control stays honest |
| 2026-10-06 | Short-material lines on the penetration page link to a site-scoped stock page | Stop linking; brief the shortage inline. Then: add a drawer side menu (like my other apps) with Sites and Materials, and material listing and detail pages. Agreed outcome: `/materials` and a cross-site `/materials/[id]` with one section per site; the site-scoped page redirects to it; the across-sites total is shown | Stock is shared, so the material view belongs across sites; sites and materials are the two top-level views |
| 2026-10-06 | AI asked whether Wait and Escalate should live on the material page or inline on penetrations | Questioned why a shortage is escalated on a material page and asked to list the actions. After the breakdown (propose: per penetration; wait and escalate: per site's shortage of a material; escalate also per penetration data problem), kept shortage decisions in each site's section of the material page | One decision per shortage, next to the whole stock picture |
| 2026-10-06 | A penetration's short-material line opening the material page would make the back control return to the site list, not the penetration | Flagged the back control as wrong after a sideways jump. Agreed outcome (option 2): the line links to `/materials/[id]?from=<penetration>#site-<id>`; the back control returns to that penetration when `from` is valid, else to Materials | Back must match where the user came from |
| 2026-10-06 | Penetration-list rows named only the problem; the Acted filter matched rows that showed no sign of a decision. The substitute menu was labelled "Solution" with a plain select | Attach the acted status to each row, and label the menu "Select solution" with a refined dropdown. Agreed outcome: rows add Escalated (purple, up arrow) and Waiting (blue, clock) chips after the problem chips; the menu is a styled native select listing "Solution 0451" | A row should show why a filter matched it; the menu should say what it does |
| 2026-10-06 | The substitute menu and the heading under it both said "Solution 0451" | Drop the heading when the menu is shown, and put the solution shield on the closed control. A single candidate keeps "Solution {code}" with the shield. The fit-table column header stays | The heading repeated the selected item |
| 2026-10-06 | The substitute menu was labelled "Select solution" | Label it "Select candidate" | The menu chooses a candidate, and the selected row already says "Solution {code}" |
| 2026-10-06 | The penetration list had no title, and each row started with the place name | Add a "Penetrations" heading above the filter chips, with the total number of planned penetrations, and a leading penetration icon on each row | The chips named subsets and the rows had no mark for what they are |
| 2026-10-06 | A site opened from a material page sent Back to Sites. Site headings and places on the material page had no kind icon | The site link carries `?fromMaterial=`. The site's back control names that material and pops when the material page is underneath. Site headings get the site icon; places get the penetration icon and stay text | Back should return to the page that opened the site |
| 2026-10-06 | The side menu closed with a text Close button, and its rows were text only | The close control is a dismiss icon. Sites, Materials and About this demo each have a leading icon. The actions panel shares the dismiss icon | The menu should match the other icon controls |
| 2026-10-06 | The landing page had a sticky "Open sites" bar and no menu | Give it the same drawer as the other top-level screens. About this demo is the current item. The bar is removed | The first page should open the same way as Sites and Materials |

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
| 2026-10-06 | Landing page at `/` explains the demo; sites list moved to `/sites`; bottom demo bar replaced by a Demo tag in every header (user decision). Smoke test now checks both pages. |
