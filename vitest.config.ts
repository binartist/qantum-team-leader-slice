import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/data/**/*.test.ts", "tests/api/**/*.test.ts", "tests/db/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts"],
      // Floor from docs/test-strategy.md section 7. Applies once src/domain has code.
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
