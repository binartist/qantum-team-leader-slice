import { describe, expect, it } from "vitest";
import {
  buildCatalogue,
  computeSiteReadiness,
  type Penetration,
  type RawCatalogueRow,
  type ReadinessInput,
  type ShortageAction,
  type SolutionMaterial,
  type StockBalance,
} from "@/domain";

const AS_OF = "2026-10-03T12:00:00.000Z";

function row(code: string): RawCatalogueRow {
  return {
    "Internal Code": code,
    "Supplier Ref. Code": `ref-${code}`,
    Supplier: "Ryanfire",
    Orientation: "Wall",
    Substrate: "FR plasterboard, FR plasterboard wall (1 layer 13mm)",
    "Service Classification": "Combustible Pipe",
    "Service Type": "PEX Pipe",
    "Service Size": "Ø25mm",
    Integrity: "60",
    Insulation: "30",
    "Service Type Option": "PEX Pipe",
    "Substrate Option": "Plasterboard Wall",
  };
}

const catalogue = buildCatalogue([row("S1"), row("S2"), row("BARE")]);

function openBlocker(
  reason: "unknown_solution_code" | "no_material_mapping" | "invalid_quantity" | "solution_mismatch",
  penetrationId: string,
  internalCode: string,
  siteId = "site-a",
) {
  return {
    id: `${siteId}:blocker.${penetrationId}`,
    reason,
    penetrationId,
    internalCode,
    state: "open" as const,
    actions: [],
  };
}

function penetration(partial: Partial<Penetration> & Pick<Penetration, "id">): Penetration {
  return {
    siteId: "site-a",
    orientation: "Wall",
    substrateDetail: "FR plasterboard, FR plasterboard wall (1 layer 13mm)",
    serviceType: "PEX Pipe",
    serviceSize: "Ø25mm",
    requiredIntegrityMinutes: 60,
    requiredInsulationMinutes: 30,
    nominatedCode: "S1",
    ...partial,
  };
}

function action(partial: Partial<ShortageAction> & Pick<ShortageAction, "id" | "createdAt" | "kind">): ShortageAction {
  return {
    siteId: "site-a",
    shortageId: "site-a:M",
    escalateTo: null,
    note: null,
    shortfallQtyAtTime: 5,
    createdBy: "leader",
    ...partial,
  };
}

function input(partial: Partial<ReadinessInput> & Pick<ReadinessInput, "penetrations">): ReadinessInput {
  return {
    siteId: "site-a",
    catalogue,
    solutionMaterials: [],
    stock: [],
    actions: [],
    asOf: AS_OF,
    ...partial,
  };
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  if (value instanceof Map) {
    for (const entry of value.values()) deepFreeze(entry);
  }
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
}

function readiness(raw: ReadinessInput) {
  const snapshot = structuredClone(raw);
  deepFreeze(raw);
  const result = computeSiteReadiness(raw);
  expect(raw).toEqual(snapshot);
  return result;
}

