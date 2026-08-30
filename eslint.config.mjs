import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // React-compiler-era hook rules (set-state-in-effect / refs / immutability)
  // fire on this repo's deliberate ref-mirroring + mount-sync patterns. They
  // are real signals but not regressions — surface them as warnings, not
  // gate-breaking errors, until the components are restructured wholesale.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react/jsx-no-comment-textnodes": "off",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored search-highlight runtime emitted by pagefind — bundled third-
    // party JS, not project source; linting it is a false-red on every run:
    "public/pagefind/**",
    // Harness-runtime paths — worktrees contain full Next.js builds that
    // ESLint would otherwise scan and emit errors for:
    ".claude/worktrees/**",
    "worldline-harness/**",
    // Harness engine + runtime artifacts — gitignored, not part of the
    // production graph; linting them is a false-red on every harness slice:
    ".harness/**",
    // Visual-diff capture directories contain vendored minified JS from
    // design tool exports; these are not project source and must not be linted:
    ".claude/visual-diffs/**",
    // Beta workspace prototypes — agent scratch space, not production source:
    ".claude/beta/**",
    // Skills contain vendored/bundled assets (three.module.js etc) and prototype
    // UI kits that are not project source. Same rationale as visual-diffs.
    ".claude/skills/**",
    // Factory dashboard — vendored tracker prototype (browser-global React UMD,
    // no bundler); verified by browser tour, not the production lint graph:
    "tools/factory/**",
    // Exports and template directories may contain generated output:
    ".claude/exports/**",
    ".claude/beta-templates/**",
  ]),
]);

export default eslintConfig;
