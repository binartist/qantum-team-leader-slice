# Agentic coding approach

How coding agents were used on this slice, how they were directed and checked, and where their work was corrected. The evidence for every step (briefs, review reports, worker notes, costs) is in `docs/agent-work/`; corrections are logged in `docs/submission-checklist.md`.

## Tools

| Role | Tool | Used for |
| --- | --- | --- |
| Orchestrator | Claude Code (Claude Sonnet 5.5, later Opus 5.5) | Requirements, specs, briefs, triage, every gate run, docs, git, deployment setup |
| Worker | Grok Build CLI (`grok-4.7-build`; the fast variant for three runs, on request) | Implementation, and independent review sessions |
| Design reviewer | A Claude Opus subagent | One review of the technical design before any code |
| Helpers (from 2026-10-06) | Claude Code subagents: `validator` and `reviewer` on Sonnet, `Explore`, `bulk-worker` on Haiku | Gate runs, one review lens each, code search and mechanical edits, so the orchestrator's context went on decisions; the submission readiness check ran this way |
| Guidance | `AGENTS.md` (tool-neutral repo rules), 11 Skill Forge skills in `.agents/skills/` (coding discipline, security, testing, frontend, delegation, Vercel, Supabase Postgres, data migration) | Loaded by both agents |

I made the product and scope decisions: which slice, shared versus reserved stock, how substitutes are worded, UI defaults, which database and Vercel project, and every approval to commit, push or merge.

## How the work was planned and directed

1. **Docs before code.** The business path, glossary, iteration plan, specification (16 requirements, 17 once the side menu and materials pages were added; 32 numbered acceptance criteria, 34 after the post-delivery walkthrough, 36 after the solution-fit change, 42 after the materials pages, 44 after the actions log moved to the menu, 45 after the penetration tabs, 46 after the material tabs, 47 after the responsive side menu), technical design and test strategy were written and reviewed first. Code was then measured against them; when they disagreed, the spec was fixed first.
2. **Risk tiers.** Each change was classified by blast radius. Contract and storage changes (the HTTP API, the move to Postgres) were Tier 3 and needed my written approval of a spec with a contract diff and rollback plan.
3. **Orchestrator and worker.** Claude wrote a self-contained brief for each piece of work, as a file in the repo: role, facts, decisions not to relitigate, files the worker may touch, test-first method, verification commands and honesty rules ("do not claim a command passed unless you ran it"). Grok carried it out. Briefs were cheap to write and saved rounds of rework; the expensive model spent its tokens on decisions and checking, not on typing code.
4. **Small rounds.** Domain core, API, UI, navigation, usability, then storage and delivery. Each round ended accepted and committed before the next began.

## How outputs were verified

Each worker run went through the same ladder, cheapest checks first:

1. **The run itself:** stop reason, turns, cost, which model actually ran, and any failed tool calls.
2. **Write scope:** a checksum or `git status` diff against the files the brief allowed. Anything else was a finding.
3. **The worker's notes:** departures from the brief and what it could not verify.
4. **Gates in the orchestrator's own shell,** never the worker's word: typecheck, lint, tests with coverage, the acceptance-criteria check, build, Playwright with axe, the database contract suite, audit and secret scan.
5. **Mutation checks:** deliberately breaking rules to prove the tests notice (for example granting the database role `update, delete` must fail the contract suite).
6. **Independent review:** three fresh read-only sessions per major round (spec conformance, test quality, code quality with security and accessibility). The session that wrote the code never reviewed it.
7. **Looking at the product:** screens at phone width in light and dark, and the live site after deploy, including a write that had to survive a redeploy.

## Where agent work was corrected or rejected