describe("computeSiteReadiness shortage maths", () => {
  it("AC 1: 12 and 8 of M with 15 on hand shows required 20, on hand 15, shortfall 5, and blocked", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1", nominatedCode: "S1" }), penetration({ id: "p2", nominatedCode: "S2" })],
        solutionMaterials: [
          { internalCode: "S1", materialId: "M", quantityPerInstall: 12 },
          { internalCode: "S2", materialId: "M", quantityPerInstall: 8 },
        ],
        stock: [{ materialId: "M", location: "warehouse", quantity: 15 }],
      }),
    );
    expect(result.crewStatus).toBe("blocked");
    expect(result.blockers).toEqual([]);
    expect(result.shortages).toEqual([
      expect.objectContaining({
        id: "site-a:M",
        siteId: "site-a",
        materialId: "M",
        kind: "short",
        requiredQty: 20,
        onHandQty: 15,
        shortfallQty: 5,
        penetrationIds: ["p1", "p2"],
        state: "open",
      }),
    ]);
    expect(result.asOf).toBe(AS_OF);
  });

  it("AC 2: a site whose materials are covered is clear", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 15 }],
        stock: [{ materialId: "M", location: "warehouse", quantity: 15 }],
      }),
    );
    expect(result.crewStatus).toBe("clear");
    expect(result.shortages).toEqual([]);
    expect(result.blockers).toEqual([]);
  });

  it("an exact extra unit on hand is clear, and one unit short is a shortage", () => {
    const materials: SolutionMaterial[] = [{ internalCode: "S1", materialId: "M", quantityPerInstall: 15 }];
    const covered = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: materials,
        stock: [{ materialId: "M", location: "warehouse", quantity: 16 }],
      }),
    );
    const short = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: materials,
        stock: [{ materialId: "M", location: "warehouse", quantity: 14 }],
      }),
    );
    expect(covered.crewStatus).toBe("clear");
    expect(short.shortages[0]).toEqual(expect.objectContaining({ requiredQty: 15, onHandQty: 14, shortfallQty: 1, kind: "short" }));
  });

  it("AC 3: stock in two locations of 6 and 9 is on hand 15", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 20 }],
        stock: [
          { materialId: "M", location: "warehouse", quantity: 6 },
          { materialId: "M", location: "van", quantity: 9 },
        ],
      }),
    );
    expect(result.shortages[0]).toEqual(expect.objectContaining({ onHandQty: 15, requiredQty: 20, shortfallQty: 5 }));
  });

  it("AC 4: a fractional requirement of 2.2 rounds up to 3 after the quantities are summed", () => {
    const summed = readiness(
      input({
        penetrations: [penetration({ id: "p1" }), penetration({ id: "p2" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 1.1 }],
        stock: [{ materialId: "M", location: "warehouse", quantity: 0 }],
      }),
    );
    const single = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 2.2 }],
        stock: [{ materialId: "M", location: "warehouse", quantity: 0 }],
      }),
    );
    const dust = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 1.0000001 }],
        stock: [{ materialId: "M", location: "warehouse", quantity: 0 }],
      }),
    );
    expect(summed.shortages[0]?.requiredQty).toBe(3);
    expect(single.shortages[0]?.requiredQty).toBe(3);
    expect(dust.shortages[0]?.requiredQty).toBe(1);
  });

  it("a stock row of zero is on hand zero, not an unknown shortage", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 3 }],
        stock: [{ materialId: "M", location: "warehouse", quantity: 0 }],
      }),
    );
    expect(result.shortages[0]).toEqual(expect.objectContaining({ kind: "short", onHandQty: 0, shortfallQty: 3, requiredQty: 3 }));
  });

  it("AC 5: a material with no stock record is an unknown shortage with null quantities", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [
          { internalCode: "S1", materialId: "M", quantityPerInstall: 4 },
          { internalCode: "S1", materialId: "other", quantityPerInstall: 1 },
        ],
        stock: [{ materialId: "other", location: "warehouse", quantity: 9 }],
      }),
    );
    expect(result.crewStatus).toBe("blocked");
    expect(result.shortages).toHaveLength(1);
    expect(result.shortages[0]).toEqual(
      expect.objectContaining({
        id: "site-a:M",
        kind: "unknown",
        requiredQty: 4,
        onHandQty: null,
        shortfallQty: null,
        penetrationIds: ["p1"],
        state: "open",
      }),
    );
  });

  it("AC 5: wait and escalate recorded against an unknown shortage stay current", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 4 }],
        actions: [
          action({
            id: "wait",
            createdAt: "2026-10-01T00:00:00.000Z",
            kind: "wait",
            shortfallQtyAtTime: null,
          }),
          action({
            id: "escalate",
            createdAt: "2026-10-02T00:00:00.000Z",
            kind: "escalate",
            escalateTo: "warehouse",
            shortfallQtyAtTime: null,
          }),
        ],
      }),
    );
    expect(result.crewStatus).toBe("blocked");
    expect(result.shortages[0]?.state).toBe("escalated");
    expect(result.shortages[0]?.actions.map((item) => ({ id: item.id, current: item.current }))).toEqual([
      { id: "escalate", current: true },
      { id: "wait", current: true },
    ]);
  });
});

