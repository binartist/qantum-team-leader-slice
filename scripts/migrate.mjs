import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// TLS mapping matches src/adapters/postgres/connection.ts. This file stays plain
// JavaScript so an operator can run it without the TypeScript toolchain.
// Migrations use the session pooler (port 5432). The app uses port 6543.

const { Pool } = pg;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function optional(name) {
  const value = process.env[name];
  if (value === undefined || value === "") return undefined;
  return value;
}

function required(name) {
  const value = optional(name);
  if (value === undefined) fail(`missing ${name}`);
  return value;
}

function integer(name, fallback, min, max) {
  const value = optional(name);
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) fail(`invalid ${name}`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) fail(`invalid ${name}`);
  return parsed;
}

function sslConfig(mode, ca) {
  if (mode === "disable") return false;
  if (mode === "require") return { rejectUnauthorized: false };
  if (mode !== "verify-full") fail("invalid DB_SSL");
  if (ca === undefined) fail("missing DB_SSL_CA");
  return { rejectUnauthorized: true, ca: ca.replace(/\\n/g, "\n") };
}

function safeCode(error) {
  const code = error && typeof error === "object" && "code" in error ? error.code : "";
  return typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code) ? code : "failed";
}

async function main() {
  const host = required("DB_HOST");
  const port = integer("DB_PORT", 5432, 1, 65535);
  const user = required("DB_USER");
  const password = required("DB_PASSWORD");
  const database = required("DB_NAME");
  const ssl = sslConfig(optional("DB_SSL") ?? "require", optional("DB_SSL_CA"));
  const pool = new Pool({
    host,
    port,
    user,
    password,
    database,
    max: 1,
    ssl,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
  const client = await pool.connect();
  const applied = [];
  try {
    await client.query(`create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )`);
    const existing = await client.query("select version from schema_migrations");
    const have = new Set(existing.rows.map((row) => String(row.version)));
    const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
    const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
    for (const file of files) {
      const version = file.slice(0, -".sql".length);
      if (have.has(version)) continue;
      const sql = await readFile(path.join(directory, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (version) values ($1)", [version]);
        await client.query("commit");
      } catch (error) {
        try {
          await client.query("rollback");
        } catch {
          // Report the original failure. Rollback can fail when the session is already aborted.
        }
        throw error;
      }
      applied.push(version);
    }
    const versions = applied.length === 0 ? "(none)" : applied.join(" ");
    console.log(`applied ${versions} host ${host} database ${database}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  fail(`migration failed (${safeCode(error)})`);
});
