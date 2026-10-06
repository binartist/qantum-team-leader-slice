import { describe, expect, it } from "vitest";
import { materialDecisionScope, penetrationLog, type PenetrationLogSource } from "@/ui/penetration-log";

function action(
  id: string,
  shortageId: string,
  createdAt: string,
  overrides: {
    kind?: "wait" | "escalate";
    escalateTo?: "purchasing" | "warehouse" | null;
    note?: string | null;
    status?: "current" | "earlier" | "resolved";
    createdBy?: string;
  } = {},
) {
  return {
    id,
    shortageId,
    kind: overrides.kind ?? "escalate",
    escalateTo: overrides.escalateTo === undefined ? "purchasing" : overrides.escalateTo,
    note: overrides.note === undefined ? null : overrides.note,
    createdBy: overrides.createdBy ?? "demo-leader",
    createdAt,
    status: overrides.status ?? "current",
  };
}

function proposal(id: string, penetrationId: string, createdAt: string) {
  return {
    id,
    penetrationId,
    fromInternalCode: "0438",
    toInternalCode: "0451",
    reason: "Materials for this one are in stock",
    createdBy: "demo-leader",
    createdAt,
  };
}

const names = {
  materials: {
    "MAT-COLLAR-25": { name: "Pipe collar for 25 mm pipe" },
    "MAT-SEALANT": { name: "Intumescent sealant, 310 ml cartridge" },
    "MAT-OTHER": { name: "Other material" },
  },
  penetrations: { "pen-b-01": { floor: "L3", location: "Riser 2" } },
};

describe("AC 45: a penetration's log has its shortage, data-problem and proposal decisions, newest first", () => {
  const listed: PenetrationLogSource = {
    ...names,
    actions: [
      action("other-pen", "site-b:blocker.pen-b-02", "2026-10-06T00:00:00.000Z"),
      action("other-mat", "site-b:MAT-OTHER", "2026-10-05T00:00:00.000Z"),
      action("foreign", "MAT-COLLAR-25", "2026-10-09T00:00:00.000Z"),
      action("resolved", "site-b:MAT-SEALANT", "2026-10-01T00:00:00.000Z", { status: "resolved", note: "done" }),
      action("collar", "site-b:MAT-COLLAR-25", "2026-10-03T00:00:00.000Z", { note: "Noted from the keyboard" }),
      action("blocker", "site-b:blocker.pen-b-01", "2026-10-02T00:00:00.000Z", { escalateTo: "warehouse" }),
    ],
    proposals: [proposal("other-proposal", "pen-b-02", "2026-10-07T00:00:00.000Z"), proposal("this-proposal", "pen-b-01", "2026-10-04T00:00:00.000Z")],
  };

  const entries = penetrationLog(listed, "site-b", "pen-b-01", ["MAT-COLLAR-25", "MAT-SEALANT"]);

  it("keeps this penetration's shortage, data problem and proposal, including a resolved decision", () => {
    expect(entries.map((entry) => entry.id)).toEqual(["this-proposal", "collar", "blocker", "resolved"]);
    const collar = entries[1];
    const blocker = entries[2];
    const resolved = entries[3];
    const proposed = entries[0];
    if (collar?.kind !== "action" || blocker?.kind !== "action" || resolved?.kind !== "action" || proposed?.kind !== "proposal") {
      throw new Error("expected action, action, action, proposal");
    }
    expect(collar.sentence).toBe("Escalated to purchasing: Pipe collar for 25 mm pipe");
    expect(collar.href).toBe("/materials/MAT-COLLAR-25?from=pen-b-01#site-site-b");
    expect(collar.materialId).toBe("MAT-COLLAR-25");
    expect(blocker.sentence).toBe("Escalated to warehouse: L3, Riser 2");
    expect(blocker.href).toBeNull();
    expect(blocker.materialId).toBeNull();
    expect(resolved.href).toBeNull();
    expect(resolved.materialId).toBe("MAT-SEALANT");
    expect(resolved.status).toBe("resolved");
    expect(proposed.place).toBe("L3, Riser 2");
    expect(proposed.fromCode).toBe("0438");
    expect(proposed.toCode).toBe("0451");
  });

  it("keeps the original order when a date cannot be read", () => {
    const unreadable: PenetrationLogSource = {
      materials: names.materials,
      penetrations: {},
      actions: [action("bad-date", "site-b:MAT-COLLAR-25", "not-a-date")],
      proposals: [proposal("later", "pen-b-01", "2026-10-08T00:00:00.000Z")],
    };
    const kept = penetrationLog(unreadable, "site-b", "pen-b-01", ["MAT-COLLAR-25"]);
    expect(kept.map((entry) => entry.id)).toEqual(["bad-date", "later"]);
    expect(kept[1]).toMatchObject({ kind: "proposal", place: undefined });
  });

  it("names how many penetrations a material decision still covers, and says nothing once it has left readiness", () => {
    const shortages = [{ materialId: "MAT-COLLAR-25", penetrationIds: ["pen-b-01", "pen-b-02", "pen-b-03", "pen-b-04"] }];
    expect(materialDecisionScope("MAT-COLLAR-25", shortages)).toBe("Applies to all 4 penetrations at this site");
    expect(materialDecisionScope("MAT-SEALANT", shortages)).toBeNull();
    expect(materialDecisionScope(null, shortages)).toBeNull();
    expect(materialDecisionScope("MAT-COLLAR-25", [{ materialId: "MAT-COLLAR-25", penetrationIds: [] }])).toBeNull();
  });
});