describe("computeSiteReadiness blockers and crew status", () => {
  it("AC 6: an unknown nominated code is a blocker and the crew is blocked", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p-missing", nominatedCode: "NO-SUCH" })],
        solutionMaterials: [{ internalCode: "NO-SUCH", materialId: "M", quantityPerInstall: 9 }],
        stock: [],
      }),
    );
    expect(result.blockers).toEqual([openBlocker("unknown_solution_code", "p-missing", "NO-SUCH")]);
    expect(result.shortages).toEqual([]);
    expect(result.crewStatus).toBe("blocked");
  });

  it("AC 7: a nominated code with no material mapping is a blocker and the crew is blocked", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p-bare", nominatedCode: "BARE" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 9 }],
        stock: [{ materialId: "M", location: "warehouse", quantity: 100 }],
      }),
    );
    expect(result.blockers).toEqual([openBlocker("no_material_mapping", "p-bare", "BARE")]);
    expect(result.shortages).toEqual([]);
    expect(result.crewStatus).toBe("blocked");
  });

  it("lists both blocker reasons in penetration order and ignores the blocked penetrations' materials", () => {
    const result = readiness(
      input({
        penetrations: [
          penetration({ id: "p-missing", nominatedCode: "NO-SUCH" }),
          penetration({ id: "p-ok" }),
          penetration({ id: "p-bare", nominatedCode: "BARE" }),
        ],
        solutionMaterials: [{ internalCode: "S1", materialId: "sealant", quantityPerInstall: 2 }],
        stock: [{ materialId: "sealant", location: "warehouse", quantity: 0 }],
      }),
    );
    expect(result.blockers.map((blocker) => blocker.reason)).toEqual(["unknown_solution_code", "no_material_mapping"]);
    expect(result.blockers.map((blocker) => blocker.penetrationId)).toEqual(["p-missing", "p-bare"]);
    expect(result.shortages.map((shortage) => shortage.materialId)).toEqual(["sealant"]);
    expect(result.shortages[0]?.penetrationIds).toEqual(["p-ok"]);
    expect(result.crewStatus).toBe("blocked");
  });

  it("AC 35: a nominated solution below the penetration's rating is a solution_mismatch blocker that adds no need", () => {
    const result = computeSiteReadiness(
      input({
        penetrations: [penetration({ id: "p1", requiredInsulationMinutes: 90 }), penetration({ id: "p2" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 4 }],
        stock: [{ materialId: "M", location: "W", quantity: 4 }],
      }),
    );
    expect(result.blockers).toEqual([{ ...openBlocker("solution_mismatch", "p1", "S1"), mismatches: ["insulation"] }]);
    // Only p2 counts towards M, so 4 on hand covers it and there is no shortage.
    expect(result.shortages).toEqual([]);
    expect(result.crewStatus).toBe("blocked");
  });

  it("AC 35: an unknown code is reported before a mismatch, and a mismatch before a missing mapping", () => {
    const result = computeSiteReadiness(
      input({
        penetrations: [
          penetration({ id: "p1", nominatedCode: "NOPE", requiredInsulationMinutes: 90 }),
          penetration({ id: "p2", nominatedCode: "BARE", requiredInsulationMinutes: 90 }),
        ],
      }),
    );
    expect(result.blockers.map((blocker) => [blocker.penetrationId, blocker.reason])).toEqual([
      ["p1", "unknown_solution_code"],
      ["p2", "solution_mismatch"],
    ]);
  });

  it("AC 35: a mismatch is reported before an invalid quantity, and keeps its fields", () => {
    const result = computeSiteReadiness(
      input({
        penetrations: [penetration({ id: "p1", requiredInsulationMinutes: 90 })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: Number.NaN }],
      }),
    );
    expect(result.blockers).toEqual([{ ...openBlocker("solution_mismatch", "p1", "S1"), mismatches: ["insulation"] }]);
    expect(result.shortages).toEqual([]);
  });

  it("AC 35: a requirement that is not a usable number blocks the crew and adds no need", () => {
    const result = computeSiteReadiness(
      input({
        penetrations: [penetration({ id: "p1", requiredIntegrityMinutes: Number.NaN })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 1 }],
        stock: [],
      }),
    );
    expect(result.blockers).toEqual([{ ...openBlocker("solution_mismatch", "p1", "S1"), mismatches: ["integrity"] }]);
    expect(result.shortages).toEqual([]);
    expect(result.crewStatus).toBe("blocked");
  });

  it("an escalation on a blocker makes it escalated and the crew stays blocked", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p-missing", nominatedCode: "NO-SUCH" })],
        actions: [
          action({
            id: "escalate",
            createdAt: "2026-10-02T00:00:00.000Z",
            kind: "escalate",
            escalateTo: "purchasing",
            shortageId: "site-a:blocker.p-missing",
            shortfallQtyAtTime: null,
            note: "missing code",
          }),
        ],
      }),
    );
    expect(result.crewStatus).toBe("blocked");
    expect(result.shortages).toEqual([]);
    expect(result.blockers).toEqual([
      {
        ...openBlocker("unknown_solution_code", "p-missing", "NO-SUCH"),
        state: "escalated",
        actions: [
          expect.objectContaining({
            id: "escalate",
            kind: "escalate",
            current: true,
            shortfallQtyAtTime: null,
            shortageId: "site-a:blocker.p-missing",
          }),
        ],
      },
    ]);
  });

  it("an action for another site does not attach to a blocker", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p-missing", nominatedCode: "NO-SUCH" })],
        actions: [
          action({
            id: "elsewhere",
            createdAt: "2026-10-02T00:00:00.000Z",
            kind: "escalate",
            escalateTo: "warehouse",
            siteId: "site-b",
            shortageId: "site-a:blocker.p-missing",
            shortfallQtyAtTime: null,
          }),
        ],
      }),
    );
    expect(result.blockers).toEqual([openBlocker("unknown_solution_code", "p-missing", "NO-SUCH")]);
    expect(result.crewStatus).toBe("blocked");
  });

  it("a blocker action with a recorded shortfall is not current", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p-missing", nominatedCode: "NO-SUCH" })],
        actions: [
          action({
            id: "numbered",
            createdAt: "2026-10-02T00:00:00.000Z",
            kind: "escalate",
            escalateTo: "purchasing",
            shortageId: "site-a:blocker.p-missing",
            shortfallQtyAtTime: 1,
          }),
        ],
      }),
    );
    expect(result.blockers[0]?.state).toBe("open");
    expect(result.blockers[0]?.actions).toEqual([expect.objectContaining({ id: "numbered", current: false })]);
  });

  it("AC 8: a site with no penetrations is nothing_planned", () => {
    const result = readiness(input({ penetrations: [] }));
    expect(result.crewStatus).toBe("nothing_planned");
    expect(result.shortages).toEqual([]);
    expect(result.blockers).toEqual([]);
  });

  it("AC 8: penetrations for other sites do not count", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "other", siteId: "site-b" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 50 }],
        stock: [],
        actions: [action({ id: "foreign", createdAt: "2026-10-01T00:00:00.000Z", kind: "wait", siteId: "site-b", shortageId: "site-b:M" })],
      }),
    );
    expect(result.crewStatus).toBe("nothing_planned");
    expect(result.shortages).toEqual([]);
    expect(result.blockers).toEqual([]);
  });

  it("AC 10: two sites that each need 10 of M with 15 on hand are each clear", () => {
    const shared: StockBalance[] = [{ materialId: "M", location: "warehouse", quantity: 15 }];
    const materials: SolutionMaterial[] = [{ internalCode: "S1", materialId: "M", quantityPerInstall: 10 }];
    const siteA = readiness(
      input({
        siteId: "site-a",
        penetrations: [penetration({ id: "a", siteId: "site-a" })],
        solutionMaterials: materials,
        stock: shared,
      }),
    );
    const siteB = readiness(
      input({
        siteId: "site-b",
        penetrations: [penetration({ id: "b", siteId: "site-b" })],
        solutionMaterials: materials,
        stock: shared,
      }),
    );
    expect(siteA.crewStatus).toBe("clear");
    expect(siteB.crewStatus).toBe("clear");
    expect(siteA.shortages).toEqual([]);
    expect(siteB.shortages).toEqual([]);
  });

  it("sorts shortages by material id and sums every material on a penetration", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [
          { internalCode: "S1", materialId: "wrap", quantityPerInstall: 2 },
          { internalCode: "S1", materialId: "board", quantityPerInstall: 1 },
          { internalCode: "S1", materialId: "wrap", quantityPerInstall: 0.2 },
        ],
        stock: [
          { materialId: "wrap", location: "warehouse", quantity: 0 },
          { materialId: "board", location: "van", quantity: 0 },
        ],
      }),
    );
    expect(result.shortages.map((shortage) => shortage.materialId)).toEqual(["board", "wrap"]);
    expect(result.shortages[1]).toEqual(expect.objectContaining({ requiredQty: 3, penetrationIds: ["p1"] }));
  });
});

