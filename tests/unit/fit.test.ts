import { describe, expect, it } from "vitest";
import { buildCatalogue, solutionMismatches, type Penetration, type RawCatalogueRow } from "@/domain";

function row(partial: Partial<RawCatalogueRow> = {}): RawCatalogueRow {
  return {
    "Internal Code": "S1",
    "Supplier Ref. Code": "ref-S1",
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
    ...partial,
  };
}

function solution(partial: Partial<RawCatalogueRow> = {}) {
  const built = buildCatalogue([row(partial)]).solutions[0];
  if (!built) throw new Error("no solution");
  return built;
}

function penetration(partial: Partial<Penetration> = {}): Penetration {
  return {
    id: "p1",
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

describe("AC 35: a nominated solution that does not fit its penetration", () => {
  it("fits when every field matches and the rating meets the requirement", () => {
    expect(solutionMismatches(penetration(), solution())).toEqual([]);
    expect(solutionMismatches(penetration({ requiredIntegrityMinutes: 30, requiredInsulationMinutes: 0 }), solution())).toEqual([]);
  });

  it("ignores differences of spacing and capitals, as substitute matching does", () => {
    const loose = penetration({
      substrateDetail: "  fr plasterboard,  FR plasterboard wall ( 1 layer 13 mm) ",
      serviceType: "pex  pipe",
      serviceSize: " ø25mm",
    });
    expect(solutionMismatches(loose, solution())).toEqual([]);
  });

  it("names each field that differs, in a fixed order", () => {
    const off = penetration({
      orientation: "Floor",
      substrateDetail: "Concrete floor",
      serviceType: "Copper Pipe",
      serviceSize: "Ø32mm",
      requiredIntegrityMinutes: 120,
      requiredInsulationMinutes: 90,
    });
    expect(solutionMismatches(off, solution())).toEqual(["orientation", "substrate", "serviceType", "serviceSize", "integrity", "insulation"]);
  });

  it("treats a missing insulation claim as below a stated insulation requirement", () => {
    expect(solutionMismatches(penetration(), solution({ Insulation: "-" }))).toEqual(["insulation"]);
    expect(solutionMismatches(penetration({ requiredInsulationMinutes: null }), solution({ Insulation: "-" }))).toEqual([]);
  });

  it("never lets a cut-off substrate fit, on either side, even against identical cut-off text", () => {
    // A substrate cut off after the family name cannot identify a build-up (catalogue-data-model.md).
    expect(solutionMismatches(penetration(), solution({ Substrate: "FR plasterboard," }))).toEqual(["substrate"]);
    expect(solutionMismatches(penetration({ substrateDetail: "FR plasterboard," }), solution())).toEqual(["substrate"]);
    expect(solutionMismatches(penetration({ substrateDetail: "FR plasterboard," }), solution({ Substrate: "FR plasterboard," }))).toEqual([
      "substrate",
    ]);
    expect(solutionMismatches(penetration({ substrateDetail: "FR plasterboard,  " }), solution({ Substrate: "FR plasterboard," }))).toEqual([
      "substrate",
    ]);
  });

  it("fails closed on a requirement it cannot compare", () => {
    expect(solutionMismatches(penetration({ requiredIntegrityMinutes: Number.NaN }), solution())).toEqual(["integrity"]);
    expect(solutionMismatches(penetration({ requiredInsulationMinutes: Number.POSITIVE_INFINITY }), solution())).toEqual(["insulation"]);
    expect(solutionMismatches(penetration({ requiredIntegrityMinutes: -5 }), solution())).toEqual(["integrity"]);
  });

  it.each([
    ["orientation", { orientation: "Floor" as const }],
    ["orientation", { orientation: "Ceiling" as const }],
    ["serviceType", { serviceType: "Copper Pipe" }],
    ["serviceSize", { serviceSize: "Ø32mm" }],
    ["integrity", { requiredIntegrityMinutes: 61 }],
    ["insulation", { requiredInsulationMinutes: 31 }],
  ])("flags only %s when that field alone does not fit", (field, change) => {
    expect(solutionMismatches(penetration(change), solution())).toEqual([field]);
  });

  it("passes an unstated integrity requirement, and holds a zero insulation requirement against no claim", () => {
    expect(solutionMismatches(penetration({ requiredIntegrityMinutes: null }), solution())).toEqual([]);
    // A stated requirement, even of zero, needs a stated claim.
    expect(solutionMismatches(penetration({ requiredInsulationMinutes: 0 }), solution({ Insulation: "-" }))).toEqual(["insulation"]);
  });

  it.each([
    ["integrity", { integrityMinutes: Number.POSITIVE_INFINITY }],
    ["integrity", { integrityMinutes: -1 }],
    ["integrity", { integrityMinutes: Number.NaN }],
    ["insulation", { insulationMinutes: Number.POSITIVE_INFINITY }],
    ["insulation", { insulationMinutes: -1 }],
    ["insulation", { insulationMinutes: Number.NaN }],
  ])("fails closed on an unusable solution rating (%s %o)", (field, change) => {
    expect(solutionMismatches(penetration(), { ...solution(), ...change })).toEqual([field]);
  });

  it("fails closed on blank text: an empty field on either side never matches", () => {
    expect(solutionMismatches(penetration({ serviceType: "  " }), solution())).toEqual(["serviceType"]);
    const blank = solution();
    expect(solutionMismatches(penetration({ serviceSize: "" }), { ...blank, key: { ...blank.key, serviceSize: "" } })).toEqual([
      "serviceSize",
    ]);
    expect(solutionMismatches(penetration({ substrateDetail: "" }), { ...blank, key: { ...blank.key, substrate: "" } })).toEqual([
      "substrate",
    ]);
  });
});
