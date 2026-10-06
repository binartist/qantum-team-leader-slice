import { describe, expect, it } from "vitest";
import { penetrationLine, penetrationsByPlace } from "@/ui/format";
import { candidateFacts, filterByMaterial, listFactChips, penetrationFacts } from "@/ui/penetrations";

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

  it("AC 34: marks a penetration acted on, after its problems, in the decision colours", () => {
    const shortages = [
      { kind: "short" as const, penetrationIds: ["p1", "p2"], state: "escalated" },
      { kind: "short" as const, penetrationIds: ["p1"], state: "waiting" },
      { kind: "short" as const, penetrationIds: ["p1", "p3"], state: "escalated" },
    ];
    const blockers = [{ penetrationId: "p4", reason: "unknown_solution_code" as const, state: "waiting" }];
    // One chip per decision kind, escalated first, however many shortages share it.
    expect(listFactChips("p1", shortages, [])).toEqual([
      { label: "Short material × 3", tone: "danger", icon: "stop" },
      { label: "Escalated", tone: "escalation", icon: "arrow-up" },
      { label: "Waiting", tone: "info", icon: "clock" },
    ]);
    expect(labels(listFactChips("p2", shortages, []))).toEqual(["Short material", "Escalated"]);
    expect(labels(listFactChips("p4", [], blockers))).toEqual(["Unknown solution", "Waiting"]);
    // An open problem is not acted on.
    expect(labels(listFactChips("p5", [{ kind: "short" as const, penetrationIds: ["p5"], state: "open" }], []))).toEqual(["Short material"]);
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
