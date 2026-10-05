import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { createActionsRepository } from "@/adapters/postgres/repository";
import { createPgActionsStore } from "@/adapters/postgres/pg-store";
import { UpstreamError, type NewShortageAction, type NewSubstitutionProposal } from "@/ports";

const DRIVER_TEXT = "duplicate key SECRET-DRIVER-TEXT password=db-password-marker";

interface RecordedQuery {
  readonly text: string;
  readonly values: unknown[];
  readonly named: boolean;
}

function textOf(query: unknown): string {
  if (typeof query === "string") return query;
  if (typeof query === "object" && query !== null && "text" in query && typeof query.text === "string") return query.text;
  return "";
}

function valuesOf(query: unknown, second: unknown): unknown[] {
  if (typeof query === "string") return Array.isArray(second) ? second : [];
  if (typeof query === "object" && query !== null && "values" in query && Array.isArray(query.values)) return query.values;
  return [];
}

function fakePool(respond: (text: string, values: unknown[]) => Promise<{ rows: unknown[] }>): { pool: Pool; calls: RecordedQuery[] } {
  const calls: RecordedQuery[] = [];
  const query = vi.fn(async (queryConfig: unknown, second?: unknown) => {
    const text = textOf(queryConfig);
    const values = valuesOf(queryConfig, second);
    calls.push({
      text,
      values,
      named: typeof queryConfig === "object" && queryConfig !== null && "name" in queryConfig,
    });
    return respond(text, values);
  });
  return { pool: { query } as unknown as Pool, calls };
}

function actionInput(overrides: Partial<NewShortageAction> = {}): NewShortageAction {
  return {
    siteId: "site-b",
    shortageId: "site-b:MAT-SEALANT",
    kind: "wait",
    escalateTo: null,
    note: "quote' OR 1=1",
    shortfallQtyAtTime: 2.5,
    createdBy: "demo-leader",
    idempotencyKey: "key-1",
    ...overrides,
  };
}

function proposalInput(overrides: Partial<NewSubstitutionProposal> = {}): NewSubstitutionProposal {
  return {
    siteId: "site-b",
    penetrationId: "pen-b-01",
    fromInternalCode: "0438",
    toInternalCode: "0451",
    reason: "closer rating",
    createdBy: "demo-leader",
    idempotencyKey: "proposal-1",
    ...overrides,
  };
}

const shortageRow = {
  id: "11111111-1111-4111-8111-111111111111",
  site_id: "site-b",
  shortage_id: "site-b:MAT-SEALANT",
  kind: "wait",
  escalate_to: null,
  note: "quote' OR 1=1",
  shortfall_qty_at_time: "2.5",
  created_by: "demo-leader",
  created_at: new Date("2026-10-03T12:00:00.000Z"),
  idempotency_key: "key-1",
};

const proposalRow = {
  id: "22222222-2222-4222-8222-222222222222",
  site_id: "site-b",
  penetration_id: "pen-b-01",
  from_internal_code: "0438",
  to_internal_code: "0451",
  reason: "closer rating",
  status: "proposed",
  created_by: "demo-leader",
  created_at: new Date("2026-10-03T12:00:05.000Z"),
  idempotency_key: "proposal-1",
};

describe("pg actions store", () => {
  it("uses parameterised SQL with no name, converts timestamptz, and orders newest first", async () => {
    const { pool, calls } = fakePool(async (text) => {
      if (text.includes("substitution_proposal") && text.includes("insert")) return { rows: [proposalRow] };
      if (text.includes("shortage_action") && text.includes("insert")) return { rows: [shortageRow] };
      if (text.includes("substitution_proposal")) return { rows: [proposalRow] };
      return { rows: [shortageRow] };
    });
    const repo = createActionsRepository(createPgActionsStore(pool));
    const saved = await repo.appendShortageAction(actionInput());
    const proposal = await repo.appendSubstitutionProposal(proposalInput());
    await repo.listShortageActions("site-b");
    await repo.listSubstitutionProposals("site-b");

    expect(saved.created).toBe(true);
    expect(saved.record.createdAt).toBe("2026-10-03T12:00:00.000Z");
    expect(saved.record.shortfallQtyAtTime).toBe(2.5);
    expect(proposal.created).toBe(true);
    expect(proposal.record.createdAt).toBe("2026-10-03T12:00:05.000Z");
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((call) => call.named === false)).toBe(true);
    for (const call of calls) {
      expect(call.text).toMatch(/\$\d+/);
      expect(call.text).not.toContain("quote' OR 1=1");
      expect(call.text).not.toContain("demo-leader");
    }
    const shortageInsert = calls.find((call) => call.text.includes("shortage_action") && call.text.includes("insert"));
    expect(shortageInsert?.values).toEqual([
      "site-b",
      "site-b:MAT-SEALANT",
      "wait",
      null,
      "quote' OR 1=1",
      2.5,
      "demo-leader",
      "key-1",
    ]);
    const proposalInsert = calls.find((call) => call.text.includes("substitution_proposal") && call.text.includes("insert"));
    expect(proposalInsert?.values).toEqual(["site-b", "pen-b-01", "0438", "0451", "closer rating", "proposed", "demo-leader", "proposal-1"]);
    const lists = calls.filter((call) => call.text.toLowerCase().includes("order by"));
    expect(lists).toHaveLength(2);
    for (const call of lists) {
      expect(call.text.toLowerCase()).toContain("order by created_at desc, id desc");
      expect(call.values).toEqual(["site-b"]);
    }
  });

  it("AC 16: a unique violation returns the existing row with created false", async () => {
    const driver = Object.assign(new Error(DRIVER_TEXT), { code: "23505" });
    let inserted = false;
    const { pool, calls } = fakePool(async (text) => {
      if (!inserted && text.includes("insert")) {
        inserted = true;
        throw driver;
      }
      return { rows: [shortageRow] };
    });
    const repo = createActionsRepository(createPgActionsStore(pool));
    const saved = await repo.appendShortageAction(actionInput());
    expect(saved.created).toBe(false);
    expect(saved.record.id).toBe(shortageRow.id);
    expect(saved.record.createdAt).toBe("2026-10-03T12:00:00.000Z");
    expect(calls.map((call) => call.text.toLowerCase().includes("insert"))).toEqual([true, false]);
    const select = calls[1];
    expect(select?.text.toLowerCase()).toContain("created_by = $1");
    expect(select?.text.toLowerCase()).toContain("idempotency_key = $2");
    expect(select?.values).toEqual(["demo-leader", "key-1"]);
    expect(JSON.stringify(saved.record)).not.toContain("SECRET-DRIVER-TEXT");
    expect(JSON.stringify(saved.record)).not.toContain("db-password-marker");
  });

  it("turns other driver failures into upstream_unavailable without driver text", async () => {
    const driver = Object.assign(new Error(DRIVER_TEXT), { code: "08006" });
    const { pool } = fakePool(async () => {
      throw driver;
    });
    const repo = createActionsRepository(createPgActionsStore(pool));
    await expect(repo.appendShortageAction(actionInput())).rejects.toMatchObject({
      name: "UpstreamError",
      code: "upstream_unavailable",
      system: "actions_store",
    });
    await expect(repo.appendSubstitutionProposal(proposalInput())).rejects.toBeInstanceOf(UpstreamError);
    try {
      await repo.listShortageActions("site-b");
    } catch (error) {
      expect(error).toBeInstanceOf(UpstreamError);
      expect(String(error)).not.toContain("SECRET-DRIVER-TEXT");
      expect(String(error)).not.toContain("db-password-marker");
      expect(String(error)).not.toContain("08006");
    }
  });
});
