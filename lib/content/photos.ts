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
