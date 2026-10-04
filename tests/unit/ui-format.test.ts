import { describe, expect, it } from "vitest";
import {
  actionSentence,
  actionTarget,
  actionsPath,
  affectedCount,
  formatAsOf,
  formatMaterialSummary,
  formatNeed,
  formatQuantity,
  formatRating,
  formatRecordedAt,
  penetrationPath,
  proposalSentence,
  sitePath,
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
    expect(formatNeed(10, 8, 2, "cartridge")).toBe("Need 10, have 8, short 2 cartridge");
    expect(formatNeed(1, null, null, "tube")).toBe("Need 1, stock unknown");
    expect(formatNeed(4, null, 2, "each")).toBe("Need 4, stock unknown");
    expect(formatNeed(4, 2, null, "each")).toBe("Need 4, stock unknown");
    expect(formatNeed(1, 0, 1, "each")).toBe("Need 1, have 0, short 1 each");
  });
});

describe("times", () => {
  it("formats an instant in UTC without using the local zone", () => {
    expect(formatAsOf("2026-10-03T08:00:00Z")).toBe("As of 3 Oct 2026, 08:00 UTC");
    expect(formatAsOf("2026-01-09T00:05:00.000Z")).toBe("As of 9 Jan 2026, 00:05 UTC");
    expect(formatRecordedAt("2026-02-02T00:00:00.000Z")).toBe("2 Feb 2026, 00:00 UTC");
    expect(formatAsOf("2026-10-03T09:00:00+01:00")).toBe("As of 3 Oct 2026, 08:00 UTC");
    expect(formatRecordedAt("2026-10-03T08:00:00Z")).toBe("3 Oct 2026, 08:00 UTC");
  });

  it("does not invent a time when the value is not a date", () => {
    expect(formatAsOf("not-a-date")).toBe("As of unknown");
    expect(formatRecordedAt("")).toBe("Time unknown");
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
  it("prints a rating and uses not claimed for a null part", () => {
    expect(formatRating(60, 30)).toBe("60/30");
    expect(formatRating(60, null)).toBe("60/not claimed");
    expect(formatRating(null, null)).toBe("not claimed/not claimed");
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

describe("forbidden words", () => {
  it("no formatted string contains compatible or approved", () => {
    const texts = [
      formatNeed(1, 1, 0, "each"),
      formatAsOf("2026-10-03T08:00:00Z"),
      formatMaterialSummary([{ materialId: "M", requiredQty: 1, onHandQty: 1 }], { M: { name: "Pad" } }),
      formatRating(60, null),
      actionSentence("escalate", "purchasing", "Pad"),
      proposalSentence("0438", "0451"),
    ];
    for (const text of texts) expect(text).not.toMatch(/compatible|approved/i);
  });
});
