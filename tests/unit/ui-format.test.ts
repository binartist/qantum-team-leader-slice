import { describe, expect, it } from "vitest";
import {
  actionSentence,
  actionTarget,
  plannedWorkLine,
  decisionScope,
  groupPlaces,
  siteMaterialPath,
  materialPagePath,
  siteMaterialLine,
  shortageBrief,
  materialStockLine,
  plannedAcrossLine,
  shortSiteCount,
  uncheckedSiteCount,
  siteAnchor,
  MATERIALS_PATH,
  formatQuantity,
  ratingValue,
  formatRecordedAt,
  formatReference,
  formatUnit,
  penetrationLine,
  serviceLine,
  penetrationPath,
  proposalSentence,
  actionLink,
  sitePath,
  stockFiguresLine,
  stockIsStale,
} from "@/ui/format";

describe("quantities", () => {
  it("prints whole numbers and snapped fractions", () => {
    expect(formatQuantity(10)).toBe("10");
    expect(formatQuantity(0)).toBe("0");
    expect(formatQuantity(2.2)).toBe("2.2");
    expect(formatQuantity(0.8)).toBe("0.8");
    expect(formatQuantity(0.1 + 0.2)).toBe("0.3");
    expect(formatQuantity(1.2345674)).toBe("1.234567");
    expect(formatQuantity(-1)).toBe("-1");
    expect(formatQuantity(-0)).toBe("0");
  });

  it("does not print a non-finite quantity as a number", () => {
    expect(formatQuantity(Number.NaN)).toBe("unknown");
    expect(formatQuantity(Number.POSITIVE_INFINITY)).toBe("unknown");
    expect(formatQuantity(Number.NEGATIVE_INFINITY)).toBe("unknown");
  });

  it("pluralises a unit from the shortfall, and omits each", () => {
    expect(formatUnit(2, "each")).toBe("");
    expect(formatUnit(1, "each")).toBe("");
    expect(formatUnit(1, "")).toBe("");
    expect(formatUnit(1, "cartridge")).toBe("cartridge");
    expect(formatUnit(2, "cartridge")).toBe("cartridges");
    expect(formatUnit(1, "tube")).toBe("tube");
    expect(formatUnit(2, "tube")).toBe("tubes");
    expect(formatUnit(1, "metre")).toBe("metre");
    expect(formatUnit(2.5, "metre")).toBe("metres");
    expect(formatUnit(0, "metre")).toBe("metres");
    expect(formatUnit(1, "box")).toBe("box");
    expect(formatUnit(2, "box")).toBe("boxs");
    expect(formatUnit(Number.NaN, "metre")).toBe("metres");
  });
});

