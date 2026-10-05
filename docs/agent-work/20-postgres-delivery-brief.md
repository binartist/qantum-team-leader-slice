# BRIEF: Postgres store on the shared Supabase server, CI/CD and Vercel config

## 1. Role

You are the **worker** for this brief. Execute it. Do not engage another external worker or hand the brief back up. Your own in-harness helpers (subagents) are allowed within limits: one level deep, and never two helpers editing the same file. The orchestrator reviews everything you produce and runs its own gates, the live database setup and the deploy. This brief outranks any per-turn instruction that contradicts it. Do not keep your own task ledger or `tasks/todo.md`. Durable notes go in `DB-NOTES.md`. Do not run `git add`, `git commit`, `git push` or any git write command, and do not run `vercel`, `gh` or anything that talks to Vercel, GitHub or Supabase.

## 2. Facts

- Cwd is the repo root: Next.js 16.3, strict TypeScript, Vitest, Zod 4, Playwright. The app is complete and green: 281 unit and API tests, 100% coverage on `src/domain/**` and `src/ui/*.ts`, 12 Playwright tests, `check:ac` exits 0. Read `AGENTS.md`, `docs/technical-design.md` sections 2, 4, 8 and 10, `docs/api.md` (Configuration), `docs/test-strategy.md` section 7.
- **Dependencies are already changed and installed by the orchestrator:** `pg@^8.23.1` and `@types/pg` added, `@supabase/supabase-js` removed. Do not run `npm install`. You may edit only the `"scripts"` section of `package.json`; nothing else in it, and never the lockfile.
- Actions are stored through the port `ActionsRepository` in `src/ports/index.ts`. Today `src/adapters/supabase/actions-repository.ts` holds (a) a generic repository `createActionsRepository(store: ActionsStore)` with row schemas, mappers, idempotent `writeOne` (unique violation `23505` returns the existing row with `created: false`), and (b) a ~35 line supabase-js store `createSupabaseActionsRepository`. The supabase-js import no longer resolves, so typecheck currently fails until you replace (b).
- The deployed target is a **new database `qantum_slice` on an existing Supabase Postgres 17 server**, reached through Supabase's poolers with plain `pg`, the same pattern as a sibling project. Supabase Auth and the Data API are not used. The app connects as a least-privilege role `qantum_slice`. Read `.agents/skills/supabase-postgres/SKILL.md` and `.agents/skills/data-migration/SKILL.md` and follow them (transaction pooler port 6543 for the app; one connection per function; unnamed queries; TLS modes).
- A **local Postgres 17** is running for tests at `127.0.0.1:55432`, admin user `postgres`, password `localtest`, database `postgres` (throwaway, local only). You may create and drop databases and roles on it. Nobody else uses it.
- The sandbox cannot launch Chromium; you cannot run Playwright. You cannot reach GitHub, Vercel or Supabase, and must not try.
- Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run build`, `npm run check:ac`.

## 3. Approved spec (implement exactly; do not relitigate)

**Approach.** Keep the `ActionsStore` seam. Replace the supabase-js store with a `pg` store. The repository logic, mappers and idempotency behaviour stay the same. The app role gets only `SELECT, INSERT` on the two tables, so append-only is enforced by the database.

| Area | Change |
| --- | --- |
| `src/adapters/postgres/repository.ts` | Move the generic part unchanged in behaviour: row schemas, mappers, `createActionsRepository`, `ActionsStore`, `StoreResult`. Keep `SYSTEM = "actions_store"` |
| `src/adapters/postgres/pg-store.ts` | `createPgActionsStore(pool: Pool): ActionsStore`. Parameterised SQL only (`$1…`), never string-built. Insert `… returning *`; select by `(created_by, idempotency_key)`; list by `site_id` ordered `created_at desc, id desc`. **No `name` on any query** (the transaction pooler rejects named prepared statements). Map a pg error with `code === "23505"` to `{ error: { code: "23505" } }`; any other failure to an error result so the repository throws `UpstreamError("upstream_unavailable", "actions_store")`. Convert `timestamptz` (`Date`) to ISO strings before mapping; `numeric` arrives as a string and the mapper already parses it. Never put driver error text in errors or logs |
| `src/adapters/postgres/connection.ts` | `poolConfig(settings)` returns a `pg` `PoolConfig`: `max` from `DB_POOL_MAX` (default 1, allowed 1 to 10), `ssl`: `disable` gives `false`; `require` gives `{ rejectUnauthorized: false }` (encrypted, not authenticated, a documented compromise); `verify-full` gives `{ rejectUnauthorized: true, ca }` using `DB_SSL_CA` (PEM; literal `\n` sequences are turned into newlines) and is refused without a CA. Short timeouts: `connectionTimeoutMillis` 5000, `idleTimeoutMillis` 10000 |
| Delete | `src/adapters/supabase/` and any import of it |
| `src/server/env.ts` | `ACTIONS_STORE` is `memory` or `postgres`. New settings `DB_HOST`, `DB_PORT` (integer 1 to 65535, default 5432), `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL` (`disable`, `require`, `verify-full`, default `require`), `DB_SSL_CA`, `DB_POOL_MAX`. Remove the Supabase settings. Invalid values throw `InternalError("config_invalid")` |
| `src/server/deps.ts` | Outside production the default store stays `memory`. In production: `ACTIONS_STORE` other than `postgres` is `InternalError("store_forbidden")`; any of host, user, password, name missing is `InternalError("db_unconfigured")`; `DB_SSL=disable` is `InternalError("db_tls_insecure")`. Failures are not cached (existing behaviour). Build one `Pool` per process, cached with the dependencies on `globalThis` (existing mechanism). When the postgres store is built, log one `db_config` event with host, port, user, database, ssl mode and `passwordPresent: true/false`, **never the password**; extend the logger's field allowlist for exactly these fields (`host`, `port`, `user`, `database`, `ssl`, `passwordPresent`) and keep its value checks |
| `src/ports/errors.ts` | Replace the Supabase reason tokens with `db_unconfigured`, `db_tls_insecure` (keep `config_invalid`, `store_forbidden`) |
| `db/migrations/0001_actions.sql` | The two tables, checks and indexes exactly as `supabase/migrations/0001_actions.sql`, in schema `public`, **without** the RLS lines and the `anon`/`authenticated` revokes (those roles do not exist in the new database). Then `revoke all on both tables from public; grant select, insert on both tables to qantum_slice;` No update or delete grant. Delete the `supabase/` directory |
| `db/setup.sql` | Run once by an admin with psql: create role `qantum_slice` with login and the password from a psql variable (`\set app_password` is supplied by the operator, e.g. `psql -v app_password=… -f db/setup.sql`; never a literal password in the file), create database `qantum_slice`, revoke `connect` on it from `public`, grant `connect` to `qantum_slice`, then `\connect qantum_slice` and grant `usage` on schema `public` to `qantum_slice` and revoke `create` on schema `public` from `public`. Idempotent where reasonable (`do` blocks or `if not exists`), with a header comment explaining how to run it |
| `scripts/migrate.mjs` | Plain Node ESM, no TypeScript, no new dependency (uses `pg`). Reads the same `DB_*` variables (for migrations the operator exports the admin user and the session pooler port). Creates `schema_migrations (version text primary key, applied_at timestamptz not null default now())` if missing, applies every `db/migrations/*.sql` not yet recorded, in filename order, each in one transaction with its record, and prints only versions applied and the target host and database (never the password). Exit non-zero on failure. `package.json` script `"db:migrate": "node scripts/migrate.mjs"` |
| Tests, unit | `tests/unit/pg-store.test.ts` with a fake `Pool` (record SQL and params): parameterised SQL, no `name` on any query, `23505` path returns the existing row with `created: false`, other errors become `upstream_unavailable` without driver text, `Date` to ISO conversion, ordering clause. `tests/unit/db-connection.test.ts` for the TLS mapping, CA newline handling, pool max bounds. Update `tests/api/security.test.ts` and friends for the new env and reason tokens, including **production with `DB_SSL=disable` is 500**, **`ACTIONS_STORE=memory` in production is 500**, **missing `DB_PASSWORD` is 500**, logged reason is the fixed token, and `DB_PASSWORD`'s value never appears in any response body or log line (AC 28) |
| Tests, database contract | `tests/db/contract.test.ts`, run by `npm run test:db` (`vitest run tests/db`). Uses admin env `TEST_DB_ADMIN_URL` (e.g. `postgres://postgres:localtest@127.0.0.1:55432/postgres`). It creates a uniquely named database and the role with a random password, runs `db/setup.sql`'s statements and `scripts/migrate.mjs` against it, then connects **as the app role** through `poolConfig` and checks: append and read back for both tables; replay with the same key returns `created: false` and one row; same key for another user creates a second row; newest first; constraints reject an escalate without `escalate_to`, a status other than `proposed`, a 501-character note; and the app role is **refused** `UPDATE`, `DELETE`, `TRUNCATE` and `CREATE TABLE`. It drops its database afterwards. Skips with a clear reason when `TEST_DB_ADMIN_URL` is unset, and **fails** when `REQUIRE_DB_CONTRACT=1` is set and the URL is unset. Name the relevant tests `AC 16`, `AC 17` or the security AC they cover where one applies. Exclude `tests/db` from `npm test` / `test:coverage` if it would otherwise skip noisily; it must not need a database for the default run |
| `vitest.config.ts` | Only if needed to exclude `tests/db` from the default run and add `src/adapters/postgres/connection.ts` to the coverage include |
| `.github/workflows/ci.yml` | Jobs. **checks** (as today) plus `REQUIRE_BUNDLE_SCAN=1` on the security test after build. **db**: service container `postgres:17` with a throwaway password, `TEST_DB_ADMIN_URL` pointing at it, `REQUIRE_DB_CONTRACT=1 npm run test:db`. **e2e**: `npx playwright install --with-deps chromium`, `npm run test:e2e`, `npm run check:ac`, upload the Playwright report on failure. **deploy**: `needs: [checks, db, e2e]`, only on `push` to `main`, `concurrency` group `deploy-production`, env `VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}`, `VERCEL_ORG_ID: ${{ vars.VERCEL_ORG_ID }}`, `VERCEL_PROJECT_ID: ${{ vars.VERCEL_PROJECT_ID }}`; steps `npx vercel@62.2.0 pull --yes --environment=production --token "$VERCEL_TOKEN"`, `npx vercel@62.2.0 build --prod --token …`, `npx vercel@62.2.0 deploy --prebuilt --prod --token …`, then **smoke**: against `${{ vars.PRODUCTION_URL }}`, retrying for up to 60 seconds: `GET /api/sites` is 200, has `Cache-Control: no-store`, and lists exactly 4 sites; `GET /` is 200 and contains `Sites`; fail otherwise. Put the smoke check in `scripts/smoke.mjs` (plain Node, `fetch`, no dependency) so it can also run locally against any URL. Use `actions/checkout@v5` and `actions/setup-node@v5`, Node 22, npm cache. `permissions: contents: read` |
| `vercel.json` | `{ "$schema": "https://openapi.vercel.sh/vercel.json", "framework": "nextjs", "regions": ["syd1"] }` |
| `.env.example` | Replace the Supabase lines with the `DB_*` names (empty values), a comment that the app uses the transaction pooler port 6543 and migrations the session pooler port 5432, and that `DB_PASSWORD` is set only in Vercel and the operator's shell. Keep `ACTIONS_STORE` (now `memory` or `postgres`) |

**Contract diff.** Environment only: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` and `ACTIONS_STORE=supabase` are replaced by `DB_*` and `ACTIONS_STORE=postgres`. The HTTP API, responses and the port are unchanged.

**Acceptance criteria.** 1. The contract suite passes against the local Postgres 17. 2. The app role is refused update, delete, truncate and DDL. 3. Production config failures are 500 with fixed reason tokens. 4. No password in logs, responses or the client bundle. 5. All existing gates stay green. 6 and 7 (CI deploy and live persistence) are verified by the orchestrator.

## 4. Files you may change or create

`src/adapters/postgres/**` (create), delete `src/adapters/supabase/**` and `supabase/**`, edit `src/server/env.ts`, `src/server/deps.ts`, `src/ports/errors.ts`, `src/application/log.ts` (allowlist only), `tests/**`, `db/**` (create), `scripts/migrate.mjs`, `scripts/smoke.mjs` (create), `.github/workflows/ci.yml`, `vercel.json` (create), `.env.example`, `vitest.config.ts` (as stated), `package.json` `"scripts"` only, and `DB-NOTES.md`.
Nothing else. Do not touch `docs/`, `data/`, `src/domain/`, `src/ui/`, `src/app/`, `next.config.ts`, the lockfile.

## 5. Method (test first)

Write unit tests first, run them and confirm they fail against the current code, then implement. Then write the contract suite and run it against the local Postgres (`TEST_DB_ADMIN_URL=postgres://postgres:localtest@127.0.0.1:55432/postgres REQUIRE_DB_CONTRACT=1 npm run test:db`). Record which tests failed first in `DB-NOTES.md`. If the local Postgres is not reachable from your sandbox, say so plainly and leave the suite for the orchestrator; do not fake it.

## 6. Verification (run before finishing, record in `DB-NOTES.md`)

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run check:ac
npx vitest run --sequence.shuffle --sequence.seed 7
TEST_DB_ADMIN_URL=postgres://postgres:localtest@127.0.0.1:55432/postgres REQUIRE_DB_CONTRACT=1 npm run test:db
```

All must exit 0. Coverage on `src/domain/**` and `src/ui/*.ts` stays 100%. No `any`, `@ts-ignore`, `eslint-disable`. Do not start long-running processes.

## 7. Honesty constraints

- Do not claim a command passed unless you ran it and saw the exit code. Paste exit codes and the coverage summary in the notes.
- Never write a real password, token or connection string with a real password into any file. The local `localtest` password may appear only in test defaults documentation and notes.
- If a decision in section 3 seems wrong or impossible, implement what it says and record the disagreement. Do not change an expected value to fit.
- Do not edit docs. List every changed environment variable, reason token and script in the notes so the orchestrator can document them.

## 8. DB-NOTES.md

Short and factual: tests that failed first, departures and why, the exact env variables and reason tokens, how `db/setup.sql` and `npm run db:migrate` are meant to be run, what you could not verify, and what the orchestrator must check (CI jobs, deploy, live database).
