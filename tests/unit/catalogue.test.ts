import { parse } from "csv-parse/sync";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCatalogueFromCsv } from "@/adapters/catalogue-csv";
import { buildCatalogue, normaliseText, type RawCatalogueRow } from "@/domain";

const csvPath = new URL("../../data/solutions-excerpt.csv", import.meta.url);
const csvText = readFileSync(csvPath, "utf8");

function parsedRows(): RawCatalogueRow[] {
  return parse<RawCatalogueRow>(csvText, { columns: true, bom: true, skip_empty_lines: true });
}

function row(code: string, overrides: Record<string, string> = {}): RawCatalogueRow {
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
    ...overrides,
  };
}

describe("catalogue load (AC 26)", () => {
  const catalogue = loadCatalogueFromCsv();
  const rows = parsedRows();

  it("AC 26: loads 148 solutions and preserves raw text for every row", () => {
    expect(catalogue.solutions).toHaveLength(148);
    expect(rows).toHaveLength(148);
    catalogue.solutions.forEach((solution, index) => {
      const source = rows[index];
      expect(source).toBeDefined();
      if (!source) return;
      expect(solution.internalCode).toBe(source["Internal Code"]);
      expect(solution.supplierRefCode).toBe(source["Supplier Ref. Code"]);
      expect(solution.supplier).toBe(source.Supplier);
      expect(solution.orientation).toBe(source.Orientation);
      expect(solution.substrateDetail).toBe(source.Substrate);
      expect(solution.substrateOption).toBe(source["Substrate Option"]);
      expect(solution.serviceClassification).toBe(source["Service Classification"]);
      expect(solution.serviceType).toBe(source["Service Type"]);
      expect(solution.serviceTypeOption).toBe(source["Service Type Option"]);
      expect(solution.serviceSize).toBe(source["Service Size"]);
      expect(solution.integrityMinutes).toBe(Number(source.Integrity));
      expect(solution.insulationMinutes).toBe(source.Insulation === "-" ? null : Number(source.Insulation));
    });

    const complete = catalogue.byCode.get("0452");
    const incomplete = catalogue.byCode.get("0955");
    expect(complete?.substrateIncomplete).toBe(false);
    expect(complete?.key).toEqual({
      substrate: "fr plasterboard, fr plasterboard wall (1 layer 13mm)",
      serviceType: "pex-al pipe",
      serviceSize: "ø25mm",
    });
    expect(incomplete?.substrateIncomplete).toBe(true);
  });

  it("AC 26: flags exactly the six incomplete substrates, in input order", () => {
    expect(catalogue.incompleteCodes).toEqual(["0853", "0943", "0944", "0946", "0952", "0955"]);
  });

  it("AC 26: stores a dash insulation as null on exactly eight solutions", () => {
    const missing = catalogue.solutions.filter((solution) => solution.insulationMinutes === null);
    expect(missing.map((solution) => solution.internalCode)).toEqual([
      "0334",
      "0335",
      "0722",
      "0724",
      "0804",
      "0811",
      "0813",
      "0968",
    ]);
  });

  it("resolves the default CSV from the adapter file, not the process cwd", () => {
    const explicit = loadCatalogueFromCsv(csvPath.pathname);
    expect(explicit.solutions.map((solution) => solution.internalCode)).toEqual(
      catalogue.solutions.map((solution) => solution.internalCode),
    );
  });
});

describe("normalisation of real catalogue rows", () => {
  const catalogue = loadCatalogueFromCsv();

  function solution(code: string) {
    const found = catalogue.byCode.get(code);
    if (!found) throw new Error(`missing solution ${code}`);
    return found;
  }

  it("0375: collapses the double space in the service type", () => {
    const item = solution("0375");
    expect(item.serviceType).toContain("  ");
    expect(item.key.serviceType).toBe("copper pipe - 50mm fibreglass");
    expect(item.key.serviceType).not.toContain("  ");
  });

  it("0452 and 0479: removes the space just inside the substrate brackets", () => {
    expect(solution("0452").substrateDetail).toContain("( 1 layer 13mm)");
    expect(solution("0452").key.substrate).toContain("(1 layer 13mm)");
    expect(solution("0479").substrateDetail).toContain("( 1 layer 13mm)");
    expect(solution("0479").key.substrate).toContain("(1 layer 13mm)");
  });

  it("0734: removes the space in (51 mm)", () => {
    expect(solution("0734").substrateDetail).toContain("(51 mm)");
    expect(solution("0734").key.substrate).toContain("(51mm)");
  });

  it("treats a case-only substrate difference as the same key", () => {
    const lower = solution("0485");
    const mixed = solution("0970");
    expect(lower.substrateDetail).not.toBe(mixed.substrateDetail);
    expect(lower.key.substrate).toBe(mixed.key.substrate);
    expect(lower.key.substrate).toBe("timber infill, 100mm timber infill floor");
  });

  it("does not strip a trailing comma from an incomplete substrate", () => {
    const item = solution("0943");
    expect(item.substrateDetail).toBe("FR plasterboard,");
    expect(item.key.substrate).toBe("fr plasterboard,");
    expect(item.substrateIncomplete).toBe(true);
  });

  it("keeps Ø50mm different from 50mm", () => {
    const sized = catalogue.solutions.find((item) => item.serviceSize === "Ø50mm");
    expect(sized).toBeDefined();
    expect(sized?.key.serviceSize).toBe("ø50mm");
    expect(sized?.key.serviceSize).not.toBe(normaliseText("50mm"));
  });

  it("0534 and 0535: does not merge substrates worded two ways", () => {
    expect(solution("0534").key.substrate).not.toBe(solution("0535").key.substrate);
    expect(solution("0534").key.substrate).toContain("concrete");
    expect(solution("0535").key.substrate).not.toContain("concrete");
  });
});