describe("times", () => {
  it("formats an instant in UTC without using the local zone", () => {
    expect(formatRecordedAt("2026-01-09T00:05:00.000Z")).toBe("9 Jan 2026, 00:05 UTC");
    expect(formatRecordedAt("2026-02-02T00:00:00.000Z")).toBe("2 Feb 2026, 00:00 UTC");
    expect(formatRecordedAt("2026-10-03T09:00:00+01:00")).toBe("3 Oct 2026, 08:00 UTC");
    expect(formatRecordedAt("2026-10-03T08:00:00Z")).toBe("3 Oct 2026, 08:00 UTC");
  });

  it("does not invent a time when the value is not a date", () => {
    expect(formatRecordedAt("")).toBe("Time unknown");
  });

  it("states the age of the stock snapshot against the request time, in UTC", () => {
    expect(stockFiguresLine("2026-10-03T08:00:00Z", "2026-10-05T08:00:00Z")).toBe(
      "Stock figures from 3 Oct 2026, 08:00 UTC (2 days old)",
    );
    expect(stockIsStale("2026-10-03T08:00:00Z", "2026-10-05T08:00:00Z")).toBe(true);
    expect(stockFiguresLine("2026-10-03T09:00:00+01:00", "2026-10-05T08:00:00Z")).toBe(
      "Stock figures from 3 Oct 2026, 08:00 UTC (2 days old)",
    );
    expect(stockFiguresLine("2026-10-03T08:00:00Z", "2026-10-03T08:00:00Z")).toBe(
      "Stock figures from 3 Oct 2026, 08:00 UTC (0 minutes old)",
    );
    expect(stockIsStale("2026-10-03T08:00:00Z", "2026-10-03T08:00:00Z")).toBe(false);
    expect(stockFiguresLine("2026-10-03T08:00:00Z", "2026-10-03T08:01:00Z")).toBe(
      "Stock figures from 3 Oct 2026, 08:00 UTC (1 minute old)",
    );
    expect(stockFiguresLine("2026-10-03T08:00:00Z", "2026-10-03T08:02:00Z")).toBe(
      "Stock figures from 3 Oct 2026, 08:00 UTC (2 minutes old)",
    );
    expect(stockFiguresLine("2026-10-03T08:00:00Z", "2026-10-03T08:59:00Z")).toBe(
      "Stock figures from 3 Oct 2026, 08:00 UTC (59 minutes old)",
    );
    expect(stockFiguresLine("2026-10-03T08:00:00Z", "2026-10-03T09:00:00Z")).toBe(
      "Stock figures from 3 Oct 2026, 08:00 UTC (1 hour old)",
    );
    expect(stockIsStale("2026-10-03T08:00:00Z", "2026-10-03T09:00:00Z")).toBe(false);
    expect(stockFiguresLine("2026-10-03T08:00:00Z", "2026-10-03T11:00:00Z")).toBe(
      "Stock figures from 3 Oct 2026, 08:00 UTC (3 hours old)",
    );
    expect(stockFiguresLine("2026-10-03T08:00:00Z", "2026-10-04T07:00:00Z")).toBe(
      "Stock figures from 3 Oct 2026, 08:00 UTC (23 hours old)",
    );
    expect(stockIsStale("2026-10-03T08:00:00Z", "2026-10-04T07:00:00Z")).toBe(false);
    expect(stockFiguresLine("2026-10-03T08:00:00Z", "2026-10-04T08:00:00Z")).toBe(
      "Stock figures from 3 Oct 2026, 08:00 UTC (1 day old)",
    );
    expect(stockIsStale("2026-10-03T08:00:00Z", "2026-10-04T08:00:00Z")).toBe(false);
    expect(stockFiguresLine("2026-10-03T08:00:00.000Z", "2026-10-04T08:00:00.001Z")).toBe(
      "Stock figures from 3 Oct 2026, 08:00 UTC (1 day old)",
    );
    expect(stockIsStale("2026-10-03T08:00:00.000Z", "2026-10-04T08:00:00.001Z")).toBe(true);
  });

  it("does not invent an age when the snapshot is in the future or not a date", () => {
    expect(stockFiguresLine("2026-10-05T08:00:00Z", "2026-10-03T08:00:00Z")).toBe("Stock figures from 5 Oct 2026, 08:00 UTC");
    expect(stockIsStale("2026-10-05T08:00:00Z", "2026-10-03T08:00:00Z")).toBe(false);
    expect(stockFiguresLine("not-a-date", "2026-10-05T08:00:00Z")).toBe("Stock figures from an unknown time");
    expect(stockIsStale("not-a-date", "2026-10-05T08:00:00Z")).toBe(false);
    expect(stockFiguresLine("2026-10-03T08:00:00Z", "not-a-date")).toBe("Stock figures from 3 Oct 2026, 08:00 UTC");
    expect(stockIsStale("2026-10-03T08:00:00Z", "not-a-date")).toBe(false);
  });
});

