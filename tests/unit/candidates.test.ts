import { describe, expect, it } from "vitest";
import { loadCatalogueFromCsv } from "@/adapters/catalogue-csv";
import {
  buildCatalogue,
  findCandidates,
  normaliseText,
  type Catalogue,
  type Penetration,
  type RawCatalogueRow,
  type Solution,
} from "@/domain";

const catalogue = loadCatalogueFromCsv();

const CODES_WITH_CANDIDATES = [
  "0334",
  "0434",
  "0438",
  "0451",
  "0452",
  "0464",
  "0465",
  "0646",
  "0707",
  "0708",
  "0722",
  "0724",
  "0733",
  "0736",
  "0743",
  "0789",
  "0791",
  "0804",
  "0813",
  "0968",
] as const;

function solution(code: string): Solution {
  const found = catalogue.byCode.get(code);
  if (!found) throw new Error(`missing solution ${code}`);
  return found;
}

function penetrationFrom(item: Solution, overrides: Partial<Penetration> = {}): Penetration {
  return {
    id: `p-${item.internalCode}`,
    siteId: "site-a",
    orientation: item.orientation,
    substrateDetail: item.substrateDetail,
    serviceType: item.serviceType,
    serviceSize: item.serviceSize,
    requiredIntegrityMinutes: item.integrityMinutes,
    requiredInsulationMinutes: item.insulationMinutes,
    nominatedCode: item.internalCode,
    ...overrides,
  };
}

function row(code: string, overrides: Record<string, string> = {}): RawCatalogueRow {
  return {
    "Internal Code": code,
    "Supplier Ref. Code": `ref-${code}`,
    Supplier: "Ryanfire",
    Orientation: "Wall",
    Substrate: "Plasterboard, 1 layer 13mm",
    "Service Classification": "Combustible Pipe",
    "Service Type": "PVC Pipe",
    "Service Size": "Ø50mm",
    Integrity: "60",
    Insulation: "60",
    "Service Type Option": "PVC Pipe",
    "Substrate Option": "Plasterboard Wall",
    ...overrides,
  };
}

describe("findCandidates on the real catalogue", () => {
  it("AC 18: 0438 candidates are exactly 0451 and 0464", () => {
    const result = findCandidates(penetrationFrom(solution("0438")), catalogue);
    expect(result.status).toBe("ok");
    expect(result.candidates.map((item) => item.internalCode)).toEqual(["0451", "0464"]);
  });

  it("AC 19: 0789 candidates are exactly 0790 and 0791, and 0434's candidate is exactly 0435", () => {
    const blank = findCandidates(penetrationFrom(solution("0789")), catalogue);
    const kelox = findCandidates(penetrationFrom(solution("0434")), catalogue);
    expect(blank.status).toBe("ok");
    expect(blank.candidates.map((item) => item.internalCode)).toEqual(["0790", "0791"]);
    expect(kelox.status).toBe("ok");
    expect(kelox.candidates.map((item) => item.internalCode)).toEqual(["0435"]);
  });

  it("AC 20: 0344 has no candidates", () => {
    const result = findCandidates(penetrationFrom(solution("0344")), catalogue);
    expect(result).toEqual({ status: "ok", candidates: [] });
  });

  it("AC 21: 0943 gives substrate_incomplete and no candidates", () => {
    const result = findCandidates(penetrationFrom(solution("0943")), catalogue);
    expect(result).toEqual({ status: "substrate_incomplete", candidates: [] });
  });

  it("a nominated code that is not in the catalogue gives nominated_code_unknown", () => {
    const result = findCandidates(penetrationFrom(solution("0438"), { nominatedCode: "NOT-A-CODE" }), catalogue);
    expect(result).toEqual({ status: "nominated_code_unknown", candidates: [] });
  });

  it("matches the penetration's own attributes, not the nominated solution", () => {
    const result = findCandidates(
      penetrationFrom(solution("0438"), { nominatedCode: "0943" }),
      catalogue,
    );
    expect(result.status).toBe("ok");
    expect(result.candidates.map((item) => item.internalCode)).toEqual(["0438", "0451", "0464"]);
  });

  it("AC 22 and AC 25: exactly 20 complete solutions have a candidate, and every candidate meets the rules", () => {
    const matched: string[] = [];
    for (const item of catalogue.solutions) {
      if (item.substrateIncomplete) continue;
      const penetration = penetrationFrom(item);
      const result = findCandidates(penetration, catalogue);
      expect(result.status).toBe("ok");
      if (result.candidates.length > 0) matched.push(item.internalCode);
      for (const candidate of result.candidates) {
        expect(candidate.internalCode).not.toBe(item.internalCode);
        expect(candidate.substrateIncomplete).toBe(false);
        expect(candidate.orientation).toBe(item.orientation);
        expect(candidate.key).toEqual({
          substrate: normaliseText(penetration.substrateDetail),
          serviceType: normaliseText(penetration.serviceType),
          serviceSize: normaliseText(penetration.serviceSize),
        });
        expect(candidate.integrityMinutes).toBeGreaterThanOrEqual(item.integrityMinutes);
        if (item.insulationMinutes !== null) {
          expect(candidate.insulationMinutes).not.toBeNull();
          expect(candidate.insulationMinutes as number).toBeGreaterThanOrEqual(item.insulationMinutes);
        }
      }
    }
    expect(matched).toHaveLength(20);
    expect(matched.slice().sort()).toEqual([...CODES_WITH_CANDIDATES].sort());
  });
});

