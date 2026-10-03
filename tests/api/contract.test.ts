import { describe, expect, it } from "vitest";
import { loadCatalogueFromCsv } from "@/adapters/catalogue-csv";
import {
  IdSchema,
  NominationsFileSchema,
  SitesFileSchema,
  SolutionMaterialsFileSchema,
  StockBalanceSchema,
  StockFileSchema,
} from "@/ports";
import nominationsFile from "../../data/sample/nominations.json";
import sitesFile from "../../data/sample/sites.json";
import solutionMaterialsFile from "../../data/sample/solution-materials.json";
import stockFile from "../../data/sample/stock.json";

describe("upstream contract", () => {
  it("AC 27: every sample file validates, codes and ids line up, and no id contains a colon", () => {
    const sites = SitesFileSchema.parse(sitesFile);
    const nominations = NominationsFileSchema.parse(nominationsFile);
    const stock = StockFileSchema.parse(stockFile);
    const materials = SolutionMaterialsFileSchema.parse(solutionMaterialsFile);
    const catalogue = loadCatalogueFromCsv();

    expect(sites.sites.length).toBeGreaterThan(0);
    expect(Object.keys(nominations.bySite)).toEqual(sites.sites.map((site) => site.id));

    const materialIds = new Set(materials.materials.map((material) => material.id));
    let missingCode = 0;
    for (const [siteId, penetrations] of Object.entries(nominations.bySite)) {
      expect(siteId).not.toContain(":");
      for (const penetration of penetrations) {
        expect(penetration.siteId).toBe(siteId);
        expect(penetration.id).not.toContain(":");
        if (penetration.nominatedCode === "9999") {
          missingCode += 1;
          expect(catalogue.byCode.has(penetration.nominatedCode)).toBe(false);
        } else {
          expect(catalogue.byCode.has(penetration.nominatedCode)).toBe(true);
        }
      }
    }
    expect(missingCode).toBe(1);

    for (const material of materials.materials) expect(material.id).not.toContain(":");
    for (const item of materials.items) expect(materialIds.has(item.materialId)).toBe(true);
    for (const balance of stock.balances) {
      expect(balance.materialId).not.toContain(":");
      expect(materialIds.has(balance.materialId)).toBe(true);
    }
  });

  it("accepts a negative finite quantity, ignores extra fields, and rejects a bad id or a non-finite number", () => {
    const parsed = StockBalanceSchema.parse({ materialId: "MAT-SEALANT", location: "Warehouse", quantity: -2, note: "do-not-keep" });
    expect(parsed).toEqual({ materialId: "MAT-SEALANT", location: "Warehouse", quantity: -2 });
    expect(IdSchema.safeParse("site:b").success).toBe(false);
    expect(StockBalanceSchema.safeParse({ materialId: "MAT-SEALANT", location: "Warehouse", quantity: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(StockBalanceSchema.safeParse({ materialId: "MAT-SEALANT", location: "Warehouse" }).success).toBe(false);
  });
});
