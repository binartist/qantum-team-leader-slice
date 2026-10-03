import { describe, expect, it } from "vitest";
import { makeStubs } from "@/adapters/stub";
import { UpstreamError } from "@/ports";

describe("sample stubs", () => {
  it("returns validated sample data and only the requested stock and codes", async () => {
    const stubs = makeStubs();
    const sites = await stubs.sites.listSites();
    expect(sites.map((site) => site.id)).toEqual(["site-a", "site-b", "site-c", "site-d"]);
    expect(await stubs.sites.getSite("site-d")).toMatchObject({ id: "site-d", name: "Old Mill Annex" });
    expect(await stubs.sites.getSite("missing")).toBeNull();

    const nominations = await stubs.nominations.getNominations("site-d");
    expect(nominations).toEqual([]);
    expect(await stubs.nominations.getNominations("missing")).toBeNull();

    const stock = await stubs.stock.getStock(["MAT-SEALANT", "MAT-MISSING"]);
    expect(stock.balances.map((balance) => balance.materialId)).toEqual(["MAT-SEALANT", "MAT-SEALANT"]);
    expect(stock.asOf).toBe("2026-10-03T08:00:00Z");

    const materials = await stubs.solutionMaterials.getSolutionMaterials(["0451", "0464"]);
    expect(materials.items.map((item) => item.internalCode)).toEqual(["0451", "0451"]);
    expect(materials.materials.map((material) => material.id).sort()).toEqual(["MAT-PUTTY", "MAT-SEALANT"]);
  });

  it("AC 9: down throws upstream_unavailable and malformed throws upstream_invalid, with no raw payload", async () => {
    const down = makeStubs({ stock: "down", sites: "down", nominations: "down", solutionMaterials: "down" });
    await expect(down.stock.getStock(["MAT-SEALANT"])).rejects.toMatchObject({ code: "upstream_unavailable", system: "stock" });
    await expect(down.sites.listSites()).rejects.toBeInstanceOf(UpstreamError);
    await expect(down.nominations.getNominations("site-a")).rejects.toMatchObject({
      code: "upstream_unavailable",
      system: "nominations",
    });
    await expect(down.solutionMaterials.getSolutionMaterials(["0438"])).rejects.toMatchObject({
      code: "upstream_unavailable",
      system: "solution_materials",
    });

    const malformed = makeStubs({ stock: "malformed", sites: "malformed", nominations: "malformed", solutionMaterials: "malformed" });
    const error = await malformed.stock.getStock(["MAT-SEALANT"]).then(
      () => {
        throw new Error("malformed stock was accepted");
      },
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ code: "upstream_invalid", system: "stock" });
    expect(String(error)).not.toContain("Infinity");
    expect(String(error)).not.toContain("node_modules");
    await expect(malformed.sites.listSites()).rejects.toMatchObject({ code: "upstream_invalid" });
    await expect(malformed.nominations.getNominations("site-a")).rejects.toMatchObject({ code: "upstream_invalid" });
    await expect(malformed.solutionMaterials.getSolutionMaterials(["0438"])).rejects.toMatchObject({ code: "upstream_invalid" });
  });

  it("empty mode is valid and contains no rows", async () => {
    const stubs = makeStubs({ sites: "empty", nominations: "empty", stock: "empty", solutionMaterials: "empty" });
    expect(await stubs.sites.listSites()).toEqual([]);
    expect(await stubs.nominations.getNominations("site-a")).toBeNull();
    expect(await stubs.stock.getStock(["MAT-SEALANT"])).toEqual({ asOf: "2026-10-03T08:00:00Z", balances: [] });
    expect(await stubs.solutionMaterials.getSolutionMaterials(["0438"])).toEqual({ materials: [], items: [] });
  });
});
