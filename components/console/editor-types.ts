/**
 * components/console/editor-types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared types for the Atlas Console full kind-aware editor.
 *
 * Transcribed from the build-contract "shared types" section:
 *   docs/design/atlas-console-full-editor.md  (Betelgeuse · α-VIS-04 · signed 2026-06-07)
 *
 * One coherent instrument across three entry kinds — ARTICLE (◆), PHOTO (◎),
 * FICTION (△). These are NEW types; no existing file is modified to accommodate
 * them. Photo EXIF / fiction chapters / film-sim are UNCONFIRMED in the content
 * schema (Procyon SCHEMA-NEEDS) — consumers use elegant in-component mock data
 * and do NOT wire photo/fiction to the velite content layer yet.
 *
 * Owner: Sirius (α-SUR-01) · atlas-console full editor
 */

// Entry kind
export type EntryKind = 'article' | 'photo' | 'fiction'

// Fiction chapter state
export type FictionState = 'draft' | 'settled'

// Film simulation chip options (matches prototype FILM_SIMS constant)
export type FilmSim =
  | 'provia'
  | 'classic chrome'
  | 'acros'
  | 'reala ace'
  | 'velvia'

// Single photo frame
export interface PhotoFrame {
  id: string
  /** Resolved URL for browser-renderable formats (JPEG/PNG/WebP/AVIF/GIF/TIFF).
   *  Undefined for RAW and HEIC — those cannot be decoded client-side; the neutral
   *  placeholder slot is shown instead, and the real preview is server-generated. */
  src?: string
  caption?: string
  filmSim?: FilmSim
  exif?: {
    camera?: string
    lens?: string
    iso?: number
    aperture?: string
    shutter?: string
    focal?: string
  }
}

// Single fiction chapter
export interface FictionChapter {
  id: string
  title: string
  body: string         // markdown source
  state: FictionState
}

// Article/photo metadata shape (production conventions — not prototype ad-hoc)
// Note: fileNum (not fileId); coords object (not coord string)
export interface ArticleMeta {
  fileNum: string      // e.g. "042"
  title: string
  date: string         // ISO date string
  coords?: { lat: number; lon: number; place: string }
  tags?: string[]
  status?: string
  readMin?: number
}

export interface PhotoMeta {
  fileNum: string
  title: string
  date: string
  place?: string
  tags?: string[]
  // SCHEMA NEEDS: PhotoMeta.filmSim, PhotoMeta.camera, PhotoMeta.exif
  // are not confirmed in the current content schema. Flag to Procyon
  // before wiring. For now PhotoFrame carries per-frame EXIF.
}

export interface FictionMeta {
  fileNum: string
  title: string
  date: string
  tags?: string[]
  // SCHEMA NEEDS: FictionMeta has no confirmed content schema.
  // Flag to Procyon. Chapters live in editor state, not persisted schema yet.
}

// Full-preview overlay device viewport (cross-kind surface — FullPreview)
export type PreviewDevice = 'desktop' | 'mobile'

// Publish/transmit panel phase (cross-kind surface — PublishPanel, MOCKED)
export type PublishPhase = 'review' | 'running' | 'done'
