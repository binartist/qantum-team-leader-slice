import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client, Pool, escapeIdentifier, escapeLiteral, type PoolConfig } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { poolConfig } from "@/adapters/postgres/connection";
import { createPgActionsStore } from "@/adapters/postgres/pg-store";
import { createActionsRepository } from "@/adapters/postgres/repository";
import type { ActionsRepository, NewShortageAction, NewSubstitutionProposal } from "@/ports";

const adminUrl = process.env.TEST_DB_ADMIN_URL;
const required = process.env.REQUIRE_DB_CONTRACT === "1";

if (!adminUrl) {
  describe("postgres database contract", () => {
    if (required) {
      it("fails when REQUIRE_DB_CONTRACT=1 and TEST_DB_ADMIN_URL is unset", () => {
        throw new Error(
          "REQUIRE_DB_CONTRACT=1 but TEST_DB_ADMIN_URL is unset. Point it at a Postgres 17 admin database.",
        );
      });
    } else {
      it.skip("skipped: set TEST_DB_ADMIN_URL to run the database contract", () => {});
    }
  });
} else {
  const admin = parseAdminUrl(adminUrl);
  const database = `qantum_contract_${randomBytes(8).toString("hex")}`;
  const appPassword = randomBytes(24).toString("hex");
  const secrets = [admin.password, appPassword];
  let pool: Pool | undefined;
  let repo: ActionsRepository | undefined;

  describe("postgres database contract", () => {
    beforeAll(async () => {
      try {
        await runSetup(admin, database, appPassword);
        const first = migrate(admin, database);
        expect(visible(first.stdout, secrets)).toContain(`applied 0001_actions host ${admin.host} database ${database}`);
        expect(visible(`${first.stdout}\n${first.stderr}`, secrets)).not.toContain("[redacted]");
        const second = migrate(admin, database);
        expect(visible(second.stdout, secrets)).toContain(`applied (none) host ${admin.host} database ${database}`);
        expect(visible(`${second.stdout}\n${second.stderr}`, secrets)).not.toContain("[redacted]");
        pool = new Pool(
          poolConfig({
            host: admin.host,
            port: admin.port,
            user: "qantum_slice",
            password: appPassword,
            database,
            ssl: "disable",
            poolMax: 1,
          }),
        );
        repo = createActionsRepository(createPgActionsStore(pool));
      } catch (error) {
        throw scrub(error, secrets);
      }
    }, 60_000);

    afterAll(async () => {
      await pool?.end();
      const client = adminClient(admin, admin.database);
      try {
        await client.connect();
        await client.query(`drop database if exists ${escapeIdentifier(database)} with (force)`);
      } finally {
        await client.end();
      }
    }, 30_000);

    it("AC 16: appends a shortage, replays the same key as one row, and keeps another user's row", async () => {
      const actions = repository();
      const siteId = id("site");
      const input = actionInput(siteId);
      const first = await actions.appendShortageAction(input);
      const replay = await actions.appendShortageAction({ ...input, note: "changed", shortfallQtyAtTime: 9 });
      const other = await actions.appendShortageAction({ ...input, createdBy: "other-leader", note: "other" });
      const listed = await actions.listShortageActions(siteId);
      expect(first.created).toBe(true);
      expect(first.record).toMatchObject({
        siteId,
        shortageId: `${siteId}:MAT-SEALANT`,
        kind: "wait",
        escalateTo: null,
        note: "kept",
        shortfallQtyAtTime: 2.5,
        createdBy: "demo-leader",
      });
      expect(first.record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(first.record.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(replay).toEqual({ record: first.record, created: false });
      expect(other.created).toBe(true);
      expect(other.record.id).not.toBe(first.record.id);
      expect(listed).toHaveLength(2);
      expect(listed.filter((row) => row.id === first.record.id)).toHaveLength(1);
    });

    it("AC 16: appends a proposal, replays the same key as one row, and keeps another user's row", async () => {
      const actions = repository();
      const siteId = id("site");
      const input = proposalInput(siteId);
      const first = await actions.appendSubstitutionProposal(input);
      const replay = await actions.appendSubstitutionProposal({ ...input, reason: "a different reason" });
      const other = await actions.appendSubstitutionProposal({ ...input, createdBy: "other-leader", reason: "other reason" });
      const listed = await actions.listSubstitutionProposals(siteId);
      expect(first.created).toBe(true);
      expect(first.record).toMatchObject({
        siteId,
        penetrationId: `${siteId}-pen`,
        fromInternalCode: "0438",
        toInternalCode: "0451",
        reason: "closer rating",
        status: "proposed",
        createdBy: "demo-leader",
      });
      expect(replay).toEqual({ record: first.record, created: false });
      expect(other.created).toBe(true);
      expect(listed).toHaveLength(2);
    });

    it("lists shortages and proposals newest first", async () => {
      const actions = repository();
      const siteId = id("site");
      const older = await actions.appendShortageAction(actionInput(siteId, { idempotencyKey: `${siteId}-older` }));
      await delay(30);
      const newer = await actions.appendShortageAction(
        actionInput(siteId, { idempotencyKey: `${siteId}-newer`, kind: "escalate", escalateTo: "purchasing", note: null }),
      );
      expect((await actions.listShortageActions(siteId)).map((row) => row.id)).toEqual([newer.record.id, older.record.id]);

      const olderProposal = await actions.appendSubstitutionProposal(proposalInput(siteId, { idempotencyKey: `${siteId}-p-older` }));
      await delay(30);
      const newerProposal = await actions.appendSubstitutionProposal(
        proposalInput(siteId, { idempotencyKey: `${siteId}-p-newer`, reason: "second" }),
      );
      expect((await actions.listSubstitutionProposals(siteId)).map((row) => row.id)).toEqual([
        newerProposal.record.id,
        olderProposal.record.id,
      ]);
    });

    it("AC 17: rejects a 501-character note, an escalate without a target, and a status other than proposed", async () => {
      const siteId = id("site");
      await expectState(
        `insert into public.shortage_action (site_id, shortage_id, kind, note, created_by, idempotency_key)
         values ($1, $2, 'wait', $3, $4, $5)`,
        [siteId, `${siteId}:MAT`, "n".repeat(501), "demo-leader", `${siteId}-note`],
        "23514",
      );
      await expectState(
        `insert into public.shortage_action (site_id, shortage_id, kind, escalate_to, created_by, idempotency_key)
         values ($1, $2, 'escalate', null, $3, $4)`,
        [siteId, `${siteId}:MAT`, "demo-leader", `${siteId}-escalate`],
        "23514",
      );
      await expectState(
        `insert into public.substitution_proposal (
           site_id, penetration_id, from_internal_code, to_internal_code, reason, status, created_by, idempotency_key
         ) values ($1, $2, '0438', '0451', 'because', 'approved', $3, $4)`,
        [siteId, `${siteId}-pen`, "demo-leader", `${siteId}-status`],
        "23514",
      );
    });

    it("refuses update, delete, truncate, and create table for the app role", async () => {
      const siteId = id("site");
      await repository().appendShortageAction(actionInput(siteId, { idempotencyKey: `${siteId}-priv` }));
      await expectState("update public.shortage_action set note = 'changed'", [], "42501");
      await expectState("delete from public.shortage_action", [], "42501");
      await expectState("truncate public.shortage_action", [], "42501");
      await expectState(`create table public.${id("denied")} (id int)`, [], "42501");
    });
  });

  function repository(): ActionsRepository {
    if (!repo) throw new Error("database contract is not set up");
    return repo;
  }

  function queryPool(): Pool {
    if (!pool) throw new Error("database contract is not set up");
    return pool;
  }

  async function expectState(text: string, values: readonly (string | number | null)[], code: string): Promise<void> {
    let caught: unknown;
    try {
      await queryPool().query(text, [...values]);
    } catch (error) {
      caught = error;
    }
    const actual = typeof caught === "object" && caught !== null && "code" in caught ? caught.code : undefined;
    expect(actual).toBe(code);
    expect(visible(caught instanceof Error ? caught.message : "", secrets)).not.toContain("[redacted]");
  }
}

interface Admin {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

function parseAdminUrl(value: string): Admin {
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !url.username || !database) throw new Error("TEST_DB_ADMIN_URL is missing a host, user, or database");
  return {
    host: url.hostname,
    port: url.port === "" ? 5432 : Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}

function adminClient(admin: Admin, database: string): Client {
  const config: PoolConfig = {
    host: admin.host,
    port: admin.port,
    user: admin.user,
    password: admin.password,
    database,
    ssl: false,
    connectionTimeoutMillis: 5000,
  };
  return new Client(config);
}

function migrate(admin: Admin, database: string): { stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: process.env.NODE_ENV ?? "test",
      DB_HOST: admin.host,
      DB_PORT: String(admin.port),
      DB_USER: admin.user,
      DB_PASSWORD: admin.password,
      DB_NAME: database,
      DB_SSL: "disable",
    },
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "migrate failed");
  return { stdout: result.stdout, stderr: result.stderr };
}

async function runSetup(admin: Admin, database: string, appPassword: string): Promise<void> {
  const vars = new Map<string, string>([
    ["app_password", appPassword],
    ["app_role", "qantum_slice"],
    ["app_database", database],
  ]);
  let client = adminClient(admin, admin.database);
  await client.connect();
  const stack = [{ parentTaking: true, taking: true, taken: true }];
  let buffer = "";
  const taking = (): boolean => stack[stack.length - 1]?.taking === true;
  try {
    for (const line of readFileSync("db/setup.sql", "utf8").split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("--") && buffer.trim() === "") continue;
      if (trimmed === "" && buffer.trim() === "") continue;
      if (trimmed.startsWith("\\")) {
        await meta(trimmed);
        continue;
      }
      if (!taking()) continue;
      buffer += `${line}\n`;
      if (buffer.trim().endsWith(";")) {
        await client.query(substitute(buffer, vars));
        buffer = "";
      }
    }
    if (buffer.trim() !== "") throw new Error("setup.sql ended inside a statement");
    if (stack.length !== 1) throw new Error("setup.sql ended inside a conditional");
  } finally {
    await client.end();
  }

  async function meta(trimmed: string): Promise<void> {
    if (trimmed.startsWith("\\if")) {
      const parent = stack[stack.length - 1];
      if (!parent) throw new Error("if stack is empty");
      const cond = parent.taking && truthy(trimmed.slice("\\if".length).trim(), vars);
      stack.push({ parentTaking: parent.taking, taking: cond, taken: cond });
      return;
    }
    if (trimmed === "\\else") {
      const frame = stack[stack.length - 1];
      if (!frame || stack.length === 1) throw new Error("else without if");
      frame.taking = frame.parentTaking && !frame.taken;
      if (frame.taking) frame.taken = true;
      return;
    }
    if (trimmed === "\\endif") {
      if (stack.length === 1) throw new Error("endif without if");
      stack.pop();
      return;
    }
    if (!taking()) return;
    if (trimmed.startsWith("\\set ")) {
      const match = trimmed.match(/^\\set\s+([A-Za-z0-9_]+)\s+(\S+)\s*$/);
      const name = match?.[1];
      const value = match?.[2];
      if (!name || value === undefined) throw new Error("unsupported set");
      vars.set(name, value);
      return;
    }
    if (trimmed === "\\gset") {
      if (buffer.trim() === "") throw new Error("gset without a query");
      const result = await client.query(substitute(buffer, vars));
      buffer = "";
      const row = result.rows[0];
      if (!row) throw new Error("gset returned no row");
      for (const [key, value] of Object.entries(row)) vars.set(key, value === null || value === undefined ? "" : String(value));
      return;
    }
    if (trimmed.startsWith("\\connect ")) {
      const match = trimmed.match(/^\\connect\s+:"([A-Za-z0-9_]+)"\s*$/);
      const name = match?.[1];
      if (!name) throw new Error("unsupported connect");
      const next = vars.get(name);
      if (!next) throw new Error("connect target is missing");
      await client.end();
      client = adminClient(admin, next);
      await client.connect();
      return;
    }
    if (trimmed.startsWith("\\echo ")) return;
    if (trimmed.startsWith("\\quit")) throw new Error(trimmed);
    throw new Error("unsupported setup command");
  }
}

