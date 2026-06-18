/**
 * app/layout.tsx — ROOT layout (wraps ALL routes)
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides the <html> and <body> shell for every route, including:
 *   - Public routes under app/[lang]/ (bilingual P3 — each locale has a nested layout)
 *   - Console routes under app/console/ (chrome i18n deferred — DL3 / OQ6)
 *
 * Fonts are loaded here so both public and console surfaces share the same
 * CSS variable set. The TriangulateSearchPortal has been moved to
 * app/[lang]/layout.tsx (public surface only — console does not get it).
 *
 * The html lang attribute here is 'en' at the document level:
 *   - Console routes: always English (DL3).
 *   - Public routes: the content-region lang is set per-article via
 *     <section lang="{article.lang}"> (SPEC §6.2, P6 render pass).
 *     The document-level lang update (dynamic html lang from [lang] param)
 *     requires the P6 render work or a route-group refactor — deferred.
 *
 * Owner: Altair (α-BND-02) · bilingual P3
 */

import type { Metadata } from 'next'
import {
  Cormorant_Garamond,
  JetBrains_Mono,
  Noto_Serif_Thai,
  Special_Elite,
} from 'next/font/google'
import './globals.css'

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '500'],
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
})

const elite = Special_Elite({
  variable: '--font-elite',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
})

// P6a — Noto Serif Thai for Thai-script content rendering.
// next/font injects the CSS variable --font-noto-thai on <html>.
// globals.css @theme block maps --font-thai to var(--font-noto-thai) so
// fallback chains (body/title stacks) can append var(--font-thai) AFTER
// the Latin families: Latin glyphs resolve first; Thai glyphs resolve only
// for codepoints the Latin family has no coverage for.
// subsets: ['thai'] — no Latin subset needed; the other three families cover Latin.
const notoSerifThai = Noto_Serif_Thai({
  variable: '--font-noto-thai',
  subsets: ['thai'],
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Worldline · ∇ Neospirit',
  description:
    'An archive of unfinished thought, kept openly. A digital garden — fragments, drafts, and half-formed theories on coffee, code, narrative, and the architecture of taste.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${jetbrains.variable} ${elite.variable} ${notoSerifThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  )
}
