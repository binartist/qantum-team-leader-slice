import { describe, expect, it } from "vitest";
import { penetrationLine, penetrationsByPlace } from "@/ui/format";
import { candidateFacts, decisionChipName, decisionChips, filterByMaterial, listFactChips, penetrationFacts } from "@/ui/penetrations";

const materials = {
  "MAT-SEALANT": { name: "Intumescent sealant, 310 ml cartridge" },
  "MAT-MASTIC": { name: "Fire mastic tube" },
};

const source = { siteId: "site-b", penetrationId: "p1" };
const sealant = { materialId: "MAT-SEALANT", kind: "short" as const, requiredQty: 10, shortfallQty: 2 };
const mastic = { materialId: "MAT-MASTIC", kind: "unknown" as const, requiredQty: 1, shortfallQty: null };

describe("penetration facts on the penetration page", () => {
  it("AC 40: briefs each shortage inline with this site's figures and links it to the material page at this site", () => {
    const shortages = [
      { ...sealant, penetrationIds: ["p1", "p2"] },
      { ...mastic, penetrationIds: ["p1"] },
    ];
    // Colour-coded and never colour alone: each fact carries a tone and an icon.
    expect(penetrationFacts(source, shortages, [], materials)).toEqual([
      {
        label: "Short material: Intumescent sealant, 310 ml cartridge · this site short 2 of 10",
        tone: "danger",
        icon: "stop",
        href: "/materials/MAT-SEALANT?from=p1#site-site-b",
      },
      {
        label: "Stock unknown: Fire mastic tube · this site needs 1",
        tone: "warning",
        icon: "warning",
        href: "/materials/MAT-MASTIC?from=p1#site-site-b",
      },
    ]);
    expect(penetrationFacts({ ...source, penetrationId: "p2" }, shortages, [], materials).map((fact) => fact.href)).toEqual([
      "/materials/MAT-SEALANT?from=p2#site-site-b",
    ]);
  });

  it("names a data problem by its reason, first", () => {
    const blockers = [{ penetrationId: "p3", reason: "unknown_solution_code" as const, internalCode: "9999" }];
    expect(penetrationFacts({ ...source, penetrationId: "p3" }, [], blockers, materials)).toEqual([
      { label: "Solution code 9999 isn't in the catalogue", tone: "danger", icon: "warning" },
    ]);
    expect(penetrationFacts({ ...source, penetrationId: "p4" }, [], blockers, materials)).toEqual([]);
  });

  it("AC 35: names the fields of a nominated solution that does not fit", () => {
    const blockers = [{ penetrationId: "p5", reason: "solution_mismatch" as const, internalCode: "0435", mismatches: ["insulation" as const] }];
    expect(penetrationFacts({ ...source, penetrationId: "p5" }, [], blockers, materials)).toEqual([
      { label: "Solution 0435 doesn't fit this penetration: insulation", tone: "danger", icon: "warning" },
    ]);
  });

  it("says nothing about a penetration with no problem, and never calls one ready", () => {
    expect(penetrationFacts({ ...source, penetrationId: "p9" }, [{ ...sealant, penetrationIds: ["p1"] }], [], materials)).toEqual([]);
  });

  it("falls back to the material id when the name is missing", () => {
    const facts = penetrationFacts(source, [{ ...sealant, materialId: "MAT-X", penetrationIds: ["p1"] }], [], {});
    expect(facts.map((fact) => fact.label)).toEqual(["Short material: MAT-X · this site short 2 of 10"]);
  });
});