function truthy(expression: string, vars: Map<string, string>): boolean {
  const defined = expression.match(/^:{\?([A-Za-z0-9_]+)}$/);
  if (defined?.[1]) return vars.has(defined[1]);
  const named = expression.match(/^:([A-Za-z0-9_]+)$/);
  const name = named?.[1];
  if (!name) throw new Error("unsupported if expression");
  const value = (vars.get(name) ?? "").trim().toLowerCase();
  return value !== "" && value !== "0" && value !== "false" && value !== "off" && value !== "no";
}

function substitute(sql: string, vars: Map<string, string>): string {
  let out = "";
  for (let index = 0; index < sql.length; ) {
    if (sql.startsWith(":'", index)) {
      const end = sql.indexOf("'", index + 2);
      if (end === -1) throw new Error("unclosed psql literal");
      out += escapeLiteral(requiredVar(vars, sql.slice(index + 2, end)));
      index = end + 1;
      continue;
    }
    if (sql.startsWith(':"', index)) {
      const end = sql.indexOf('"', index + 2);
      if (end === -1) throw new Error("unclosed psql identifier");
      out += escapeIdentifier(requiredVar(vars, sql.slice(index + 2, end)));
      index = end + 1;
      continue;
    }
    out += sql[index] ?? "";
    index += 1;
  }
  return out;
}

