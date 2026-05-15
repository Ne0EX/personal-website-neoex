#!/usr/bin/env tsx
/**
 * scripts/process-photos.ts
 * -------------------------
 * Photo processing pipeline for the Worldline photo atlas.
 *
 * Responsibilities:
 *   1. Scan content/photos/ for JPEG source files.
 *   2. Extract EXIF metadata (camera, lens, film sim, capture time, GPS).
 *   3. Generate responsive variants via sharp (3 sizes × 3 formats).
 *   4. Write a per-photo JSON cache at content/photos/<roll>/.cache/<id>.json.
 *   5. Privacy gate: GPS coordinates are NEVER written to the cache unless
 *      the co-located sidecar .mdx has `shareLocation: true`.
 *
 * Idempotent: content-addressed by SHA-1 of source bytes. Re-running skips
 * unchanged photos. Only new or modified source files are re-processed.
 *
 * Usage:
 *   npx tsx scripts/process-photos.ts [--roll <roll-name>] [--dry-run]
 *
 * Owner: Procyon (α-IDX-03) · TASK-2026-05-15-30
 * Privacy invariant: no GPS in output unless shareLocation=true in sidecar.
 */

import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Type definitions (kept local — consumers use lib/content/types.ts)
// ---------------------------------------------------------------------------

export type PhotoExif = {
  /** Camera make + model, e.g. "FUJIFILM X-E5" */
  camera?: string
  /** Lens model, e.g. "XF23mmF2 R WR" */
  lens?: string
  /** Film simulation name per Fuji MakerNote, e.g. "Classic Chrome" */
  filmSim?: string
  /** Aperture as f-number, e.g. 2.8 */
  aperture?: number
  /** Shutter speed as a display string, e.g. "1/250" or "2" */
  shutter?: string
  /** ISO value, e.g. 400 */
  iso?: number
  /** Focal length in mm (native), e.g. 23 */
  focal?: number
  /** Focal length equivalent in 35mm, e.g. 35 */
  focal35?: number
  /** ISO 8601 capture time string. */
  captureTime?: string
}

export type PhotoVariantEntry = {
  jpg: string
  webp: string
  avif: string
}

export type PhotoVariants = {
  /** 320px wide. Used for thumbnails and contact sheet. */
  thumb: PhotoVariantEntry
  /** 1280px wide. Used for lightbox and single photo medium view. */
  medium: PhotoVariantEntry
  /** 2400px wide. Used for full-resolution single photo view. */
  full: PhotoVariantEntry
}

