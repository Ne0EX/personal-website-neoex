# PRD 03 — Photo + ATLAS Deep-Dive

> Status: Draft v0.1 — 2026.05.10
> Companion to: `prd-03-photo-atlas.md` (the *what*); this is the *how*.
> Scope: implementation patterns, build sequence, gotchas. Concrete enough to hand to Claude Code.

---

## 0 · Implementation sequence

Dependencies between steps. Don't reorder.

```
1. Install deps + sharp pipeline scripts          (no UI yet)
2. velite photo collection schema                  (no UI yet, but content cache exists)
3. Build script: process-photos.ts                 (one roll processed E2E)
4. Photo entry route (/photos/<roll>/<id>)         (single-photo reading surface)
5. Roll index route (/photos)                      (list of rolls)
6. Single roll route (/photos/<roll>)              (contact sheet)
7. ATLAS globe integration (photo pins)            (extends existing scene)
8. Lightbox integration                            (within roll page)
9. Film simulation palette switcher                (extends data-palette toggle)
10. Privacy hardening + smoke tests                (last, before merging)
```

Steps 1–4 give the working surface for one photo. Steps 5–9 are the polish layer. Step 10 is the gate.

---

## 1 · Content folder structure

```
content/photos/
  2026-04-chiang-mai/
    _meta.yml
    DSCF0001.jpg
    DSCF0001.mdx          # optional — caption + share-location flag
    DSCF0002.jpg
    DSCF0002.mdx
    ...
```

`_meta.yml`:

```yaml
roll: "2026-04-chiang-mai"
title: "เชียงใหม่ · cool season"
date_range: ["2026-04-12", "2026-04-18"]
location_label: "Chiang Mai · Thailand"
caption: "Notes from the dry-cool gap before songkran."
```

Per-photo `.mdx` (sidecar — overrides EXIF when needed):

```yaml
---
caption: "Doi Suthep at first light. Acros R."
share-location: true   # default false
override-place: "Doi Suthep · Chiang Mai · TH"   # optional, for places EXIF doesn't know
---
```

If a photo has no sidecar `.mdx`, defaults apply (`share-location: false`, no caption). Sidecar exists only when the photographer wants to override or annotate.

**Why sidecar over single-file frontmatter?** Photos are binary; you can't put YAML at the top of a JPEG. Sidecar `.mdx` is the cleanest "frontmatter for binaries" pattern velite supports. Same convention used by Astro Image, contentlayer-era tools.

`.gitignore` / git-lfs decision: photos go in git-lfs unless the roll is small (<50 photos, <100 MB). LFS keeps repo lean while preserving history.

---

## 2 · velite configuration

`velite.config.ts` at repo root:

```ts
import { defineConfig, defineCollection, s } from 'velite'
import { processPhoto } from './scripts/process-photo'

const articles = defineCollection({
  name: 'Article',
  pattern: 'articles/**/*.mdx',
  schema: s.object({
    fileNum: s.string(),
    title: s.string(),
    date: s.string(),
    domain: s.enum(['identity', 'reflection', 'method', 'meta']),
    tags: s.array(s.string()),
    status: s.enum(['seed', 'ongoing', 'refined', 'settled']),
    coords: s.object({ lat: s.number(), lon: s.number(), place: s.string() }),
    summary: s.string(),
    patches: s.array(s.object({
      n: s.number(),
      date: s.string(),
      note: s.string(),
    })).default([]),
    body: s.mdx(),
  }),
})

const photos = defineCollection({
  name: 'Photo',
  // Match JPEGs; sidecar .mdx is read in transform if it exists.
  pattern: 'photos/**/*.jpg',
  schema: s
    .object({
      // Derived in transform — so optional in raw schema
      roll: s.string().optional(),
      sourceFile: s.string().optional(),
      slug: s.string().optional(),
      caption: s.string().optional(),
      'share-location': s.boolean().default(false),
      'override-place': s.string().optional(),
      exif: s.any().optional(),
      variants: s.any().optional(),
      coords: s.any().optional(),
    })
    .transform(async (raw, { meta }) => {
      // meta.path is the absolute path to the .jpg
      // process-photo handles EXIF, variants, sidecar merge, GPS gating
      return processPhoto(meta.path, raw)
    }),
})

const fiction = defineCollection({
  name: 'Fiction',
  pattern: 'fiction/**/*.mdx',
  schema: s.object({
    slug: s.string(),
    title: s.string(),
    date: s.string(),
    divergence: s.string(),  // narrative α, distinct from site α
    length: s.enum(['short', 'medium', 'long']),
    summary: s.string(),
    body: s.mdx(),
  }),
})

export default defineConfig({
  root: 'content',
  output: { data: '.velite', clean: true },
  collections: { articles, photos, fiction },
})
```

**Key decisions:**

- `s.any()` on derived fields (`exif`, `variants`, `coords`) — type discipline lives in `processPhoto`. velite's strict zod can't easily express "either populated by transform or undefined." Trade strict typing for clean transform contract; consumers cast.
- velite re-runs on watch; processed photo cache should be content-addressed (hash source bytes) to avoid reprocessing unchanged files.

> **Verify before committing:** velite's `transform` async signature in current release. If it doesn't expose `meta.path`, switch to a custom `loader` that reads the directory directly. Velite docs: https://velite.js.org

---

## 3 · The photo processing script

`scripts/process-photo.ts`:

```ts
import exifr from 'exifr'
import sharp from 'sharp'
import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

type RawPhoto = {
  caption?: string
  'share-location': boolean
  'override-place'?: string
}

export async function processPhoto(absPath: string, raw: RawPhoto) {
  // 1. Parse roll + filename from path
  const rel = path.relative(path.resolve('content/photos'), absPath)
  const [roll, sourceFile] = rel.split(path.sep)
  const slug = sourceFile.replace(/\.(jpe?g|JPE?G)$/, '')

  // 2. Read sidecar .mdx if it exists (caption + share-location overrides)
  const sidecarPath = absPath.replace(/\.(jpe?g|JPE?G)$/, '.mdx')
  const sidecar = await readSidecar(sidecarPath)
  const merged = { ...raw, ...sidecar }

  // 3. EXIF — full set incl. Fuji MakerNote
  const exifData = await exifr.parse(absPath, {
    pick: [
      'Make', 'Model', 'LensModel', 'LensMake',
      'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'FocalLengthIn35mmFormat',
      'DateTimeOriginal',
      'GPSLatitude', 'GPSLongitude',
    ],
    makerNote: true,    // critical for Fuji film sim
    mergeOutput: true,
  })

  const filmSim = readFujiFilmSim(exifData)
  const gps = exifData.GPSLatitude != null && exifData.GPSLongitude != null
    ? { lat: exifData.GPSLatitude, lon: exifData.GPSLongitude }
    : undefined

  // 4. Variant generation — content-addressed cache
  const sourceBytes = await fs.readFile(absPath)
  const hash = createHash('sha1').update(sourceBytes).digest('hex').slice(0, 10)
  const variants = await generateVariants(absPath, roll, slug, hash)

  // 5. Privacy gate — strip GPS unless explicitly opted in
  const sharedGps = merged['share-location'] ? gps : undefined
  const coords = sharedGps
    ? { lat: sharedGps.lat, lon: sharedGps.lon, place: merged['override-place'] ?? '' }
    : undefined

  return {
    roll,
    sourceFile,
    slug,
    caption: merged.caption,
    'share-location': merged['share-location'],
    exif: {
      camera: `${exifData.Make} ${exifData.Model}`.trim(),
      lens: exifData.LensModel,
      filmSim,
      aperture: exifData.FNumber,
      shutter: formatShutter(exifData.ExposureTime),
      iso: exifData.ISO,
      focal: exifData.FocalLength,
      focal35: exifData.FocalLengthIn35mmFormat,
      captureTime: exifData.DateTimeOriginal?.toISOString(),
      // GPS in exif object is for build-time use only. Do NOT serialize to client
      // unless share-location is true. velite will serialize whatever you return,
      // so we explicitly drop it here.
    },
    variants,
    coords,  // undefined if not opted in — globe filter excludes
  }
}
```

`generateVariants`:

```ts
async function generateVariants(
  absPath: string,
  roll: string,
  slug: string,
  hash: string,
) {
  const SIZES = [
    { name: 'thumb', width: 320, q: { jpg: 80, webp: 75, avif: 60 } },
    { name: 'medium', width: 1280, q: { jpg: 85, webp: 78, avif: 60 } },
    { name: 'full', width: 2400, q: { jpg: 88, webp: 80, avif: 65 } },
  ] as const

  const outDir = path.resolve('public/photos', roll)
  await fs.mkdir(outDir, { recursive: true })

  const result: Record<string, Record<string, string>> = {}
  for (const size of SIZES) {
    result[size.name] = {}
    for (const fmt of ['jpg', 'webp', 'avif'] as const) {
      const outFile = `${slug}-${size.name}-${hash}.${fmt}`
      const outPath = path.join(outDir, outFile)
      // Skip if already exists (content-addressed by hash)
      try {
        await fs.access(outPath)
      } catch {
        await sharp(absPath, { failOn: 'truncated' })
          .rotate()  // honor EXIF orientation
          .resize({ width: size.width, withoutEnlargement: true })
          .toFormat(fmt as 'jpeg' | 'webp' | 'avif', { quality: size.q[fmt] })
          .toFile(outPath)
      }
      result[size.name][fmt] = `/photos/${roll}/${outFile}`
    }
  }
  return result
}
```

**Fuji film sim reader** (the tricky bit):

```ts
function readFujiFilmSim(exif: any): string | undefined {
  // exifr returns Fuji makernote under `Fujifilm` or merged at top level.
  // Field name varies: FilmMode, FilmSimulation. Test on first roll.
  const sim = exif.FilmMode ?? exif.FilmSimulation ?? exif.Fujifilm?.FilmMode
  if (typeof sim === 'string') return normalizeFujiSim(sim)
  if (typeof sim === 'number') return fujiSimByCode(sim)
  return undefined
}

const FUJI_SIM_NAMES: Record<string, string> = {
  PROVIA: 'Provia',
  VELVIA: 'Velvia',
  ASTIA: 'Astia',
  CLASSIC_CHROME: 'Classic Chrome',
  PRO_NEG_HI: 'Pro Neg Hi',
  PRO_NEG_STD: 'Pro Neg Std',
  CLASSIC_NEG: 'Classic Neg',
  ETERNA: 'Eterna',
  ETERNA_BLEACH_BYPASS: 'Eterna Bleach Bypass',
  ACROS: 'Acros',
  REALA_ACE: 'Reala Ace',
  NOSTALGIC_NEG: 'Nostalgic Neg',
}

function normalizeFujiSim(s: string): string {
  const key = s.toUpperCase().replace(/[\s-]/g, '_')
  return FUJI_SIM_NAMES[key] ?? s
}
```

> **Verification needed on first roll:** exifr's exact field name for X-E5 film sim. If both `FilmMode` and `FilmSimulation` are absent, fall back to a manual `film-sim:` field in the sidecar `.mdx` and surface it the same way.

---

