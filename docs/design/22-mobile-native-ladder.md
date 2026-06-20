# docs/design/22-mobile-native-ladder.md
# Worldline — Mobile-Native Breakpoint Ladder + Chrome Spec
# F2 · Betelgeuse (α-VIS-04) · 2026-06-20

---

## intent

Lock the canonical responsive breakpoint ladder for the mobile-native pass.
Define safe-area chrome adaptations so every layout decision downstream can
reference a single source of truth.

This spec is consumed by S1, S2, S3, S5 (CSS slices) and by Sirius (Nav.tsx,
GalleryGrid.tsx). It documents where the existing divergent queries live and
why they are left alone.

---

## canonical ladder

```
PHONE   ≤ 600px   primary target: iPhone 17 393px DPR3
TABLET  ≤ 900px   portrait iPad, touch-screen laptops
DESKTOP > 900px   default; site was authored here
```

All new @media queries in `app/globals.css` use these exact values.
No intermediate breakpoints are introduced.

**Governing rule:** Tailwind v4 `sm:/md:/lg:` are not used for layout
decisions (source-detection disabled per Turbopack/codegraph workaround).
Custom `@media` in globals.css is the canonical mechanism.

---

## existing query inventory — decisions

### Kept at 768px (legacy)

```
@media (max-width: 768px)   — CW-01 · .archive-body single-column collapse
```

This is a LAYOUT shift (two-column grid → one-column) that predates the
mobile-native pass. It is documented as a "legacy tablet tweak."
Changing it from 768 → 900 would collapse the archive rail at 800–900px
desktop widths where it currently renders correctly. Defer to a separate
archive-responsive slice. Do not migrate as part of F2.

### Migrated from 768px → 900px (F2)

```
@media (max-width: 768px) → @media (max-width: 900px)
  CW-08 · .footer-channel-link  padding-block:18px  (tap zone)
  CW-16 · .attractor-pill        min-height:44px     (tap zone)
  CW-04 · .nav-links a           padding-block:15px  (tap zone)
```

Rationale: tablets in the 769–900px window are touch devices that need
≥44px tap targets as much as phones do. The original 768px threshold
missed this window.

### Left unchanged — editor admin divergence

```
@media (max-width: 880px)   — editor admin query (EntryEditor.tsx)
```

This is the admin editor's responsive threshold, controlled by Sirius
in `components/console/EntryEditor.tsx`. The editor is a separate
surface from the public site. The 880px value predates this ladder and
is embedded in both CSS and JS (`matchMedia('(max-width:880px)')`).
Changing it would require coordinated JS + CSS changes in the editor.
Documented here as an intentional divergence. Do not migrate.

### Left unchanged — container query

```
@container arl (max-width: 300px)   — mini readout compact mode
```

This is a CSS Container Query on the `.archive-globe-readout` container,
not a viewport breakpoint. Container queries are orthogonal to the
viewport ladder; they respond to the container's rendered width. Left
untouched. Documented as a divergence by design.

---

## safe-area chrome adaptation

Requires `viewport-fit=cover` in `app/layout.tsx` (F1, Canopus).
Without F1, `env()` resolves to 0 everywhere (safe fallback, not broken).

### .corner-marks

```css
inset: max(16px, env(safe-area-inset-top))
       max(16px, env(safe-area-inset-right))
       max(16px, env(safe-area-inset-bottom))
       max(16px, env(safe-area-inset-left));
```

On no-notch devices: resolves to `inset: 16px` (unchanged).
On iPhone 14+ with Dynamic Island: resolves to larger inset values so
reticles clear the hardware chrome. Reticles stay VISIBLE — they shift
inward. This is the minimum viable instrument presence.

### .scroll-meter

```css
top: env(safe-area-inset-top);
```

Shifts the 2px orange march line below the Dynamic Island.
On no-notch: resolves to 0 (unchanged).

### .nav-slim-bar (S3)

```css
padding-top: env(safe-area-inset-top);
height: calc(44px + env(safe-area-inset-top));
padding-left: max(16px, env(safe-area-inset-left));
padding-right: max(16px, env(safe-area-inset-right));
```

The slim bar physically sits at the viewport top. The extra top padding
pushes content below the Dynamic Island. The height grows to compensate.

### .nav-slim-menu

```css
padding-left: max(0px, env(safe-area-inset-left));
padding-right: max(0px, env(safe-area-inset-right));
```

Menu panel safe-area on left/right edges for landscape orientation.

### .nav-slim-menu-inner

```css
padding: 8px 0 max(8px, env(safe-area-inset-bottom));
```

Clears the home indicator at the bottom of the menu in landscape mode.

---

## S1-CSS — globe `touch-action: pan-y`

```css
@media (pointer: coarse) {
  .atlas-frame .atlas-globe-wrap canvas {
    touch-action: pan-y;
  }
}
```

