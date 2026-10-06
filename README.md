# QAntum team leader: stock readiness before the crew goes

Before sending a crew to site, a team leader checks whether the materials for the planned penetrations are in stock. For each shortage they record a decision: **wait**, **escalate** to purchasing or the warehouse, or **propose a substitute** solution from the catalogue for a manager to verify. The app never approves a substitute and never says the crew can go while anything is short or unknown.

- **Live:** https://qantum-team-leader-slice.vercel.app (best on a phone-width window)
- **Pipeline:** [GitHub Actions](https://github.com/binartist/qantum-team-leader-slice/actions), e.g. [the run that deployed main](https://github.com/binartist/qantum-team-leader-slice/actions/runs/37309054947)

## Try it (about two minutes)

The live demo uses invented sample data and has no login. Decisions are stored in Postgres and shared by everyone who visits, so some may already be recorded. The first page explains this.

1. **Sites** (the menu on the first page, or `/sites`). Harbour Point and Kingsway Works are blocked, and the chip says why. Riverside Plaza can go. Old Mill Annex has nothing planned.
2. **Harbour Point.** The page lists 12 penetrations across 5 solutions. There is no blocked banner. The Shortages chip counts penetrations (12 here, because every opening uses the short sealant), which is not the same unit as the sites-list chip ("2 shortages"). Each of those openings also says so on its row. Stock figures are labelled "on hand, shared, not reserved", with their age and a warning when they are more than a day old (always, in the demo: the sample stock is dated 3 Oct 2026).
3. **Open the sealant.** Open an `L3, Riser 2` row and tap its line "Short material: Intumescent sealant … · this site short 2 of 10". The sealant's page opens at Harbour Point's section. Escalate it to Purchasing with a note. The sealant's Actions log tab shows it. Back returns to the penetration. On the Sites list Harbour Point is still Blocked, because a decision records intent, it does not create stock.
4. **On that `L3, Riser 2` penetration** (solution `0438`), candidates `0451` and `0464` are shown with their fire rating, whether they meet the required rating, and stock. Every candidate is "Catalogue match, not verified", and `0451` warns that it uses sealant, which this site is already short of. **Propose `0451`** with a reason anyway: a manager decides.
5. **Back on Harbour Point**, open the `L5, Plant room` row (solution `0344`): no catalogue match. The shortage is decided on the sealant's page.
6. **Kingsway Works.** One penetration has no stock record ("stock unknown", at L2, Plant room). The Data problems chip counts 4: a solution code missing from the catalogue, a solution with no materials recorded, and two nominated solutions that do not fit (L1, Stair core: substrate cut off in the catalogue; L1, Riser 1: insulation too low). Open either to see the side-by-side comparison, and escalate a data problem from that penetration.
7. **Actions log**, from the menu on the Sites list: every site's decisions and proposals with time and author, and whether each still applies. On a site's list, rows mark escalated and waiting penetrations; each penetration page has its own Actions log tab.
8. **Materials**, from the menu on the Sites list. Each material against the one shared stock, across sites. The pipe collar shows 2 on hand against 6 planned across sites, short at one site: Riverside Plaza on its own is not short, but the sites together need more than there is.

## Run locally

Needs Node 22 or later.

```bash
npm ci
ACTIONS_STORE=memory npm run dev
```

Open http://localhost:3000. Decisions are kept in memory and reset when the server restarts. No database or credentials are needed. To see the failure state, restart with `STUB_STOCK_MODE=down`: every site shows "Can't check", never "Crew can go".

## Tests

```bash
npm run typecheck
npm run lint
npm run test:coverage   # unit and API tests; 95% coverage gate on src/domain, pure src/ui modules, the decision client and the Postgres config
npm run check:ac        # every acceptance criterion in the spec is referenced by a test
npm run test:e2e        # Playwright at 375px with axe in light and dark (run `npx playwright install chromium` once)
```

Database contract tests need a Postgres 17 you can create databases on, for example `podman run -d -p 127.0.0.1:55432:5432 -e POSTGRES_PASSWORD=localtest postgres:17`:

```bash
TEST_DB_ADMIN_URL=postgres://postgres:localtest@127.0.0.1:55432/postgres REQUIRE_DB_CONTRACT=1 npm run test:db
```

They check idempotent writes, ordering and constraints against a real database, and that the app's role cannot update, delete or create tables. CI runs all of the above on every pull request. The strategy is in `docs/test-strategy.md`.

## Deploy

CI deploys `main` to Vercel after the checks, database and browser jobs pass, then runs `scripts/smoke.mjs` against the production URL. The setup, done once:

1. **Database.** A database `qantum_slice` on an existing Supabase Postgres server, reached as plain Postgres through the transaction pooler. Supabase Auth and the Data API are not used. As the Supabase admin, through the session pooler (port 5432):
   ```bash
   psql "postgresql://postgres.<project-ref>@<pooler-host>:5432/postgres?sslmode=require" -v app_password='<new password>' -f db/setup.sql
   DB_HOST=<pooler-host> DB_PORT=5432 DB_USER=postgres.<project-ref> DB_PASSWORD=<admin password> DB_NAME=qantum_slice DB_SSL=require npm run db:migrate
   ```
   Type passwords at prompts or read them from a password manager. Do not leave them in shell history.
2. **Vercel project** (framework Next.js, region `syd1` from `vercel.json`) with `ACTIONS_STORE=postgres`, `DB_HOST`, `DB_PORT=6543`, `DB_USER=qantum_slice.<project-ref>`, `DB_NAME=qantum_slice`, `DB_SSL=require`, `DB_POOL_MAX=1`, and `DB_PASSWORD` as a sensitive variable.
3. **GitHub:** secret `VERCEL_TOKEN`; variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PRODUCTION_URL`.

Every runtime variable of the app is listed in `.env.example` and explained in `docs/api.md` (Configuration). The test and CI variables above (`TEST_DB_ADMIN_URL`, `REQUIRE_DB_CONTRACT`, `PRODUCTION_URL`, `VERCEL_*`) are not.

## Sample data

Everything in `data/sample/` is invented and labelled so: four sites, their planned penetrations and nominated solutions, material quantities per solution, and stock balances. It stands in for systems this slice does not own. The catalogue `data/solutions-excerpt.csv` is the supplied Ryanfire excerpt, unmodified (a test pins its hash). The mappings and assumptions are in `docs/sample-data-and-stubs.md` and `docs/catalogue-data-model.md`.

## Known limitations

- **No login.** One demo identity records every decision, and anyone with the URL can add one. Production would use QAntum's existing sign-in and a site-membership check.
- **Upstream systems are stubs.** Sites, nominations, material quantities and stock come from the sample files, behind ports that a real client would replace.
- **Stock is shared and not reserved.** Two sites can both read the same units as available. The screens say so.
- **Substitutes are suggestions only.** A catalogue match is not proof of compliance. Proposals are recorded for a manager; there is no approval workflow, and nothing is sent to anyone automatically.
- **Database TLS encrypts but does not authenticate the server** (`require`), because the Supabase pooler's chain is not in Node's trust store. `verify-full` with a CA bundle is supported.
- **Idempotent repeats are not compared.** A repeat request with the same key and target but a different note or reason returns the original record unchanged.
- **Not built:** offline use, crew scheduling and work dates, rate limiting, editing a recorded decision, a separate escalation route for data problems.

## How it is built

Next.js 16 server components and route handlers on Vercel, a pure TypeScript domain core, and Postgres for the decisions only. More detail:

| Document | What it covers |
| --- | --- |
| [`docs/iteration-plan.md`](docs/iteration-plan.md) | Why this slice, and the iterations after it |
| [`docs/slice-specification.md`](docs/slice-specification.md) | Requirements, 47 acceptance criteria, assumptions, exclusions |
| [`docs/technical-design.md`](docs/technical-design.md) | Architecture, domain rules, data model, trade-offs |
| [`docs/ui-design.md`](docs/ui-design.md) | Screens, copy, states and accessibility |
| [`docs/api.md`](docs/api.md) | HTTP API, errors, idempotency, configuration |
| [`docs/test-strategy.md`](docs/test-strategy.md) | Test layers, acceptance-criteria mapping, CI gates |
| [`docs/glossary.md`](docs/glossary.md) | Business terms (penetration, integrity, insulation, nominated solution) |
| [`docs/agentic-approach.md`](docs/agentic-approach.md) | How coding agents were used, directed and checked |
| [`AGENTS.md`](AGENTS.md), [`.agents/skills/`](.agents/skills/), [`docs/agent-work/`](docs/agent-work/) | The instructions and skills given to the agents (skills from [Skill Forge](https://github.com/more-than-code/skill-forge)), every brief, review and worker note |
| [`docs/submission-checklist.md`](docs/submission-checklist.md) | Submission items with evidence |