## 4 · Globe integration — photo pins

The existing `WorldlineGlobe.tsx` builds entry pins inside `buildScene()`. Extend the pattern, but visually distinguish photos (square plane facing outward) from entries (sphere).

### 4.1 Pass photos into the component

`components/WorldlineGlobe.tsx`:

```ts
// Replace hardcoded RECENT_ENTRIES import with collection imports
import { entries, photos } from '@/.velite'

// Filter to photos that opted in to share location
const PHOTO_PINS = photos.filter(p => p.coords)
```

### 4.2 Build photo pin layer

Inside `buildScene()`, after the existing entry pin loop:

```ts
// Photo pins — square planes facing outward, slightly above sphere
const photoMatBase = new THREE.MeshBasicMaterial({
  color: 0x1f5063,        // matches existing teal palette
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.9,
})
const photoGeo = new THREE.PlaneGeometry(0.018, 0.018)
const photoObjects: { photo: typeof PHOTO_PINS[number]; head: THREE.Mesh; hit: THREE.Mesh }[] = []

for (const p of PHOTO_PINS) {
  const v = latLonToVec3(p.coords!.lat, p.coords!.lon, 1.008)  // slightly higher than entry pins (1.005)
  const head = new THREE.Mesh(photoGeo, photoMatBase.clone())
  head.position.copy(v)
  // Face outward — normal of plane aligned with the radial vector
  head.lookAt(v.clone().multiplyScalar(2))
  nodesGroup.add(head)

  // Hit proxy — sphere, larger than visible plane for easier click
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  hit.position.copy(v)
  hit.userData.kind = 'photo'
  hit.userData.id = `${p.roll}/${p.slug}`
  nodesGroup.add(hit)

  photoObjects.push({ photo: p, head, hit })
}
```

### 4.3 Click handling

The existing raycaster picks `pinObjects[].hit`. Extend to handle both kinds:

```ts
const allHits = [
  ...pinObjects.map(p => p.hit),
  ...photoObjects.map(p => p.hit),
]
const hits = raycaster.intersectObjects(allHits, false)
if (hits.length > 0) {
  const ud = hits[0].object.userData
  if (ud.kind === 'photo') {
    router.push(`/photos/${ud.id}`)
  } else {
    setSelectedId(ud.entry as string)
  }
}
```

> **Decision:** photo click → route to entry page (not lightbox). The lightbox lives inside the roll page where context exists. From the globe, route to entry page so the visitor lands on a self-contained surface.

### 4.4 Stratum visibility

In `STRATA[neo]` and `STRATA[all]`, photos visible. In `STRATA[neon]` and `STRATA[nex]`, photos hidden:

```ts
// At the top of applyStratum, add:
const showPhotos = key === 'neo' || key === 'all'
photoObjects.forEach(({ head }) => { head.visible = showPhotos })
```

This keeps the NeX possibility-shells stratum from cluttering with literal documentary photos.

### 4.5 Hover thumbnail (nice-to-have)

When the cursor hovers a photo pin's hit proxy, show a thumbnail tooltip near the cursor:

```ts
const onHover = (e: PointerEvent) => {
  // ... existing entry hover logic
  const photoHit = raycaster.intersectObjects(photoObjects.map(p => p.hit), false)[0]
  if (photoHit) {
    const obj = photoObjects.find(p => p.hit === photoHit.object)
    showPhotoTooltip(obj?.photo, e.clientX, e.clientY)
  } else {
    hidePhotoTooltip()
  }
}
```

Tooltip is a sibling DOM element, not a Three.js sprite — easier styling, uses thumb variant directly.

---

## 5 · Photo entry page

Route: `app/photos/[roll]/[id]/page.tsx`

```tsx
import { photos } from '@/.velite'
import { notFound } from 'next/navigation'
import { PhotoView } from '@/components/PhotoView'

export async function generateStaticParams() {
  return photos.map(p => ({ roll: p.roll!, id: p.slug! }))
}

export default function Page({ params }: { params: { roll: string; id: string } }) {
  const photo = photos.find(p => p.roll === params.roll && p.slug === params.id)
  if (!photo) return notFound()

  const rollPhotos = photos.filter(p => p.roll === params.roll)
    .sort((a, b) => (a.exif?.captureTime ?? '').localeCompare(b.exif?.captureTime ?? ''))
  const idx = rollPhotos.findIndex(p => p.slug === photo.slug)
  const prev = rollPhotos[idx - 1]
  const next = rollPhotos[idx + 1]

  return <PhotoView photo={photo} prev={prev} next={next} />
}
```

> **Next.js 16 caveat:** `generateStaticParams` exists across recent versions but the params shape may differ in 16. Verify against `node_modules/next/dist/docs/`. Same for `notFound()` import path.

`components/PhotoView.tsx` layout sketch:

```tsx
<article className="paper-canvas min-h-screen">
  <Nav />
  <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_240px] gap-8 px-10 py-12">

    {/* LEFT — instrument readout */}
    <aside className="atlas-readout">
      <div className="atlas-readout-head">§ INSTRUMENT</div>
      <ReadoutRow label="CAMERA" value={photo.exif.camera} />
      <ReadoutRow label="LENS"   value={photo.exif.lens} />
      <ReadoutRow label="FILM"   value={photo.exif.filmSim} accent />
      <ReadoutRow label="EXPOSURE" value={`f/${photo.exif.aperture} · ${photo.exif.shutter} · ISO ${photo.exif.iso}`} />
      <ReadoutRow label="FOCAL"  value={`${photo.exif.focal}mm (35eq: ${photo.exif.focal35}mm)`} />
      <ReadoutRow label="CAPTURED" value={fmtCaptureTime(photo.exif.captureTime)} />
      {photo.coords && <ReadoutRow label="COORD" value={fmtCoord(photo.coords.lat, photo.coords.lon)} />}
    </aside>

    {/* CENTER — photo */}
    <main>
      <picture>
        <source type="image/avif" srcSet={`${photo.variants.full.avif}`} />
        <source type="image/webp" srcSet={`${photo.variants.full.webp}`} />
        <img src={photo.variants.full.jpg} alt={photo.caption ?? ''} loading="eager" decoding="async" />
      </picture>
      {photo.caption && (
        <p className="t-display italic text-[var(--ink-soft)] mt-4 text-[13px] leading-[1.6]">
          {photo.caption}
        </p>
      )}
    </main>

    {/* RIGHT — roll context */}
    <aside>
      <RollNav roll={photo.roll!} prev={prev} next={next} />
    </aside>

  </div>
</article>
```

Mobile (≤880px): collapses to single column — readout above photo, roll nav below.

---

## 6 · Roll index + single roll pages

`/photos` (roll index) — list of all rolls, newest first. Pulls from `_meta.yml` data via velite.

`/photos/<roll>` (single roll) — contact sheet + mini-map. Mini-map is a simplified globe (orthographic SVG, not Three.js — no need for the full scene cost on a roll page).

Mini-map approach: reuse `lib/cartography.ts` — it already has `orthographic()` for lat/lon → x/y projection. Build a simple `<RollMiniMap />` SVG component:

```tsx
function RollMiniMap({ photos }: { photos: Photo[] }) {
  const withGps = photos.filter(p => p.coords)
  if (withGps.length === 0) return null

  // Center the projection on the median GPS
  const cx = median(withGps.map(p => p.coords!.lon))
  const cy = median(withGps.map(p => p.coords!.lat))

  return (
    <svg viewBox="-100 -100 200 200" className="w-full max-w-[400px]">
      {/* Globe outline */}
      <circle cx={0} cy={0} r={95} fill="none" stroke="var(--ink-faint)" strokeWidth="0.5" />
      {/* Pins */}
      {withGps.map(p => {
        const { x, y, visible } = orthographicCentered(p.coords!.lon, p.coords!.lat, cx, cy, 95)
        if (!visible) return null
        return <rect key={p.slug} x={x - 1.5} y={y - 1.5} width={3} height={3} fill="var(--accent-orange)" />
      })}
    </svg>
  )
}
```

Contact sheet uses the medium variant for thumbnails, lazy-loads, opens lightbox on click (next section).

---

## 7 · Lightbox integration

`yet-another-react-lightbox` for the contact-sheet → fullscreen flow:

```tsx
'use client'
import Lightbox from 'yet-another-react-lightbox'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/captions.css'

export function RollLightbox({ photos, openIndex, onClose }: Props) {
  const slides = photos.map(p => ({
    src: p.variants.full.jpg,
    srcSet: [
      { src: p.variants.medium.jpg, width: 1280 },
      { src: p.variants.full.jpg, width: 2400 },
    ],
    alt: p.caption ?? '',
    title: p.exif?.filmSim ?? '',
    description: p.caption,
  }))

  return (
    <Lightbox
      open={openIndex !== null}
      index={openIndex ?? 0}
      close={onClose}
      slides={slides}
      plugins={[Captions, Zoom]}
      styles={{
        container: { backgroundColor: 'rgba(10,10,10,0.95)' },
      }}
    />
  )
}
```

> **Lazy-load:** the lightbox bundle is ~30kb. Load via `dynamic(() => import('./RollLightbox'), { ssr: false })` to keep it out of the initial roll-page bundle.

---

## 8 · Film simulation palette switcher

The existing `globals.css` toggle uses `[data-palette="ink"]` as the only alternative. Extend to a multi-palette system.

### 8.1 CSS — sixteen palette blocks

Append to `globals.css`:

```css
/* Provia is the default — defined in :root, no override needed */

[data-palette="classic-chrome"] {
  --paper-base:    #E5DBC8;
  --paper-warm:    #EAE0CD;
  --paper-deep:    #D6C9A6;
  --paper-bright:  #EFE6D2;
  --ink-rgb:       56 75 89;       /* muted steel */
  --netra-rgb:     94 110 122;
  --accent-orange: #A86B2C;        /* muted ochre */
  --accent-orange-soft: rgba(168, 107, 44, 0.18);
}

[data-palette="acros"] {
  --paper-base:    #DDDAD3;
  --paper-warm:    #E2DFD7;
  --paper-deep:    #C8C5BC;
  --paper-bright:  #EDE9E0;
  --ink-rgb:       26 24 21;       /* near-black */
  --netra-rgb:     60 56 50;
  --accent-orange: #5A5A55;        /* B&W: no chroma accent, use deep gray */
  --accent-orange-soft: rgba(90, 90, 85, 0.20);
}

[data-palette="reala-ace"] {
  --paper-base:    #EAE3D2;
  --paper-warm:    #EFE9D8;
  --paper-deep:    #D9CFB4;
  --paper-bright:  #F2ECDB;
  --ink-rgb:       36 54 80;       /* warm navy */
  --netra-rgb:     86 100 124;
  --accent-orange: #C75D45;        /* coral */
  --accent-orange-soft: rgba(199, 93, 69, 0.18);
}

[data-palette="velvia"] {
  --paper-base:    #EAE0CC;
  --paper-warm:    #EFE5D2;
  --paper-deep:    #D9CCAE;
  --paper-bright:  #F2E8D5;
  --ink-rgb:       16 70 91;       /* deep teal */
  --netra-rgb:     58 110 128;
  --accent-orange: #D24820;        /* saturated red-orange */
  --accent-orange-soft: rgba(210, 72, 32, 0.20);
}

/* ── Wave 3 additions (2026-05-18) — 11 remaining Fuji simulations ── */

/*
 * ASTIA (Soft)
 * Character: softer contrast than Provia, pastel-lifted shadows, gentle
 *   saturation. Skin-tone-forward simulation designed for portraits.
 *   Warm-neutral paper, low-contrast ink, dusty-rose accent.
 * Core hues: warm mid-tones, lifted shadows, soft highlights
 * Shadow tendency: lifted / milky — shadows never block up to true black
 * Highlight tendency: slightly warm rolloff
 * Accent: dusty rose — the simulation's skin-flattering quality made visible
 * Use case: portrait rolls, soft-light street, hazy afternoon
 * Token conflict: none — all values expressible in current token set
 */
[data-palette="astia"] {
  --paper-base:    #EDE5D8;
  --paper-warm:    #F2EAE0;
  --paper-deep:    #E0D4C4;
  --paper-bright:  #F5EFEA;
  --ink-rgb:       72 58 52;       /* warm charcoal — soft, never cold */
  --netra-rgb:     118 100 90;
  --accent-orange: #B8614A;        /* dusty rose-terracotta */
  --accent-orange-soft: rgba(184, 97, 74, 0.16);
}

/*
 * PRO NEG HI
 * Character: elevated contrast, strong separation. Designed for commercial
 *   work — the "high contrast negative" simulation. Punchier than Provia,
 *   less saturated than Velvia. Cool-neutral foundation.
 * Core hues: neutral paper with elevated contrast; shadows push dark
 * Shadow tendency: dense — holds detail but with weight
 * Highlight tendency: clean rolloff, no warmth added
 * Accent: deep amber — punchiness made visible without going orange
 * Use case: architecture, product, high-key street
 * Token conflict: none
 */
[data-palette="pro-neg-hi"] {
  --paper-base:    #E6E0D3;
  --paper-warm:    #EBE5D8;
  --paper-deep:    #D4CCBB;
  --paper-bright:  #EEEAD0;         /* slightly cooler bright — elevated contrast feel */
  --ink-rgb:       22 30 35;        /* near-black with slight blue cast */
  --netra-rgb:     58 74 82;
  --accent-orange: #B05A18;         /* deep amber, punchy */
  --accent-orange-soft: rgba(176, 90, 24, 0.18);
}

/*
 * PRO NEG STD
 * Character: low contrast, flat, understated. The "standard negative" film
 *   reference — intended for even, natural rendering across a wide scene range.
 *   Less push than Pro Neg Hi; slightly warmer base.
 * Core hues: neutral warm paper, mid-gray ink with no aggressive contrast
 * Shadow tendency: open — shadows are readable without boost
 * Highlight tendency: flat — highlights hold without burning
 * Accent: muted sienna — warmth of the emulsion without drama
 * Use case: reportage, documentary, even indoor light
 * Token conflict: none
 */
[data-palette="pro-neg-std"] {
  --paper-base:    #EAE4D8;
  --paper-warm:    #EFE9DE;
  --paper-deep:    #DDD5C6;
  --paper-bright:  #F2EEE4;
  --ink-rgb:       54 48 40;        /* warm mid-gray — low contrast */
  --netra-rgb:     100 92 82;
  --accent-orange: #A3622E;         /* muted sienna */
  --accent-orange-soft: rgba(163, 98, 46, 0.16);
}

/*
 * CLASSIC NEG
 * Character: the "expired film" simulation. Lifted shadows, faded highlights,
 *   shifted color balance that pushes greens and blues slightly cool.
 *   A contemporary Fuji simulation (X-Pro3 era) modeled after 100-speed negative.
 * Core hues: slightly faded, cool-green shift in neutrals; lifted shadows
 * Shadow tendency: crushed slightly but with a lift — "overexposed negative" look
 * Highlight tendency: milky — highlights don't stay pure white
 * Accent: uses --accent-cool (iron-slate) — cool-axis semantic token for
 *   palettes outside the warm amber family. The olive quality of Classic Neg
 *   is expressed through paper + ink values; the accent carries the cool cast.
 * Use case: nostalgic street, analog-feeling portraits, anything where
 *   "found photo" aesthetics are intentional
 * Token conflict: resolved — wired to --accent-cool / --accent-cool-soft.
 */
[data-palette="classic-neg"] {
  --paper-base:    #E2DDD5;
  --paper-warm:    #E6E2D8;
  --paper-deep:    #D0C9BC;
  --paper-bright:  #EDEAE2;
  --ink-rgb:       42 48 44;        /* cool charcoal with green cast */
  --netra-rgb:     80 90 84;
  --accent-orange: var(--accent-cool);
  --accent-orange-soft: var(--accent-cool-soft);
}

/*
 * ETERNA (Cinema)
 * Character: Fuji's cinema emulsion reference — cinematic color science.
 *   Low saturation, shadow lift, slight desaturation in highlights. Colors
 *   roll toward teal in shadows and warm orange in highlights (the "teal-orange"
 *   of cinema). Long tonal range.
 * Core hues: desaturated warm-teal shadows, muted warm highlights
 * Shadow tendency: lifted, slightly teal-shifted (cinema shadow grade)
 * Highlight tendency: warm but rolled — not clipping orange, staying rolled
 * Accent: muted amber-gold — warm cinema highlight without saturation
 * Use case: evening shoots, artificial-light interiors, narrative-mode street
 * Token conflict: none — current teal accent family aligns with Eterna's shadow cast
 */
[data-palette="eterna"] {
  --paper-base:    #E4DDD3;
  --paper-warm:    #EAE4DA;
  --paper-deep:    #D5CBBD;
  --paper-bright:  #EDE8E0;
  --ink-rgb:       28 44 50;        /* teal-shadowed near-black — cinema base */
  --netra-rgb:     68 90 100;
  --accent-orange: #C08040;         /* muted amber-gold — warm cinema highlight */
  --accent-orange-soft: rgba(192, 128, 64, 0.18);
}

/*
 * ETERNA BLEACH BYPASS
 * Character: Eterna Cinema with a silver-retention bleach bypass process applied.
 *   Very low saturation, high contrast, silver-metallic paper. The most stark
 *   of all Fuji color simulations — borderline monochrome but retains residual
 *   color bias. Silver halide visual quality.
 * Core hues: near-neutral, very low chroma, silvery paper
 * Shadow tendency: hard — dense, near-black
 * Highlight tendency: metallic, slightly cool — near-white with silver cast
 * Accent: uses --accent-cool (iron-slate) — cool-axis semantic token.
 *   The metallic shimmer character is expressed through the near-black ink + silver
 *   paper; the accent carries the blue-cool direction.
 * Use case: harsh urban environments, industrial subjects, intentional brutalism
 * Token conflict: resolved — wired to --accent-cool / --accent-cool-soft.
 */
[data-palette="eterna-bleach-bypass"] {
  --paper-base:    #D8D6D2;         /* silvery cool — metallic */
  --paper-warm:    #DEDAD6;
  --paper-deep:    #C6C4BF;
  --paper-bright:  #E4E2DE;
  --ink-rgb:       18 20 22;        /* near-black, very cool */
  --netra-rgb:     52 58 62;
  --accent-orange: var(--accent-cool);
  --accent-orange-soft: var(--accent-cool-soft);
}

/*
 * ACROS R (Red filter)
 * Character: Acros B&W simulation with a red channel filter applied.
 *   Dramatically darkens blue sky, lightens warm tones (skin, foliage in
 *   autumn warmth). Strong contrast between sky and clouds.
 *   Paper feels slightly warmer than base Acros due to the filter's lift of warm tones.
 * Core hues: near-monochrome; reds and oranges rendered lighter than base Acros
 * Shadow tendency: deep — the red filter pushes blues and cool tones very dark
 * Highlight tendency: warm-leaning — red-lit surfaces glow
 * Accent: muted warm gray (slight warmth vs. base Acros cold gray)
 * Use case: landscape with sky drama, architectural B&W
 * Token conflict: none — shares Acros token range with slight warm push
 */
[data-palette="acros-r"] {
  --paper-base:    #DEDAD4;         /* slightly warmer than base Acros */
  --paper-warm:    #E3DED8;
  --paper-deep:    #CCC7C0;
  --paper-bright:  #ECEAE4;
  --ink-rgb:       22 20 18;        /* near-black, warmer cast than base Acros */
  --netra-rgb:     58 54 50;
  --accent-orange: #6A6360;         /* warm-tinted deep gray */
  --accent-orange-soft: rgba(106, 99, 96, 0.20);
}

/*
 * ACROS G (Green filter)
 * Character: Acros B&W simulation with a green channel filter applied.
 *   Classic landscape and portrait B&W filter — lightens foliage, evens skin tones,
 *   darkens red and blue subjects. More neutral than R filter, less contrasty than Ye.
 * Core hues: near-monochrome; greens rendered lighter than base Acros
 * Shadow tendency: moderate — red tones go darker but not as extreme as R filter
 * Highlight tendency: clean — green channel lift adds subtlety to highlights
 * Accent: neutral medium gray — the balanced character of the G filter
 * Use case: landscapes, portraits, general B&W documentary
 * Token conflict: none
 */
[data-palette="acros-g"] {
  --paper-base:    #DDDAD3;         /* same as base Acros — green filter is most neutral */
  --paper-warm:    #E2DFD7;
  --paper-deep:    #C8C5BC;
  --paper-bright:  #EDEAD0;
  --ink-rgb:       24 23 20;        /* near-black, neutral cast */
  --netra-rgb:     60 58 54;
  --accent-orange: #626260;         /* neutral mid-gray — green filter's balance */
  --accent-orange-soft: rgba(98, 98, 96, 0.20);
}

/*
 * ACROS Ye (Yellow filter)
 * Character: Acros B&W simulation with a yellow channel filter applied.
 *   Slight contrast boost to skies vs. clouds; classic portrait filter that gives
 *   a mild brightening to warm tones and moderate darkening of blue.
 *   The most subtle of the three Acros filter variants.
 * Core hues: near-monochrome; yellow filter lifts warm tones slightly
 * Shadow tendency: mild darkening of blues vs. base Acros; less extreme than R
 * Highlight tendency: slightly warm like R but more restrained
 * Accent: gray with very faint warmth — the most restrained Acros variant
 * Use case: casual portraits, overcast street, low-drama B&W
 * Token conflict: none
 */
[data-palette="acros-ye"] {
  --paper-base:    #DDDAD4;
  --paper-warm:    #E2DFD9;
  --paper-deep:    #C9C6BE;
  --paper-bright:  #EDEAD2;
  --ink-rgb:       25 23 20;        /* near-black, barely warmer than base Acros */
  --netra-rgb:     62 58 52;
  --accent-orange: #686460;         /* faintly warm gray */
  --accent-orange-soft: rgba(104, 100, 96, 0.20);
}

/*
 * NOSTALGIC NEG
 * Character: X-T4/X-T5 era simulation modeled after American-style color negative
 *   film from the 1970s. Warm shadow lift, faded colors, slight cyan-green cast
 *   in highlights. Very distinctive amber-tinted shadows with mid-tone glow.
 * Core hues: warm amber paper, amber-tinted shadows, slightly faded mid-tones
 * Shadow tendency: warm lifted — the defining signature; shadows glow amber
 * Highlight tendency: slightly cool/cyan — the opposite of the warm shadows
 *   creates the Nostalgic Neg's characteristic tension
 * Accent: faded amber-gold — the "nostalgic" warmth distilled
 * Use case: nostalgic street, period-feeling material, golden hour, interior warmth
 * Token conflict: none — warm amber maps cleanly to existing accent family
 */
[data-palette="nostalgic-neg"] {
  --paper-base:    #EDE2C8;         /* amber-tinted paper — warm lift throughout */
  --paper-warm:    #F2E8D0;
  --paper-deep:    #DECCAA;
  --paper-bright:  #F5EDDA;
  --ink-rgb:       64 48 28;        /* warm dark amber */
  --netra-rgb:     108 88 60;
  --accent-orange: #C87830;         /* faded amber-gold — nostalgic warmth */
  --accent-orange-soft: rgba(200, 120, 48, 0.18);
}

/*
 * SEAL
 * Character: Introduced in X-T5 firmware. Fuji's most recent simulation at time of
 *   writing. Described by Fuji as inspired by marine seal skin — muted, low-chroma,
 *   slightly cool mid-tones with a slight blue-gray cast throughout. Very subtle
 *   saturation, not quite monochrome. Softer and cooler than Classic Chrome.
 * Core hues: cool gray paper with slight blue cast; desaturated but not B&W
 * Shadow tendency: flat, open — no blocking
 * Highlight tendency: very soft rolloff, slightly cool
 * Accent: uses --accent-cool (iron-slate) — cool-axis semantic token.
 *   The steel-blue quality of Seal is the defining character of this token;
 *   --accent-cool was partially shaped by Seal's accent direction.
 * Use case: overcast, winter, subdued environments, architectural minimalism
 * Token conflict: resolved — wired to --accent-cool / --accent-cool-soft.
 */
[data-palette="seal"] {
  --paper-base:    #DDDDE0;         /* slight blue-gray cast — cooler than any other sim */
  --paper-warm:    #E3E3E6;
  --paper-deep:    #C8C8CC;
  --paper-bright:  #EBEBEE;
  --ink-rgb:       30 36 44;        /* cool near-black — not warm charcoal */
  --netra-rgb:     68 80 94;
  --accent-orange: var(--accent-cool);
  --accent-orange-soft: var(--accent-cool-soft);
}
```

