# PRD 03 — Photo + ATLAS Integration

> Status: Draft v0.1 — 2026.05.10
> Phase: C
> Companion: `worldline-feature-brainstorm.md` §1.2, §3.1
> Tech: exifr, sharp, yet-another-react-lightbox

---

## Goal

Make the Fujifilm X-E5 photo journal a first-class citizen of Worldline by integrating photos directly into the ATLAS globe at their real GPS coordinates. EXIF surfaces as instrument readout in the existing A.T.L.A.S. visual language. Film simulation choice optionally drives the site palette. This is the single feature with the highest aesthetic-leverage-per-effort ratio in the build, because the globe and instrument frame already exist.

## User stories

- **As Peat (photographer)**, I want to import a roll of X-E5 photos, have GPS / film sim / camera settings extracted automatically, and see the photos appear as nodes on the globe at their capture coordinates.
- **As Peat**, I want to flip a Fuji film simulation toggle (Classic Chrome, Acros, Reala Ace, Provia, Velvia) and have the entire site's palette shift to match — making the site feel like the camera I actually shoot with.
- **As a visitor**, I want to click any photo node on the globe and view the photo full-resolution, with EXIF data presented as instrument readout (not a generic caption).
- **As a visitor**, I want to browse a roll like a contact sheet — small thumbnails in capture order — with a clear sense of where the roll happened.
- **As Peat (privacy-conscious)**, I want GPS only surfaced for photos I explicitly opt in to share location for. Default is off.

## Scope

### In scope

- Build-step EXIF extraction including GPS, film simulation, full camera settings.
- Build-step image variant generation (thumb 320, medium 1280, full 2400) in JPEG/WebP/AVIF.
- Photo node layer on ATLAS globe, integrated with existing pin system.
- Photo entry page (covered partially in PRD 01; this PRD adds globe integration + lightbox + roll context).
- Roll index page at `/photos` listing all rolls.
- Single-roll page at `/photos/<roll>` with contact-sheet view + map of all photos in roll.
- Film simulation palette switcher: at least 5 simulations mapped to palette variants.
- Lightbox via `yet-another-react-lightbox` for fullscreen viewing.
- GPS opt-in flag (`share-location: true` in photo frontmatter). Default false.

### Out of scope

- AI-driven tagging or auto-captioning.
- EXIF editing.
- Direct camera connectivity (manual file import only).
- Photo comments or social interactions.
- Print-on-demand or commerce integrations.

## Functional requirements

### Import pipeline (build step)

A `scripts/process-photos.ts` runs as part of `npm run build`:

1. Walks `content/photos/<roll>/` directories.
2. For each `.jpg` (and `.heic` if applicable):
   a. Extracts EXIF via exifr (camera, lens, aperture, shutter, ISO, focal length, capture timestamp, GPS, film simulation tag).
   b. Generates resized variants via sharp at thumb / medium / full sizes, in JPEG + WebP + AVIF.
   c. Writes variants to `public/photos/<roll>/<base>-{size}.{format}`.
   d. Strips GPS from served metadata unless frontmatter says `share-location: true`.
3. Emits a typed photo records file consumed by velite collection.

### Globe integration

Extends the existing pin layer in `components/WorldlineGlobe.tsx`:

- Photo nodes use a different glyph than entry pins — small square instead of circle, to distinguish at a glance.
- Photo nodes appear in the `Ne0` stratum (surface archive) and the `all` stratum.
- Hovering a photo node shows a thumbnail tooltip near the cursor (EXIF readout below).
- Clicking a photo node opens the photo entry page (or the lightbox in modal mode if user prefers — see open questions).

Edge cases:
- Photos without GPS (or with `share-location: false`) do not appear on globe. They appear in roll views only.
- Photos with identical or near-identical coordinates cluster: cluster glyph shows count, expands to spread on hover.

### Roll index (`/photos`)

```
─────────────────────────────────────────
  HEADER
  · § PHOTO ARCHIVE · X-E5 · NN ROLLS
─────────────────────────────────────────
  ROLL LIST (chronological, newest first)
  Each row:
    · roll name (e.g. "2026-04-chiang-mai")
    · date range
    · photo count
    · primary location (derived from EXIF GPS if any photo opts in)
    · 4-6 thumbnail strip (cover preview)
─────────────────────────────────────────
```

### Single roll (`/photos/<roll>`)

```
─────────────────────────────────────────
  HEADER
  · roll name · date range · photo count
  · roll caption (from _meta.yml)
─────────────────────────────────────────
  MINI-MAP
  · cropped ATLAS-style globe centered on roll's median GPS
  · pins for each photo with GPS opted-in
─────────────────────────────────────────
  CONTACT SHEET
  · grid of thumbnails in capture-time order
  · click thumbnail opens lightbox
─────────────────────────────────────────
```

### Single photo (`/photos/<roll>/<id>`)

