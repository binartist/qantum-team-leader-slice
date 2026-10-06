import { describe, expect, it } from "vitest";
import { materialTabHref, parseMaterialTab } from "@/ui/material-tabs";

describe("AC 46: material page tabs", () => {
  it("stays on Stock unless the query is the single value log", () => {
    expect(parseMaterialTab(undefined)).toBe("stock");
    expect(parseMaterialTab("stock")).toBe("stock");
    expect(parseMaterialTab("junk")).toBe("stock");
    expect(parseMaterialTab(["log"])).toBe("stock");
    expect(parseMaterialTab(["log", "log"])).toBe("stock");
    expect(parseMaterialTab("log")).toBe("log");
  });

  it("keeps a valid from, and the log origin, on both tab links", () => {
    expect(materialTabHref("MAT-MASTIC", "stock")).toBe("/materials/MAT-MASTIC");
    expect(materialTabHref("MAT-MASTIC", "log")).toBe("/materials/MAT-MASTIC?tab=log");
    expect(materialTabHref("MAT-MASTIC", "stock", "pen-c-05")).toBe("/materials/MAT-MASTIC?from=pen-c-05");
    expect(materialTabHref("MAT-MASTIC", "log", "pen-c-05")).toBe("/materials/MAT-MASTIC?tab=log&from=pen-c-05");
    expect(materialTabHref("MAT-MASTIC", "log", "pen-c-05", "site-c")).toBe(
      "/materials/MAT-MASTIC?tab=log&from=pen-c-05&fromLog=site-c",
    );
    expect(materialTabHref("MAT-MASTIC", "stock", undefined, "site-c")).toBe("/materials/MAT-MASTIC?fromLog=site-c");
    expect(materialTabHref("MAT-MASTIC", "stock", "", "")).toBe("/materials/MAT-MASTIC");
  });
});