The `ink` palette stays as-is for the Konami easter egg.

#### Token conflict summary (resolved — TASK-2026-05-18-BETELGEUSE-WAVE7-COOL-TOKENS)

Three simulations — Classic Neg, Eterna Bleach Bypass, and Seal — previously used `--accent-orange` to represent cool-gray or olive-green accents semantically outside the warm-orange family.

Resolution shipped: `--accent-cool` (`#3E5A6A`, iron-slate) and `--accent-cool-soft` (`rgba(62, 90, 106, 0.18)`) added to `:root` in `app/globals.css`. The three palette blocks now reference `var(--accent-cool)` and `var(--accent-cool-soft)` via the CSS cascade, overriding `--accent-orange` only in those palette states.

Contrast verification (WCAG AA, 4.5:1 at small text):
- `--accent-cool` vs `--paper-warm`: 5.93:1 — PASS
- `--accent-cool` vs `--paper-base`: 5.09:1 — PASS
- `--accent-cool` vs `--paper-deep`: 4.71:1 — PASS
- `--accent-cool` vs `--paper-bright`: 5.51:1 — PASS

Usage rule: warm/spectrum palettes → `--accent-orange` / `--accent-orange-soft`. Cool/silver/B&W-variant palettes → `--accent-cool` / `--accent-cool-soft`.

