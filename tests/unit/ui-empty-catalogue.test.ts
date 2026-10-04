import { describe, expect, it } from "vitest";
import { emptyCatalogueLabel } from "@/ui/status";

describe("empty catalogue sentence", () => {
  it("omits Escalate instead when there is no related shortage or blocker", () => {
    expect(emptyCatalogueLabel(false)).toBe("No catalogue match for this penetration.");
    expect(emptyCatalogueLabel(false)).not.toContain("Escalate instead");
    expect(emptyCatalogueLabel(true)).toBe("No catalogue match for this penetration. Escalate instead.");
  });
});
