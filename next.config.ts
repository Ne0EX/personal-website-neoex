import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // `/resume` was this app's own static route before the S5 root swap
  // moved the NETRA Survey ledger to `/`. 308 (permanent) — search engines
  // and any bookmarked link should update to the new canonical location.
  async redirects() {
    return [
      {
        source: "/resume",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
