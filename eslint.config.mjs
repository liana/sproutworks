import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "src/generated/**", "design/**"]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
      // The Anthropic SDK may only be imported by the AI gateway.
      "no-restricted-imports": ["error", { patterns: [{ group: ["@anthropic-ai/sdk", "@anthropic-ai/sdk/*"], message: "Only src/lib/ai/ may import the Anthropic SDK." }] }],
    },
  },
  { files: ["src/lib/ai/**"], rules: { "no-restricted-imports": "off" } },
  // Components are display only: no database, no fetch, no SDK.
  {
    files: ["src/components/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["@/lib/db", "**/lib/db*", "@prisma/*", "@/generated/*"], message: "Components must not touch the database." },
        { group: ["@anthropic-ai/sdk", "@anthropic-ai/sdk/*"], message: "Only src/lib/ai/ may import the Anthropic SDK." },
      ] }],
      "no-restricted-globals": ["error", { name: "fetch", message: "Components must not call fetch. Use a server component or a route." }],
    },
  },
]);
