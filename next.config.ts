import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Build dir is env-overridable so an isolated inspect build (WL_DIST=/abs/path
  // outside the repo) is immune to a concurrent `git clean .next` in this tree.
  // Defaults to the standard `.next` when WL_DIST is unset.
  distDir: process.env.WL_DIST || ".next",
  // Photo variants are already sized/formatted at ingestion. Disable the unused
  // optimizer so /_next/image cannot cache past the media route's access checks.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