describe("computeSiteReadiness action lifecycle", () => {
  const materials: SolutionMaterial[] = [{ internalCode: "S1", materialId: "M", quantityPerInstall: 13 }];
  const stock: StockBalance[] = [{ materialId: "M", location: "warehouse", quantity: 5 }];

  it("AC 14: escalate then wait stays escalated, lists both, and the crew stays blocked", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: materials,
        stock,
        actions: [
          action({ id: "escalate", createdAt: "2026-10-01T00:00:00.000Z", kind: "escalate", escalateTo: "purchasing", note: "order more", shortfallQtyAtTime: 8 }),
          action({ id: "wait", createdAt: "2026-10-02T00:00:00.000Z", kind: "wait", note: "due Friday", shortfallQtyAtTime: 8 }),
        ],
      }),
    );
    expect(result.crewStatus).toBe("blocked");
    expect(result.shortages[0]?.shortfallQty).toBe(8);
    expect(result.shortages[0]?.state).toBe("escalated");
    expect(result.shortages[0]?.actions.map((item) => item.kind)).toEqual(["wait", "escalate"]);
    expect(result.shortages[0]?.actions.every((item) => item.current)).toBe(true);
  });

  it("AC 15: an action recorded at shortfall 5 is not current at 8, so the state is open", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: materials,
        stock,
        actions: [
          action({ id: "old", createdAt: "2026-10-01T00:00:00.000Z", kind: "wait", shortfallQtyAtTime: 5 }),
          action({
            id: "other-site",
            createdAt: "2026-10-03T00:00:00.000Z",
            kind: "escalate",
            escalateTo: "purchasing",
            siteId: "site-b",
            shortageId: "site-a:M",
            shortfallQtyAtTime: 8,
          }),
          action({
            id: "other-shortage",
            createdAt: "2026-10-03T00:00:00.000Z",
            kind: "escalate",
            escalateTo: "warehouse",
            shortageId: "site-a:other",
            shortfallQtyAtTime: 8,
          }),
        ],
      }),
    );
    expect(result.crewStatus).toBe("blocked");
    expect(result.shortages[0]?.state).toBe("open");
    expect(result.shortages[0]?.actions).toEqual([
      expect.objectContaining({ id: "old", current: false, shortfallQtyAtTime: 5 }),
    ]);
  });

  it("AC 15: an action recorded against unknown stock is not current once the shortfall is known", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: materials,
        stock,
        actions: [action({ id: "was-unknown", createdAt: "2026-10-01T00:00:00.000Z", kind: "escalate", escalateTo: "warehouse", shortfallQtyAtTime: null })],
      }),
    );
    expect(result.shortages[0]?.state).toBe("open");
    expect(result.shortages[0]?.actions[0]?.current).toBe(false);
  });

  it("AC 14: a wait with no escalation leaves the shortage waiting and the crew blocked", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 10 }],
        stock: [{ materialId: "M", location: "warehouse", quantity: 0 }],
        actions: [action({ id: "wait", createdAt: "2026-10-02T00:00:00.000Z", kind: "wait", shortfallQtyAtTime: 10 })],
      }),
    );
    expect(result.shortages[0]?.state).toBe("waiting");
    expect(result.crewStatus).toBe("blocked");
  });

  it("AC 15: an action recorded at 5 is not current when the shortfall is 6", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 6 }],
        stock: [{ materialId: "M", location: "warehouse", quantity: 0 }],
        actions: [
          action({
            id: "recorded",
            createdAt: "2026-10-01T00:00:00.000Z",
            kind: "escalate",
            escalateTo: "purchasing",
            shortfallQtyAtTime: 5,
          }),
        ],
      }),
    );
    expect(result.shortages[0]).toEqual(expect.objectContaining({ shortfallQty: 6, state: "open" }));
    expect(result.shortages[0]?.actions[0]?.current).toBe(false);
    expect(result.crewStatus).toBe("blocked");
  });

  it("AC 15: an action recorded at 5 is not current once the stock record disappears", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 5 }],
        stock: [],
        actions: [
          action({
            id: "was-known",
            createdAt: "2026-10-01T00:00:00.000Z",
            kind: "escalate",
            escalateTo: "warehouse",
            shortfallQtyAtTime: 5,
          }),
        ],
      }),
    );
    expect(result.shortages[0]?.kind).toBe("unknown");
    expect(result.shortages[0]?.state).toBe("open");
    expect(result.shortages[0]?.actions[0]?.current).toBe(false);
    expect(result.crewStatus).toBe("blocked");
  });
});

