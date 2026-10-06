import { defineConfig } from "@playwright/test";

const port = 3100;
const externalBase = process.env.E2E_BASE_URL;
const baseURL = externalBase ?? `http://127.0.0.1:${port}`;
const viewport = { width: 375, height: 812 };

const readSpecs = [
  "**/ac30-status-text.spec.ts",
  "**/ac32-viewport.spec.ts",
  "**/accessibility.spec.ts",
  "**/not-found.spec.ts",
  "**/home-status.spec.ts",
  "**/substitutes-empty.spec.ts",
  "**/site-tabs.spec.ts",
];

const writeSpecs = ["**/ac31-keyboard.spec.ts", "**/idempotency-key.spec.ts", "**/scenario.spec.ts"];

function devServer(portNumber: number, distDir: string, stockMode?: string) {
  const stock = stockMode ? `STUB_STOCK_MODE=${stockMode} ` : "";
  return {
    command: `ACTIONS_STORE=memory NEXT_DIST_DIR=${distDir} ${stock}npx next dev -p ${portNumber} -H 127.0.0.1`,
    url: `http://127.0.0.1:${portNumber}`,
    reuseExistingServer: false,
    timeout: 180_000,
  };
}

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    browserName: "chromium",
    viewport,
    navigationTimeout: 120_000,
  },
  projects: [
    {
      name: "chromium-375",
      testMatch: readSpecs,
      use: { browserName: "chromium", viewport },
    },
    {
      name: "chromium-375-write",
      dependencies: ["chromium-375"],
      testMatch: writeSpecs,
      use: { browserName: "chromium", viewport },
    },
    {
      name: "stock-down",
      testMatch: "**/stock-down.spec.ts",
      use: { baseURL: "http://127.0.0.1:3101", browserName: "chromium", viewport },
    },
    {
      name: "stock-malformed",
      testMatch: "**/stock-malformed.spec.ts",
      use: { baseURL: "http://127.0.0.1:3102", browserName: "chromium", viewport },
    },
  ],
  // When E2E_BASE_URL is set, no server is started. The stock projects still call 3101 and 3102.
  webServer: externalBase
    ? undefined
    : [
        devServer(port, ".next-e2e"),
        devServer(3101, ".next-e2e-stock-down", "down"),
        devServer(3102, ".next-e2e-stock-malformed", "malformed"),
      ],
});
