import { describe, expect, it } from "vitest";
import { describePenetration, loadSiteData } from "@/application";
import { testDependencies } from "../api/support";

describe("page-only material ids for a site's penetration rows", () => {
  it("lists each penetration's nominated-solution materials in the same order as the penetration page", async () => {
    const deps = testDependencies();
    const data = await loadSiteData(deps, "site-b");
    const ids = Object.keys(data.sitePenetrations);
    expect(ids.length).toBeGreaterThan(0);
    for (const penetrationId of ids) {
      const detail = await describePenetration(deps, "site-b", penetrationId);
      expect(data.penetrationMaterialIds[penetrationId]).toEqual(detail.materialIds);
    }
    expect(data.penetrationMaterialIds["pen-b-01"]).toEqual(["MAT-COLLAR-25", "MAT-SEALANT"]);
  });
});