describe("ratings, counts, and paths", () => {
  it("prints a rating value without the label, for a labelled field", () => {
    expect(ratingValue(90, 60)).toBe("90 min integrity, 60 min insulation");
    expect(ratingValue(60, null)).toBe("60 min integrity, no insulation rating");
    expect(ratingValue(null, 30)).toBe("no integrity rating, 30 min insulation");
  });

  it("names a penetration row and its service", () => {
    const pex = { id: "pen-b-01", floor: "L3", location: "Riser 2", serviceType: "PEX Pipe", serviceSize: "Ø25mm", nominatedCode: "0438" };
    const kelox = {
      id: "pen-b-05",
      floor: "L4",
      location: "Corridor south",
      serviceType: "KELOX Pipe  - 13mm PE",
      serviceSize: "Ø32mm",
      nominatedCode: "0434",
    };
    expect(penetrationLine(pex)).toBe("L3, Riser 2 · PEX Pipe Ø25mm");
    // Raw catalogue text keeps its double spaces for matching; the screen shows single spaces.
    expect(penetrationLine(kelox)).toBe("L4, Corridor south · KELOX Pipe - 13mm PE Ø32mm");
    expect(serviceLine(kelox)).toBe("KELOX Pipe - 13mm PE, Ø32mm");
  });

  // User decisions: a decision covers the whole site, and "not short" is only ever for one site alone.
  it("words a material across sites", () => {
    expect(decisionScope(1)).toBe("For the 1 penetration at this site");
    expect(decisionScope(4)).toBe("For all 4 penetrations at this site");
    expect(siteMaterialLine(4, { kind: "short", shortfallQty: 2 }, "each")).toBe("Needs 4, short 2");
    expect(siteMaterialLine(10, { kind: "short", shortfallQty: 2 }, "cartridge")).toBe("Needs 10, short 2 cartridges");
    expect(siteMaterialLine(1, { kind: "unknown", shortfallQty: null }, "tube")).toBe("Needs 1, stock unknown");
    expect(siteMaterialLine(1, { kind: "short", shortfallQty: null }, "tube")).toBe("Needs 1, stock unknown");
    expect(siteMaterialLine(2, null, "each")).toBe("Needs 2, not short for this site alone");
    expect(materialStockLine(2, 6, "each")).toBe("On hand 2 · planned across sites 6");
    expect(materialStockLine(8, 12, "cartridge")).toBe("On hand 8 cartridges · planned across sites 12 cartridges");
    expect(materialStockLine(null, 1, "tube")).toBe("Stock unknown · planned across sites 1 tube");
    expect(materialStockLine(5, null, "each")).toBe("On hand 5");
    expect(plannedAcrossLine(1, "tube")).toBe("Planned across sites 1 tube");
    expect(plannedAcrossLine(null, "tube")).toBe("");
    expect(shortSiteCount(1)).toBe("Short at 1 site");
    expect(shortSiteCount(2)).toBe("Short at 2 sites");
    expect(uncheckedSiteCount(1)).toBe("1 site couldn't be checked");
    expect(uncheckedSiteCount(3)).toBe("3 sites couldn't be checked");
  });

  it("briefs a penetration's shortage inline with this site's figures (AC 40)", () => {
    expect(shortageBrief("Pipe collar", { kind: "short", requiredQty: 4, shortfallQty: 2 })).toBe("Short material: Pipe collar · this site short 2 of 4");
    expect(shortageBrief("Fire mastic", { kind: "unknown", requiredQty: 1, shortfallQty: null })).toBe("Stock unknown: Fire mastic · this site needs 1");
  });

  it("groups identical places in first-seen order, counting repeats", () => {
    expect(groupPlaces(["L3, Riser 2", "L4, Core", "L3, Riser 2", "L3, Riser 2"])).toEqual(["L3, Riser 2 ×3", "L4, Core"]);
    expect(groupPlaces([])).toEqual([]);
  });

  it("encodes ids into paths", () => {
    expect(sitePath("site-b")).toBe("/sites/site-b");
    expect(penetrationPath("site-b", "pen-b-01")).toBe("/sites/site-b/penetrations/pen-b-01");
    expect(penetrationPath("a/b", "c d")).toBe("/sites/a%2Fb/penetrations/c%20d");
    expect(sitePath("a/b")).toBe("/sites/a%2Fb");
    expect(MATERIALS_PATH).toBe("/materials");
    expect(siteAnchor("site-b")).toBe("site-site-b");
    expect(materialPagePath("MAT-SEALANT")).toBe("/materials/MAT-SEALANT");
    expect(materialPagePath("c d", { siteId: "site-b" })).toBe("/materials/c%20d#site-site-b");
    expect(materialPagePath("MAT-COLLAR-25", { siteId: "site-b", penetrationId: "pen-b-01" })).toBe(
      "/materials/MAT-COLLAR-25?from=pen-b-01#site-site-b",
    );
    expect(siteMaterialPath("site-b", "MAT-COLLAR-25")).toBe("/sites/site-b?material=MAT-COLLAR-25");
    expect(siteMaterialPath("a/b", "c d")).toBe("/sites/a%2Fb?material=c%20d");
  });
});