describe("AC 40: a substitute's material lines", () => {
  const lines = (...items: [string, "in_stock" | "short" | "unknown"][]) => items.map(([materialId, status]) => ({ materialId, status }));

  it("briefs and links a material the site is already short of, like the nominated solution's", () => {
    const facts = candidateFacts({ overall: "short", lines: lines(["MAT-SEALANT", "short"], ["MAT-PUTTY", "in_stock"]) }, materials, [sealant], source);
    expect(facts).toEqual([
      {
        label: "Short material: Intumescent sealant, 310 ml cartridge · this site short 2 of 10",
        tone: "danger",
        icon: "stop",
        href: "/materials/MAT-SEALANT?from=p1#site-site-b",
      },
    ]);
    const unknown = candidateFacts({ overall: "unknown", lines: lines(["MAT-MASTIC", "unknown"]) }, materials, [mastic], source);
    expect(unknown[0]).toMatchObject({ label: "Stock unknown: Fire mastic tube · this site needs 1", href: "/materials/MAT-MASTIC?from=p1#site-site-b" });
  });

  it("keeps a material only this substitute would run short of as text: it is not a site shortage, so nothing to decide", () => {
    const facts = candidateFacts({ overall: "short", lines: lines(["MAT-PUTTY", "short"], ["MAT-MASTIC", "unknown"]) }, materials, [], source);
    expect(facts).toEqual([
      { label: "Short material: MAT-PUTTY", tone: "danger", icon: "stop" },
      { label: "Stock unknown: Fire mastic tube", tone: "warning", icon: "warning" },
    ]);
    expect(facts.every((fact) => fact.href === undefined)).toBe(true);
  });

  it("says why when no material line applies, and nothing when every material is in stock", () => {
    expect(candidateFacts({ overall: "no_material_mapping", lines: [] }, materials, [], source)).toEqual([
      { label: "We can't tell if its materials are in stock.", tone: "warning", icon: "warning" },
    ]);
    expect(candidateFacts({ overall: "in_stock", lines: lines(["MAT-PUTTY", "in_stock"]) }, materials, [], source)).toEqual([]);
  });
});

describe("filtering the list to one short material", () => {
  const places = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
  const shortages = [{ materialId: "MAT-SEALANT", kind: "short" as const, requiredQty: 10, shortfallQty: 2, penetrationIds: ["p1", "p3"] }];

  it("keeps only the penetrations whose solution uses that shortage's material", () => {
    expect(filterByMaterial(places, shortages, materials, "MAT-SEALANT")).toEqual({
      places: [{ id: "p1" }, { id: "p3" }],
      filter: { materialName: "Intumescent sealant, 310 ml cartridge", shown: 2, total: 3 },
      unknownMaterial: false,
    });
  });

  it("shows everything when no filter is asked for", () => {
    expect(filterByMaterial(places, shortages, materials, undefined)).toEqual({ places, filter: null, unknownMaterial: false });
  });

  it("shows everything, and says so, for a material that is not a shortage on this site", () => {
    // Never an empty list that could read as "nothing to worry about".
    expect(filterByMaterial(places, shortages, materials, "MAT-NOPE")).toEqual({ places, filter: null, unknownMaterial: true });
  });

  it("names an unnamed material by its id", () => {
    expect(filterByMaterial(places, [{ materialId: "MAT-X", penetrationIds: ["p2"] }], {}, "MAT-X").filter).toEqual({
      materialName: "MAT-X",
      shown: 1,
      total: 3,
    });
  });
});

describe("compact chips on the site list", () => {
  const labels = (chips: readonly { label: string }[]) => chips.map((chip) => chip.label);

  it("names each data problem by kind only, in a danger chip", () => {
    const blockers = [
      { penetrationId: "p1", reason: "unknown_solution_code" as const, state: "open" },
      { penetrationId: "p1", reason: "solution_mismatch" as const, state: "open" },
      { penetrationId: "p2", reason: "no_material_mapping" as const, state: "open" },
      { penetrationId: "p3", reason: "invalid_quantity" as const, state: "open" },
    ];
    expect(labels(listFactChips("p1", [], blockers))).toEqual(["Unknown solution", "Doesn't fit"]);
    expect(labels(listFactChips("p2", [], blockers))).toEqual(["No materials"]);
    expect(listFactChips("p3", [], blockers)).toEqual([{ label: "Invalid quantity", tone: "danger", icon: "warning" }]);
  });

  it("counts short and unknown-stock materials, and never says ready", () => {
    const shortages = [
      { kind: "short" as const, requiredQty: 10, shortfallQty: 2, penetrationIds: ["p1", "p2"], state: "open" },
      { kind: "short" as const, requiredQty: 10, shortfallQty: 2, penetrationIds: ["p1"], state: "open" },
      { kind: "unknown" as const, requiredQty: 1, shortfallQty: null, penetrationIds: ["p1", "p3"], state: "open" },
      { kind: "unknown" as const, requiredQty: 1, shortfallQty: null, penetrationIds: ["p1"], state: "open" },
    ];
    expect(labels(listFactChips("p1", shortages, []))).toEqual(["Short material × 2", "Stock unknown × 2"]);
    expect(listFactChips("p2", shortages, [])).toEqual([{ label: "Short material", tone: "danger", icon: "stop" }]);
    expect(listFactChips("p3", shortages, [])).toEqual([{ label: "Stock unknown", tone: "warning", icon: "warning" }]);
    expect(listFactChips("p4", shortages, [])).toEqual([]);
  });

  it("AC 34: names the kind of problem, and leaves the decision off this chip", () => {
    const shortages = [
      { kind: "short" as const, penetrationIds: ["p1", "p2"], state: "escalated" },
      { kind: "short" as const, penetrationIds: ["p1"], state: "waiting" },
      { kind: "short" as const, penetrationIds: ["p1", "p3"], state: "escalated" },
    ];
    const blockers = [{ penetrationId: "p4", reason: "unknown_solution_code" as const, state: "waiting" }];
    expect(listFactChips("p1", shortages, [])).toEqual([{ label: "Short material × 3", tone: "danger", icon: "stop" }]);
    expect(labels(listFactChips("p2", shortages, []))).toEqual(["Short material"]);
    expect(labels(listFactChips("p4", [], blockers))).toEqual(["Unknown solution"]);
    expect(labels(listFactChips("p5", [{ kind: "short" as const, penetrationIds: ["p5"], state: "open" }], []))).toEqual(["Short material"]);
  });
});

