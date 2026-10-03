import { describe, expect, it } from "vitest";
import { isIncompleteSubstrate, normaliseText } from "@/domain";

describe("normaliseText", () => {
  it("trims and collapses whitespace runs to one space", () => {
    expect(normaliseText("  Copper   Pipe \n\t 50 ")).toBe("copper pipe 50");
  });

  it("removes whitespace just inside parentheses but keeps the words", () => {
    expect(normaliseText("FR plasterboard wall ( 1 layer 13mm)")).toBe("fr plasterboard wall (1 layer 13mm)");
    expect(normaliseText("( 1  layer )")).toBe("(1 layer)");
  });

  it("removes whitespace between a digit and mm, including inside parentheses", () => {
    expect(normaliseText("(51 mm )")).toBe("(51mm)");
    expect(normaliseText("51  mm by 20 mm")).toBe("51mm by 20mm");
  });

  it("treats a spaced uppercase unit as the same size", () => {
    expect(normaliseText("51 MM")).toBe(normaliseText("51mm"));
    expect(normaliseText("(51 MM )")).toBe(normaliseText("(51mm)"));
    expect(normaliseText("51 MM")).toBe("51mm");
    expect(normaliseText("(51 MM )")).toBe("(51mm)");
  });

  it("lower-cases and does not strip commas or the diameter sign", () => {
    expect(normaliseText("Unlined Timber,")).toBe("unlined timber,");
    expect(normaliseText("Ø50mm")).not.toBe(normaliseText("50mm"));
    expect(normaliseText("Ø50mm")).toBe("ø50mm");
    expect(normaliseText("50mm")).toBe("50mm");
  });

  it("does not treat a space before mm as a unit when no digit precedes it", () => {
    expect(normaliseText("size mm")).toBe("size mm");
  });

  it("leaves an already normalised size unchanged apart from case", () => {
    expect(normaliseText("900mm x 50mm")).toBe("900mm x 50mm");
    expect(normaliseText("60")).toBe("60");
  });
});

describe("isIncompleteSubstrate", () => {
  it("is true when the trimmed text ends with a comma", () => {
    expect(isIncompleteSubstrate("FR plasterboard,")).toBe(true);
    expect(isIncompleteSubstrate("  Unlined Timber,  ")).toBe(true);
  });

  it("is false when a comma is only a separator", () => {
    expect(isIncompleteSubstrate("FR plasterboard, FR plasterboard wall (1 layer 13mm)")).toBe(false);
    expect(isIncompleteSubstrate("FR plasterboard")).toBe(false);
  });
});
