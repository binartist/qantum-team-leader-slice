import { describe, expect, it } from "vitest";
import {
  actionSentence,
  actionTarget,
  actionsPath,
  dataProblemsPath,
  affectedCount,
  formatMaterialSummary,
  formatNeed,
  formatQuantity,
  formatRating,
  formatRecordedAt,
  formatReference,
  formatUnit,
  penetrationDisclosureLabel,
  penetrationGroups,
  penetrationLine,
  serviceLine,
  penetrationPath,
  proposalSentence,
  sitePath,
  stockFiguresLine,
  stockIsStale,
  supplierRefLine,
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

  it("formats a known shortage and an unknown-stock shortage", () => {
    expect(formatNeed(10, 8, 2, "cartridge")).toBe("Need 10, have 8, short 2 cartridges");
    expect(formatNeed(1, 0, 1, "cartridge")).toBe("Need 1, have 0, short 1 cartridge");
    expect(formatNeed(2, 0, 2, "tube")).toBe("Need 2, have 0, short 2 tubes");
    expect(formatNeed(1, 0, 1, "tube")).toBe("Need 1, have 0, short 1 tube");
    expect(formatNeed(1, 0, 1, "metre")).toBe("Need 1, have 0, short 1 metre");
    expect(formatNeed(2.5, 0, 2.5, "metre")).toBe("Need 2.5, have 0, short 2.5 metres");
    expect(formatNeed(0, 0, 0, "metre")).toBe("Need 0, have 0, short 0 metres");
    expect(formatNeed(4, 2, 2, "each")).toBe("Need 4, have 2, short 2");
    expect(formatNeed(1, 0, 1, "each")).toBe("Need 1, have 0, short 1");
    expect(formatNeed(1, null, null, "tube")).toBe("Need 1, stock unknown");
    expect(formatNeed(4, null, 2, "each")).toBe("Need 4, stock unknown");
    expect(formatNeed(4, 2, null, "each")).toBe("Need 4, stock unknown");
    expect(formatNeed(1, 0, 1, "")).toBe("Need 1, have 0, short 1");
    expect(formatNeed(3, 1, 2, "box")).toBe("Need 3, have 1, short 2 boxs");
    expect(formatNeed(1, 0, Number.NaN, "metre")).toBe("Need 1, have 0, short unknown metres");
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

describe("candidate material lines", () => {
  it("joins named lines and falls back to the material id", () => {
    const line = formatMaterialSummary(
      [
        { materialId: "MAT-PUTTY", requiredQty: 1, onHandQty: 20 },
        { materialId: "MAT-SEALANT", requiredQty: 1, onHandQty: 8 },
        { materialId: "MAT-GONE", requiredQty: 2, onHandQty: null },
      ],
      { "MAT-PUTTY": { name: "Fire putty pad" }, "MAT-SEALANT": { name: "Intumescent sealant, 310 ml cartridge" } },
    );
    expect(line).toBe("Fire putty pad x1, Intumescent sealant, 310 ml cartridge x1, MAT-GONE x2");
    expect(formatMaterialSummary([{ materialId: "M", requiredQty: 1, onHandQty: 0 }], { M: { name: "Pad" } })).toBe("Pad x1");
    expect(formatMaterialSummary([], {})).toBe("");
  });
});

describe("ratings, counts, and paths", () => {
  it("prints a fire rating in minutes and names a missing part", () => {
    expect(formatRating(60, 30)).toBe("Fire rating: 60 min integrity, 30 min insulation");
    expect(formatRating(60, null)).toBe("Fire rating: 60 min integrity, no insulation rating");
    expect(formatRating(null, 30)).toBe("Fire rating: no integrity rating, 30 min insulation");
    expect(formatRating(null, null)).toBe("Fire rating: no integrity rating, no insulation rating");
    expect(formatRating(60.5, 0)).toBe("Fire rating: 60.5 min integrity, 0 min insulation");
  });

  it("prints a supplier reference only when one is present", () => {
    expect(supplierRefLine("V21.27-22SFR00053-158-E")).toBe("Supplier ref V21.27-22SFR00053-158-E");
    expect(supplierRefLine(" ABC ")).toBe("Supplier ref ABC");
    expect(supplierRefLine("")).toBeNull();
    expect(supplierRefLine("   ")).toBeNull();
  });

  it("names a penetration row and groups rows when more than one solution is nominated", () => {
    const pex = { id: "pen-b-01", floor: "L3", location: "Riser 2", serviceType: "PEX Pipe", serviceSize: "Ø25mm", nominatedCode: "0438" };
    const kelox = {
      id: "pen-b-05",
      floor: "L4",
      location: "Corridor south",
      serviceType: "KELOX Pipe  - 13mm PE",
      serviceSize: "Ø32mm",
      nominatedCode: "0434",
    };
    const again = { ...pex, id: "pen-b-02" };
    expect(penetrationLine(pex)).toBe("L3, Riser 2 · PEX Pipe Ø25mm");
    // Raw catalogue text keeps its double spaces for matching; the screen shows single spaces.
    expect(penetrationLine(kelox)).toBe("L4, Corridor south · KELOX Pipe - 13mm PE Ø32mm");
    expect(serviceLine(kelox)).toBe("KELOX Pipe - 13mm PE, Ø32mm");
    expect(penetrationDisclosureLabel(1)).toBe("Penetrations and substitutes (1)");
    expect(penetrationDisclosureLabel(12)).toBe("Penetrations and substitutes (12)");
    expect(penetrationGroups([pex, again])).toEqual([{ heading: "Solution 0438 · 2", places: [pex, again] }]);
    expect(penetrationGroups([pex, kelox, again])).toEqual([
      { heading: "Solution 0438 · 2", places: [pex, again] },
      { heading: "Solution 0434 · 1", places: [kelox] },
    ]);
    expect(penetrationGroups([])).toEqual([]);
  });

  it("counts affected penetrations", () => {
    expect(affectedCount(1)).toBe("Affects 1 penetration");
    expect(affectedCount(12)).toBe("Affects 12 penetrations");
    expect(affectedCount(0)).toBe("Affects 0 penetrations");
  });

  it("encodes ids into paths", () => {
    expect(sitePath("site-b")).toBe("/sites/site-b");
    expect(actionsPath("site-b")).toBe("/sites/site-b/actions");
    expect(penetrationPath("site-b", "pen-b-01")).toBe("/sites/site-b/penetrations/pen-b-01");
    expect(penetrationPath("a/b", "c d")).toBe("/sites/a%2Fb/penetrations/c%20d");
    expect(sitePath("a/b")).toBe("/sites/a%2Fb");
    expect(actionsPath("a/b")).toBe("/sites/a%2Fb/actions");
    expect(dataProblemsPath("site-c")).toBe("/sites/site-c/data-problems");
    expect(dataProblemsPath("a/b")).toBe("/sites/a%2Fb/data-problems");
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
      formatNeed(1, 1, 0, "each"),
      formatMaterialSummary([{ materialId: "M", requiredQty: 1, onHandQty: 1 }], { M: { name: "Pad" } }),
      formatRating(60, null),
      formatRating(null, 30),
      supplierRefLine("ABC") ?? "",
      stockFiguresLine("2026-10-03T08:00:00Z", "2026-10-05T08:00:00Z"),
      penetrationLine({ floor: "L3", location: "Riser 2", serviceType: "PEX Pipe", serviceSize: "Ø25mm", nominatedCode: "0438" }),
      penetrationDisclosureLabel(4),
      penetrationGroups([
        { id: "a", nominatedCode: "0438" },
        { id: "b", nominatedCode: "0434" },
      ])[0]?.heading ?? "",
      actionSentence("escalate", "purchasing", "Pad"),
      proposalSentence("0438", "0451"),
      formatReference("RP-A2"),
    ];
    for (const text of texts) expect(text).not.toMatch(/compatible|approved/i);
  });
});
