import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const includeDb = process.env.VITEST_INCLUDE_DB === "1";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/data/**/*.test.ts",
      "tests/api/**/*.test.ts",
      ...(includeDb ? ["tests/db/**/*.test.ts"] : []),
    ],
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts", "src/ui/*.ts", "src/ui/decisions/api-client.ts", "src/ui/decisions/form.ts", "src/adapters/postgres/connection.ts"],
      // Floor from docs/test-strategy.md section 7. Applies once src/domain has code.
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
