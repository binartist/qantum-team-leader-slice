# API layer review: code quality and security

Reviewed the ports, adapters, use cases, server composition root, route handlers, domain edits, API tests, and `next.config.ts` as they are on disk. No repo files were changed. Highest severity first.

## Findings

### High

1. **High** — `tests/api/security.test.ts:106-109` (with `:54-67` and `:80-81`)
   The test named "does not return env values from the parser" never inspects the parsed service key, and the client-bundle scan does not run unless `.next/static` already exists.
   `readEnv({ DEMO_USER_ID: "leader-2", SUPABASE_SERVICE_KEY: "marker-secret", SUPABASE_URL: "http://insecure.example" })` returns `supabaseServiceKey === "marker-secret"`. The assertion builds `JSON.stringify({ demoUserId: parsed.demoUserId })`, which is `{"demoUserId":"leader-2"}` and cannot contain the key. `toThrowError()` on `DEMO_USER_ID: "bad id"` passes for any throw; the implementation happens to throw `InternalError: Something went wrong.` The production case stubs `SUPABASE_SERVICE_KEY` to `""`, so a body that echoed the key would still pass. The `.next/static` loop is inside `if (statSync(...).isDirectory())`. The suite run from `/tmp/review-copy` (no `.next`) passed this test, including AC 28, without scanning a bundle. A separate scan of the workspace `.next/static` (9 files) found no `SUPABASE_SERVICE_KEY` and no `service_role`; that is evidence about the current build, not about this test.
   Suggested fix: assert that a request handled with a recognisable key in the environment omits that key from the response body and from `console.log`. Assert the invalid-id error name and message. Fail AC 28 when `.next/static` is absent instead of skipping the bundle scan, or build before the test.

### Medium

2. **Medium** — `src/server/http.ts:99-108`
   The 10_000-byte cap buffers the whole body before rejecting it whenever `Content-Length` is missing, not a single integer, or smaller than the bytes that follow.
   A stream of 30 × 1000 bytes with `Content-Length: 10` pulled 31 times (30_000 bytes enqueued, then close) and then threw `PayloadTooLargeError`. A 20_000-byte body whose header was the non-numeric value `10, 20` (Fetch `Headers#get` joins duplicates with a comma) also threw only after the body was read. A numeric `Content-Length: 999999` threw `PayloadTooLargeError` after one 1000-byte chunk, so the early reject works only for a single oversized integer. These POSTs are unauthenticated by design (`docs/technical-design.md` section 8), so a chunked or understated body can force the process to hold the payload.
   Suggested fix: count bytes while reading and stop at 10_001, whether or not `Content-Length` is present. Keep the post-read check. Do not treat a missing or non-numeric length as small.

3. **Medium** — `src/application/sites.ts:14-21`
   `listSites` turns every per-site failure into HTTP 200 and `crewStatus: "unavailable"`, and it does not log.
   With stock throwing `UpstreamError("upstream_unavailable", "stock")`, `GET /api/sites` returned 200, `Cache-Control: no-store`, and all four sample sites as `unavailable`, including `site-d` (no nominations). `console.log` captured no line for that request. The same dependency on `GET /api/sites/site-d/readiness` returned 502 `{"code":"upstream_unavailable","message":"stock is unavailable."}` and did log `upstream_failed`. `getSiteReadiness` calls stock even when the nomination list is empty, so a stock outage also replaces `nothing_planned`. The body did not contain `"clear"`. `unavailable` is outside the domain union `clear | blocked | nothing_planned`, and the list still looks like a successful load.
   Suggested fix: log `upstream_failed` with the fixed `code` and `system` only, inside the per-site catch. Keep a non-clear status for that site. Let a failure of `listSites()` itself (the sites port) stay a 502.

4. **Medium** — `src/server/env.ts:4-11` and `src/server/deps.ts:44-46`
   Production accepts an `http:` Supabase URL and will send `SUPABASE_SERVICE_KEY` to it. The service role bypasses row-level security.
   `readEnv` allows `http:` and `https:`. `buildDependencies()` in `NODE_ENV=production` with `SUPABASE_URL=http://insecure.example` and a non-empty key returned a built dependency object and did not call `fetch` during construction (the key is sent on the first query). The production guard only rejects `ACTIONS_STORE=memory`.
   Suggested fix: when `NODE_ENV === "production"`, require `https:`. Keep `http:` for local Supabase outside production.