describe("findCandidates fixtures", () => {
  it("AC 22: a null insulation is never offered for a stated insulation requirement", () => {
    const built = buildCatalogue([
      row("LOW", { Insulation: "-", Integrity: "60" }),
      row("BARE", { Insulation: "-", Integrity: "120" }),
      row("OK", { Insulation: "30", Integrity: "60" }),
      row("SHORT", { Insulation: "15", Integrity: "90" }),
    ]);
    const nominated = built.byCode.get("LOW");
    if (!nominated) throw new Error("missing LOW");
    const result = findCandidates(
      {
        id: "p",
        siteId: "site-a",
        orientation: "Wall",
        substrateDetail: nominated.substrateDetail,
        serviceType: nominated.serviceType,
        serviceSize: nominated.serviceSize,
        requiredIntegrityMinutes: 60,
        requiredInsulationMinutes: 30,
        nominatedCode: "LOW",
      },
      built,
    );
    expect(result.status).toBe("ok");
    expect(result.candidates.map((item) => item.internalCode)).toEqual(["OK"]);
  });

  it("a null integrity requirement accepts a lower offered rating than the nominated solution", () => {
    const built = buildCatalogue([
      row("NOMINATED", { Integrity: "120", Insulation: "-" }),
      row("LOW", { Integrity: "30", Insulation: "-" }),
    ]);
    const result = findCandidates(
      {
        id: "p",
        siteId: "site-a",
        orientation: "Wall",
        substrateDetail: "Plasterboard, 1 layer 13mm",
        serviceType: "PVC Pipe",
        serviceSize: "Ø50mm",
        requiredIntegrityMinutes: null,
        requiredInsulationMinutes: null,
        nominatedCode: "NOMINATED",
      },
      built,
    );
    expect(result.status).toBe("ok");
    expect(result.candidates.map((item) => item.internalCode)).toEqual(["LOW"]);
  });

  it("uses the penetration orientation rather than the nominated solution", () => {
    const built = buildCatalogue([
      row("FLOOR_NOM", { Orientation: "Floor" }),
      row("WALL_MATCH", { Orientation: "Wall" }),
      row("FLOOR_MATCH", { Orientation: "Floor" }),
    ]);
    const result = findCandidates(
      {
        id: "p",
        siteId: "site-a",
        orientation: "Wall",
        substrateDetail: "Plasterboard, 1 layer 13mm",
        serviceType: "PVC Pipe",
        serviceSize: "Ø50mm",
        requiredIntegrityMinutes: 60,
        requiredInsulationMinutes: 60,
        nominatedCode: "FLOOR_NOM",
      },
      built,
    );
    expect(result.status).toBe("ok");
    expect(result.candidates.map((item) => item.internalCode)).toEqual(["WALL_MATCH"]);
  });

  it("returns frozen catalogue solutions and a later search is unaffected", () => {
    const built = buildCatalogue([
      row("NOMINATED", { Integrity: "30" }),
      row("OTHER", { Integrity: "120" }),
    ]);
    const penetration: Penetration = {
      id: "p",
      siteId: "site-a",
      orientation: "Wall",
      substrateDetail: "Plasterboard, 1 layer 13mm",
      serviceType: "PVC Pipe",
      serviceSize: "Ø50mm",
      requiredIntegrityMinutes: 60,
      requiredInsulationMinutes: 60,
      nominatedCode: "NOMINATED",
    };
    const first = findCandidates(penetration, built);
    const candidate = first.candidates[0];
    expect(candidate?.internalCode).toBe("OTHER");
    expect(candidate).toBe(built.byCode.get("OTHER"));
    expect(Object.isFrozen(candidate)).toBe(true);
    expect(() => {
      if (!candidate) throw new Error("missing candidate");
      (candidate as { integrityMinutes: number }).integrityMinutes = 1;
    }).toThrow(TypeError);
    const second = findCandidates(penetration, built);
    expect(second.candidates.map((item) => item.internalCode)).toEqual(["OTHER"]);
    expect(second.candidates[0]?.integrityMinutes).toBe(120);
  });

  it("a null requirement is satisfied by any offered value", () => {
    const built = buildCatalogue([
      row("NOMINATED", { Integrity: "30", Insulation: "-" }),
      row("ANY", { Integrity: "120", Insulation: "-" }),
    ]);
    const nominated = built.byCode.get("NOMINATED");
    if (!nominated) throw new Error("missing NOMINATED");
    const result = findCandidates(
      {
        id: "p",
        siteId: "site-a",
        orientation: nominated.orientation,
        substrateDetail: nominated.substrateDetail,
        serviceType: nominated.serviceType,
        serviceSize: nominated.serviceSize,
        requiredIntegrityMinutes: null,
        requiredInsulationMinutes: null,
        nominatedCode: "NOMINATED",
      },
      built,
    );
    expect(result.candidates.map((item) => item.internalCode)).toEqual(["ANY"]);
  });

  it("does not match on substrate option or service type option", () => {
    const built = buildCatalogue([
      row("SOCKET", {
        Substrate: "Plasterboard, 1 layer 13mm",
        "Service Type": "PVC Socket",
        "Service Type Option": "PVC Pipe",
        "Substrate Option": "Plasterboard Wall",
      }),
      row("PIPE", {
        Substrate: "Plasterboard, 2 layer 13mm",
        "Service Type": "PVC Pipe",
        "Service Type Option": "PVC Pipe",
        "Substrate Option": "Plasterboard Wall",
      }),
      row("SAME", {
        Substrate: "Plasterboard, 1 layer 13mm",
        "Service Type": "PVC Socket",
        "Service Type Option": "Other",
        "Substrate Option": "Other",
        Integrity: "90",
      }),
    ]);
    const nominated = built.byCode.get("SOCKET");
    if (!nominated) throw new Error("missing SOCKET");
    const result = findCandidates(
      {
        id: "p",
        siteId: "site-a",
        orientation: "Wall",
        substrateDetail: nominated.substrateDetail,
        serviceType: nominated.serviceType,
        serviceSize: nominated.serviceSize,
        requiredIntegrityMinutes: 60,
        requiredInsulationMinutes: 60,
        nominatedCode: "SOCKET",
      },
      built,
    );
    expect(result.candidates.map((item) => item.internalCode)).toEqual(["SAME"]);
  });

  it("rejects a different orientation, a lower integrity, and an incomplete substrate row", () => {
    const built = buildCatalogue([
      row("NOMINATED"),
      row("FLOOR", { Orientation: "Floor" }),
      row("WEAK", { Integrity: "30" }),
      row("CUT", { Substrate: "Plasterboard," }),
      row("BIGGER", { Integrity: "90", Insulation: "90" }),
    ]);
    const result = findCandidates(
      {
        id: "p",
        siteId: "site-a",
        orientation: "Wall",
        substrateDetail: "Plasterboard, 1 layer 13mm",
        serviceType: "PVC Pipe",
        serviceSize: "Ø50mm",
        requiredIntegrityMinutes: 60,
        requiredInsulationMinutes: 60,
        nominatedCode: "NOMINATED",
      },
      built,
    );
    expect(result.candidates.map((item) => item.internalCode)).toEqual(["BIGGER"]);
  });

  it("checks the nominated code before the penetration substrate", () => {
    const built = buildCatalogue([row("S")]);
    const result = findCandidates(
      {
        id: "p",
        siteId: "site-a",
        orientation: "Wall",
        substrateDetail: "FR plasterboard,",
        serviceType: "PVC Pipe",
        serviceSize: "Ø50mm",
        requiredIntegrityMinutes: 60,
        requiredInsulationMinutes: null,
        nominatedCode: "MISSING",
      },
      built,
    );
    expect(result.status).toBe("nominated_code_unknown");
  });

  function handmade(partial: Pick<Solution, "internalCode" | "integrityMinutes" | "insulationMinutes"> & Partial<Solution>): Solution {
    return {
      supplierRefCode: `ref-${partial.internalCode}`,
      supplier: "Ryanfire",
      orientation: "Wall",
      substrateDetail: "Plasterboard, 1 layer 13mm",
      substrateOption: "Plasterboard Wall",
      serviceClassification: "Combustible Pipe",
      serviceType: "PVC Pipe",
      serviceTypeOption: "PVC Pipe",
      serviceSize: "Ø50mm",
      key: {
        substrate: "plasterboard, 1 layer 13mm",
        serviceType: "pvc pipe",
        serviceSize: "ø50mm",
      },
      substrateIncomplete: false,
      ...partial,
    };
  }

  function handmadeCatalogue(solutions: readonly Solution[]): Catalogue {
    return {
      solutions,
      byCode: new Map(solutions.map((item) => [item.internalCode, item])),
      incompleteCodes: [],
    };
  }

  it("a non-finite stated requirement returns ok with no candidates", () => {
    const built = buildCatalogue([row("NOMINATED"), row("OTHER", { Integrity: "240", Insulation: "240" })]);
    const base: Penetration = {
      id: "p",
      siteId: "site-a",
      orientation: "Wall",
      substrateDetail: "Plasterboard, 1 layer 13mm",
      serviceType: "PVC Pipe",
      serviceSize: "Ø50mm",
      requiredIntegrityMinutes: 60,
      requiredInsulationMinutes: 60,
      nominatedCode: "NOMINATED",
    };
    for (const requirement of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(findCandidates({ ...base, requiredIntegrityMinutes: requirement }, built)).toEqual({ status: "ok", candidates: [] });
      expect(findCandidates({ ...base, requiredInsulationMinutes: requirement }, built)).toEqual({ status: "ok", candidates: [] });
    }
  });

  it("rejects a solution whose offered rating is not finite", () => {
    const nominated = handmade({ internalCode: "NOMINATED", integrityMinutes: 60, insulationMinutes: 60 });
    const penetration: Penetration = {
      id: "p",
      siteId: "site-a",
      orientation: "Wall",
      substrateDetail: nominated.substrateDetail,
      serviceType: nominated.serviceType,
      serviceSize: nominated.serviceSize,
      requiredIntegrityMinutes: 60,
      requiredInsulationMinutes: 60,
      nominatedCode: "NOMINATED",
    };
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const badIntegrity = findCandidates(penetration, handmadeCatalogue([nominated, handmade({ internalCode: "BAD", integrityMinutes: bad, insulationMinutes: 60 })]));
      const badInsulation = findCandidates(penetration, handmadeCatalogue([nominated, handmade({ internalCode: "BAD", integrityMinutes: 120, insulationMinutes: bad })]));
      expect(badIntegrity).toEqual({ status: "ok", candidates: [] });
      expect(badInsulation).toEqual({ status: "ok", candidates: [] });
    }
  });

  it("reports substrate_incomplete from the penetration even when the nominated solution is complete", () => {
    const built = buildCatalogue([row("S")]);
    const result = findCandidates(
      {
        id: "p",
        siteId: "site-a",
        orientation: "Wall",
        substrateDetail: "FR plasterboard,",
        serviceType: "PVC Pipe",
        serviceSize: "Ø50mm",
        requiredIntegrityMinutes: null,
        requiredInsulationMinutes: null,
        nominatedCode: "S",
      },
      built,
    );
    expect(result).toEqual({ status: "substrate_incomplete", candidates: [] });
  });
});
