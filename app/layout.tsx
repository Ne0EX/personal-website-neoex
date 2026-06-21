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
 *
 * FONT VERSION F — IBM PLEX SUPERFAMILY (genesis/store-as-source)
 * ─────────────────────────────────────────────────────────────────────────────
 * Body Latin  → IBM Plex Mono (next/font/google, weight 400 + 500)
 *               variable: --font-plex-mono (→ --font-body-en in globals.css @theme)
 *               14.5px / line-height 1.75 / letter-spacing 0.01em
 *               Rationale: designed superfamily companion to IBM Plex Sans Thai.
 *               Both were drawn together as part of the IBM Plex family, giving
 *               them genuine shared DNA (weight axis, x-height, spacing rhythm).
 *               This is the only render-correct path to EN+TH that share mono-family
 *               identity — Plex Mono (Latin) + Plex Sans Thai (Thai) are siblings.
 *
 * Body Thai   → IBM Plex Sans Thai (next/font/google, weight 400)
 *               variable: --font-plex-thai (→ --font-thai-body in globals.css @theme)
 *               :lang(th) body 15.5px / line-height 2.0 / letter-spacing 0.03em
 *               IBM Plex Sans Thai was designed as the Thai companion to IBM Plex.
 *               Same x-height philosophy, same weight register as Plex Mono.
 *               Marks (above/below) stack correctly — full Unicode Thai coverage.
 *
 * World chrome (instrument readouts, meta labels, console) → JetBrains Mono (unchanged)
 *               variable: --font-jetbrains / --font-mono
 *               Nav/FILE/metadata stays JetBrains Mono — only the ARTICLE BODY
 *               Latin switches to IBM Plex Mono. Chrome is not under test here.
 *
 * Titles / display → Cormorant Garamond + Trirong (unchanged)
 */

import type { Metadata } from 'next'
import {
  Cormorant_Garamond,
  IBM_Plex_Mono,
  IBM_Plex_Sans_Thai,
  JetBrains_Mono,
  Special_Elite,
  Trirong,
} from 'next/font/google'
import './globals.css'

// Version F: IBM Plex Mono — designed superfamily companion to IBM Plex Sans Thai
const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

// Version F: IBM Plex Sans Thai — the designed Thai companion to IBM Plex Mono
const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  variable: '--font-plex-thai',
  subsets: ['thai'],
  weight: ['400'],
  display: 'swap',
})

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

// Bilingual type system — Version F (IBM Plex superfamily)
//
// --font-plex-mono (EN body register) — Version F
//   IBM Plex Mono: designed as part of the IBM Plex superfamily.
//   Shares x-height, weight axis, and spacing philosophy with IBM Plex Sans Thai.
//   Both are genuine siblings — same design family, drawn to pair.
//   This is the structural fix: EN mono + TH sans from ONE family = genuine DNA match.
//
// --font-plex-thai (TH body register) — Version F
//   IBM Plex Sans Thai: the official Thai companion to IBM Plex.
//   Correct GPOS — marks stack. Even stroke at 400 matches Plex Mono 400.
//   Rendered at 15.5px / line-height 2.0 / letter-spacing 0.03em.
//
// --font-trirong (display register) — unchanged from Version A
//   Trirong Light (weight 300) pairs with Cormorant Garamond: both are
//   high-contrast, literary serifs. weight 300 prevents Thai headings from
//   punching heavier than Cormorant's already-light italic.
//
// Design token mapping in globals.css @theme:
//   --font-body-en      → var(--font-plex-mono)       (Version F — article body EN only)
//   --font-mono         → var(--font-jetbrains)        (world chrome — unchanged)
//   --font-thai-body    → var(--font-plex-thai)        (Version F)
//   --font-thai-display → var(--font-trirong)          (unchanged)

const trirong = Trirong({
  variable: '--font-trirong',
  subsets: ['thai'],
  weight: ['300', '400'],
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
      className={`${ibmPlexMono.variable} ${ibmPlexSansThai.variable} ${cormorant.variable} ${jetbrains.variable} ${elite.variable} ${trirong.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  )
}
