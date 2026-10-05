# DB notes

Worker delivery for the Postgres actions store, CI workflow, and Vercel config. Docs were not edited (brief forbids `docs/`).

## Tests that failed first

`npx vitest run tests/unit/pg-store.test.ts tests/unit/db-connection.test.ts` exited 1 before the adapter existed. Both files failed to load: `Cannot find package '@/adapters/postgres/connection'` and `Cannot find package '@/adapters/postgres/repository'`. Test files 2 failed, tests none, duration 181ms. They pass after the implementation.

## Departures

- `db/setup.sql` accepts optional psql variables `app_role` and `app_database`. Both default to `qantum_slice`, so `psql -v app_password=… -f db/setup.sql` still matches the spec. The contract needs a unique database name. `db/migrations/0001_actions.sql` grants to the fixed role `qantum_slice`.
- `tests/db/contract.test.ts` interprets that script with `pg` (comments, `\if`, `\set`, `\gset`, `\connect`, `\quit`). CI may not have the `psql` binary. It was run against local Postgres 17.
- The contract alters `qantum_slice` to a new random password each run and does not drop the role. It drops its `qantum_contract_<hex>` database with `DROP DATABASE … WITH (FORCE)`.
- `scripts/migrate.mjs` duplicates the TLS mapping from `src/adapters/postgres/connection.ts`. The script must stay plain JavaScript.
- `readEnv` takes `Readonly<Record<string, string | undefined>>`. This project's `@types/node` requires `NODE_ENV` on `ProcessEnv`, and the unit tests pass partial objects. Runtime is unchanged.
- Production with `ACTIONS_STORE` unset uses `postgres`. Explicit `memory` in production is `store_forbidden`. Missing host, user, password, or name is `db_unconfigured` before the TLS check. `verify-full` without `DB_SSL_CA` is `config_invalid` from `poolConfig`.
- The e2e job sets `actions: write` so `actions/upload-artifact` can run under the workflow `contents: read`.
- The deploy job runs `npm ci` before `vercel build`. The CLI needs `node_modules`.
- The CI service password is the word `postgres`. gitleaks was not run here.

## Environment and reason tokens

Removed: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ACTIONS_STORE=supabase`, `supabase_unconfigured`, `supabase_url_insecure`.

App settings: `ACTIONS_STORE` (`memory` or `postgres`), `DB_HOST`, `DB_PORT` (1–65535, default 5432), `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL` (`disable`, `require`, `verify-full`, default `require`), `DB_SSL_CA`, `DB_POOL_MAX` (1–10, default 1). Invalid values throw `InternalError("config_invalid")`.

`InternalReason`: `config_invalid`, `store_forbidden`, `db_unconfigured`, `db_tls_insecure`.

Outside production the default store is `memory`. In production a non-postgres store is `store_forbidden`, missing host/user/password/name is `db_unconfigured`, and `DB_SSL=disable` is `db_tls_insecure`. Failures are not cached. One `Pool` per process, cached with the dependencies. A successful postgres build logs `db_config` with `host`, `port`, `user`, `database`, `ssl`, `passwordPresent`. Those six names were added to the logger allowlist. The password is not a field.

Test-only: `TEST_DB_ADMIN_URL`, `REQUIRE_DB_CONTRACT=1` (fail if the URL is unset; skip with a reason if both are unset), `VITEST_INCLUDE_DB=1` (npm script `test:db` sets this so `tests/db` stays out of `npm test` and `test:coverage`). Smoke reads argv or `PRODUCTION_URL`.

## How to run

Once, as an admin, through the session pooler (port 5432). The password is only on the command line:

```bash
psql "postgres://<admin>@<host>:5432/postgres" -v app_password='…' -f db/setup.sql
DB_HOST=… DB_PORT=5432 DB_USER=<admin> DB_PASSWORD=… DB_NAME=qantum_slice DB_SSL=require npm run db:migrate
```

`npm run db:migrate` is `node scripts/migrate.mjs`. It prints applied versions plus host and database, never the password, and exits non-zero on failure. Re-running prints `applied (none)`.

The app uses the transaction pooler, port 6543, user `qantum_slice`, `DB_SSL=require` (or `verify-full` with `DB_SSL_CA`). `DB_POOL_MAX` defaults to 1. Queries are unnamed.

`node scripts/smoke.mjs <url>` retries for 60 seconds: `GET /api/sites` is 200, `Cache-Control` contains `no-store`, `sites` length is 4, and `GET /` is 200 and contains `Sites`.

## Verification

Commands from earlier in this session, on this tree, all exit 0: `npm run typecheck`, `npm run lint`, `npm run test:coverage` (32 files, 289 tests), `npm run build`, `npm run check:ac` ("All 32 acceptance criteria are referenced by tests."), `npx vitest run --sequence.shuffle --sequence.seed 7` (32 files, 289 tests, seed 7).

`test:coverage` text summary: Statements 100% (529/529), Branches 99.73% (371/372), Functions 100% (117/117), Lines 100% (432/432). `coverage/coverage-final.json` was re-read after that run: statements 529/529, branches 371/372, functions 117/117. The only missed branch is pre-existing `src/ui/decisions/api-client.ts`. `src/adapters/postgres/connection.ts` has no missed statements or branches. The JSON has no line counters, so the line figure is from the text summary.

Re-run after that, this continuation:

- `TEST_DB_ADMIN_URL=postgres://postgres:localtest@127.0.0.1:55432/postgres REQUIRE_DB_CONTRACT=1 npm run test:db` exit 0. 1 file, 5 tests, duration 1.09s.
- `REQUIRE_BUNDLE_SCAN=1 npx vitest run tests/api/security.test.ts` exit 0. `.next/static` was present. 1 file, 12 tests. No hit on `SUPABASE_SERVICE_KEY`, `service_role`, or `DB_PASSWORD`.
- `node --check scripts/migrate.mjs` and `node --check scripts/smoke.mjs` exit 0.

Local Postgres 17 at `127.0.0.1:55432` was reachable. After the contract run, no `qantum_contract_*` database remained. Role `qantum_slice` exists there with the last random password. The password was not printed. The role was not dropped.

## Not verified

Playwright (this sandbox cannot launch Chromium). GitHub Actions (`checks`, `db`, `e2e`, `deploy`), gitleaks, and `npm audit` on CI. Vercel pull, build, and deploy. The live Supabase database and persistence. `scripts/smoke.mjs` against a server.

## Orchestrator

- Run the four CI jobs. Deploy is push to `main` only and needs `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `PRODUCTION_URL`.
- Create `qantum_slice` with `db/setup.sql`, migrate through the session pooler (5432), and point the app at the transaction pooler (6543) as `qantum_slice` with TLS on. Confirm a wait or escalate survives a new function instance, and that the role cannot update, delete, truncate, or create tables.
- Update `docs/api.md` (Configuration), `docs/technical-design.md`, `docs/test-strategy.md` section 7 (it still describes local Supabase and `REQUIRE_SUPABASE_CONTRACT`), and the submission checklist. HTTP responses and the `ActionsRepository` port are unchanged.
- `tests/api/client-boundary.mjs` and `eslint.config.mjs` still name `@supabase/supabase-js`. Left in place; they are outside the allowed edit set. No `src/` import of that package or of `src/adapters/supabase` remains. `supabase/` is deleted.
