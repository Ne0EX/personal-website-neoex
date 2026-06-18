/**
 * app/[lang]/layout.tsx — locale-segment layout (NESTED under app/layout.tsx)
 * ─────────────────────────────────────────────────────────────────────────────
 * Created by bilingual P3 refactor. This is a NESTED layout under the root
 * app/layout.tsx — it does NOT redeclare <html> or <body>.
 *
 * Purpose: make the lang param available to all public route children so they
 * can thread it into content reads (getArticleByFileNum(fileNum, lang), etc.)
 * and emit hreflang alternates.
 *
 * The <html lang> attribute dynamic update (so the document-level lang reflects
 * the viewed locale) is part of the P6 render pass (SPEC §6.2). In P3, the
 * lang param is wired to child pages; the root <html lang> stays 'en' at the
 * document level (console routes are English; public routes will have their
 * content-region lang set via <section lang="{article.lang}"> in P6).
 *
 * generateStaticParams: pre-render layout shells for both supported locales.
 *
 * Triangulate Search OVERLAY — mounted here (public surface).
 * Console routes are NOT under [lang] so they do not get the portal.
 *
 * SPEC: SPEC-2026-06-18-bilingual-translation-group §4.1, §4.3
 * Owner: Altair (α-BND-02) · bilingual P3
 */

import { getArchiveEntries, getMiniGlobePins } from '@/lib/content'
import { TriangulateSearchPortal } from '@/components/TriangulateSearchPortal'

// ─────────────────────────────────────────────────────────────────────────────
// Static params — pre-render layout shells for supported locales.
// SPEC §4.3: generate en + th so both locale trees exist in the static graph.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'th' }]
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  // Resolve lang — proxy.ts guarantees this is 'en' or 'th' for public routes.
  // The param is available here so child pages can propagate it to content reads.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lang: _lang } = await params

  // Full privacy-gated pin set for the Triangulate Search OVERLAY.
  // Computed here (server) since the overlay is a global client mount with no
  // corpus of its own. RootLayout is statically rendered (no request-time API
  // read), so this stays in the static graph.
  const allEntries = await getArchiveEntries()
  const allPins = getMiniGlobePins(allEntries)

  return (
    <>
      {children}
      {/*
       * Triangulate Search OVERLAY — public-surface mount.
       * Hosts the global '/' hotkey listener + the 'triangulate:open' event
       * listener, so the SEARCH surface opens OVER any public page without
       * navigating. Console routes do NOT get this portal (not under [lang]).
       */}
      <TriangulateSearchPortal allPins={allPins} />
    </>
  )
}
