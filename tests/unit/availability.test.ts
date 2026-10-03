import { describe, expect, it } from "vitest";
import { describeCandidateAvailability, type SolutionMaterial, type StockBalance } from "@/domain";

function material(materialId: string, quantityPerInstall: number, internalCode = "0451"): SolutionMaterial {
  return { internalCode, materialId, quantityPerInstall };
}

function stock(materialId: string, quantity: number, location = "Warehouse"): StockBalance {
  return { materialId, location, quantity };
}

describe("describeCandidateAvailability", () => {
  it("returns no_material_mapping and no lines when the code has no rows", () => {
    expect(describeCandidateAvailability("0464", [material("MAT-PUTTY", 1, "0451")], [])).toEqual({
      internalCode: "0464",
      overall: "no_material_mapping",
      lines: [],
    });
  });

  it.each([
    ["negative", -1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ] as const)("a %s quantity is invalid_quantity with no lines", (_label, quantity) => {
    const result = describeCandidateAvailability("0451", [material("MAT-PUTTY", 1), material("MAT-SEALANT", quantity)], [
      stock("MAT-PUTTY", 20),
    ]);
    expect(result).toEqual({ internalCode: "0451", overall: "invalid_quantity", lines: [] });
  });

  it("rounds each row up, snaps on hand across locations, and keeps input order", () => {
    const result = describeCandidateAvailability(
      "0451",
      [material("MAT-PUTTY", 1), material("MAT-SEALANT", 0.25)],
      [stock("MAT-SEALANT", 6), stock("MAT-SEALANT", 2, "Van 2"), stock("MAT-PUTTY", 20), stock("MAT-WRAP", 12)],
    );
    expect(result).toEqual({
      internalCode: "0451",
      overall: "in_stock",
      lines: [
        { materialId: "MAT-PUTTY", quantityPerInstall: 1, requiredQty: 1, onHandQty: 20, status: "in_stock" },
        { materialId: "MAT-SEALANT", quantityPerInstall: 0.25, requiredQty: 1, onHandQty: 8, status: "in_stock" },
      ],
    });
  });

  it("any short line makes the overall short, ahead of an unknown line", () => {
    const result = describeCandidateAvailability("X", [material("A", 5, "X"), material("B", 1, "X")], [stock("A", 1)]);
    expect(result.overall).toBe("short");
    expect(result.lines).toEqual([
      { materialId: "A", quantityPerInstall: 5, requiredQty: 5, onHandQty: 1, status: "short" },
      { materialId: "B", quantityPerInstall: 1, requiredQty: 1, onHandQty: null, status: "unknown" },
    ]);
  });

  it("unknown wins over in_stock when nothing is short", () => {
    const result = describeCandidateAvailability(
      "Y",
      [material("A", 1, "Y"), material("B", 2.2, "Y")],
      [stock("A", 5), stock("B", -1)],
    );
    expect(result.overall).toBe("unknown");
    expect(result.lines[0]).toEqual({ materialId: "A", quantityPerInstall: 1, requiredQty: 1, onHandQty: 5, status: "in_stock" });
    expect(result.lines[1]).toEqual({ materialId: "B", quantityPerInstall: 2.2, requiredQty: 3, onHandQty: null, status: "unknown" });
  });

  it("required equal to on hand is in_stock", () => {
    const result = describeCandidateAvailability("Z", [material("A", 2.2, "Z")], [stock("A", 3)]);
    expect(result.overall).toBe("in_stock");
    expect(result.lines[0]).toEqual({
      materialId: "A",
      quantityPerInstall: 2.2,
      requiredQty: 3,
      onHandQty: 3,
      status: "in_stock",
    });
  });

  it("sums duplicate material rows before rounding, in first-seen order", () => {
    const result = describeCandidateAvailability(
      "DUP",
      [material("MAT-SEALANT", 5, "DUP"), material("MAT-PUTTY", 1, "DUP"), material("MAT-SEALANT", 5, "DUP")],
      [stock("MAT-SEALANT", 6), stock("MAT-SEALANT", 2, "Van 2"), stock("MAT-PUTTY", 20)],
    );
    expect(result).toEqual({
      internalCode: "DUP",
      overall: "short",
      lines: [
        { materialId: "MAT-SEALANT", quantityPerInstall: 10, requiredQty: 10, onHandQty: 8, status: "short" },
        { materialId: "MAT-PUTTY", quantityPerInstall: 1, requiredQty: 1, onHandQty: 20, status: "in_stock" },
      ],
    });
  });

  it("rounds the summed quantity once", () => {
    const result = describeCandidateAvailability(
      "DUP",
      [material("MAT-SEALANT", 0.25, "DUP"), material("MAT-SEALANT", 0.25, "DUP")],
      [stock("MAT-SEALANT", 1)],
    );
    expect(result.overall).toBe("in_stock");
    expect(result.lines).toEqual([
      { materialId: "MAT-SEALANT", quantityPerInstall: 0.5, requiredQty: 1, onHandQty: 1, status: "in_stock" },
    ]);
  });

  it("a non-finite stock sum is unknown", () => {
    const result = describeCandidateAvailability(
      "Z",
      [material("A", 1, "Z")],
      [stock("A", 1e308, "a"), stock("A", 1e308, "b")],
    );
    expect(result.lines[0]).toEqual(expect.objectContaining({ onHandQty: null, status: "unknown" }));
    expect(result.overall).toBe("unknown");
  });
});
