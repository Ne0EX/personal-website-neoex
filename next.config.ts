import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Build dir is env-overridable so an isolated inspect build (WL_DIST=/abs/path
  // outside the repo) is immune to a concurrent `git clean .next` in this tree.
  // Defaults to the standard `.next` when WL_DIST is unset.
  distDir: process.env.WL_DIST || ".next",
};

export default nextConfig;
