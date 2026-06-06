/**
 * app/console/editor/page.tsx — Worldline Console · Article Editor route
 * ─────────────────────────────────────────────────────────────────────────────
 * Tooling route — NOT in public Nav. No chrome beyond the root layout
 * (which injects only font vars + TriangulateSearchPortal).
 *
 * The ArticleEditor component is 'use client' and mounts full-viewport.
 * This page is a Server Component — just a thin shell that renders the
 * client-side editor. No data fetch needed; the editor initializes from
 * SAMPLE_MD/SAMPLE_DRAFT in the component.
 *
 * Note on global chrome: the root layout (app/layout.tsx) does not inject
 * Nav / PageShell / dot-grid — those are per-route. The editor receives only
 * CSS variables + font classes from the root, which is correct. If the root
 * layout changes and wraps all routes in chrome, a `app/console/layout.tsx`
 * opt-out may be needed — flagged to Polaris for browser verification.
 *
 * CONSOLE placeholder: /console → `// TODO: console slice` (Slice 2)
 *
 * Owner: Sirius (α-SUR-01) · atlas-console Slice 1
 */

import type { Metadata } from 'next'
import { ArticleEditor } from '@/components/console/ArticleEditor'

export const metadata: Metadata = {
  title: 'Worldline · Article Editor',
  robots: { index: false, follow: false },
}

export default function ArticleEditorPage() {
  return <ArticleEditor />
}
