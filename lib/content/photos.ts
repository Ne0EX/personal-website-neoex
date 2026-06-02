/**
 * lib/content/photos.ts
 * ---------------------
 * Photo query helpers.
 *
 * Two collections are served here:
 *   Photo (roll.mdx) — roll-level descriptors, one per roll
 *   PhotoSidecar (DSCF*.mdx) — per-photo records with EXIF + variants from pipeline
 *
 * Privacy rule: getGlobeEligiblePhotos() returns ONLY photos with shareLocation=true
 * AND a defined servedCoords. This is a second line of defence behind TASK-20's
 * build-step GPS scrub and process-photos.ts's first-pass GPS gate.
 * Algol writes the regression test for this invariant.
 *
 * Owner: Procyon (α-IDX-03) · TASK-2026-05-15-22 / TASK-2026-05-15-30
 */
import type { Photo, PhotoSidecar, PhotoPin } from './types'

// ---------------------------------------------------------------------------
// Roll-level photos (roll.mdx) — unchanged from TASK-22
// ---------------------------------------------------------------------------

let _photos: Photo[] | null = null

async function loadPhotos(): Promise<Photo[]> {
  if (_photos) return _photos
  const cache = await import('../../.velite')
  _photos = cache.photos as Photo[]
  return _photos
}

/** All roll descriptors, sorted newest-first. */
export async function getPhotos(): Promise<Photo[]> {
  const photos = await loadPhotos()
  return [...photos].sort((a, b) => b.isoDate.localeCompare(a.isoDate))
}

/** All roll descriptors within a specific roll directory. (Normally just one.) */
export async function getPhotosByRoll(roll: string): Promise<Photo[]> {
  const photos = await loadPhotos()
  return photos
    .filter((p) => p.roll === roll)
    .sort((a, b) => a.id.localeCompare(b.id))
}

// ---------------------------------------------------------------------------
// Per-photo sidecar records (DSCF*.mdx) — TASK-30
// ---------------------------------------------------------------------------

let _sidecars: PhotoSidecar[] | null = null

async function loadSidecars(): Promise<PhotoSidecar[]> {
  if (_sidecars) return _sidecars
  const cache = await import('../../.velite')
  // photoSidecars is emitted by the photoSidecars collection in velite.config.ts
  _sidecars = (cache.photoSidecars as PhotoSidecar[]) ?? []
  return _sidecars
}

/** All per-photo sidecar records across all rolls, sorted newest-first by capture date. */
export async function getPhotoSidecars(): Promise<PhotoSidecar[]> {
  const sidecars = await loadSidecars()
  return [...sidecars].sort((a, b) => b.isoDate.localeCompare(a.isoDate))
}

/**
 * All per-photo sidecar records within a specific roll, sorted by id ascending.
 * This gives the contact-sheet order (capture sequence).
 */
