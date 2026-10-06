# Test strategy

How the slice is verified. Acceptance criteria (AC) are numbered in `slice-specification.md` section 4. Each AC maps to at least one automated test, and tests use the AC number in their name so coverage can be checked by search.

## 1. Approach

- **Test where the risk is.** The risk is a wrong "Crew can go" and a wrong substitute suggestion. Both live in the pure domain core, so most tests sit there: fast, deterministic, no I/O.
- **Fail closed is a tested property.** Every missing-data and upstream-failure path has a test asserting the crew is never reported clear.
- **Test pyramid.** Many unit tests, fewer API and database tests, a handful of end-to-end tests on the demonstration scenario.
- **Real parts where cheap.** The real catalogue CSV and a real Postgres in CI. Upstream systems are stubs, and that limit is stated in section 8.
- **Tests are written from the spec, not from the code.** An agent that writes code does not write its own acceptance tests unreviewed. Tests are reviewed against the AC list before the implementation they cover.

## 2. Layers and tools

| Layer | Tool | What it covers | Runs |
| --- | --- | --- | --- |
| Unit (domain) | Vitest | Requirements, shortages, status, lifecycle, matching, normalisation | Every push |
| Catalogue and data checks | Vitest | CSV load counts, raw text preserved, sample data references | Every push |
| Contract | Vitest and Zod | Each upstream stub validates against its schema | Every push |
| API | Vitest, calling route handlers directly | Status codes, validation, idempotency, headers | Every push |
| Database | Vitest against a real Postgres 17 (`npm run test:db`) | Constraints, idempotent uniqueness, ordering, and the app role's refused update, delete, truncate and DDL | Every push |
| End to end | Playwright | The demonstration scenario and failure states in a browser | Every push, and after deploy against the public URL |
| Accessibility | axe-core inside Playwright, plus a manual keyboard pass | Contrast, labels, focus order, status without colour | Every push (automated), release (manual) |
| Static checks | TypeScript strict, ESLint | Types, unsafe patterns, import boundaries | Every push |
| Secrets and dependencies | Secret scan, dependency audit | No credentials in repo, known vulnerabilities | Every push |

Boundary rule enforced by lint: the domain core may not import Next.js, React, the database driver (`pg`) or file system modules, and client code may not import `pg` or server modules.

## 3. Acceptance criteria to tests

| AC | Layer | Test focus |
| --- | --- | --- |
| 1, 2, 3, 4 | Unit | Sum, covered site, two locations summed, fraction rounds up |
| 5 | Unit, API | Unknown shortage has null quantities. API accepts wait and escalate for it |
| 6, 7 | Unit, API | Blocker reasons. 422 for wait on a blocker, escalate accepted |
| 8 | Unit | No penetrations gives nothing planned |
| 9 | API, E2E | Stock stub fails: 502, UI says unavailable, never clear |
| 10 | Unit, E2E | Two sites share stock and both clear. Label visible on screen |
| 11, 12, 13 | API | 201 and state waiting, 422 on bad target, 404 on missing shortage |
| 14, 15 | Unit | Escalate then wait keeps escalated. Grown shortfall marks action earlier |
| 16 | API, Database | Repeat returns original with one row. Missing key is 400. Per-user unique constraint |
| 17 | API | Over-long note is 422 |
| 18, 19, 20, 21, 22 | Unit, E2E | Demo codes give the stated candidates. Empty and incomplete states. Null insulation never offered |
| 23 | API | 422 for non-candidate target, 409 for stale source |
| 24 | API, Database | Proposed status only. Nomination and shortage unchanged |
| 25 | Unit | Exactly 20 of 148 have a candidate |
| 26 | Unit | 148 rows, raw text intact, 6 incomplete flagged |
| 27 | Contract | Every sample penetration code exists, except the deliberate missing one |
| 28 | Build check | Client bundle contains no database credentials or service key |
| 29 | API | `Cache-Control: no-store` on readiness and actions |
| 30, 31, 32 | E2E, accessibility | Row contents, keyboard use, target size, 375px layout without horizontal scroll |
| 33 | Unit, API, E2E | A material the site is short of (or has unknown stock for) makes a candidate short (or unknown). Harbour Point's `0451` shows it |
| 34 | Unit, E2E | Short blocked banner on every tab; the tab counts carry the detail |
| 35 | Unit, API | Each fit rule, normalisation, a cut-off substrate on either side never fits (even identical text), blank text never matches, fail-closed requirements, order of blocker checks, no added need; wait 422 and escalate 201 on the new blocker |
| 36 | Unit, E2E | Side-by-side rows for penetration and nominated solution; a field that does not fit marked with an icon and text |

A script lists every AC number and fails CI if one has no test referencing it.

## 4. Key unit test groups

**Fail-closed numbers** (added after independent review)
- Negative, `NaN` and `Infinity` mapped quantities give `invalid_quantity` and never `clear`. A bad value cannot cancel another penetration's need.
- Negative, `NaN`, `Infinity` and overflowing stock make the material `unknown`.
- Required overflow throws. Decimal dust: ten balances of 0.1 cover 1, and 4.2 against 5 is short by 0.8.
- Non-finite requirements or offered ratings never produce a candidate.

**Shortage maths**
- Sum across penetrations and materials. Exact match is not a shortage. One unit short is.
- Fractions round up. Zero and very large quantities.
- Multi-location stock summed. A missing location is not zero.

**Status**
- Clear only when no shortage, no blocker, and at least one penetration.
- Wait and escalate never change status.

**Lifecycle**
- Action current while shortfall is no larger than recorded. Earlier when it grows.
- Escalate then wait. Wait then escalate. Several actions in order.

