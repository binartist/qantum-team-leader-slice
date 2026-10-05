import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { clientBoundaryOffenders } from "./client-boundary.mjs";

it("flags a transitive client import, a relative server import, and the database driver", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ui-layer-probe-"));
  try {
    mkdirSync(path.join(root, "src/app/_lib"), { recursive: true });
    mkdirSync(path.join(root, "src/ui"), { recursive: true });
    mkdirSync(path.join(root, "src/server"), { recursive: true });
    writeFileSync(path.join(root, "src/server/deps.ts"), "export const marker = 1;\n");
    writeFileSync(
      path.join(root, "src/app/_lib/leak-probe.ts"),
      'import { marker } from "@/server/deps";\nexport const reached = marker;\n',
    );
    writeFileSync(
      path.join(root, "src/app/error.tsx"),
      '"use client";\nimport { reached } from "./_lib/leak-probe";\nexport const value = reached;\n',
    );
    writeFileSync(path.join(root, "src/ui/supa-probe.ts"), '"use client";\nimport "pg";\n');
    writeFileSync(path.join(root, "src/ui/rel-probe.ts"), '"use client";\nimport "../server/deps";\n');
    const offenders = clientBoundaryOffenders(root);
    expect(offenders.some((line) => line.includes("@/server/deps"))).toBe(true);
    expect(offenders.some((line) => line.includes("-> pg"))).toBe(true);
    expect(offenders.some((line) => line.includes("../server/deps"))).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