export type PhotoCacheRecord = {
  /** Source JPEG path relative to content/photos/. */
  sourceRelPath: string
  /** SHA-1 hash of source bytes (first 10 chars). Content-address key. */
  sourceHash: string
  /** Parsed EXIF data. GPS is never included here. */
  exif: PhotoExif
  /** Generated variant paths (all relative to /public root, web-ready). */
  variants: PhotoVariants
  /** GPS coordinates — only present when sidecar has shareLocation: true. */
  coords?: { lat: number; lon: number }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(process.cwd())
const CONTENT_PHOTOS = path.join(REPO_ROOT, 'content', 'photos')
const PUBLIC_PHOTOS = path.join(REPO_ROOT, 'public', 'photos')

const VARIANT_SIZES = [
  { name: 'thumb', width: 320 },
  { name: 'medium', width: 1280 },
  { name: 'full', width: 2400 },
] as const

const VARIANT_QUALITY = {
  thumb:  { jpg: 80, webp: 75, avif: 60 },
  medium: { jpg: 85, webp: 78, avif: 60 },
  full:   { jpg: 88, webp: 80, avif: 65 },
} as const

const JPEG_EXTS = new Set(['.jpg', '.jpeg', '.JPG', '.JPEG'])

// ---------------------------------------------------------------------------
// Fuji film simulation mapping
// ---------------------------------------------------------------------------

const FUJI_SIM_MAP: Record<string, string> = {
  PROVIA:               'Provia',
  VELVIA:               'Velvia',
  ASTIA:                'Astia',
  CLASSIC_CHROME:       'Classic Chrome',
  PRO_NEG_HI:           'Pro Neg Hi',
  PRO_NEG_STD:          'Pro Neg Std',
  CLASSIC_NEG:          'Classic Neg',
  ETERNA:               'Eterna',
  ETERNA_BLEACH_BYPASS: 'Eterna Bleach Bypass',
  ACROS:                'Acros',
  ACROS_R:              'Acros R',
  ACROS_G:              'Acros G',
  ACROS_YE:             'Acros Ye',
  REALA_ACE:            'Reala Ace',
  NOSTALGIC_NEG:        'Nostalgic Neg',
  SEAL:                 'Seal',
}

function normalizeFujiSim(raw: string): string {
  const key = raw
    .toUpperCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
  return FUJI_SIM_MAP[key] ?? raw
}

function readFujiFilmSim(exif: Record<string, unknown>): string | undefined {
  // exifr can return Fuji makernote fields merged at top level or under Fujifilm.
  // Field names vary by exifr version and camera model.
  const raw =
    (exif['FilmMode'] as string | undefined) ??
    (exif['FilmSimulation'] as string | undefined) ??
    ((exif['Fujifilm'] as Record<string, unknown> | undefined)?.FilmMode as string | undefined) ??
    ((exif['Fujifilm'] as Record<string, unknown> | undefined)?.FilmSimulation as string | undefined)

  if (typeof raw === 'string') return normalizeFujiSim(raw)
  return undefined
}

// ---------------------------------------------------------------------------
// Shutter speed formatting
// ---------------------------------------------------------------------------

function formatShutter(exposureTime: number | undefined): string | undefined {
  if (exposureTime == null) return undefined
  if (exposureTime >= 1) return String(Math.round(exposureTime))
  const denominator = Math.round(1 / exposureTime)
  return `1/${denominator}`
}

// ---------------------------------------------------------------------------
// Sidecar MDX reader
// ---------------------------------------------------------------------------

type SidecarData = {
  shareLocation: boolean
  caption?: string
  overridePlace?: string
}

async function readSidecar(sidecarPath: string): Promise<SidecarData> {
  try {
    const raw = await fs.readFile(sidecarPath, 'utf-8')
    // Parse YAML frontmatter between --- delimiters
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) return { shareLocation: false }

    const fm = match[1]
    // Simple field extraction — no full YAML parser dependency
    const shareLocation = /shareLocation:\s*true/i.test(fm)
    const captionMatch = fm.match(/caption:\s*["']?(.*?)["']?\s*$/m)
    const overridePlaceMatch = fm.match(/overridePlace:\s*["']?(.*?)["']?\s*$/m)

    return {
      shareLocation,
      caption: captionMatch?.[1]?.trim() || undefined,
      overridePlace: overridePlaceMatch?.[1]?.trim() || undefined,
    }
  } catch {
    // No sidecar — defaults apply
    return { shareLocation: false }
  }
}

// ---------------------------------------------------------------------------
// Variant generation
// ---------------------------------------------------------------------------

async function generateVariants(
  absPath: string,
  roll: string,
  slug: string,
  hash: string,
  dryRun: boolean,
): Promise<PhotoVariants> {
  // Dynamic import to keep startup fast and avoid sharp in dev if not installed
  const sharp = (await import('sharp')).default

  const outDir = path.join(PUBLIC_PHOTOS, roll)
  if (!dryRun) await fs.mkdir(outDir, { recursive: true })

  const result = {} as PhotoVariants

  for (const size of VARIANT_SIZES) {
    const entry = {} as PhotoVariantEntry
    for (const fmt of ['jpg', 'webp', 'avif'] as const) {
      const outFile = `${slug}-${size.name}-${hash}.${fmt}`
      const outPath = path.join(outDir, outFile)
      const webPath = `/photos/${roll}/${outFile}`

      if (!dryRun) {
        // Skip if already exists (content-addressed — same hash = same output)
        let alreadyExists = false
        try {
          await fs.access(outPath)
          alreadyExists = true
        } catch {
          // Does not exist — will generate
        }

        if (!alreadyExists) {
          const pipeline = sharp(absPath, { failOn: 'truncated' })
            .rotate()  // honor EXIF orientation before stripping EXIF
            .resize({ width: size.width, withoutEnlargement: true })

          if (fmt === 'jpg') {
            await pipeline
              .jpeg({ quality: VARIANT_QUALITY[size.name].jpg, mozjpeg: true })
              .toFile(outPath)
          } else if (fmt === 'webp') {
            await pipeline
              .webp({ quality: VARIANT_QUALITY[size.name].webp })
              .toFile(outPath)
          } else {
            await pipeline
              .avif({ quality: VARIANT_QUALITY[size.name].avif })
              .toFile(outPath)
          }
        }
      }

      entry[fmt] = webPath
    }
    result[size.name] = entry
  }

  return result
}

// ---------------------------------------------------------------------------
// Main: process a single JPEG
// ---------------------------------------------------------------------------

async function processJpeg(
  absPath: string,
  dryRun: boolean,
): Promise<{ roll: string; slug: string; cacheWritten: boolean }> {
  const relFromPhotos = path.relative(CONTENT_PHOTOS, absPath)
  const parts = relFromPhotos.split(path.sep)
  if (parts.length !== 2) {
    console.warn(`  skip: unexpected path depth: ${relFromPhotos}`)
    return { roll: '', slug: '', cacheWritten: false }
  }
  const [roll, filename] = parts
  const slug = filename.replace(/\.(jpe?g|JPE?G)$/, '')

  const cacheDir = path.join(CONTENT_PHOTOS, roll, '.cache')
  const cacheFile = path.join(cacheDir, `${slug}.json`)

  // Read sidecar MDX (caption + shareLocation)
  const sidecarPath = absPath.replace(/\.(jpe?g|JPE?G)$/, '.mdx')
  const sidecar = await readSidecar(sidecarPath)

  // Content-address check
  const sourceBytes = await fs.readFile(absPath)
  const hash = createHash('sha1').update(sourceBytes).digest('hex').slice(0, 10)

  // Check if cache is up-to-date
  try {
    const existing = JSON.parse(await fs.readFile(cacheFile, 'utf-8')) as PhotoCacheRecord
    if (
      existing.sourceHash === hash &&
      existing.coords !== undefined === sidecar.shareLocation
    ) {
      // Cache is current
      process.stdout.write('.')
      return { roll, slug, cacheWritten: false }
    }
  } catch {
    // No cache yet
  }

  // EXIF extraction
  // Dynamic import — exifr must be installed (npm install exifr).
  // Type stub at types/exifr.d.ts allows TypeScript resolution before install.
  let exifData: Record<string, unknown> = {}
  try {
    const exifr = (await import('exifr')).default
    exifData = await exifr.parse(absPath, {
      pick: [
        'Make', 'Model', 'LensModel', 'LensMake',
        'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'FocalLengthIn35mmFormat',
        'DateTimeOriginal',
        'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef',
      ],
      makerNote: true,  // critical for Fuji film sim fields
      mergeOutput: true,
    }) ?? {}
  } catch (err) {
    console.warn(`\n  warn: EXIF parse failed for ${relFromPhotos}: ${(err as Error).message}`)
  }

  // Build EXIF record — GPS is never included in exif object (privacy)
  const exif: PhotoExif = {
    camera: [exifData['Make'], exifData['Model']]
      .filter(Boolean)
      .join(' ')
      .trim() || undefined,
    lens: (exifData['LensModel'] as string | undefined) ?? undefined,
    filmSim: readFujiFilmSim(exifData),
    aperture: (exifData['FNumber'] as number | undefined) ?? undefined,
    shutter: formatShutter(exifData['ExposureTime'] as number | undefined),
    iso: (exifData['ISO'] as number | undefined) ?? undefined,
    focal: (exifData['FocalLength'] as number | undefined) ?? undefined,
    focal35: (exifData['FocalLengthIn35mmFormat'] as number | undefined) ?? undefined,
    captureTime: exifData['DateTimeOriginal'] instanceof Date
      ? (exifData['DateTimeOriginal'] as Date).toISOString()
      : typeof exifData['DateTimeOriginal'] === 'string'
        ? exifData['DateTimeOriginal']
        : undefined,
  }

  // GPS privacy gate — only include coordinates when photographer opts in
  let coords: { lat: number; lon: number } | undefined
  if (sidecar.shareLocation) {
    const lat = exifData['GPSLatitude'] as number | undefined
    const lon = exifData['GPSLongitude'] as number | undefined
    if (lat != null && lon != null) {
      coords = { lat, lon }
    }
  }
  // If shareLocation is false OR GPS is absent: coords remains undefined.
  // This is a HARD invariant. No GPS leaks to the cache unless opted in.

  // Variant generation
  const variants = await generateVariants(absPath, roll, slug, hash, dryRun)

  // Write cache
  const cacheRecord: PhotoCacheRecord = {
    sourceRelPath: relFromPhotos,
    sourceHash: hash,
    exif,
    variants,
    ...(coords !== undefined ? { coords } : {}),
  }

  if (!dryRun) {
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.writeFile(cacheFile, JSON.stringify(cacheRecord, null, 2), 'utf-8')
  }

  process.stdout.write('+')
  return { roll, slug, cacheWritten: true }
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const rollFilter = args.includes('--roll')
    ? args[args.indexOf('--roll') + 1]
    : null

  console.log(`\nprocess-photos · ${dryRun ? '[DRY RUN] ' : ''}scanning ${CONTENT_PHOTOS}\n`)

  // Discover rolls
  let rollDirs: string[]
  try {
    const entries = await fs.readdir(CONTENT_PHOTOS, { withFileTypes: true })
    rollDirs = entries
      .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-/.test(e.name))
      .map((e) => e.name)
      .filter((name) => !rollFilter || name === rollFilter)
      .sort()
  } catch {
    console.error(`error: content/photos/ not found at ${CONTENT_PHOTOS}`)
    process.exit(1)
  }

  if (rollDirs.length === 0) {
    console.log('no rolls found.')
    return
  }

  let totalProcessed = 0
  let totalSkipped = 0
  let totalErrors = 0

  for (const roll of rollDirs) {
    const rollDir = path.join(CONTENT_PHOTOS, roll)
    let jpegFiles: string[]

    try {
      const entries = await fs.readdir(rollDir, { withFileTypes: true })
      jpegFiles = entries
        .filter((e) => e.isFile() && JPEG_EXTS.has(path.extname(e.name)))
        .map((e) => e.name)
        .sort()
    } catch {
      continue
    }

    if (jpegFiles.length === 0) continue

    console.log(`\n[${roll}] ${jpegFiles.length} jpeg(s)`)
    process.stdout.write('  ')

    for (const file of jpegFiles) {
      const absPath = path.join(rollDir, file)
      try {
        const { cacheWritten } = await processJpeg(absPath, dryRun)
        if (cacheWritten) totalProcessed++
        else totalSkipped++
      } catch (err) {
        process.stdout.write('E')
        console.error(`\n  error: ${file}: ${(err as Error).message}`)
        totalErrors++
      }
    }
    console.log()
  }

  console.log(
    `\ndone. processed=${totalProcessed} skipped(cached)=${totalSkipped} errors=${totalErrors}`,
  )
  if (totalErrors > 0) process.exit(1)
}

main().catch((err) => {
  console.error('fatal:', err)
  process.exit(1)
})