**Normalisation** (one case from a real row each)
- Double space in service type (`0375`).
- Space inside brackets (`0452`, `0479`).
- Space before unit (`0734`).
- Case differences.
- Trailing comma is not stripped. The six incomplete rows are flagged (`0943`).
- Different size formats do not match each other. `0534` and `0535` are not merged.

**Matching** (property-style checks over the real catalogue)
- No candidate ever has a lower integrity or insulation than required.
- A null insulation never satisfies a stated requirement.
- A candidate never shares the nominated code.
- Orientation, substrate, service type and size always equal after normalisation.
- Count of solutions with candidates is exactly 20.

## 4a. API layer verification (added after independent review)

The vitest coverage floor measures only `src/domain`, so the API layer is judged by mutation checks. After the first review, 24 deliberately broken rules survived the suite. The fix round added tests for each, and the orchestrator re-ran the rules as mutants: 13 of 15 were killed, and the 2 survivors were equivalent (the numeric `Content-Length` early reject is an optimisation behind the streaming limit, and the note length is enforced by both the schema and the use case). Contract tests run against the in-memory repository, and against a real Postgres 17 when `TEST_DB_ADMIN_URL` is set. `REQUIRE_DB_CONTRACT=1` and `REQUIRE_BUNDLE_SCAN=1` make a skipped run fail, for CI. A mutation that grants the app role `update, delete` fails the database suite.

## 5. Failure and risk coverage

| Risk | Consequence | Tests |
| --- | --- | --- |
| Missing data read as zero | False clear or false shortage | AC 5, 6, 7, 8, 9 and stock-record-missing unit cases |
| Stale nomination or stale candidates | Wrong substitute saved | AC 23 |
| Over-eager matching | Unsafe substitute suggested | AC 18 to 22, 25 and the property checks |
| Coarse catalogue fields used by mistake | Socket matched as pipe | Unit cases where options match but raw values differ |
| Old action applied to a new shortage | Leader thinks someone is dealing with it | AC 14, 15 |
| Double submit on poor signal | Duplicate escalation | AC 16 |
| Cached "clear" after stock falls | Crew sent without materials | AC 29 |
| Database credentials exposed | Data exposure | AC 28 and secret scan |
| Direct database access without login | Anyone reads or writes | Database test: with the anon role, select and insert both fail |
| Catalogue update changes behaviour silently | Wrong suggestions | AC 25 and 26 fail loudly |
| Upstream shape changes | Wrong numbers | Contract tests |
| Inaccessible controls | Leader cannot act | Axe checks and manual keyboard pass |

Failure paths for every endpoint: invalid body, unknown field, wrong type, missing key, unknown site, upstream error. Each returns the single error shape `{code, message}` and none leaks a stack trace, path or SQL. A test checks the shape and the absence of those strings.

## 6. Test data

- **Catalogue:** the real CSV, unchanged.
- **Sample upstream data:** `data/sample/`, labelled invented. The demo set from `slice-specification.md` section 7.
- **Fixtures for unit tests:** small hand-built objects, so tests do not depend on the sample files.
- **Failure stubs:** each upstream stub can be switched to fail, return empty, or return malformed data for tests.
- **Database:** each test run starts from migrations on a clean schema, and tests clean up their rows.
- No real personal data and no production credentials anywhere in tests.

## 7. CI/CD gates

On every push and pull request, in order:

1. Install with a locked lockfile.
2. Typecheck and lint, including the import-boundary rule.
3. Unit, contract, catalogue and API tests, with coverage.
4. Start a Postgres 17 service, run `db/setup.sql` and the migrations, run the database contract suite with `REQUIRE_DB_CONTRACT=1`.
5. Build, then the client bundle check for credentials.
6. Secret scan and dependency audit.
7. Playwright end-to-end and axe on a dev server (four projects: reads, writes, and two stock-failure servers started with `STUB_STOCK_MODE=down` and `malformed`, each with its own build directory).
8. AC coverage script.
9. On `main` only, after all of the above: deploy to Vercel (`vercel pull`, `build --prod`, `deploy --prebuilt --prod`), then `scripts/smoke.mjs` against the production URL (`/api/sites` is 200, `no-store`, four sites; `/` renders "Sites").

Merge to the default branch is blocked on any failure. Deployment to Vercel runs only from a green default branch. After deploy, a smoke run of the end-to-end scenario against the public URL is the evidence of a working deployment.

**Thresholds.** Domain core: at least 95% line and branch coverage. Overall: no fall below the current level. Coverage is a floor, and the AC mapping and property checks are what show the tests mean something.

**Flakiness policy.** No retries on unit, API or database tests. Playwright may retry once, and a retried pass is reported so it can be fixed.

**Local runs.** The same commands run locally. For containers use Podman where Docker is absent. The README documents the commands.

## 8. What this strategy does not prove

- Real upstream behaviour: latency, auth, data quality. Stubs prove the contract shape and the logic only.
- Real user comprehension. Accessibility checks and a keyboard pass do not replace trying it with leaders.
- Compliance of a suggested substitute. Tests show that rules are applied as written, not that the rules are sufficient. That judgement stays with a qualified person.
- Load beyond the stated target, and long-running behaviour.
- Offline use, which is out of scope.

## 9. Reviewing agent-written tests

- Tests are derived from the AC list before implementation, so they cannot be shaped around the code.
- Every new test is checked to fail first against missing or wrong behaviour, then pass.
- A test that only restates the implementation, or asserts a mock, is rejected.
- Corrections to agent output are logged in `submission-checklist.md` as evidence of review.
- Mutation-style spot checks on the matching and shortage code: deliberately break a rule and confirm a test fails.