describe("AC 44: a decision chip carries the latest decision of its kind that still applies", () => {
  const names = {
    siteId: "site-b",
    materials: {
      "MAT-OLD": { name: "Older collar" },
      "MAT-NEW": { name: "Newer collar" },
    },
    penetrations: { "pen-c-03": { floor: "L1", location: "Riser 1" } },
  };

  function recorded(
    createdAt: string,
    overrides: {
      kind?: "wait" | "escalate";
      escalateTo?: "purchasing" | "warehouse" | null;
      note?: string | null;
      current?: boolean;
      createdBy?: string;
    } = {},
  ) {
    return {
      kind: overrides.kind ?? "escalate",
      escalateTo: overrides.escalateTo === undefined ? "purchasing" : overrides.escalateTo,
      note: overrides.note === undefined ? null : overrides.note,
      createdBy: overrides.createdBy ?? "demo-leader",
      createdAt,
      current: overrides.current ?? true,
    };
  }

  it("lets the newer escalation win and skips an action that no longer applies", () => {
    const chips = decisionChips(
      "p1",
      [
        {
          id: "site-b:MAT-OLD",
          penetrationIds: ["p1", "p2"],
          state: "escalated",
          actions: [
            recorded("2026-10-04T00:00:00.000Z", { note: "later but no longer current", current: false }),
            recorded("2026-10-03T00:00:00.000Z", { note: "current, then an older one loses" }),
            recorded("2026-10-01T00:00:00.000Z", { note: "older current" }),
          ],
        },
        {
          id: "site-b:MAT-NEW",
          penetrationIds: ["p1"],
          state: "escalated",
          actions: [recorded("2026-10-02T00:00:00.000Z", { note: "newer current" })],
        },
      ],
      [],
      names,
    );
    expect(chips).toEqual([
      {
        state: "escalated",
        chip: { label: "Escalated", tone: "escalation", icon: "arrow-up" },
        latest: {
          sentence: "Escalated to purchasing: Older collar",
          recordedAt: "2026-10-03T00:00:00.000Z",
          createdBy: "demo-leader",
          note: "current, then an older one loses",
        },
      },
    ]);
  });

  it("uses a blocker decision, named by its place", () => {
    const chips = decisionChips(
      "pen-c-03",
      [],
      [
        {
          id: "site-c:blocker.pen-c-03",
          penetrationId: "pen-c-03",
          state: "escalated",
          actions: [recorded("2026-10-02T00:00:00.000Z", { escalateTo: "warehouse", note: "catalogue gap" })],
        },
      ],
      { siteId: "site-c", materials: {}, penetrations: names.penetrations },
    );
    expect(chips).toEqual([
      {
        state: "escalated",
        chip: { label: "Escalated", tone: "escalation", icon: "arrow-up" },
        latest: {
          sentence: "Escalated to warehouse: L1, Riser 1",
          recordedAt: "2026-10-02T00:00:00.000Z",
          createdBy: "demo-leader",
          note: "catalogue gap",
        },
      },
    ]);
  });

  it("shows no chip for an open problem, or for a penetration the shortage does not list", () => {
    const open = [{ id: "site-b:MAT-NEW", penetrationIds: ["p5"], state: "open", actions: [recorded("2026-10-02T00:00:00.000Z")] }];
    expect(decisionChips("p5", open, [], names)).toEqual([]);
    expect(decisionChips("p9", open, [], names)).toEqual([]);
  });

  it("lists escalated before waiting", () => {
    const chips = decisionChips(
      "p1",
      [
        {
          id: "site-b:MAT-NEW",
          penetrationIds: ["p1"],
          state: "waiting",
          actions: [recorded("2026-10-02T00:00:00.000Z", { kind: "wait", escalateTo: null, note: "hold" })],
        },
        {
          id: "site-b:MAT-OLD",
          penetrationIds: ["p1"],
          state: "escalated",
          actions: [recorded("2026-10-01T00:00:00.000Z", { note: null })],
        },
      ],
      [],
      names,
    );
    expect(chips.map((chip) => chip.state)).toEqual(["escalated", "waiting"]);
    expect(chips[1]?.latest.sentence).toBe("Wait: Newer collar");
    expect(chips[0]?.latest.note).toBeNull();
  });

  it("omits the chip when no current action of that kind exists", () => {
    const chips = decisionChips(
      "p1",
      [
        {
          id: "site-b:MAT-OLD",
          penetrationIds: ["p1"],
          state: "escalated",
          actions: [
            recorded("2026-10-04T00:00:00.000Z", { current: false }),
            recorded("2026-10-03T00:00:00.000Z", { kind: "wait", escalateTo: null, current: true }),
          ],
        },
      ],
      [],
      names,
    );
    expect(chips).toEqual([]);
  });

  it("keeps the first action when the dates tie or cannot be read", () => {
    const tied = decisionChips(
      "p1",
      [
        {
          id: "site-b:MAT-OLD",
          penetrationIds: ["p1"],
          state: "escalated",
          actions: [
            recorded("2026-10-02T00:00:00.000Z", { note: "first" }),
            recorded("2026-10-02T00:00:00.000Z", { note: "same time" }),
          ],
        },
      ],
      [],
      names,
    );
    expect(tied[0]?.latest.note).toBe("first");

    const unreadableFirst = decisionChips(
      "p1",
      [
        {
          id: "site-b:MAT-OLD",
          penetrationIds: ["p1"],
          state: "escalated",
          actions: [recorded("not-a-date", { note: "unreadable" }), recorded("2026-10-05T00:00:00.000Z", { note: "later but the first cannot be compared" })],
        },
      ],
      [],
      names,
    );
    expect(unreadableFirst[0]?.latest.note).toBe("unreadable");

    const unreadableSecond = decisionChips(
      "p1",
      [
        {
          id: "site-b:MAT-OLD",
          penetrationIds: ["p1"],
          state: "escalated",
          actions: [recorded("2026-10-02T00:00:00.000Z", { note: "readable" }), recorded("still-not-a-date", { note: "ignored" })],
        },
      ],
      [],
      names,
    );
    expect(unreadableSecond[0]?.latest.note).toBe("readable");
  });

  it("names the chip with the place", () => {
    expect(decisionChipName("Escalated", "L3, Riser 2 · PEX Pipe Ø25mm")).toBe(
      "Escalated, latest decision for L3, Riser 2 · PEX Pipe Ø25mm",
    );
  });
});

describe("site-list order and row text", () => {
  const row = (id: string, floor: string, location: string, serviceType = "PEX Pipe", serviceSize = "Ø25mm") => ({
    id,
    floor,
    location,
    serviceType,
    serviceSize,
    nominatedCode: "0438",
  });

  it("orders by floor (numerically), place, service, size, then id", () => {
    const sorted = penetrationsByPlace([
      row("e", "L10", "Core"),
      row("d", "L3", "Riser 2", "PEX Pipe", "Ø32mm"),
      row("c", "L3", "Riser 2"),
      row("b", "L3", "Riser 2"),
      row("a", "L3", "Lobby", "Steel Pipe"),
      row("f", "L3", "Riser 2", "Copper Pipe"),
    ]);
    expect(sorted.map((place) => place.id)).toEqual(["a", "f", "b", "c", "d", "e"]);
  });

  it("names a row by place and service, with tidied spacing", () => {
    expect(penetrationLine(row("a", "L3", "Riser 2", "PEX  Pipe", " Ø25mm"))).toBe("L3, Riser 2 · PEX Pipe Ø25mm");
  });
});
