import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const clientBoundaryMessage = "UI and client modules must not import the server, adapters, ports, or the Supabase client.";

// ESLint matches file paths, not the "use client" directive. These are the client entries under src/app.
// tests/api/client-boundary.mjs walks every "use client" file, including transitive imports.
export const clientBoundaryFiles = ["src/ui/**/*.{ts,tsx}", "src/app/error.tsx", "src/app/global-error.tsx"];

export const clientBoundaryImports = {
  paths: [{ name: "pg", message: clientBoundaryMessage }],
  patterns: [
    {
      group: [
        "@/server",
        "@/server/*",
        "@/adapters",
        "@/adapters/*",
        "@/ports",
        "@/ports/*",
        "../server",
        "../server/*",
        "../adapters",
        "../adapters/*",
        "../ports",
        "../ports/*",
        "../../server",
        "../../server/*",
        "../../adapters",
        "../../adapters/*",
        "../../ports",
        "../../ports/*",
        "../../../server",
        "../../../server/*",
        "../../../adapters",
        "../../../adapters/*",
        "../../../ports",
        "../../../ports/*",
        "../../../../server",
        "../../../../server/*",
        "../../../../adapters",
        "../../../../adapters/*",
        "../../../../ports",
        "../../../../ports/*",
      ],
      message: clientBoundaryMessage,
    },
  ],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".next-e2e/**",
    ".next-e2e-stock-down/**",
    ".next-e2e-stock-malformed/**",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "next-env.d.ts",
    // Agent worktrees nest a full checkout here; each is linted in its own tree.
    ".claude/worktrees/**",
  ]),
  {
    // Domain core stays pure: no framework, database or file-system imports.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*", "react", "react-dom", "pg", "pg/*"], message: "Domain core must not import frameworks or the database client." },
            { group: ["node:*", "fs", "fs/*", "path", "@/adapters/*", "@/app/*"], message: "Domain core must not do I/O or import adapters or the app layer." },
          ],
        },
      ],
    },
  },
  {
    // Application and ports stay free of the framework and the server composition root.
    files: ["src/application/**/*.ts", "src/ports/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/server", "@/server/*"], message: "Application and ports must not import the server composition root." },
            { group: ["@/app", "@/app/*"], message: "Application and ports must not import the app layer." },
            { group: ["next", "next/*", "react", "react-dom"], message: "Application and ports must not import Next.js or React." },
          ],
        },
      ],
    },
  },
  {
    files: clientBoundaryFiles,
    rules: {
      "no-restricted-imports": ["error", clientBoundaryImports],
    },
  },
]);
