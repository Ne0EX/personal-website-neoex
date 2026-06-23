# Session log — Dark Mode + interactive-state design system

**Span:** 2026-06-18 → 2026-06-22 (closed 2026-06-24)
**Branch:** `genesis/store-as-source` (NOT pushed, NOT merged to main)
**Front-of-house:** Polaris · agents: Sirius, Betelgeuse, Algol

---

## Set out to do
Peat shared a Claude Design "Worldline Dark Mode PoC" → implement dark mode. Key
parts he named: the theme colours + the globe in its night palette.

## What happened (the arc)

### Phase 0 — merge mobile-native (prerequisite)
Dark mode had to land on top of the unmerged `genesis/mobile-native` (the mobile
UI concept — nav-slim, ATLAS reflow, PhotoSwipeViewer, safe-area). Merged it into
store-as-source (`ed17348`). Semantic conflict: store-as-source had the
Peat-confirmed IBM Plex superfamily fonts (Version F), mobile-native an older font
arc — resolved keeping Version F + grafting viewportFit:cover; dropped a duplicate
ATLAS reflow block; **corrected a stale test (f)** that asserted requestAnimationFrame
while mobile-native deliberately uses setInterval (iOS Safari blank-canvas fix).

### Dark mode (opt-in night register)
- `[data-theme="dark"]` token swap in globals.css; no-FOUC inline script in
  layout.tsx; `lib/useThemeMode.ts` (MutationObserver hook, no provider);
  REGISTER toggle bottom-right (desktop) + `.nav-slim-theme` (mobile). `c228317`.
- Globe recolor: `GLOBE_PALETTES{light,dark}` + `lib/globe-surface.ts` modes.
  Algol gauntlet → REVISE → fixed direction-breakers + a11y + hydration (`0a79acb`).

### The globe iteration (many Peat reviews — the long tail)
The globe was the hard part. Sequence of fixes, each from Peat's eye:
- coastline + panels track theme (`9040663`); continents up + lines calmer (`98142d5`);
- **scope correction**: line-dimming is curvation-only, NOT the orbital field (`c629d8b`) — Peat caught the over-reach;
- place nodes vanished on toggle (rebuild dep bug) (`3a1c1a1`);
- **recolor-IN-PLACE** instead of scene-rebuild so camera/selection/dig survive a toggle (`4291903`) — this was the real architectural fix for the toggle-state-loss class;
- the "moon" — a bright spot: first dimmed key light (`7a7a209`, insufficient), then matte sphere (roughness 1, no roughnessMap) killed the specular glint for real (`14a1780`);
- **the big lesson — contrast POLARITY** (`e2e3d87`): continents were invisible because dark kept the light polarity (land darkened on a dark sphere = dark-on-dark). Inverted to light-on-dark (land = mid-teal landTint, lighter than ocean). ChatGPT's perceptual analysis (Peat relayed) was correct; raising coastline strength had made it WORSE.
- edge: a rim-glow ring looked tacky (Peat: "ทุเรศ") → removed; soft borderless silhouette by not darkening the rim in dark (`105c7c8` then `7ca65f8`).

### Reusable <Globe> component
Extracted `components/Globe.tsx` (standalone sphere, no ATLAS chrome) + shared
`lib/globe-palettes.ts`; WorldlineGlobe = pure import refactor, unchanged. PARKED
(not wired anywhere). `8f47377`.

### Console + interactive-state design system (Peat's directive)
Console buttons glared white in dark (active state used `background:var(--ink-primary)`
which flips to cream in dark). Stopgap `--btn-fill` (`cb46994`), then Peat asked to
**fix it at the design-system level** — "support all variants, know what to pick,
states consistent, no guessing." Built `--ctl-*` interactive-state token system
(fill/ghost/segment/text/register/pill/status × rest/hover/active × light/dark)
`87c5e30`; doc `docs/design/80-interactive-states.md` + soul-atom gallery A18
showcase `e648bb6`; migrated site+console controls `f59fe4e` + token-chain closure
`a8fcd7e`. Fixed the /photos TIMELINE toggle glare en route.

### Triangulate flicker
Results list flickered in/out on every keystroke (both themes): list rendered only
on `phase==="results"`, but each debounced search flips to "loading" first, hiding
the list + snapping the layout. Fixed: render list when `items.length>0`; bare
loading only on first search. `2bfd5ac`.

## Key decisions (+ who)
- Merge mobile-native first (Peat). · Opt-in dark, default light (Peat). · Toggle =
  REGISTER bottom-right desktop / nav-slim mobile (Peat). · Recolor-in-place not
  rebuild (Polaris, forced by the toggle-state-loss bug). · Dark globe = matte +
  light-on-dark land polarity (Peat eye + ChatGPT analysis). · Build the --ctl-*
  design-system, not more one-offs (Peat). · Extract <Globe>, park it (Peat).

## Shipped (21 commits, ground truth `git log 782aebb..HEAD`)
Dark mode (site + console + mobile) · reusable <Globe> · --ctl-* interactive-state
system + doc + gallery · triangulate flicker fix. Every commit verified: build clean
(27 pages), mobile-touch-contract 12/12, chrome-devtools ground-truth per fix.

## Parked / open (see Hand-off in STATUS)
- NOT pushed, NOT merged to main (web-only policy — goes to main at deploy).
- Algol #4 (`--ink-soft` 4.22:1 on dark = AA-borderline for .t-meta; systemic
  design-tier, dark doesn't regress vs light ~3.7) → Betelgeuse call.
- Algol #1 — no signature record for this task → protocol.
- `genesis/mobile-native` branch merged → can be deleted.
- 23-mobile-atlas-reflow.md fuller draft (236-line) preserved in `.harness/merge-backup/`.
- ImportZone aria-dropeffect/grabbed = pre-existing deprecation warnings (not this work).
