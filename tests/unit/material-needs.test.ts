import { describe, expect, it } from "vitest";
import { buildCatalogue, onHandByMaterial, siteMaterialNeeds, type Penetration, type RawCatalogueRow } from "@/domain";

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

const catalogue = buildCatalogue([row("S1"), row("S2")]);

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

describe("AC 39: each material a site needs, short or not", () => {
  it("sums the need per material, rounds up once on the site total, and lists the penetrations", () => {
    const needs = siteMaterialNeeds({
      siteId: "site-a",
      penetrations: [penetration({ id: "p1" }), penetration({ id: "p2" }), penetration({ id: "p3", nominatedCode: "S2" })],
      catalogue,
      solutionMaterials: [
        { internalCode: "S1", materialId: "MAT-SEALANT", quantityPerInstall: 0.5 },
        { internalCode: "S1", materialId: "MAT-COLLAR", quantityPerInstall: 1 },
        { internalCode: "S2", materialId: "MAT-SEALANT", quantityPerInstall: 0.25 },
      ],
    });
    expect(needs).toEqual([
      { materialId: "MAT-COLLAR", requiredQty: 2, penetrationIds: ["p1", "p2"] },
      { materialId: "MAT-SEALANT", requiredQty: 2, penetrationIds: ["p1", "p2", "p3"] },
    ]);
  });

  it("adds no need for a penetration that is a data problem, and none for another site's penetration", () => {
    const needs = siteMaterialNeeds({
      siteId: "site-a",
      penetrations: [
        penetration({ id: "p1", nominatedCode: "9999" }),
        penetration({ id: "p2", requiredInsulationMinutes: 120 }),
        penetration({ id: "p3", siteId: "site-b" }),
        penetration({ id: "p4", nominatedCode: "S2" }),
      ],
      catalogue,
      solutionMaterials: [
        { internalCode: "S1", materialId: "MAT-SEALANT", quantityPerInstall: 1 },
        { internalCode: "S2", materialId: "MAT-BAD", quantityPerInstall: Number.NaN },
      ],
    });
    expect(needs).toEqual([]);
  });
});

describe("AC 38: on hand per material", () => {
  it("sums balances per material and fails closed on unusable figures", () => {
    const onHand = onHandByMaterial([
      { materialId: "MAT-A", location: "W1", quantity: 2 },
      { materialId: "MAT-A", location: "W2", quantity: 3 },
      { materialId: "MAT-B", location: "W1", quantity: -1 },
    ]);
    expect(onHand.get("MAT-A")).toBe(5);
    expect(onHand.get("MAT-B")).toBeNull();
    expect(onHand.has("MAT-C")).toBe(false);
  });
});