describe("fail-closed quantities", () => {
  it("rows of 10 and -10 do not clear the crew", () => {
    const result = readiness(
      input({
        penetrations: [
          penetration({ id: "needs", nominatedCode: "S1" }),
          penetration({ id: "credit", nominatedCode: "S2" }),
        ],
        solutionMaterials: [
          { internalCode: "S1", materialId: "M", quantityPerInstall: 10 },
          { internalCode: "S2", materialId: "M", quantityPerInstall: -10 },
        ],
        stock: [{ materialId: "M", location: "warehouse", quantity: 0 }],
      }),
    );
    expect(result.crewStatus).toBe("blocked");
    expect(result.blockers).toEqual([openBlocker("invalid_quantity", "credit", "S2")]);
    expect(result.shortages).toEqual([
      expect.objectContaining({
        materialId: "M",
        kind: "short",
        requiredQty: 10,
        onHandQty: 0,
        shortfallQty: 10,
        penetrationIds: ["needs"],
      }),
    ]);
  });

  it("rows of 0.4 and -0.5 do not clear the crew", () => {
    const result = readiness(
      input({
        penetrations: [
          penetration({ id: "needs", nominatedCode: "S1" }),
          penetration({ id: "credit", nominatedCode: "S2" }),
        ],
        solutionMaterials: [
          { internalCode: "S1", materialId: "M", quantityPerInstall: 0.4 },
          { internalCode: "S2", materialId: "M", quantityPerInstall: -0.5 },
        ],
        stock: [{ materialId: "M", location: "warehouse", quantity: 0 }],
      }),
    );
    expect(result.crewStatus).toBe("blocked");
    expect(result.blockers).toEqual([openBlocker("invalid_quantity", "credit", "S2")]);
    expect(result.shortages[0]).toEqual(expect.objectContaining({ requiredQty: 1, penetrationIds: ["needs"], kind: "short" }));
  });

  it.each([
    ["negative", -3],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ] as const)("a lone %s quantity is an invalid_quantity blocker and the crew is blocked", (_label, quantity) => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: quantity }],
        stock: [{ materialId: "M", location: "warehouse", quantity: 0 }],
      }),
    );
    expect(result.crewStatus).toBe("blocked");
    expect(result.blockers).toEqual([openBlocker("invalid_quantity", "p1", "S1")]);
    expect(result.shortages).toEqual([]);
  });

  it("a mapped code with one invalid quantity contributes no requirement", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1", nominatedCode: "S1" })],
        solutionMaterials: [
          { internalCode: "S1", materialId: "M", quantityPerInstall: 10 },
          { internalCode: "S1", materialId: "other", quantityPerInstall: -1 },
        ],
        stock: [{ materialId: "M", location: "warehouse", quantity: 0 }],
      }),
    );
    expect(result.blockers).toEqual([openBlocker("invalid_quantity", "p1", "S1")]);
    expect(result.shortages).toEqual([]);
    expect(result.crewStatus).toBe("blocked");
  });

  it("unknown code beats no mapping beats invalid quantity", () => {
    const result = readiness(
      input({
        penetrations: [
          penetration({ id: "p-unknown", nominatedCode: "NO-SUCH" }),
          penetration({ id: "p-bare", nominatedCode: "BARE" }),
          penetration({ id: "p-bad", nominatedCode: "S1" }),
        ],
        solutionMaterials: [
          { internalCode: "NO-SUCH", materialId: "M", quantityPerInstall: Number.NaN },
          { internalCode: "S1", materialId: "M", quantityPerInstall: -2 },
        ],
        stock: [],
      }),
    );
    expect(result.blockers).toEqual([
      openBlocker("unknown_solution_code", "p-unknown", "NO-SUCH"),
      openBlocker("no_material_mapping", "p-bare", "BARE"),
      openBlocker("invalid_quantity", "p-bad", "S1"),
    ]);
    expect(result.shortages).toEqual([]);
    expect(result.crewStatus).toBe("blocked");
  });

  it("throws RangeError when the required quantity is not finite", () => {
    const call = () =>
      readiness(
        input({
          penetrations: [penetration({ id: "p1" })],
          solutionMaterials: [
            { internalCode: "S1", materialId: "M", quantityPerInstall: 1e308 },
            { internalCode: "S1", materialId: "M", quantityPerInstall: 1e308 },
          ],
          stock: [{ materialId: "M", location: "warehouse", quantity: 0 }],
        }),
      );
    expect(call).toThrow(RangeError);
    expect(call).toThrow("required quantity is not finite");
  });

  it.each([
    ["Infinity", [{ materialId: "M", location: "warehouse", quantity: Number.POSITIVE_INFINITY }]],
    [
      "overflow",
      [
        { materialId: "M", location: "a", quantity: 1e308 },
        { materialId: "M", location: "b", quantity: 1e308 },
      ],
    ],
    ["NaN", [{ materialId: "M", location: "warehouse", quantity: Number.NaN }]],
    ["negative", [{ materialId: "M", location: "warehouse", quantity: -5 }]],
    ["snap-overflow", [{ materialId: "M", location: "warehouse", quantity: 1e308 }]],
  ] as const)("%s stock is unknown and the crew is blocked", (_label, stock) => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 5 }],
        stock: [...stock],
      }),
    );
    expect(result.crewStatus).toBe("blocked");
    expect(result.shortages).toEqual([
      expect.objectContaining({
        materialId: "M",
        kind: "unknown",
        requiredQty: 5,
        onHandQty: null,
        shortfallQty: null,
      }),
    ]);
  });

  it("one invalid stock row makes the material unknown whatever the other rows say", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 5 }],
        stock: [
          { materialId: "M", location: "warehouse", quantity: 100 },
          { materialId: "M", location: "van", quantity: -5 },
        ],
      }),
    );
    expect(result.crewStatus).toBe("blocked");
    expect(result.shortages[0]).toEqual(expect.objectContaining({ kind: "unknown", onHandQty: null, shortfallQty: null, requiredQty: 5 }));
  });

  it("ten balances of 0.1 cover a requirement of 1", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 1 }],
        stock: Array.from({ length: 10 }, (_, index) => ({ materialId: "M", location: `bin-${index}`, quantity: 0.1 })),
      }),
    );
    expect(result.crewStatus).toBe("clear");
    expect(result.shortages).toEqual([]);
    expect(result.blockers).toEqual([]);
  });

  it("stock 4.2 against a requirement of 5 is short by 0.8", () => {
    const result = readiness(
      input({
        penetrations: [penetration({ id: "p1" })],
        solutionMaterials: [{ internalCode: "S1", materialId: "M", quantityPerInstall: 5 }],
        stock: [{ materialId: "M", location: "warehouse", quantity: 4.2 }],
      }),
    );
    expect(result.crewStatus).toBe("blocked");
    expect(result.shortages[0]).toEqual(expect.objectContaining({ kind: "short", onHandQty: 4.2, shortfallQty: 0.8, requiredQty: 5 }));
  });
});