5. **Medium** — `src/adapters/memory/actions-repository.ts:39-40` and `src/adapters/supabase/actions-repository.ts:169-173`
   A repeated idempotency key returns the first row for that demo user and records nothing for a different shortage. The Supabase `23505` branch does the same lookup and does not compare the new row to the stored one.
   `POST` wait `site-b` / `site-b:MAT-SEALANT` with `Idempotency-Key: rebind` and note `sealant-note` returned 201. The same key on `site-b` / `site-b:MAT-COLLAR-25` with note `collar-note` returned 200 `created: false` and the sealant record, including `note: "sealant-note"`. No collar wait was stored. Section 5 of the technical design leaves "rejecting a reused key with a different body" to production. Today every caller shares `demo-leader`, so one reused key drops a later decision and answers with the earlier note. Wait and escalate still do not set crew status to `clear`.
   Suggested fix: on a key hit, return the stored row only when site, resource id, and body match; otherwise return 409. Apply the same check in the memory repository and in `writeOne` after `23505`.

6. **Medium** — `src/domain/readiness.ts:157-160`
   `computeSiteReadiness` deletes penetrations whose `siteId` does not match, and the rest of the site can come back `clear`.
   Direct call: `pen-ok` on `site-a` with catalogue code `0438`, one unit of `MAT-X`, and 10 on hand, plus `pen-hidden` on `site-b` with nominated code `9999` (the sample's missing code). Result: `crewStatus: "clear"`, `blockers: []`. `pen-hidden` was not a blocker. The stub does not feed this shape today: `src/adapters/stub/index.ts:70-71` throws `upstream_invalid` when `penetration.siteId` does not match the map key, and the route then returns 502. The use case passes port rows straight into this function, so the next adapter inherits the drop.
   Suggested fix: if any input penetration's `siteId` is not the requested site, fail closed (throw, or keep it as a blocker). Do not filter it out.

### Low

7. **Low** — `.env.example:1-6` versus `src/server/env.ts:16`
   `.env.example` documents `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `DEMO_USER_ID`, and does not document `ACTIONS_STORE`, which selects `memory` or `supabase` and is rejected in production when set to `memory`.
   Suggested fix: add `ACTIONS_STORE=` with a one-line comment that production must use `supabase` or leave it unset.

8. **Low** — `src/server/env.ts:1` (and the other modules under `src/server/`)
   Nothing imports `server-only`, so a future client component that imports `@/server/env` or `@/server/deps` fails at runtime instead of failing the build. There is no `"use client"` module under `src/` today. Next does not inline a non-`NEXT_PUBLIC_` value into a client bundle; the workspace `.next/static` scan above found neither marker.
   Suggested fix: `import "server-only"` at the top of `src/server/env.ts` and `src/server/deps.ts`.

9. **Low** — `src/server/deps.ts:41`
   The composition root loads the catalogue from `path.join(process.cwd(), "data", "solutions-excerpt.csv")`. `loadCatalogueFromCsv` already defaults to a path next to the module so the file does not follow the process working directory (`src/adapters/catalogue-csv.ts:7-14`). A process started in another directory with its own `data/solutions-excerpt.csv` would use that file to decide which substitutes are candidates.
   Suggested fix: call `loadCatalogueFromCsv()` with no argument.

10. **Low** — `src/application/types.ts:12` and `src/server/deps.ts:39-59`
    `Dependencies.newId` is required and stored, and no use case reads it. The memory repository closes over the `newId` passed to `createMemoryActionsRepository`, not over `deps.newId`.
    Suggested fix: drop `newId` from `Dependencies`, or have the repository read it from `deps` in one place.

11. **Low** — `src/server/env.ts:39`, `src/server/deps.ts:36`, `src/server/deps.ts:45`
    A bad `DEMO_USER_ID`, `ACTIONS_STORE=memory` in production, and a missing Supabase URL or key all throw the same empty `InternalError`. The log line is `request_failed` / `internal_error` / `500`, with no fixed reason code. The response text stays generic, which is right; an operator cannot tell the checks apart.
    Suggested fix: log a fixed reason such as `config_invalid`, `store_forbidden`, or `supabase_unconfigured`, and not the env value.

## Verified OK

- **Unauthenticated writes match the design.** Section 8 sets one server-side demo identity and accepts that anyone with the URL can add demo actions. `POST` wait with `X-User-Id: attacker`, `?createdBy=attacker`, and `Content-Type: text/plain` stored `createdBy: "demo-leader"`. `createdBy` in the JSON body is an unknown field and is rejected. No route reads a query string or a header to choose the user or `ACTIONS_STORE`.
- **Response and log hygiene.** `errorResponse(new Error("SQL failed SUPABASE_SERVICE_KEY=marker-secret /Users/joe/secret.sql note=leader-note"))` returned `{"code":"internal_error","message":"Something went wrong."}`. The log line was `{"event":"internal_error","code":"internal_error","status":500}`. A bad wait body `{ note: "VISIBLE-NOTE", createdBy: "BODYUSER", "<script>": "x" }` produced `Invalid fields: createdBy` and did not include the note or the angle brackets. `log` allowlists field names and token-shaped values. `codeOnly` keeps only the Supabase error code.
- **Cache-Control.** `GET /api/sites` and the 502 readiness response above both sent `no-store`. `next.config.ts` sets `poweredByHeader: false`. No route sets `Access-Control-Allow-Origin`. Next 16's `auto-implement-methods.js` answers an unimplemented method with 405, and answers `OPTIONS` with 204 and `Allow` only. The server was not started.
- **Path ids.** Site, penetration, and shortage ids are decoded once and checked against an ASCII allowlist. Shortage ids must start with `${siteId}:` and contain one colon. `.` is allowed, and ids are lookup keys, not filesystem paths. A second `decodeURIComponent` cannot introduce `/` without failing the allowlist.
- **Fail-closed composition root.** A production build with an empty URL and key throws `InternalError` and does not cache that failure: the next call, after a valid URL and key were set, built a new object. `ACTIONS_STORE=memory` in production throws. Development with a URL set and `ACTIONS_STORE` unset used the memory repository and did not call `fetch` (`sites=4`, `actions=0`, `fetchCalled=0`). Successful builds are cached: two `getDependencies()` calls returned the same catalogue object.
- **Crew status on bad quantities.** `onHandFromQuantities([100, -1])` is `null`, so one bad stock row does not become a usable on-hand figure. Invalid mapped quantities become blockers before they are added to a requirement. Crew status is `blocked` when any shortage or blocker remains. Wait does not change that; the suite's AC 11 path passed in this run.
- **Substitutes.** `proposeSubstitution` reloads the penetration, requires `fromInternalCode` to equal the current nomination, and requires `toInternalCode` to be among `findCandidates` for that penetration. The nominated code is excluded. A null offered insulation does not satisfy a stated requirement. Proposals are stored as `proposed` only.
- **Supabase adapter shape.** Filters are `.eq(column, value)` and inserts are row objects. There is no string interpolation into a filter. User-controlled ids that reach `.eq` are limited to `[A-Za-z0-9._-]`, which excludes PostgREST's `,()` separators. Every error code other than `23505` becomes `upstream_unavailable`, including a missing code. `23505` re-reads by `created_by` and `idempotency_key`; a missing row becomes `upstream_unavailable` rather than a second insert. Row parsing checks the uuid, the escalate pair, non-negative quantities, and `from !== to`. The client is created with the service key and `auth.persistSession: false`. The migration enables RLS with no policies and revokes `anon` and `authenticated`.
- **Layers.** Domain modules do not import Next, the file system, or Supabase. Application modules do not import Next or `src/server`. Route handlers parse, call one use case, and map status. `src/app/page.tsx` does not import the server. No `any`, no non-null assertion, and no lint suppression under `src/`. The only assertion in the HTTP parser is `JSON.parse(...) as unknown`. The per-code error classes match the status map and are not an extra framework.
- **Performance at 200 penetrations.** One site, 200 penetrations: about 0.7 ms. Four sites: about 2.4 ms and 9 counted site/nomination calls (each site also calls solution materials, stock, and actions on the uncounted stubs). Readiness indexes materials and stock with `Map`s. `findCandidates` is not on the list path. The catalogue CSV is loaded in `buildDependencies` and reused. The N-fold stub parses are real and are not a problem at this size.
- **Secrets on disk.** `.gitignore` ignores `.env` and `.env.*` and keeps `.env.example`. No `.env` file was in the workspace. The service key is read only in `src/server/env.ts` and passed into the server-side client.

## Commands

- `rsync -a --exclude node_modules --exclude .next --exclude .git --exclude coverage` of the repo to `/tmp/review-copy`, then per-package symlinks into a real `/tmp/review-copy/node_modules` so Vite's config bundle could be written outside the read-only `node_modules/.vite-temp`. Exit 0.
- `cd /tmp/review-copy && npx vitest run --config /tmp/vitest-configs/vitest.config.mjs --reporter=dot`. Exit 0. 12 files, 147 passed, 3 skipped (`tests/api/actions-repository.test.ts` Supabase cases; `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` were unset).
- `cd /tmp/review-copy && npx vitest run --config /tmp/vitest-configs/vitest.config.mjs tests/api/review-proof.test.ts --disableConsoleIntercept`. Exit 1. The script printed the body-limit, env, identity, and quantity results, then threw `TypeError: Cannot assign to property 'readFileSync'` in the proof harness. That failure is the harness, not the app.
- `cd /tmp/review-copy && npx vitest run --config /tmp/vitest-configs/vitest.config.mjs tests/api/review-proof-2.test.ts --disableConsoleIntercept`. Exit 0. Printed the list/readiness, idempotency rebind, domain `clear`, content-length pull counts, and catalogue identity result.
- Node scan of `/Users/joe/workspace/qantum-team-leader-slice/.next/static`. Exit 0. `{"files":9,"keyName":0,"role":0,"supabaseHost":0}`.
- `next dev` and `next start` were not run.
