import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";

const csvPath = new URL("../../data/solutions-excerpt.csv", import.meta.url);
const bytes = readFileSync(csvPath);

describe("supplied catalogue file (AC 26, file-level)", () => {
  it("is the file as supplied (unchanged)", () => {
    const sha = createHash("sha256").update(bytes).digest("hex");
    expect(sha).toBe("cc01d2ab3fd65a29d95ef42fd04648682e116b1142700300fab9074a30b5e805");
  });

  it("has 148 rows with unique internal and supplier codes", () => {
    const rows = parse(bytes, { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
    expect(rows).toHaveLength(148);
    expect(new Set(rows.map((r) => r["Internal Code"])).size).toBe(148);
    expect(new Set(rows.map((r) => r["Supplier Ref. Code"])).size).toBe(148);
  });
});
