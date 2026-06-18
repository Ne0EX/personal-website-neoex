/**
 * app/console/layout.tsx — console surface layout
 * ─────────────────────────────────────────────────────────────────────────────
 * Console chrome is English-only (DL3 / OQ6 — chrome i18n deferred).
 * Console routes are NOT under app/[lang]/ (Altair P3 bilingual refactor).
 *
 * This layout is currently a pass-through shell. Fonts are provided by the
 * root app/layout.tsx. The TriangulateSearchPortal is intentionally NOT
 * mounted here (it's a public-surface feature in app/[lang]/layout.tsx).
 *
 * This file exists to explicitly scope the console route group and to make
 * it easy to add console-specific providers in the future.
 *
 * Owner: Altair (α-BND-02) · bilingual P3
 */

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