Scoped to `pointer:coarse` (not max-width:600px) so touch-enabled tablets
and touch-screen laptops also get the correct gesture split.

**NOT applied to the mini-globe.** `ArchiveMiniGlobeThreeJS` (in the
/archive overlay) uses `touch-action:none` set inline in its TSX wrapper.
That is correct — the mini-globe is a bounded pan-able panel. This rule
cannot reach the mini-globe because it is not a descendant of `.atlas-frame`.

CW-11 direction guard (~WorldlineGlobe.tsx:1260) is kept as belt-and-suspenders
under `pan-y`. The CSS is the browser gesture hint; the JS guard is the
fallback for edge cases.

---

## S2 — soul-chrome slim at ≤600px

### .marginalia — hairline, not hidden

Previous rule: `display:none` at ≤600px.
New rule:

```css
.marginalia {
  width: 1px;
  padding: 0;
  border-left: 1px dashed var(--ink-dashed);
  background: none;
}
.marginalia > * {
  display: none;
}
```

Instrument language principle: the soul-chrome adapted, not removed.
The 1px dashed seam is the minimum viable instrument signature on phone.
Text children (vertical readout strings) are hidden — unreadable and
width-starved at phone widths. The scanline texture background is removed
(meaningless at 1px).

The `.scroll-meter` adjusts `right: 1px` (was `right: 0` at ≤600) to
clear the hairline.

---

## S3 — nav slim bar class-name contract

Full contract documented as comments in `app/globals.css` §S3 block.
Summary:

| Class | Role | Viewport |
|---|---|---|
| `.nav-shell` | Desktop nav wrapper (existing) | Visible >600 / Hidden ≤600 |
| `.nav-slim` | Slim bar root (new) | Hidden >600 / Visible ≤600 |
| `.nav-slim-bar` | Single-row bar: wordmark + readout + actions | Inside `.nav-slim` |
| `.nav-slim-wordmark` | Wordmark text/link | Inside `.nav-slim-bar` |
| `.nav-slim-readout` | Stratum/clock text | Inside `.nav-slim-bar` |
| `.nav-slim-actions` | Locale + search + menu buttons cluster | Inside `.nav-slim-bar` |
| `.nav-slim-locale` | LocaleSwitcher wrapper (44px target) | Inside `.nav-slim-actions` |
| `.nav-slim-search` | Search glyph button ⌖ | Inside `.nav-slim-actions` |
| `.nav-slim-menu-btn` | Menu glyph button ☰ | Inside `.nav-slim-actions` |
| `.nav-slim-menu` | Collapsible links panel | Inside `.nav-slim` |
| `.nav-slim-menu-inner` | Inner padding wrapper | Inside `.nav-slim-menu` |
| `.nav-slim-link` | Individual nav link (44px height) | Inside `.nav-slim-menu-inner` |
| `.is-open` | State class on `.nav-slim` | Toggled by Sirius onClick |

Open state: Sirius toggles `.is-open` on the `.nav-slim` root element via
a single `onClick` handler on `.nav-slim-menu-btn`. The CSS
`.nav-slim.is-open .nav-slim-menu { max-height: 320px }` does the rest.
No JS measures heights. No JS reads breakpoints. No hydration flash.

Search glyph: `onClick → window.dispatchEvent(new CustomEvent("triangulate:open"))`.
The existing Triangulate overlay already listens for this event.

---

## S5 — gallery caption + overlay safe-area

### .gv-cap class-name contract

The gallery caption `<div>` currently has no CSS class (opacity set inline via
`isHovered ? 1 : 0`). Sirius must add `className="gv-cap"` to the caption
divs in GalleryGrid.tsx across all three view modes (TIMELINE, FLAT, PLACE).

CSS rule in `components/GalleryGrid.css`:

```css
@media (max-width: 600px) {
  .gv-cap {
    opacity: 1 !important;
  }
}
```

`!important` overrides the inline style specificity. Desktop hover behaviour
is unchanged (inline opacity:0→1 on isHovered still works above 600px).

### Overlay safe-area (GalleryLightbox, TriangulateSearch)

Both overlays use `100vh` and `position:fixed` with inline styles in TSX
(no CSS class rules in any stylesheet). Their safe-area adaptation and
`100vh → 100dvh` migration is Sirius's responsibility. Documented here so
the gap is explicit:

- `GalleryLightbox` — `100vh` and edge insets are inline in `GalleryLightbox.tsx`
- `TriangulateSearch` — `100vh` and edge insets are inline in the TSX

Sirius: add `env(safe-area-inset-*)` to edge padding and change `100vh`
to `100dvh` on those overlays.

---

## non-goals

- PWA / manifest / service worker
- Tailwind `sm:/md:/lg:` breakpoints for layout
- Any change to the editor's 880px admin threshold
- Changing the `@container arl (max-width:300px)` container query
- Print stylesheet
- RTL layout