Sims that can ship immediately once palette blocks are wired to FilmSimSwitcher (all tokens resolved):
- Astia, Pro Neg Hi, Pro Neg Std, Eterna, Nostalgic Neg — warm axis, use --accent-orange
- Classic Neg, Eterna Bleach Bypass, Seal — cool axis, now use --accent-cool
- Acros R, Acros G, Acros Ye — gray-scale family; no conflict; --accent-orange in gray territory is tolerable. Review at implementation time.

### 8.2 Switcher component

`components/FilmSimSwitcher.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'

const SIMS = ['provia', 'classic-chrome', 'acros', 'reala-ace', 'velvia'] as const
type Sim = typeof SIMS[number]

const STORAGE_KEY = 'wl:film-sim'

export function FilmSimSwitcher() {
  const [current, setCurrent] = useState<Sim>('provia')

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Sim) ?? 'provia'
    setCurrent(saved)
    applyPalette(saved)
  }, [])

  const switchTo = (s: Sim) => {
    setCurrent(s)
    localStorage.setItem(STORAGE_KEY, s)
    applyPalette(s)
  }

  return (
    <div className="flex flex-wrap gap-1.5 t-meta">
      <span className="text-[var(--ink-faint)]">FILM ·</span>
      {SIMS.map(s => (
        <button
          key={s}
          onClick={() => switchTo(s)}
          className={`px-2 py-0.5 border tracking-[0.18em] text-[9px] uppercase ${
            current === s
              ? 'border-[var(--accent-orange)] text-[var(--accent-orange)]'
              : 'border-[var(--ink-faint)] hover:border-[var(--accent-orange)]'
          }`}
        >
          {labelFor(s)}
        </button>
      ))}
    </div>
  )
}

function applyPalette(s: Sim) {
  // 'provia' is the default — no attribute = base palette
  if (s === 'provia') document.documentElement.removeAttribute('data-palette')
  else document.documentElement.setAttribute('data-palette', s)
}

function labelFor(s: Sim) {
  return s.replace('-', ' ').toUpperCase()
}
```

