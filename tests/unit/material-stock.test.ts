import { describe, expect, it } from "vitest";
import { describeMaterialStock, listMaterialStock, type Dependencies } from "@/application";
import { MaterialNotFoundError, UpstreamError } from "@/ports";
import { testDependencies } from "../api/support";

/** One site's nominations fail upstream, or are missing; the others read normally. */
function withSiteDown(siteId: string, failure: "upstream" | "missing" = "upstream"): Dependencies {
  const deps = testDependencies();
  return {
    ...deps,
    nominations: {
      getNominations: async (id: string) => {
        if (id !== siteId) return deps.nominations.getNominations(id);
        if (failure === "missing") return null;
        throw new UpstreamError("upstream_unavailable", "nominations");
      },
    },
  };
}

/** Counts stock reads, and can make every stock read fail. */
function countingStock(fail = false): { deps: Dependencies; reads: () => number } {
  const deps = testDependencies();
  let reads = 0;
  return {
    reads: () => reads,
    deps: {
      ...deps,
      stock: {
        getStock: async (ids: readonly string[]) => {
          reads += 1;
          if (fail) throw new UpstreamError("upstream_unavailable", "stock");
          return deps.stock.getStock(ids);
        },
      },
    },
  };
}

describe("AC 38: the materials list, across sites", () => {
  it("lists each planned material by name with on hand, the across-sites need and the short sites", async () => {
    const list = await listMaterialStock(testDependencies());
    expect(list.stockNotice).toBe("On hand, shared, not reserved");
    expect(list.stockAsOf).toBe("2026-10-03T08:00:00Z");
    expect(list.asOf).toBe("2026-10-03T12:00:00.000Z");
    expect(list.uncheckedSiteCount).toBe(0);
    expect(list.materials.map((item) => [item.id, item.onHandQty, item.plannedQty, item.neededSiteCount, item.shortSiteCount])).toEqual([
      ["MAT-MASTIC", null, 1, 1, 1],
      ["MAT-SEALANT", 8, 12, 2, 1],
      ["MAT-WRAP", 12, 9, 2, 0],
      ["MAT-BATT", 10, 6, 1, 0],
      ["MAT-COLLAR-25", 2, 6, 2, 1],
      ["MAT-COLLAR-32", 5, 3, 1, 0],
    ]);
    // Putty is mapped only to a substitute nobody nominates, so no site plans it.
    expect(list.materials.some((item) => item.id === "MAT-PUTTY")).toBe(false);
  });

  it("reads the stock once for the whole page, so every figure on it comes from the same read", async () => {
    const { deps, reads } = countingStock();
    await listMaterialStock(deps);
    expect(reads()).toBe(1);
    await describeMaterialStock(deps, "MAT-SEALANT");
    expect(reads()).toBe(2);
  });

  it("never claims a total while a site could not be checked, whether upstream failed or the site is missing", async () => {
    for (const failure of ["upstream", "missing"] as const) {
      const list = await listMaterialStock(withSiteDown("site-a", failure));
      expect(list.uncheckedSiteCount, failure).toBe(1);
      expect(list.materials.every((item) => item.plannedQty === null), failure).toBe(true);
      expect(list.materials.find((item) => item.id === "MAT-COLLAR-25"), failure).toMatchObject({
        onHandQty: 2,
        neededSiteCount: 1,
        shortSiteCount: 1,
      });
    }
  });

  it("is unavailable when the stock cannot be read, never zero", async () => {
    await expect(listMaterialStock(testDependencies({ stock: "down" }))).rejects.toBeInstanceOf(UpstreamError);
    await expect(listMaterialStock(testDependencies({ stock: "malformed" }))).rejects.toBeInstanceOf(UpstreamError);
    await expect(listMaterialStock(countingStock(true).deps)).rejects.toBeInstanceOf(UpstreamError);
  });

  it("reads no stock and claims no stock figures when nothing is planned", async () => {
    const { deps, reads } = countingStock();
    const empty: Dependencies = { ...deps, nominations: { getNominations: async () => [] } };
    const list = await listMaterialStock(empty);
    expect(list.materials).toEqual([]);
    expect(list.stockAsOf).toBeNull();
    expect(reads()).toBe(0);
  });

  it("is unavailable when no site can be read at all", async () => {
    await expect(listMaterialStock(testDependencies({ nominations: "down" }))).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe("AC 39: one material across sites", () => {
  it("gives each planning site, in site order, its need, places and shortage", async () => {
    const detail = await describeMaterialStock(testDependencies(), "MAT-COLLAR-25");
    expect(detail.material).toMatchObject({ name: "Pipe collar for 25 mm pipe", onHandQty: 2, plannedQty: 6, shortSiteCount: 1 });
    expect(detail.sites.map((site) => site.siteId)).toEqual(["site-a", "site-b"]);
    const [riverside, harbour] = detail.sites;
    expect(riverside).toMatchObject({ status: "ready", siteName: "Riverside Plaza, Block A", requiredQty: 2, shortage: null });
    expect(harbour).toMatchObject({
      status: "ready",
      requiredQty: 4,
      shortage: { id: "site-b:MAT-COLLAR-25", kind: "short", shortfallQty: 2, state: "open" },
    });
    if (harbour?.status !== "ready") throw new Error("expected a ready section");
    expect(harbour.places.map((place) => place.id)).toEqual(["pen-b-01", "pen-b-02", "pen-b-03", "pen-b-04"]);
    expect(harbour.places[0]).toMatchObject({ floor: "L3", location: "Riser 2", serviceType: "PEX Pipe" });
    expect(detail.back).toBeNull();
  });

  it("keeps a stock-unknown shortage as a shortage with no on-hand figure", async () => {
    const detail = await describeMaterialStock(testDependencies(), "MAT-MASTIC");
    expect(detail.material.onHandQty).toBeNull();
    expect(detail.sites).toHaveLength(1);
    expect(detail.sites[0]).toMatchObject({ siteId: "site-c", requiredQty: 1, shortage: { kind: "unknown", onHandQty: null } });
  });

  it("lists a site that could not be checked after the others, and gives no total", async () => {
    const detail = await describeMaterialStock(withSiteDown("site-a"), "MAT-COLLAR-25");
    expect(detail.sites.map((site) => [site.siteId, site.status])).toEqual([
      ["site-b", "ready"],
      ["site-a", "unavailable"],
    ]);
    expect(detail.material.plannedQty).toBeNull();
  });

  it("is not found for a material no site plans, and unavailable when no planning site could be checked", async () => {
    await expect(describeMaterialStock(testDependencies(), "MAT-PUTTY")).rejects.toBeInstanceOf(MaterialNotFoundError);
    await expect(describeMaterialStock(withSiteDown("site-c"), "MAT-MASTIC")).rejects.toBeInstanceOf(UpstreamError);
    await expect(describeMaterialStock(countingStock(true).deps, "MAT-SEALANT")).rejects.toBeInstanceOf(UpstreamError);
  });

  it("rethrows a failure that is not an upstream outage", async () => {
    const deps = testDependencies();
    const broken: Dependencies = { ...deps, nominations: { getNominations: async () => Promise.reject(new TypeError("bug")) } };
    await expect(listMaterialStock(broken)).rejects.toBeInstanceOf(TypeError);
  });
});

describe("AC 42: where a material page's back control returns", () => {
  it("returns to a penetration of a planning site, including one whose substitute opened the page", async () => {
    expect((await describeMaterialStock(testDependencies(), "MAT-COLLAR-25", "pen-b-01")).back).toEqual({
      siteId: "site-b",
      penetrationId: "pen-b-01",
      floor: "L3",
      location: "Riser 2",
    });
    // pen-b-10 nominates 0344 (no collar), but Harbour Point plans the collar, so a substitute line there could open it.
    expect((await describeMaterialStock(testDependencies(), "MAT-COLLAR-25", "pen-b-10")).back).toMatchObject({ penetrationId: "pen-b-10" });
    expect((await describeMaterialStock(testDependencies(), "MAT-MASTIC", "pen-c-05")).back).toMatchObject({ siteId: "site-c" });
  });

  it("does not return to a site that does not plan the material, an unknown id, or an object key", async () => {
    for (const from of ["pen-c-05", "pen-none", "constructor", "__proto__", "toString", undefined]) {
      expect((await describeMaterialStock(testDependencies(), "MAT-COLLAR-25", from)).back, String(from)).toBeNull();
    }
  });

  it("does not return to a penetration of a site that could not be checked", async () => {
    expect((await describeMaterialStock(withSiteDown("site-a"), "MAT-COLLAR-25", "pen-a-05")).back).toBeNull();
  });
});
