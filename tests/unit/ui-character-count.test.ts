import { describe, expect, it } from "vitest";
import { characterCountLabel } from "@/ui/format";

describe("character counter", () => {
  it("shows the trimmed length in N of 500 characters", () => {
    expect(characterCountLabel("x ")).toBe("1 of 500 characters");
    expect(characterCountLabel(" ".repeat(500))).toBe("0 of 500 characters");
    expect(characterCountLabel(`${"x".repeat(500)} `)).toBe("500 of 500 characters");
  });
});
