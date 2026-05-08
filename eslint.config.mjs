import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Defensive: nested build/cache dirs (e.g. when a Claude worktree
    // lives inside .claude/ with its own .next and node_modules).
    "**/.next/**",
    "**/node_modules/**",
    ".claude/**",
    // Auto-generated Prisma client should never be linted.
    "src/generated/**",
  ]),
]);

export default eslintConfig;