export async function getSidecarsInRoll(roll: string): Promise<PhotoSidecar[]> {
  const sidecars = await loadSidecars()
  return sidecars
    .filter((s) => s.roll === roll)
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * A single per-photo sidecar record by roll + id.
 * Used by /photos/<roll>/<id> entry route (TASK-31).
 */
export async function getPhotoById(
  roll: string,
  id: string,
): Promise<PhotoSidecar | undefined> {
  const sidecars = await loadSidecars()
  return sidecars.find((s) => s.roll === roll && s.id === id)
}

/**
 * A single per-photo sidecar record by roll + id. Returns null (not undefined)
 * for idiomatic null-check in the /photos/[roll]/[id] route page.
 *
 * Used by: app/photos/[roll]/[id]/page.tsx
 * Owner: Sirius (α-SUR-01) · TASK-2026-05-30-PHOTO-ENTRY-D3-SHIP
 */
export async function getPhotoByRollAndId(
  roll: string,
  id: string,
): Promise<PhotoSidecar | null> {
  const sidecars = await loadSidecars()
  return sidecars.find((s) => s.roll === roll && s.id === id) ?? null
}

/**
 * Prev/next navigation within a roll, by capture-sequence (id sort).
 * Used by the roll context strip on the photo entry page (TASK-31).
 */
export async function getRollNavigation(
  roll: string,
  id: string,
): Promise<{ prev: PhotoSidecar | undefined; next: PhotoSidecar | undefined }> {
  const inRoll = await getSidecarsInRoll(roll)
  const idx = inRoll.findIndex((s) => s.id === id)
  if (idx === -1) return { prev: undefined, next: undefined }
  return {
    prev: idx > 0 ? inRoll[idx - 1] : undefined,
    next: idx < inRoll.length - 1 ? inRoll[idx + 1] : undefined,
  }
}

// ---------------------------------------------------------------------------
// Roll contact-sheet helper — S1 roll-index (VISION-2026-05-31)
// ---------------------------------------------------------------------------

/**
 * Roll contacts context — sidecars + roll description for the roll-index page.
 *
 * Used by: app/photos/[roll]/page.tsx + components/RollIndex.tsx
 * Owner: Sirius (α-SUR-01) · S1 roll-index ship
 */
export interface RollContacts {
  /** Sidecars ordered by id ascending (capture sequence). */
  sidecars: PhotoSidecar[]
  /** Roll lede body text extracted from roll.mdx MDX body.
   *  Empty string when the roll has no prose body (2026-04-chiang-mai).
   *  The route reads this at build time via fs.readFile. */
  lede: string
  /** Derived date range: YYYY.MM.DD — YYYY.MM.DD (Special Elite display format).
   *  Empty string when roll has no sidecars. */
  dateRange: string
}

/**
 * Returns sidecars for a roll plus the roll description lede.
 * The lede is extracted directly from the roll.mdx MDX body at build time.
 *
 * @param roll - Roll slug, e.g. "2026-05-bangkok"
 * @param rollMdxBody - The raw MDX body text of roll.mdx, passed in from the route
 *   (which reads the file via fs). Separating the read from this helper keeps the
 *   helper testable without filesystem access.
 */
export async function getRollContacts(
  roll: string,
  rollMdxBody: string,
): Promise<RollContacts> {
  const sidecars = await getSidecarsInRoll(roll)

  // Derive date range from min/max isoDate across all sidecars in the roll.
  // Format: YYYY.MM.DD — YYYY.MM.DD
  let dateRange = ''
  if (sidecars.length > 0) {
    const sorted = [...sidecars].sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    const first = sorted[0].isoDate.replace(/-/g, '.')
    const last = sorted[sorted.length - 1].isoDate.replace(/-/g, '.')
    dateRange = first === last ? first : `${first} — ${last}`
  }

  // Extract lede: strip MDX comments and take the first non-empty paragraph.
  // A comment-only body (<!-- ... -->) resolves to an empty lede → hide lede row.
  const lede = extractMdxLede(rollMdxBody)

  return { sidecars, lede, dateRange }
}

/**
 * Extracts the first non-empty prose paragraph from raw MDX body content.
 * Strips HTML comments (<!-- ... -->), trims whitespace.
 * Returns empty string if no prose paragraph is found.
 */
function extractMdxLede(raw: string): string {
  // Strip HTML comments (handles the <!-- roll description — Vega fills this --> case)
  const stripped = raw.replace(/<!--[\s\S]*?-->/g, '').trim()
  if (!stripped) return ''

  // Split by double newlines, take first non-empty paragraph
  const paragraphs = stripped.split(/\n\n+/)
  for (const para of paragraphs) {
    const clean = para.trim()
    if (clean) return clean
  }
  return ''
}

// ---------------------------------------------------------------------------
// Globe eligibility — TASK-22 invariant, extended for TASK-30
// ---------------------------------------------------------------------------

/**
 * Photos eligible for Globe placement (Ne0 surface pins).
 *
 * Gate: shareLocation=true AND servedCoords is defined.
 * servedCoords is set by the velite photoSidecars transform ONLY when
 * process-photos.ts wrote GPS to cache AND shareLocation=true in frontmatter.
 *
 * Per ontology §2.1: photos without GPS or with shareLocation=false do NOT
 * appear on the Globe — they live in roll views only.
 *
 * PRIVACY INVARIANT (Algol regression test must cover this):
 *   No PhotoPin is returned for a sidecar with shareLocation=false,
 *   regardless of what .velite/photoSidecars.json contains.
 *
 * Returns typed PhotoPin records (coords is non-optional after the gate).
 */
export async function getGlobeEligiblePhotos(): Promise<PhotoPin[]> {
  const sidecars = await loadSidecars()
  return sidecars
    .filter(
      (s): s is PhotoSidecar & { servedCoords: NonNullable<PhotoSidecar['servedCoords']> } =>
        s.shareLocation === true && s.servedCoords !== undefined,
    )
    .map((s) => ({
      kind: 'photo' as const,
      roll: s.roll,
      id: s.id,
      caption: s.caption,
      coords: s.servedCoords,
      isoDate: s.isoDate,
      filmSim: s.exif?.filmSim,
      thumbWebp: s.variants?.thumb.webp,
    }))
}
