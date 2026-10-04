import { describe, expect, it } from "vitest";
import { createMemoryActionsRepository } from "@/adapters/memory/actions-repository";
import { getSiteReadiness, listActions } from "@/application";
import type { NewShortageAction, NewSubstitutionProposal } from "@/ports";
import { testDependencies } from "../api/support";

function proposal(reason: string, key: string): NewSubstitutionProposal {
  return {
    siteId: "site-b",
    penetrationId: "pen-b-01",
    fromInternalCode: "0438",
    toInternalCode: "0451",
    reason,
    createdBy: "demo-leader",
    idempotencyKey: key,
  };
}

function action(note: string, key: string, createdAtIndex: number): NewShortageAction {
  return {
    siteId: "site-b",
    shortageId: "site-b:MAT-SEALANT",
    kind: createdAtIndex === 0 ? "wait" : "escalate",
    escalateTo: createdAtIndex === 0 ? null : "purchasing",
    note,
    shortfallQtyAtTime: 2,
    createdBy: "demo-leader",
    idempotencyKey: key,
  };
}

describe("listActions", () => {
  it("lists proposals and shortage actions newest first", async () => {
    const stamps = ["2026-10-01T00:00:00.000Z", "2026-10-03T00:00:00.000Z", "2026-10-02T00:00:00.000Z", "2026-10-04T00:00:00.000Z"];
    let tick = 0;
    const deps = testDependencies();
    const actions = createMemoryActionsRepository({
      now: () => new Date(stamps[tick++] ?? stamps[0]!),
      newId: () => `id-${tick}`,
    });
    const wired = { ...deps, actions };
    await actions.appendSubstitutionProposal(proposal("older reason", "p1"));
    await actions.appendSubstitutionProposal(proposal("newer reason", "p2"));
    await actions.appendShortageAction(action("older note", "a1", 0));
    await actions.appendShortageAction(action("newer note", "a2", 1));
    const listed = await listActions(wired, "site-b");
    expect(listed.proposals.map((item) => item.reason)).toEqual(["newer reason", "older reason"]);
    expect(listed.actions.map((item) => item.note)).toEqual(["newer note", "older note"]);
  });

  it("classifies the shortage actions already loaded with the site", async () => {
    const deps = testDependencies();
    await deps.actions.appendShortageAction(action("first read", "once", 0));
    let calls = 0;
    const wired = {
      ...deps,
      actions: {
        ...deps.actions,
        async listShortageActions(siteId: string) {
          calls += 1;
          const rows = await deps.actions.listShortageActions(siteId);
          if (calls > 1) return rows.map((row) => ({ ...row, note: "second read" }));
          return rows;
        },
      },
    };
    const listed = await listActions(wired, "site-b");
    expect(calls).toBe(1);
    expect(listed.actions.map((item) => item.note)).toEqual(["first read"]);
  });

  it("keeps the first catalogue name when two rows share a material id", async () => {
    const base = testDependencies();
    const deps = {
      ...base,
      solutionMaterials: {
        async getSolutionMaterials(codes: readonly string[]) {
          const result = await base.solutionMaterials.getSolutionMaterials(codes);
          const sealant = result.materials.find((material) => material.id === "MAT-SEALANT");
          if (!sealant) return result;
          return { ...result, materials: [...result.materials, { ...sealant, name: "Second name" }] };
        },
      },
    };
    const readiness = await getSiteReadiness(deps, "site-b");
    expect(readiness.materials["MAT-SEALANT"]?.name).toBe("Intumescent sealant, 310 ml cartridge");
  });
});
