import { describe, expect, it } from "vitest";
import { parsePenetrationTab, penetrationTabHref } from "@/ui/penetration-tabs";

describe("AC 45: penetration tabs", () => {
  it("keeps Solution unless the query is exactly log", () => {
    expect(parsePenetrationTab(undefined)).toBe("solution");
    expect(parsePenetrationTab("")).toBe("solution");
    expect(parsePenetrationTab("junk")).toBe("solution");
    expect(parsePenetrationTab(["log"])).toBe("solution");
    expect(parsePenetrationTab(["log", "solution"])).toBe("solution");
    expect(parsePenetrationTab("log")).toBe("log");
  });

  it("builds tab links and keeps a log origin", () => {
    expect(penetrationTabHref("site-c", "pen-c-03", "solution")).toBe("/sites/site-c/penetrations/pen-c-03");
    expect(penetrationTabHref("site-c", "pen-c-03", "log")).toBe("/sites/site-c/penetrations/pen-c-03?tab=log");
    expect(penetrationTabHref("site-c", "pen-c-03", "solution", "site-c")).toBe("/sites/site-c/penetrations/pen-c-03?fromLog=site-c");
    expect(penetrationTabHref("site-c", "pen-c-03", "log", "site-c")).toBe("/sites/site-c/penetrations/pen-c-03?tab=log&fromLog=site-c");
    expect(penetrationTabHref("site-c", "pen-c-03", "log", "")).toBe("/sites/site-c/penetrations/pen-c-03?tab=log");
  });
});
