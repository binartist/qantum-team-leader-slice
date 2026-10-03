import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "coverage/**", "playwright-report/**", "next-env.d.ts"]),
  {
    // Domain core stays pure: no framework, database or file-system imports.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*", "react", "react-dom", "@supabase/*"], message: "Domain core must not import frameworks or the database client." },
            { group: ["node:*", "fs", "fs/*", "path", "@/adapters/*", "@/app/*"], message: "Domain core must not do I/O or import adapters or the app layer." },
          ],
        },
      ],
    },
  },
]);
