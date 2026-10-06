import { describe, expect, it } from "vitest";
import { materialBack, materialState, uncheckedBanner } from "@/ui/materials";

const row = { onHandQty: 5, plannedQty: 4, neededSiteCount: 2, shortSiteCount: 0, uncheckedSiteCount: 0 };

describe("AC 38: a materials-list row never reassures beyond what was checked", () => {
  it("says not short only when the stock is known, every site was checked and the sites together fit", () => {
    expect(materialState(row)).toBeNull();
  });

  it("names short sites first, as danger", () => {
    expect(materialState({ ...row, shortSiteCount: 2, uncheckedSiteCount: 1 })).toEqual({ label: "Short at 2 sites", tone: "danger", icon: "stop" });
  });

  it("warns on unknown stock, with where it is needed", () => {
    expect(materialState({ ...row, onHandQty: null, neededSiteCount: 1, shortSiteCount: 1 })).toEqual({
      label: "Stock unknown · needed at 1 site",
      tone: "warning",
      icon: "warning",
    });
    expect(materialState({ ...row, onHandQty: null })?.label).toBe("Stock unknown · needed at 2 sites");
  });

  it("warns when a site could not be checked, never null", () => {
    expect(materialState({ ...row, plannedQty: null, uncheckedSiteCount: 1 })).toEqual({
      label: "1 site couldn't be checked",
      tone: "warning",
      icon: "warning",
    });
  });

  it("warns when no site is short alone but the sites together need more than on hand (shared, not reserved)", () => {
    expect(materialState({ ...row, onHandQty: 5, plannedQty: 6 })).toEqual({
      label: "Sites together need more than on hand",
      tone: "warning",
      icon: "warning",
    });
    expect(materialState({ ...row, onHandQty: 6, plannedQty: 6 })).toBeNull();
  });

  it("words the unchecked banner for one site and for several", () => {
    expect(uncheckedBanner(1)).toBe("1 site couldn't be checked. Its needs are not counted.");
    expect(uncheckedBanner(2)).toBe("2 sites couldn't be checked. Their needs are not counted.");
  });
});

describe("AC 42: the material page's back control", () => {
  it("returns to the penetration it was opened from, named by its place", () => {
    expect(materialBack({ siteId: "site-b", penetrationId: "pen-b-01", floor: "L3", location: "Riser 2" })).toEqual({
      href: "/sites/site-b/penetrations/pen-b-01",
      name: "L3, Riser 2",
    });
  });

  it("returns to Materials otherwise", () => {
    expect(materialBack(null)).toEqual({ href: "/materials", name: "Materials" });
  });
});