describe("buildCatalogue errors", () => {
  it("throws on a duplicate internal code", () => {
    expect(() => buildCatalogue([row("0334"), row("0334")])).toThrow(/duplicate internal code/i);
  });

  it("throws on non-numeric integrity", () => {
    expect(() => buildCatalogue([row("0334", { Integrity: "sixty" })])).toThrow(/non-numeric integrity/i);
    expect(() => buildCatalogue([row("0334", { Integrity: "" })])).toThrow(/non-numeric integrity/i);
  });

  it("throws on an unknown orientation", () => {
    expect(() => buildCatalogue([row("0334", { Orientation: "Roof" })])).toThrow(/unknown orientation/i);
  });

  it("throws on a missing column", () => {
    const incomplete = row("0334");
    delete incomplete.Integrity;
    expect(() => buildCatalogue([incomplete])).toThrow(/missing column/i);
  });

  it("throws on non-numeric insulation", () => {
    expect(() => buildCatalogue([row("0334", { Insulation: "none" })])).toThrow(/non-numeric insulation/i);
  });

  it("returns an empty catalogue for no rows", () => {
    const catalogue = buildCatalogue([]);
    expect(catalogue.solutions).toEqual([]);
    expect(catalogue.incompleteCodes).toEqual([]);
    expect(catalogue.byCode.size).toBe(0);
  });

  it("parses a dash insulation as null and keeps raw substrate text", () => {
    const catalogue = buildCatalogue([
      row("0334", { Insulation: "-", Substrate: "  FR plasterboard,  " }),
    ]);
    const solution = catalogue.byCode.get("0334");
    expect(solution?.insulationMinutes).toBeNull();
    expect(solution?.integrityMinutes).toBe(60);
    expect(solution?.substrateDetail).toBe("  FR plasterboard,  ");
    expect(solution?.substrateIncomplete).toBe(true);
    expect(catalogue.incompleteCodes).toEqual(["0334"]);
  });

  it("freezes each solution, its key, the solutions array, and incompleteCodes", () => {
    const catalogue = buildCatalogue([row("0334"), row("0943", { Substrate: "FR plasterboard," })]);
    expect(Object.isFrozen(catalogue.solutions)).toBe(true);
    expect(Object.isFrozen(catalogue.incompleteCodes)).toBe(true);
    for (const solution of catalogue.solutions) {
      expect(Object.isFrozen(solution)).toBe(true);
      expect(Object.isFrozen(solution.key)).toBe(true);
    }
    expect(catalogue.incompleteCodes).toEqual(["0943"]);
  });

  it("throws when a numeric cell overflows instead of loading a non-finite rating", () => {
    const overflow = "9".repeat(400);
    for (const field of ["Integrity", "Insulation"] as const) {
      let thrown: unknown;
      try {
        buildCatalogue([row("0334", { [field]: overflow })]);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      const message = thrown instanceof Error ? thrown.message : "";
      expect(message).not.toContain(overflow);
    }
  });

  it("parses padded integrity and a padded insulation dash", () => {
    const catalogue = buildCatalogue([row("0334", { Integrity: " 60 ", Insulation: " - " })]);
    const solution = catalogue.byCode.get("0334");
    expect(solution?.integrityMinutes).toBe(60);
    expect(solution?.insulationMinutes).toBeNull();
  });

  it("truncates a very long bad cell in the parser error", () => {
    const raw = `NOT-A-NUMBER-${"X".repeat(180)}`;
    let thrown: unknown;
    try {
      buildCatalogue([row("0334", { Integrity: raw })]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = thrown instanceof Error ? thrown.message : "";
    expect(message.length).toBeLessThanOrEqual(80);
    expect(message).toContain("…");
    expect(message).not.toContain(raw);
  });
});

describe("catalogue file boundaries", () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it("loads the default catalogue when the working directory has no data directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "catalogue-cwd-"));
    try {
      process.chdir(dir);
      vi.resetModules();
      const adapter = await import("@/adapters/catalogue-csv");
      expect(adapter.loadCatalogueFromCsv().solutions).toHaveLength(148);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not include the path when the catalogue file is missing", () => {
    const missing = join(tmpdir(), "catalogue-missing-does-not-exist.csv");
    let thrown: unknown;
    try {
      loadCatalogueFromCsv(missing);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = thrown instanceof Error ? thrown.message : "";
    expect(message).toBe("catalogue file could not be read");
    expect(message).not.toContain(missing);
  });

  it("refuses a catalogue file over 1 MiB", () => {
    const path = join(tmpdir(), `catalogue-too-large-${process.pid}.csv`);
    writeFileSync(path, Buffer.alloc(1024 * 1024 + 1));
    try {
      let thrown: unknown;
      try {
        loadCatalogueFromCsv(path);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect(thrown instanceof Error ? thrown.message : "").toBe("catalogue file is too large");
    } finally {
      unlinkSync(path);
    }
  });
});
