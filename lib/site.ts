/**
 * Canonical site constants. `NEXT_PUBLIC_SITE_URL` should be set to the
 * deployed origin (e.g. https://neoex.dev) so canonical URLs, OG tags,
 * robots.txt and the sitemap all point at the right host.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const SITE_NAME = "∇ Neospirit";

export const SITE_TITLE = "Worldline · ∇ Neospirit";

export const SITE_DESCRIPTION =
  "An archive of unfinished thought, kept openly. A digital garden — fragments, drafts, and half-formed theories on coffee, code, narrative, and the architecture of taste.";