Place: appears on `/photos`, on photo entry pages, and on `/colophon`. NOT in the main `Nav` — this is a discoverable instrument, not a primary control.

### 8.3 Three.js color sync (the gotcha)

`WorldlineGlobe.tsx` has a "PALETTE BACKUP" comment block — the canvas can't read CSS vars, so it ships hardcoded teal `0x1f5063`. The film sim switcher changes CSS but not the globe's line/material colors. Two options:

1. **Accept it.** The globe's teal stays constant; only the surrounding paper + ink shifts. Reads as "the camera is the lens, the world is the world." Cheap.
2. **Sync the globe.** On palette change, dispatch a `window.dispatchEvent(new CustomEvent('wl:palette-change', { detail: paletteRgb }))` and have `WorldlineGlobe` listen, traversing scene materials and updating `.color`. Doable but invasive and subject to flicker.

**Recommend option 1 for v1.** Revisit if the disconnect feels wrong in practice.

---

## 9 · Privacy hardening

GPS leakage is the #1 risk in this PRD. Three layers of defense:

1. **Frontmatter default `share-location: false`.** Already in schema.
2. **Server-side strip.** `processPhoto` only writes `coords` to the velite cache when `share-location === true`. Without coords, the photo cannot reach the globe pin layer.
3. **Sharp output strips EXIF by default.** sharp's `.jpeg()` / `.webp()` / `.avif()` re-encoders drop EXIF unless explicitly preserved (we don't preserve). Resized variants in `public/photos/` are EXIF-clean — even the JPEG download has no GPS.

> **Test before any roll merges:** download the served JPEG, run `exiftool` on it, confirm no GPS. If sharp ever ships a default change, this catches it.

The original X-E5 file in `content/photos/<roll>/` may still have GPS — that's why content git-lfs / gitignore matters. Don't commit unprocessed originals unless you want them in repo history.

---

## 10 · Testing checklist

Manual smoke test against first real roll:

- [ ] velite build succeeds; `.velite/photos.json` populated for every JPEG.
- [ ] `public/photos/<roll>/` contains 9 variants per source (3 sizes × 3 formats).
- [ ] Re-running build is idempotent — no regenerated variants for unchanged sources.
- [ ] `/photos` lists the roll with correct date range and photo count.
- [ ] `/photos/<roll>` contact sheet renders with thumbs in capture-time order.
- [ ] Clicking a thumb opens lightbox; arrow keys navigate; ESC closes.
- [ ] `/photos/<roll>/<id>` renders with full instrument readout.
- [ ] Photos with `share-location: true` appear as pins on ATLAS globe.
- [ ] Photos with `share-location: false` (or unset) DO NOT appear on globe AND served JPEG has no GPS in EXIF.
- [ ] Clicking globe pin routes to entry page.
- [ ] Film sim switcher changes the surrounding palette site-wide and persists across reload.
- [ ] Reduced-motion preference respected (existing rule applies to lightbox transitions).
- [ ] Lighthouse on photo entry page: a11y ≥95, performance ≥85.
- [ ] Mobile (≤600px): everything stacks correctly; lightbox swipe works.

Edge cases worth catching early:

- A photo with no EXIF at all (cropped via a tool that strips it). `processPhoto` should not crash; surfaces "no instrument data" in the readout.
- A photo with GPS but `share-location: false`. Globe pin must NOT appear.
- A photo with `share-location: true` but no GPS. Photo entry page renders without coord row; doesn't appear on globe (no coords to project).
- Two photos with identical GPS (same spot, two shots). Globe shows two pins very close — clustering deferred to phase 2; visual overlap acceptable for now.

---

## 11 · Build-time impact

For every roll added:

- **Disk:** ~3× source size for variants (3 formats × 3 sizes, AVIF compresses small).
- **Build time:** ~2–4 seconds per source photo (sharp + exifr + 9 encodings). 100-photo roll = 4–8 minutes added.
- **CI:** if deploying to Vercel, this runs every deploy. Mitigation: content-addressed cache (already in script via SHA hash). Re-deploys only reprocess changed photos.

Long term (~1000 photos): consider moving variant generation to a one-shot pre-build script triggered locally, committing variants to a separate branch or external CDN. Phase 2 concern; not blocking.

---

## 12 · What this enables that wasn't possible before

- A photo of Doi Suthep at sunrise becomes a pin on the globe at 18.81°N, 98.92°E. Click it → land on the photo with Acros R simulation listed in the instrument readout, captured Sun 14 Apr 2026 06:12 ICT. The visitor sees *where Peat was*, *what camera-thinking he was doing*, and *what the frame felt like* — without a single word of caption.
- A visitor flips the film simulation switcher to Acros. The whole site goes high-contrast B&W. Now they're reading articles in the same key the photographer was shooting in.
- The garden has a *latitude*. Articles, photos, and (eventually) repos accrete on the same globe at coordinates that mean something. The site stops being a list of items and becomes a map.

That's the aesthetic-leverage win the brainstorm called out. This PRD delivers it.

---

*End of deep-dive. When ready: PRD 04 deep-dive (search + RSS) is the next natural follow-up — it shares velite's content cache and reuses the orthographic mini-globe.*
