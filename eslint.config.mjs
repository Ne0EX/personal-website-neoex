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
    // Harness-runtime paths — worktrees contain full Next.js builds that
    // ESLint would otherwise scan and emit errors for:
    ".claude/worktrees/**",
    "worldline-harness/**",
    // Visual-diff capture directories contain vendored minified JS from
    // design tool exports; these are not project source and must not be linted:
    ".claude/visual-diffs/**",
    // Beta workspace prototypes — agent scratch space, not production source:
    ".claude/beta/**",
  ]),
]);

export default eslintConfig;
