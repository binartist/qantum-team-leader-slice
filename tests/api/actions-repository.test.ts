import { describe, expect, it } from "vitest";
import { createMemoryActionsRepository } from "@/adapters/memory/actions-repository";
import {
  createActionsRepository,
  shortageActionFromRow,
  shortageActionToInsert,
  substitutionProposalFromRow,
  substitutionProposalToInsert,
  type ActionsStore,
} from "@/adapters/postgres/repository";
import { UpstreamError, type ActionsRepository, type NewShortageAction, type NewSubstitutionProposal } from "@/ports";

function actionInput(overrides: Partial<NewShortageAction> = {}): NewShortageAction {
  return {
    siteId: "site-b",
    shortageId: "site-b:MAT-SEALANT",
    kind: "wait",
    escalateTo: null,
    note: "first note",
    shortfallQtyAtTime: 2,
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

type ContractCase = (name: string, fn: () => Promise<void>) => void;

export function actionsRepositoryContract(factory: () => ActionsRepository, test: ContractCase = it): void {
  test("AC 16: a repeat with the same key returns the original and creates no second row", async () => {
    const repo = factory();
    const first = await repo.appendShortageAction(actionInput());
    const repeat = await repo.appendShortageAction(actionInput({ note: "different note", shortfallQtyAtTime: 9 }));
    expect(first.created).toBe(true);
    expect(repeat.created).toBe(false);
    expect(repeat.record).toEqual(first.record);
    expect(repeat.record.note).toBe("first note");
    const listed = await repo.listShortageActions("site-b");
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(first.record);
  });

  test("AC 16: the same key for a different user creates a new record", async () => {
    const repo = factory();
    const first = await repo.appendShortageAction(actionInput());
    const other = await repo.appendShortageAction(actionInput({ createdBy: "other-leader", note: "other" }));
    expect(other.created).toBe(true);
    expect(other.record.id).not.toBe(first.record.id);
    expect(other.record.createdBy).toBe("other-leader");
    expect(await repo.listShortageActions("site-b")).toHaveLength(2);
  });

  test("lists actions and proposals newest first and keeps proposal repeats on the original row", async () => {
    const repo = factory();
    const older = await repo.appendShortageAction(actionInput({ idempotencyKey: "older" }));
    const newer = await repo.appendShortageAction(actionInput({ idempotencyKey: "newer", kind: "escalate", escalateTo: "purchasing" }));
    expect((await repo.listShortageActions("site-b")).map((item) => item.id)).toEqual([newer.record.id, older.record.id]);
    expect(await repo.listShortageActions("site-a")).toEqual([]);

    const olderProposal = await repo.appendSubstitutionProposal(proposalInput({ idempotencyKey: "proposal-older" }));
    const newerProposal = await repo.appendSubstitutionProposal(
      proposalInput({ idempotencyKey: "proposal-newer", penetrationId: "pen-b-02", reason: "second" }),
    );
    expect(olderProposal.record.status).toBe("proposed");
    expect((await repo.listSubstitutionProposals("site-b")).map((item) => item.id)).toEqual([
      newerProposal.record.id,
      olderProposal.record.id,
    ]);
    expect(await repo.listSubstitutionProposals("site-a")).toEqual([]);
    const repeat = await repo.appendSubstitutionProposal(
      proposalInput({ idempotencyKey: "proposal-older", reason: "a different reason" }),
    );
    expect(repeat).toEqual({ record: olderProposal.record, created: false });
  });

  test("the same key against another shortage or site returns the original and creates nothing", async () => {
    const repo = factory();
    const first = await repo.appendShortageAction(actionInput());
    const otherShortage = await repo.appendShortageAction(actionInput({ shortageId: "site-b:MAT-COLLAR-25", note: "collar" }));
    expect(otherShortage).toEqual({ record: first.record, created: false });
    const otherSite = await repo.appendShortageAction(
      actionInput({ siteId: "site-a", shortageId: "site-a:MAT-SEALANT", note: "other site" }),
    );
    expect(otherSite).toEqual({ record: first.record, created: false });
    expect(await repo.listShortageActions("site-b")).toEqual([first.record]);
    expect(await repo.listShortageActions("site-a")).toEqual([]);
  });

  test("the same key for a different user creates a new proposal", async () => {
    const repo = factory();
    const first = await repo.appendSubstitutionProposal(proposalInput());
    const other = await repo.appendSubstitutionProposal(proposalInput({ createdBy: "other-leader", reason: "other reason" }));
    expect(other.created).toBe(true);
    expect(other.record.id).not.toBe(first.record.id);
    expect(other.record.createdBy).toBe("other-leader");
    expect(other.record.reason).toBe("other reason");
    expect(await repo.listSubstitutionProposals("site-b")).toHaveLength(2);
  });
}

function tickingClock(): () => Date {
  let tick = Date.parse("2026-10-03T12:00:00.000Z");
  return () => new Date((tick += 1000));
}

function memoryRepository(now: () => Date = tickingClock()): ActionsRepository {
  let count = 0;
  return createMemoryActionsRepository({
    now,
    newId: () => `mem-${++count}`,
  });
}

describe("in-memory actions repository", () => {
  actionsRepositoryContract(() => memoryRepository());

  it("lists the later insert first when the clock is frozen", async () => {
    const repo = memoryRepository(() => new Date("2026-10-03T12:00:00.000Z"));
    const older = await repo.appendShortageAction(actionInput({ idempotencyKey: "older" }));
    const newer = await repo.appendShortageAction(actionInput({ idempotencyKey: "newer" }));
    expect((await repo.listShortageActions("site-b")).map((item) => item.id)).toEqual([newer.record.id, older.record.id]);
  });

  it("keeps one row when two same-key writes run together", async () => {
    const repo = memoryRepository(() => new Date("2026-10-03T12:00:00.000Z"));
    const [first, second] = await Promise.all([
      repo.appendShortageAction(actionInput()),
      repo.appendShortageAction(actionInput({ note: "other" })),
    ]);
    expect([first, second].filter((result) => result.created)).toHaveLength(1);
    expect(first.record.id).toBe(second.record.id);
    expect(await repo.listShortageActions("site-b")).toHaveLength(1);
  });

  it("finds a stored action or proposal only for that user and key", async () => {
    const repo = memoryRepository(() => new Date("2026-10-03T12:00:00.000Z"));
    expect(await repo.findShortageActionByKey("demo-leader", "key-1")).toBeNull();
    const saved = await repo.appendShortageAction(actionInput());
    expect(await repo.findShortageActionByKey("demo-leader", "key-1")).toEqual(saved.record);
    expect(await repo.findShortageActionByKey("other-leader", "key-1")).toBeNull();
    expect(await repo.findSubstitutionProposalByKey("demo-leader", "proposal-1")).toBeNull();
    const proposal = await repo.appendSubstitutionProposal(proposalInput());
    expect(await repo.findSubstitutionProposalByKey("demo-leader", "proposal-1")).toEqual(proposal.record);
    expect(await repo.findSubstitutionProposalByKey("other-leader", "proposal-1")).toBeNull();
  });
});

const actionRow = {
  id: "11111111-1111-4111-8111-111111111111",
  site_id: "site-b",
  shortage_id: "site-b:MAT-SEALANT",
  kind: "escalate",
  escalate_to: "purchasing",
  note: "order more",
  shortfall_qty_at_time: "2.0",
  created_by: "demo-leader",
  created_at: "2026-10-03T12:00:00+00:00",
  idempotency_key: "key-1",
  secret: "do-not-surface",
};

describe("actions repository mapping", () => {
  it("maps a shortage row, including a numeric string, and drops unknown fields", () => {
    expect(shortageActionFromRow(actionRow)).toEqual({
      id: actionRow.id,
      siteId: "site-b",
      shortageId: "site-b:MAT-SEALANT",
      kind: "escalate",
      escalateTo: "purchasing",
      note: "order more",
      shortfallQtyAtTime: 2,
      createdBy: "demo-leader",
      createdAt: "2026-10-03T12:00:00.000Z",
    });
    expect(shortageActionFromRow({ ...actionRow, shortfall_qty_at_time: null, kind: "wait", escalate_to: null }).shortfallQtyAtTime).toBeNull();
    expect(JSON.stringify(shortageActionFromRow(actionRow))).not.toContain("do-not-surface");
    expect(JSON.stringify(shortageActionFromRow(actionRow))).not.toContain("idempotency_key");
  });

  it("rejects a bad row without echoing its contents", () => {
    expect(() => shortageActionFromRow({ ...actionRow, kind: "wait" })).toThrow(UpstreamError);
    expect(() => shortageActionFromRow({ ...actionRow, shortfall_qty_at_time: -1 })).toThrow(UpstreamError);
    expect(() => shortageActionFromRow({ ...actionRow, note: "sql-leak", kind: "approved" })).toThrow(UpstreamError);
    try {
      shortageActionFromRow({ ...actionRow, note: "sql-leak", kind: "approved" });
    } catch (error) {
      expect(String(error)).not.toContain("sql-leak");
      expect(String(error)).not.toContain("approved");
    }
  });

  it("maps a proposal row and refuses an approved status", () => {
    const row = {
      id: "22222222-2222-4222-8222-222222222222",
      site_id: "site-b",
      penetration_id: "pen-b-01",
      from_internal_code: "0438",
      to_internal_code: "0451",
      reason: "closer rating",
      status: "proposed",
      created_by: "demo-leader",
      created_at: "2026-10-03T12:00:00.000Z",
      idempotency_key: "proposal-1",
    };
    const record = substitutionProposalFromRow(row);
    expect(record.status).toBe("proposed");
    expect(record.reason).toBe("closer rating");
    expect(() => substitutionProposalFromRow({ ...row, status: "approved" })).toThrow(UpstreamError);
    expect(() => substitutionProposalFromRow({ ...row, from_internal_code: "0451", to_internal_code: "0451" })).toThrow(UpstreamError);
  });

  it("builds insert rows in the migration's column names and always sets proposed", () => {
    expect(shortageActionToInsert(actionInput())).toEqual({
      site_id: "site-b",
      shortage_id: "site-b:MAT-SEALANT",
      kind: "wait",
      escalate_to: null,
      note: "first note",
      shortfall_qty_at_time: 2,
      created_by: "demo-leader",
      idempotency_key: "key-1",
    });
    expect(substitutionProposalToInsert(proposalInput()).status).toBe("proposed");
  });

  it("returns the existing row on unique violation and hides other client errors", async () => {
    const calls: string[] = [];
    const store: ActionsStore = {
      async insertShortageAction() {
        calls.push("insert");
        return { data: null, error: { code: "23505" } };
      },
      async selectShortageActionByKey() {
        calls.push("select");
        return { data: actionRow, error: null };
      },
      async listShortageActions() {
        return { data: [actionRow], error: null };
      },
      async insertSubstitutionProposal() {
        return { data: null, error: { code: "42501" } };
      },
      async selectSubstitutionProposalByKey() {
        throw new Error("select should not run");
      },
      async listSubstitutionProposals() {
        return { data: null, error: { code: "XX000" } };
      },
    };
    const repo = createActionsRepository(store);
    const saved = await repo.appendShortageAction(actionInput());
    expect(calls).toEqual(["insert", "select"]);
    expect(saved.created).toBe(false);
    expect(saved.record.id).toBe(actionRow.id);

    await expect(repo.appendSubstitutionProposal(proposalInput())).rejects.toMatchObject({
      code: "upstream_unavailable",
      system: "actions_store",
    });
    await expect(repo.listSubstitutionProposals("site-b")).rejects.toBeInstanceOf(UpstreamError);
  });

  it("honours select arguments, replays a proposal unique violation, and reports a real insert as created", async () => {
    const selects: { table: string; createdBy: string; idempotencyKey: string }[] = [];
    const proposalRow = {
      id: "22222222-2222-4222-8222-222222222222",
      site_id: "site-b",
      penetration_id: "pen-b-01",
      from_internal_code: "0438",
      to_internal_code: "0451",
      reason: "closer rating",
      status: "proposed",
      created_by: "demo-leader",
      created_at: "2026-10-03T12:00:00.000Z",
      idempotency_key: "proposal-1",
    };
    const store: ActionsStore = {
      async insertShortageAction() {
        return { data: actionRow, error: null };
      },
      async selectShortageActionByKey(createdBy, idempotencyKey) {
        selects.push({ table: "shortage", createdBy, idempotencyKey });
        if (createdBy === "demo-leader" && idempotencyKey === "key-1") return { data: actionRow, error: null };
        return { data: null, error: null };
      },
      async listShortageActions(siteId) {
        return { data: siteId === "site-b" ? [actionRow] : [], error: null };
      },
      async insertSubstitutionProposal() {
        return { data: null, error: { code: "23505" } };
      },
      async selectSubstitutionProposalByKey(createdBy, idempotencyKey) {
        selects.push({ table: "proposal", createdBy, idempotencyKey });
        if (createdBy === "demo-leader" && idempotencyKey === "proposal-1") return { data: proposalRow, error: null };
        return { data: null, error: null };
      },
      async listSubstitutionProposals(siteId) {
        return { data: siteId === "site-b" ? [proposalRow] : [], error: null };
      },
    };
    const repo = createActionsRepository(store);
    const inserted = await repo.appendShortageAction(actionInput());
    expect(inserted.created).toBe(true);
    expect(inserted.record.id).toBe(actionRow.id);

    const replayed = await repo.appendSubstitutionProposal(proposalInput());
    expect(replayed.created).toBe(false);
    expect(replayed.record).toMatchObject({ id: proposalRow.id, reason: "closer rating" });
    expect(selects).toContainEqual({ table: "proposal", createdBy: "demo-leader", idempotencyKey: "proposal-1" });

    expect(await repo.findShortageActionByKey("demo-leader", "key-1")).toMatchObject({ id: actionRow.id });
    expect(await repo.findShortageActionByKey("other-leader", "missing")).toBeNull();
    expect(await repo.findSubstitutionProposalByKey("demo-leader", "proposal-1")).toMatchObject({ id: proposalRow.id });
    expect(selects).toEqual([
      { table: "proposal", createdBy: "demo-leader", idempotencyKey: "proposal-1" },
      { table: "shortage", createdBy: "demo-leader", idempotencyKey: "key-1" },
      { table: "shortage", createdBy: "other-leader", idempotencyKey: "missing" },
      { table: "proposal", createdBy: "demo-leader", idempotencyKey: "proposal-1" },
    ]);
  });
});