describe("action wording", () => {
  const materials = { "MAT-SEALANT": { name: "Intumescent sealant" } };
  const penetrations = { "pen-c-03": { floor: "L1", location: "Basement link" } };

  it("names a material, a place, or the id when the lookup misses", () => {
    expect(actionTarget("site-b", "site-b:MAT-SEALANT", materials, penetrations)).toBe("Intumescent sealant");
    expect(actionTarget("site-b", "site-b:MAT-OTHER", materials, penetrations)).toBe("MAT-OTHER");
    expect(actionTarget("site-c", "site-c:blocker.pen-c-03", materials, penetrations)).toBe("L1, Basement link");
    expect(actionTarget("site-c", "site-c:blocker.pen-missing", materials, penetrations)).toBe("pen-missing");
    expect(actionTarget("site-c", "site-c:blocker.", materials, penetrations)).toBe("site-c:blocker.");
    expect(actionTarget("site-b", "bare-id", materials, penetrations)).toBe("bare-id");
  });

  it("describes wait, escalate, and a proposal", () => {
    expect(actionSentence("wait", null, "Intumescent sealant")).toBe("Wait: Intumescent sealant");
    expect(actionSentence("escalate", "purchasing", "Intumescent sealant")).toBe("Escalated to purchasing: Intumescent sealant");
    expect(actionSentence("escalate", "warehouse", "L1, Basement link")).toBe("Escalated to warehouse: L1, Basement link");
    expect(actionSentence("escalate", null, "Intumescent sealant")).toBe("Escalated: Intumescent sealant");
    expect(proposalSentence("0438", "0451")).toBe("Proposed substitute: 0438 to 0451");
    // Four penetrations can look alike, so a proposal names its place when it is known.
    expect(proposalSentence("0438", "0451", "L3, Riser 2")).toBe("Proposed substitute for L3, Riser 2: 0438 to 0451");
  });

  it("links a decision to the work it is about", () => {
    expect(actionLink("site-b", "site-b:MAT-SEALANT", "current")).toBe("/sites/site-b?material=MAT-SEALANT");
    expect(actionLink("site-b", "site-b:MAT-SEALANT", "earlier")).toBe("/sites/site-b?material=MAT-SEALANT");
    // A resolved shortage has no filtered list to show; the entry already says so.
    expect(actionLink("site-b", "site-b:MAT-SEALANT", "resolved")).toBeNull();
    expect(actionLink("site-c", "site-c:blocker.pen-c-03", "current")).toBe("/sites/site-c/penetrations/pen-c-03");
    expect(actionLink("site-c", "site-c:blocker.pen-c-03", "resolved")).toBe("/sites/site-c/penetrations/pen-c-03");
    expect(actionLink("site-c", "site-c:blocker.", "current")).toBeNull();
    expect(actionLink("site-c", "other:MAT-X", "current")).toBe("/sites/site-c?material=other%3AMAT-X");
  });
});

describe("planned work", () => {
  it("counts the penetrations and distinct nominated solutions, with singulars", () => {
    expect(plannedWorkLine(["0438", "0438", "0434"])).toBe("3 penetrations, 2 solutions");
    expect(plannedWorkLine(["0438"])).toBe("1 penetration, 1 solution");
    expect(plannedWorkLine(["0344", "0344", "0375", "0375", "0452", "0452"])).toBe("6 penetrations, 3 solutions");
  });

  it("returns nothing when no work is planned, so the line is not shown", () => {
    expect(plannedWorkLine([])).toBeNull();
  });
});

describe("site reference", () => {
  it("labels the code as a job reference", () => {
    expect(formatReference("RP-A2")).toBe("Job ref RP-A2");
    expect(formatReference("HP-345")).toBe("Job ref HP-345");
  });
});

describe("forbidden words", () => {
  it("no formatted string contains compatible or approved", () => {
    const texts = [
      stockFiguresLine("2026-10-03T08:00:00Z", "2026-10-05T08:00:00Z"),
      penetrationLine({ floor: "L3", location: "Riser 2", serviceType: "PEX Pipe", serviceSize: "Ø25mm", nominatedCode: "0438" }),
      actionSentence("escalate", "purchasing", "Pad"),
      proposalSentence("0438", "0451"),
      siteMaterialLine(2, null, "each"),
      shortageBrief("Pad", { kind: "short", requiredQty: 4, shortfallQty: 2 }),
      materialStockLine(5, 6, "each"),
      formatReference("RP-A2"),
    ];
    for (const text of texts) expect(text).not.toMatch(/compatible|approved/i);
  });
});