function requiredVar(vars: Map<string, string>, name: string): string {
  const value = vars.get(name);
  if (value === undefined) throw new Error(`missing psql variable ${name}`);
  return value;
}

function actionInput(siteId: string, overrides: Partial<NewShortageAction> = {}): NewShortageAction {
  return {
    siteId,
    shortageId: `${siteId}:MAT-SEALANT`,
    kind: "wait",
    escalateTo: null,
    note: "kept",
    shortfallQtyAtTime: 2.5,
    createdBy: "demo-leader",
    idempotencyKey: `${siteId}-key`,
    ...overrides,
  };
}

function proposalInput(siteId: string, overrides: Partial<NewSubstitutionProposal> = {}): NewSubstitutionProposal {
  return {
    siteId,
    penetrationId: `${siteId}-pen`,
    fromInternalCode: "0438",
    toInternalCode: "0451",
    reason: "closer rating",
    createdBy: "demo-leader",
    idempotencyKey: `${siteId}-proposal`,
    ...overrides,
  };
}

function id(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString("hex")}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function visible(text: string, secrets: readonly string[]): string {
  return secrets.reduce((current, secret) => (secret === "" ? current : current.split(secret).join("[redacted]")), text);
}

function scrub(error: unknown, secrets: readonly string[]): Error {
  return new Error(visible(error instanceof Error ? error.message : "database contract failed", secrets));
}