```
─────────────────────────────────────────
  PHOTO (full-resolution)
─────────────────────────────────────────
  INSTRUMENT READOUT (ATLAS-style block)
  ┌──────────────────────────────────────────┐
  │ CAMERA   FUJIFILM X-E5                   │
  │ LENS     XF 23mm f/1.4 R LM WR           │
  │ FILM SIM CLASSIC CHROME                  │
  │ EXPOSURE f/2.8 · 1/250s · ISO 400        │
  │ FOCAL    23mm (35mm-eq: 35mm)            │
  │ CAPTURED 2026.04.18 · 14:32 ICT          │
  │ COORD    18.78°N · 98.99°E (Chiang Mai)  │
  └──────────────────────────────────────────┘
─────────────────────────────────────────
  CAPTION (optional, italic serif)
─────────────────────────────────────────
  ROLL NAVIGATION
  · prev / next within roll
  · "back to roll" link
─────────────────────────────────────────
```

### Film simulation palette switcher

Each Fuji film simulation maps to a palette variant defined in `globals.css`. v1 mapping:

| Simulation | Paper base | Ink primary | Accent | Mood |
|---|---|---|---|---|
| Provia (default) | current `#E8E2D5` | current teal `#1F5063` | current orange `#D4602A` | neutral, balanced — current Worldline default |
| Classic Chrome | warmer cream `#E5DBC8` | muted steel `#384B59` | muted ochre `#A86B2C` | quiet, documentary |
| Acros | cool gray `#DDDAD3` | near-black `#1A1815` | bright white accent `#F5F0E0` | high-contrast B&W |
| Reala Ace | soft cream `#EAE3D2` | warm navy `#243650` | coral `#C75D45` | gentle saturation |
| Velvia | warm cream `#EAE0CC` | deep teal `#10465B` | saturated red-orange `#D24820` | vivid, trip-energy |

Switcher UI: minimal — appears in a dedicated control on `/photos` and on photo entry pages, and as a discoverable element in `/colophon`. NOT in main nav (avoids clutter).

When switched, the entire site uses the new palette via `data-palette` attribute extension. Persists in localStorage as `wl:film-sim`.

### Privacy default

Photo frontmatter:

```yaml
share-location: false  # default, GPS stripped from served metadata + globe
```

Authoring workflow expects the photographer to explicitly opt in per photo. Considered: blanket per-roll opt-in via `_meta.yml`. Recommend per-photo to prevent accidental reveals of home/work coordinates.

## Acceptance criteria

- [ ] At least one full roll (10+ photos) processed end-to-end from `content/photos/<roll>/` to served pages.
- [ ] EXIF extraction surfaces all camera settings + film simulation correctly for each photo.
- [ ] Variants generated in 3 sizes × 3 formats (9 total per source). Total file size growth under 1.5× source.
- [ ] GPS-opted-in photos appear as nodes on ATLAS globe at correct coordinates (visual smoke test against known landmarks).
- [ ] Lightbox works keyboard (arrows for nav, ESC to close) and on mobile (swipe).
- [ ] Film simulation switcher applies palette site-wide and persists.
- [ ] Default privacy is `share-location: false`; GPS does not surface unless explicitly opted in.
- [ ] Lighthouse performance ≥85 on photo-heavy pages (note: image-heavy pages will not hit 95+; aim for mid-80s with lazy loading + AVIF).
- [ ] Build pipeline runs idempotently — re-running doesn't regenerate variants for unchanged sources.

## Dependencies

- exifr (EXIF including Fuji MakerNote for film simulation tags)
- sharp (variant generation)
- yet-another-react-lightbox (fullscreen viewer)
- velite photo collection schema (from PRD 01 base)

## Open questions

- **Click behavior on globe pin.** Open lightbox in-place (faster) or route to entry page (richer)? Recommend route to entry page; the lightbox is for fast browsing within a roll, the entry page is the destination experience.
- **Fuji film simulation tag reading.** X-E5 stores film simulation in MakerNote; exifr supports it but may need a config flag. Verify on first roll import; if exifr can't read it, fall back to manual frontmatter override.
- **HEIC support.** X-E5 can shoot RAF + JPEG; if iPhone-tethered transfers convert to HEIC, sharp needs `libheif` available. Decide based on actual workflow; not blocking for v1 if shooting JPEG.
- **Map of an entire roll.** Mini-map pins all photos in a roll. If the roll spans hundreds of km, cropping the globe meaningfully is hard. Recommend bounding the view to roll's GPS extent + 20% padding.
- **Cluster threshold.** Pins within 50m of each other cluster — but at globe-scale that's invisible anyway. Re-evaluate once first roll is in.
- **Should fiction get its own globe presence?** Tempting; but fiction frontmatter has narrative coordinates, not real ones. Recommend keeping fiction off the globe (its place is the fiction reader's full-screen mode). Re-evaluate later.

---

*End of PRD.*
