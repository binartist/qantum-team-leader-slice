-- Create the least-privilege role and the database, once, as a superuser.
-- Run it with psql against the maintenance database (usually postgres):
--   psql "postgres://<admin>@<host>:<session-port>/postgres" -v app_password='…' -f db/setup.sql
-- The password is only on the command line. This file has none.
-- Optional overrides, both defaulting to qantum_slice:
--   -v app_role=qantum_slice -v app_database=qantum_slice
-- Then apply migrations as the admin through the session pooler (port 5432):
--   DB_HOST=… DB_PORT=5432 DB_USER=… DB_PASSWORD=… DB_NAME=qantum_slice DB_SSL=require npm run db:migrate
-- The app uses the transaction pooler (port 6543) and the qantum_slice role.

\if :{?app_password}
\else
\echo app_password is required: psql -v app_password=... -f db/setup.sql
\quit 2
\endif

\if :{?app_role}
\else
\set app_role qantum_slice
\endif

\if :{?app_database}
\else
\set app_database qantum_slice
\endif

select exists (select 1 from pg_roles where rolname = :'app_role')::int as role_exists
\gset

\if :role_exists
alter role :"app_role" with login password :'app_password';
\else
create role :"app_role" with login password :'app_password';
\endif

select exists (select 1 from pg_database where datname = :'app_database')::int as db_exists
\gset

\if :db_exists
\else
create database :"app_database";
\endif

revoke connect on database :"app_database" from public;
grant connect on database :"app_database" to :"app_role";

\connect :"app_database"

grant usage on schema public to :"app_role";
revoke create on schema public from public;