- **Fail-open numbers.** The domain build let a negative or non-numeric quantity cancel another penetration's need, which could show a crew as clear when it is not. Review caught it; the fix added an `invalid_quantity` blocker and treats bad stock as unknown.
- **Idempotency in the wrong place.** The API checked business rules before the idempotency key, so a retry after the shortage cleared returned 404, and a reused key could silently drop a decision. Redesigned as lookup first, with 409 for a key reused on a different target.
- **Tests that could not fail.** The UI build reported 100% coverage, but its browser tests had never run (its sandbox could not start Chromium). Running them found a real bug: pages and API routes held separate in-memory stores, so a recorded escalation never appeared.
- **Wrong numbers in our own spec.** The orchestrator's first spec said 24 solutions had substitutes; recomputing under the design's own rules gave 20. Corrected before the brief went out.
- **A layout departure reversed.** A worker made the page body an inner scroller, claiming a sticky footer could not stay in view. Measured in a browser, it could; the inner scroller would have broken scroll position on "back", so it was reverted.
- **Usability that tests could not see.** After every gate and review passed, walking the screens against the brief's question ("can a team leader understand the information and act?") found identical penetration rows, substitution buried two levels down, unexplained "Rating 60/30", and two-day-old stock with no warning. Fixed in a dedicated round.
- **A spec gap found after delivery.** Walking the live demo again showed substitute `0451` as "Materials in stock" although it uses sealant, the very material that site is short of. The spec only said "shows whether its materials are in stock", and the code checked one install against raw stock. The spec was clarified first (AC 33), then the code.
- **Our own process slips.** The orchestrator edited docs inside a running worker's worktree, and the worker reverted them as unexplained changes. It also pushed to a pull request that had merged minutes before. Both are now rules in `tasks/lessons.md`: never write into a worker's tree, and check a PR's state before pushing to it.
- **Suggestions declined, with reasons.** A module-relative CSV path (breaks once bundled), adding `server-only` (a new dependency, logged for production), a shared dialog form shell and refresh on tab focus (real, but outside the slice).

## Where I overruled or redirected the AI

The agents proposed; I decided. Each case is logged with the reason in `docs/submission-checklist.md` (section 3). The pattern: the AI's defaults were reasonable but generic, and the changes came from looking at the product as a team leader would on a phone.

- **Navigation.** The design had a top demo bar, a full-width Back button and an unlabelled site code. From my own phone review I moved the demo label to the bottom, put the title in the header with a chevron back row below it, and had the code labelled.
- **Review approach.** Instead of the proposed fan-out of review subagents, I gave my own observations, which were faster and more specific.
- **Worker model.** A worker run went out on the fast model by default. I stopped it and set the default model as the rule, fast only when I ask.
- **What the screens carry.** I questioned the site reference on every card (now only on the site screen, as "Job ref") and replaced the permanent demo bar with a landing page that explains the demo, keeping a small Demo tag in each header after the AI pointed out that deep links would otherwise skip the explanation (I later removed the tag as clutter).
- **Shared stock on a material page.** I questioned why Wait and Escalate sit on the material page when work is done per penetration, and why its list named no site when stock is shared. The AI's point held for the buttons (a shortage is per site and material, so one escalation covers every penetration), so they stayed with their scope stated; the site is now named in the need line and the heading. When the AI proposed linking each place back to its penetration, I rejected it as circular: the places stay text, grouped, with one link up to the site list.

- **Actions log.** I took the actions log out of the header, because it did not say which work it belonged to, moved it into the side menu and asked for the latest decision in a popover on each acted row. After the first build I asked for the entity icons, a sticky site title, and back controls that return to the log rather than to each page's parent. Then I cut the row chips to icons, dropped the popover, and moved a penetration's decisions onto its own page as an Actions log tab. Since decisions are made on materials and solutions, I asked for the same tabs on the material page, dropped the state labels for one design across pages, and asked rows to count decisions, proposals included, with Acted covering proposals too.
- **Responsive menu.** The drawer was off-canvas at every width. I asked for the drawer on phones and a side menu shown by default on wider windows, collapsible. Then I moved the About page off the root to `/about-this-demo`, with `/` redirecting to it.

## Cost

Worker runs totalled about $39 across thirteen implementation runs and nine review sessions. Per-run figures are in `docs/agent-work/README.md`.

## What I would do differently

Run the browser tests in my own shell from the first UI round, rather than trusting a worker's "written, not run". Walk the screens against the brief's user question before the code reviews, not after, since that found the most valuable fixes.
