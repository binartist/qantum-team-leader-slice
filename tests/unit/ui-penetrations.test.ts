import { describe, expect, it } from "vitest";
import { penetrationLine, penetrationsByPlace, penetrationsPath } from "@/ui/format";
import { filterByMaterial, listFactChips, penetrationFacts } from "@/ui/penetrations";

const materials = {
  "MAT-SEALANT": { name: "Intumescent sealant, 310 ml cartridge" },
  "MAT-MASTIC": { name: "Fire mastic tube" },
};

describe("penetration facts on the planned-work list", () => {
  it("says which short or unknown-stock materials a penetration's solution uses", () => {
    const shortages = [
      { materialId: "MAT-SEALANT", kind: "short" as const, penetrationIds: ["p1", "p2"] },
      { materialId: "MAT-MASTIC", kind: "unknown" as const, penetrationIds: ["p1"] },
    ];
    // Colour-coded and never colour alone: each fact carries a tone and an icon.
    expect(penetrationFacts("p1", shortages, [], materials)).toEqual([
      { label: "Short material: Intumescent sealant, 310 ml cartridge", tone: "danger", icon: "stop" },
      { label: "Stock unknown: Fire mastic tube", tone: "warning", icon: "warning" },
    ]);
    expect(penetrationFacts("p2", shortages, [], materials).map((fact) => fact.label)).toEqual([
      "Short material: Intumescent sealant, 310 ml cartridge",
    ]);
  });

  it("names a data problem by its reason, first", () => {
    const blockers = [{ penetrationId: "p3", reason: "unknown_solution_code" as const, internalCode: "9999" }];
    expect(penetrationFacts("p3", [], blockers, materials)).toEqual([
      { label: "Solution code 9999 isn't in the catalogue", tone: "danger", icon: "warning" },
    ]);
    expect(penetrationFacts("p4", [], blockers, materials)).toEqual([]);
  });

  it("AC 35: names the fields of a nominated solution that does not fit", () => {
    const blockers = [{ penetrationId: "p5", reason: "solution_mismatch" as const, internalCode: "0435", mismatches: ["insulation" as const] }];
    expect(penetrationFacts("p5", [], blockers, materials)).toEqual([
      { label: "Solution 0435 doesn't fit this penetration: insulation", tone: "danger", icon: "warning" },
    ]);
  });

  it("says nothing about a penetration with no problem, and never calls one ready", () => {
    const facts = penetrationFacts("p9", [{ materialId: "MAT-SEALANT", kind: "short", penetrationIds: ["p1"] }], [], materials);
    expect(facts).toEqual([]);
  });

  it("falls back to the material id when the name is missing", () => {
    expect(penetrationFacts("p1", [{ materialId: "MAT-X", kind: "short", penetrationIds: ["p1"] }], [], {}).map((fact) => fact.label)).toEqual([
      "Short material: MAT-X",
    ]);
  });

  it("links a short material to its stock page, and leaves stock unknown as text", () => {
    const shortages = [
      { materialId: "MAT-SEALANT", kind: "short" as const, penetrationIds: ["p1"] },
      { materialId: "MAT-MASTIC", kind: "unknown" as const, penetrationIds: ["p1"] },
    ];
    expect(penetrationFacts("p1", shortages, [], materials, "site-b")).toEqual([
      {
        label: "Short material: Intumescent sealant, 310 ml cartridge",
        tone: "danger",
        icon: "stop",
        href: "/sites/site-b/materials/MAT-SEALANT",
      },
      { label: "Stock unknown: Fire mastic tube", tone: "warning", icon: "warning" },
    ]);
    expect(penetrationFacts("p1", shortages, [], materials)).toEqual([
      { label: "Short material: Intumescent sealant, 310 ml cartridge", tone: "danger", icon: "stop" },
      { label: "Stock unknown: Fire mastic tube", tone: "warning", icon: "warning" },
    ]);
  });

  it("builds the list path, with an optional material filter", () => {
    expect(penetrationsPath("site-b")).toBe("/sites/site-b/penetrations");
    expect(penetrationsPath("a/b")).toBe("/sites/a%2Fb/penetrations");
    expect(penetrationsPath("site-b", "MAT-SEALANT")).toBe("/sites/site-b/penetrations?material=MAT-SEALANT");
    expect(penetrationsPath("site-b", "a b&c")).toBe("/sites/site-b/penetrations?material=a%20b%26c");
  });
});

describe("filtering the list to one short material", () => {
  const places = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
  const shortages = [{ materialId: "MAT-SEALANT", kind: "short" as const, penetrationIds: ["p1", "p3"] }];

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
      { penetrationId: "p1", reason: "unknown_solution_code" as const },
      { penetrationId: "p1", reason: "solution_mismatch" as const },
      { penetrationId: "p2", reason: "no_material_mapping" as const },
      { penetrationId: "p3", reason: "invalid_quantity" as const },
    ];
    expect(labels(listFactChips("p1", [], blockers))).toEqual(["Unknown solution", "Doesn't fit"]);
    expect(labels(listFactChips("p2", [], blockers))).toEqual(["No materials"]);
    expect(listFactChips("p3", [], blockers)).toEqual([{ label: "Invalid quantity", tone: "danger", icon: "warning" }]);
  });

  it("counts short and unknown-stock materials, and never says ready", () => {
    const shortages = [
      { kind: "short" as const, penetrationIds: ["p1", "p2"] },
      { kind: "short" as const, penetrationIds: ["p1"] },
      { kind: "unknown" as const, penetrationIds: ["p1", "p3"] },
      { kind: "unknown" as const, penetrationIds: ["p1"] },
    ];
    expect(labels(listFactChips("p1", shortages, []))).toEqual(["Short material × 2", "Stock unknown × 2"]);
    expect(listFactChips("p2", shortages, [])).toEqual([{ label: "Short material", tone: "danger", icon: "stop" }]);
    expect(listFactChips("p3", shortages, [])).toEqual([{ label: "Stock unknown", tone: "warning", icon: "warning" }]);
    expect(listFactChips("p4", shortages, [])).toEqual([]);
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
