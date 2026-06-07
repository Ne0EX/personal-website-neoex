# docs/design/atlas-console-full-editor.md
# ATLAS Console — Full Kind-Aware Editor
# Build-contract spec (Betelgeuse · α-VIS-04 · 2026-06-07)

> Ground truth: worldline-atoms bundle `d72810da-4995-4c96-9d69-766952cdee6b`
> (colors_and_type.css · worldline-atoms.css). Prototype reference:
> `/tmp/wl-design-new/atlas-console/project/console/` (editor-entry.jsx +
> editor-kinds.jsx). Prototype is REFERENCE ONLY — deviate with purpose.
>
> Builds on Slice-1 editor (ArticleEditor.tsx). Extends the Direction-C
> three-column frame. Does NOT touch public entry pages — byte-identical
> invariant holds.

---

## intent

The full editor is a kind-aware instrument panel. Three entry kinds —
ARTICLE (◆), PHOTO (◎), FICTION (△) — share a common toolbar shell and
outer chrome, but each kind presents a distinct work pane, outline rail,
and preview. The surface must read as one coherent instrument across all
three kinds, not three different products. It speaks the same visual
language as the console graph: dashed hairlines, mono uppercase labels,
corner reticles, no SaaS chrome.

---

## kind state model

```
type EntryKind = 'article' | 'photo' | 'fiction'
```

Canonical kind definitions (for EntryToolbar kind-switcher):

```
KINDS = [
  { id: 'article', glyph: '◆', label: 'ARTICLE' },
  { id: 'photo',   glyph: '◎', label: 'PHOTO'   },
  { id: 'fiction', glyph: '△', label: 'FICTION'  },
]
```

Kind state lives in the top-level entry editor component and flows down.
It does not persist to URL or server on kind switch — kind is a view mode,
not a stored field on the entry (an article is always an article; the kind
tab maps to content fields, not to a re-classification of the entry).

---

## shared types — `components/console/editor-types.ts`

The integrator (Sirius) creates this file from the contracts below.
No existing file should be modified to accommodate these — they are new.

```typescript
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
  src: string          // blob URL or resolved path
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
```

---

## layout — full editor frame (Direction C)

```
┌─────────────────────────────────────────────────────────────────┐
│ TOOLBAR  54px  (--console-header-height)                        │
│ [◆ ARTICLE] [◎ PHOTO] [△ FICTION]  kind-switcher tabs          │
│ [◈ OUTLINE]  [VIEW: SOURCE | PREVIEW | SPLIT]  [↑ IMPORT]      │
│ [◻ PREVIEW]  [▲ PUBLISH]   filenum cell (--ed-tb-file-min 92px) │
├──────────────┬──────────────────────┬──────────────────────────┤
│ OUTLINE RAIL │    SOURCE PANE       │    PREVIEW PANE          │
│  212px       │       1fr            │       1fr                 │
│ (collapsed → │  (always present)    │  (two-work modes only)   │
│  hidden)     │                      │                          │
│ //OUTLINE    │  article: textarea   │  article: ArticlePreview │
│ (article)    │  photo: PhotoManager │  photo: PhotoPreview     │
│ //FRAMES     │  fiction: txt+state  │  fiction: FictionPreview │
│ (photo)      │                      │                          │
│ //CHAPTERS   │                      │                          │
│ //DRAFT⇄SET  │                      │                          │
│ (fiction)    │                      │                          │
├──────────────┴──────────────────────┴──────────────────────────┤
│ PROVENANCE LINE — mono 9px · dashed-top hairline               │
│ SOURCE · LAST EDIT · ENTRY-ID · WORD COUNT (article only)      │
└─────────────────────────────────────────────────────────────────┘
```

Grid columns formula:
```
outlineOpen
  ? (twoWork ? "var(--outline-rail-width) 1fr 1fr"
             : "var(--outline-rail-width) 1fr")
  : (twoWork ? "1fr 1fr"
             : "1fr")
```

`twoWork` = mode is 'split' (source + preview both visible).

---

## kind switcher — `.ed-kindtab`

```
role="tablist"  on the wrapper
role="tab"      on each tab button
aria-selected   mirrors is-on state
```

Visual states:

| state    | background              | color               | border                |
|----------|-------------------------|---------------------|-----------------------|
| default  | transparent             | var(--ink-soft)     | 1px solid transparent |
| hover    | transparent             | var(--ink-primary)  | transparent           |
| is-on    | var(--ink-primary)      | var(--paper-base)   | same                  |
| focus    | transparent             | var(--ink-primary)  | 1px solid var(--ink-primary) (offset 2px) |

is-on = **filled-ink** (NOT orange-outline). This is the canonical DS state.
Orange is reserved for the observer α, reticles, and hover — never for a
selected tab.

Glyph + label both render inside the tab button. Glyph is presentational
(aria-hidden). Label alone is the accessible name.

Jitter reserve: the toolbar allocates `--ed-tb-file-min: 92px` for the
file-number cell. This prevents the kind tabs from causing layout shift on
kind switch. The 92px cell is always present in the DOM (even when empty)
but content shows only when an entry is loaded.

---

## per-kind: ARTICLE

### outline rail
Label: `//OUTLINE` (JetBrains Mono uppercase 9px, letter-spacing 0.3em)
Content: H2 / H3 heading list extracted from markdown body. Each item is
a button; click scrolls the source pane to that heading's `[id]` anchor.
State: collapsed (hidden) by default; `◈ OUTLINE` toolbar button toggles.
Collapse animation: `width` transition 200ms ease (outline-rail-width → 0).

### source pane
Existing ArticleEditor textarea. No change. Byte-identical.

### preview pane
Existing ArticlePreview + ArticleEntryContent. No change.
Byte-identical — do not alter the preview markup or styles.

### provenance line
```
SOURCE: {fileNum} · LAST EDIT: {date} · {wordCount} WORDS
```
Class: `.ed-prov` — dashed-top hairline, mono 9px, ink-soft.

---

## per-kind: PHOTO

### outline rail
Label: `//FRAMES` (mono uppercase 9px 0.3em)
Content: frame thumbnail strip — vertical list of frame thumbnails.
Active frame highlighted with var(--accent-orange) left border (2px).
Click selects frame (updates `active` state). Drag-to-reorder: native
HTML drag-and-drop; no external library.

### source pane — PhotoManager

Instrument controls, not a lightbox. Three instrument zones:
1. **Frame strip** — selected frame display (large, dashed border, corner
   reticles). Label: FRAME {n} / {total} in mono uppercase.
2. **Film sim selector** — `.fsim-chip` pills (5 chips: Provia · Classic Chrome ·
   Acros · Reala Ace · Velvia). `is-on` = orange filled (`var(--accent-orange)`,
   `var(--paper-bright)` text). NOTE: `.fsim-chip` is its own atom, NOT `.af-pill`.
   Do not conflate.
3. **EXIF readout** — 2-column grid, mono labels + values (JetBrains Mono).
   Labels: CAMERA / LENS / ISO / f/ / 1/ / mm. Values: ink-primary.
   Read-only in this slice.

`+ ADD FRAME` button — `.ed-btn-ghost` (dashed border, ink-faint, hover ink-primary).
Click opens file picker (accept: image/*).

### source pane — PHOTO EMPTY STATE (ImportZone)
When `frames.length === 0`: render ImportZone (see cross-kind surfaces).

### preview pane — PhotoPreview
Full spread preview: frame fills the pane (object-fit: contain, no crop).
Active frame displayed. Film-sim overlay: single-word label in top-right
corner reticle area (mono 9px orange), decorative only.
Provenance line: `SOURCE: {fileNum} · {frames.length} FRAMES · {place}`

---

## per-kind: FICTION

### outline rail
Two sections, stacked, dashed-rule separator:
- `//CHAPTERS` — chapter list (title + state badge: DRAFT in ink-faint,
  SETTLED in ink-primary). Click selects chapter.
- `//STATE` — current chapter: `DRAFT ⇄ SETTLED` toggle button.
  DRAFT→SETTLED = forward motion. SETTLED→DRAFT = revision marker.
  Toggle renders as an instrument switch, not a checkbox: two labels
  flanking a `⇄` glyph, the active state filled-ink, inactive ink-faint.

### source pane — FictionManager
Top: chapter selector strip (horizontal `.ed-kindtab`-style tabs for chapter
navigation — same filled-ink active style). `+ CHAPTER` button appended.
Below: chapter body textarea (same `.ed-src` class as article textarea).
Below textarea: inline DRAFT/SETTLED toggle (mirrors outline rail; both
are kept in sync). Chapter title editable above textarea in an inline
input (`.ed-chapter-title`, mono, 11px, no chrome).

### preview pane — FictionPreview
Chapter prose stack: active chapter body rendered as markdown.
Chapter title in Cormorant 24px. State badge (DRAFT / SETTLED) in mono
9px orange (DRAFT = ink-faint, SETTLED = ink-primary). Not an instrument
readout — just inline state indicator.
Provenance line: `SOURCE: {fileNum} · {chapters.length} CHAPTERS · {active.state}`

---

## cross-kind surfaces

### ◻ FULL PREVIEW overlay — FullPreview

**intent:** Total-immersion preview of the entry as it would read on the
public site. Desktop and mobile viewports switchable. No editing. ESC or
backdrop click to close. This is NOT a SaaS modal — it is an instrument
observation window.

**soul-faithful construction:**
- Backdrop: `rgb(var(--paper-deep-rgb) / 0.85)` — paper-deep wash, NOT
  dark glass (`rgba(22,30,34,0.55)` from prototype = SaaS reject; do not
  use). Prototype's `.pub-overlay` color is FORBIDDEN here.
- Frame: `var(--paper-base)` surface. Corner reticles (cite: `corner-reticle`
  atom). No border-radius. No drop-shadow.
- Header strip: mono uppercase — PREVIEW · {kind} · {fileNum}. Close glyph: `×`.
- Device switcher: DESKTOP / 390PX buttons (`.ed-srctoggle` style — orange
  filled for active, NOT kind-tab filled-ink). These are view mode toggles,
  not navigation; orange active is appropriate for this atom class.
- Inner viewport: for desktop, 100% width with comfortable horizontal margin
  (48px each side). For 390px: centered 390px wide frame with dashed border
  to suggest device edge — no fake phone chrome.
- Article preview: wraps ArticleEntryContent (byte-identical). Other kinds:
  wraps their respective preview component.
- ESC key: closes. Backdrop click: closes. No other close mechanism.
- Reduced-motion: no open/close animation when `prefers-reduced-motion: reduce`.
  Default: overlay fades in 250ms ease, scales from 0.97 → 1.0.

**layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ backdrop (paper-deep / 0.85, fixed, full-viewport)              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ corner-reticles (4 corners)                              │   │
│  │ HEADER: PREVIEW · ARTICLE ◆ · 042           ×  close    │   │
│  │ device: [DESKTOP]  [390PX]                               │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                          │   │
│  │   inner viewport (scrollable)                            │   │
│  │   article: <ArticleEntryContent />                       │   │
│  │   photo:   <PhotoPreview narrow={false} />               │   │
│  │   fiction: <FictionPreview />                            │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### ▲ PUBLISH/TRANSMIT panel — PublishPanel (MOCKED)

**scope:** MOCKED ONLY this round. No live wiring to content layer.
Real transmission touches the live-mutating-action gate. Leave for a
future sub-project with Peat-at-seam.

**intent:** An instrument confirmation panel — three phases sequentially.
Not a modal; it should feel like an instrument sequence, not a dialog box.

**soul-faithful construction:**
- Surface: `var(--paper-warm)`. Corner reticles. Dashed inner border.
  No backdrop scrim needed — panel slides in from the right (or replaces
  the preview pane). NOT a dark-glass modal.
- Slide direction: right edge of editor frame → covers preview pane when
  open. Transition: 280ms ease. The source pane remains visible.

**Three phases (visual only — no real mutations):**

Phase `"review"`:
```
TRANSMIT SEQUENCE · {kind} · {fileNum}
────────────────────────────────────────
TITLE      {meta.title}
KIND       {kind}
STATUS     {status}          (article/photo: ongoing/settled)
           {state}           (fiction: draft/settled)
FRAMES     {frames.length}   (photo only)
CHAPTERS   {chapters.length} (fiction only)
────────────────────────────────────────
[CONFIRM TRANSMISSION ▲]    [ABORT ×]
```
Labels: mono 9px, ink-soft. Values: mono 11px, ink-primary.

Phase `"running"`:
```
TRANSMITTING…
{elapsed}s elapsed
[animated mono counter, no spinner — a spinner is SaaS]
```

Phase `"done"`:
```
TRANSMISSION COMPLETE
ENTRY {fileNum} SETTLED
[CLOSE]
```

### ImportZone + ↻ RE-IMPORT

**ImportZone empty-state:**
Renders when the editor has no content loaded (no article body, no frames,
no chapters). Instrument language: dashed border box (full source-pane area),
centered vertical content.
```
  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  │                                                        │
  │        IMPORT ZONE                                     │
  │        [↑ IMPORT ENTRY]   button (.ed-btn-primary)     │
  │        — or drag a markdown / image file here —        │
  │        (Cormorant italic, ink-soft, 13px)              │
  │                                                        │
  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```
Drag-over state: dashed border color → var(--accent-orange). Orange is
appropriate as an active/interaction signal (not a static decoration).
No filled bg on drag-over — just the border color change.

**↻ RE-IMPORT:**
When content is already loaded, `↻ RE-IMPORT` appears in the toolbar
(replaces `↑ IMPORT`). Icon: `↻` (Unicode, not SVG). Same `.ed-btn-ghost`
style. On click: shows inline confirmation (not a modal):
`REPLACE CURRENT CONTENT? [CONFIRM] [CANCEL]`
Confirmation sits in the toolbar row, replacing the button row temporarily.
Mono 9px, ink-primary. Confirm = ink-primary filled button. Cancel = ghost.

---

## prop contracts — 7 components

All components live in `components/console/`. Import shared types from
`components/console/editor-types.ts`. Props are TypeScript-shaped here;
Sirius writes the implementation.

### 1. PhotoManager

```typescript
interface PhotoManagerProps {
  frames: PhotoFrame[]
  setFrames: (frames: PhotoFrame[]) => void
  active: string | null         // frame.id of selected frame
  setActive: (id: string) => void
  onAdd: () => void             // triggers file picker (caller owns the input ref)
  reading: boolean              // true = read-only (no add/reorder/delete)
}
```

### 2. PhotoPreview

```typescript
interface PhotoPreviewProps {
  meta: PhotoMeta
  frames: PhotoFrame[]
  active: string | null         // frame.id to display
  narrow: boolean               // true = 390px preview in FullPreview overlay
}
```

### 3. FictionManager

```typescript
interface FictionManagerProps {
  chapters: FictionChapter[]
  setChapters: (chapters: FictionChapter[]) => void
  active: string | null         // chapter.id of active chapter
  setActive: (id: string) => void
}
```

### 4. FictionPreview

```typescript
interface FictionPreviewProps {
  meta: FictionMeta
  chapters: FictionChapter[]
  activeId: string | null       // chapter.id to display (renamed from 'active'
                                //   to avoid conflict with HTMLElement.active)
  status?: string               // entry-level status (ongoing / settled)
}
```

### 5. FullPreview

```typescript
type PreviewDevice = 'desktop' | 'mobile'

interface FullPreviewProps {
  kind: EntryKind
  meta: ArticleMeta | PhotoMeta | FictionMeta
  md?: string                   // article markdown body
  frames?: PhotoFrame[]         // photo frames
  chapters?: FictionChapter[]   // fiction chapters
  activeId?: string             // active frame.id or chapter.id
  status?: string               // entry-level status
  device: PreviewDevice
  setDevice: (d: PreviewDevice) => void
  onClose: () => void
}
```

### 6. PublishPanel

```typescript
type PublishPhase = 'review' | 'running' | 'done'

interface PublishPanelProps {
  kind: EntryKind
  meta: ArticleMeta | PhotoMeta | FictionMeta
  status?: string               // article/photo status (ongoing/settled)
  fictionState?: FictionState   // fiction active chapter state
  frames?: PhotoFrame[]         // photo: for frame count display
  chapters?: FictionChapter[]   // fiction: for chapter count display
  phase: PublishPhase           // caller controls phase transitions (mocked)
  onPhaseChange: (p: PublishPhase) => void
  onClose: () => void
}
```

### 7. ImportZone

```typescript
interface ImportZoneProps {
  onImport: (file: File) => void   // caller handles file read
  hasContent: boolean               // false = show ImportZone, true = show ↻ RE-IMPORT
  onReImport?: () => void          // called after re-import confirm (only when hasContent)
  reading?: boolean                 // true = suppress import controls (read-only mode)
}
```

---

## tokens used

| role | token |
|---|---|
| surface | var(--paper-base) |
| outline rail | var(--paper-warm) |
| provenance bar | var(--paper-deep) |
| body ink | var(--ink-primary) |
| label / meta | var(--ink-soft) / var(--ink-label) |
| hairlines | 1px dashed var(--ink-dashed) |
| kind tab active bg | var(--ink-primary) |
| kind tab active text | var(--paper-base) |
| film-sim chip active | var(--accent-orange) — intentional, chip atom ≠ af-pill |
| outline toggle active | var(--accent-orange) — intentional, srctoggle atom |
| FullPreview backdrop | rgb(var(--paper-deep-rgb) / 0.85) |
| drag-over border | var(--accent-orange) |
| layout rails | var(--outline-rail-width: 212px) · var(--console-rail-width: 260px) |

---

## typography

| element | family | size | weight | case | tracking |
|---|---|---|---|---|---|
| toolbar labels | JetBrains Mono | 9px | 400 | UPPER | 0.3em |
| kind tab label | JetBrains Mono | 10px | 400 | UPPER | 0.15em |
| outline rail section header | JetBrains Mono | 9px | 400 | UPPER | 0.3em |
| outline rail item | JetBrains Mono | 11px | 400 | upper | 0.1em |
| source textarea | JetBrains Mono | 13px | 400 | — | normal |
| provenance line | JetBrains Mono | 9px | 400 | UPPER | 0.2em |
| EXIF labels | JetBrains Mono | 9px | 400 | UPPER | 0.3em |
| EXIF values | JetBrains Mono | 11px | 400 | — | 0.05em |
| fiction chapter title (preview) | Cormorant Garamond | 24px | 400 | — | — |
| fiction body (preview) | Cormorant Garamond | 16px | 400 italic for em | — | — |
| import zone descriptive copy | Cormorant Garamond | 13px | 400 italic | — | — |
| FullPreview article body | ArticleEntryContent unchanged | — | — | — | — |

---

## motion

| event | duration | easing | trigger |
|---|---|---|---|
| kind tab switch | 120ms | ease | kind prop change |
| outline rail open/close | 200ms | ease | width transition |
| FullPreview open | 250ms | ease | opacity + scale(0.97→1) |
| FullPreview close | 180ms | ease | opacity + scale(1→0.97) |
| PublishPanel slide in | 280ms | ease | translateX |
| film-sim chip select | 120ms | ease | background/color |
| drag-over border | 100ms | ease | border-color |
| import confirm inline | 150ms | ease | opacity |
| all above | 0ms | — | prefers-reduced-motion: reduce |

No looping decorative motion. No motion during reading.

---

## states

### EntryToolbar
- default: all controls present for current kind
- no entry loaded: hide kind tabs + toolbar controls; show ImportZone only
- reading (read-only mode): import controls hidden; source pane read-only

### PhotoManager
- empty (frames=[]): source pane shows ImportZone
- one or more frames: shows frame strip + film-sim + EXIF
- reading: no add/delete/reorder
- active frame missing: default to frames[0]

### FictionManager
- empty (chapters=[]): `+ CHAPTER` prompt centered in source pane
- one or more chapters: shows chapter tabs + body textarea
- active chapter missing: default to chapters[0]
- reading: textarea read-only; state toggle read-only

### FullPreview
- desktop device: full-width viewport with 48px horizontal margin
- mobile (390px) device: 390px centered, dashed device-edge border
- long content: scrollable inner panel, header stays fixed
- article kind: wraps ArticleEntryContent (byte-identical)

### PublishPanel
- review phase: confirm / abort buttons
- running phase: elapsed counter (mock: auto-advance after 2s)
- done phase: close only (no confirm/abort)

### ImportZone
- hasContent=false: full drop target visible
- hasContent=true: ↻ RE-IMPORT in toolbar (not the zone)
- drag-over: orange dashed border
- reading: hidden

---

## breakpoints

### ≤880px
- Outline rail hidden by default (collapsible remains, but default closed)
- twoWork = false (source pane only; preview pane hides)
- FullPreview: mobile device defaults to 390px view
- PublishPanel: stacks vertically, full width

### ≤600px
- Toolbar kind tabs condense: glyphs only, no labels (aria-label carries name)
- Source pane: full viewport width
- Provenance line: wraps to two rows
- FullPreview: no device switcher; always 100% width
- PublishPanel: full screen, not a side panel

Touch targets: all interactive elements ≥ 44px height.
No horizontal scroll on any breakpoint.

---

## accessibility

### kind switcher
```
<div role="tablist" aria-label="Entry kind">
  <button role="tab" aria-selected={kind==='article'} ...>◆ ARTICLE</button>
  <button role="tab" aria-selected={kind==='photo'} ...>◎ PHOTO</button>
  <button role="tab" aria-selected={kind==='fiction'} ...>△ FICTION</button>
</div>
```

### keyboard map
| key | action |
|---|---|
| Tab | move through interactive elements in toolbar, rail, pane |
| Enter / Space | activate focused button |
| ESC | close FullPreview / close PublishPanel / cancel re-import confirm |
| Arrow keys | navigate chapter list or frame strip when focused |

### screen reader annotations
- PhotoManager frame strip: `<ul aria-label="Photo frames">`, each item `<li>`.
  Active frame: `aria-current="true"`.
- FictionManager chapter tabs: `role="tablist"` wrapper, each chapter `role="tab"`.
- FullPreview: `role="dialog" aria-label="Entry preview" aria-modal="true"`.
  Focus trapped. Closed on ESC.
- PublishPanel: `role="region" aria-label="Transmit panel"`. Phase changes
  announced via `aria-live="polite"` on the phase-content wrapper.
- ImportZone: `role="region" aria-label="Import zone"`. Drop target:
  `aria-dropeffect="copy"`, `aria-grabbed="false"`.
- EXIF grid: `<dl>` with `<dt>` labels and `<dd>` values.

### focus order
Toolbar (kind tabs → mode buttons → action buttons) → Outline rail →
Source pane → Preview pane → Provenance line.
FullPreview dialog traps focus within when open.

### reduced-motion
All transition values drop to 0ms when `prefers-reduced-motion: reduce`.
Implement via CSS `@media (prefers-reduced-motion: reduce)` on the
motion-bearing rules.

---

## schema needs — flag to Procyon

The following content schema fields are required by the component contracts
above but are NOT confirmed to exist in the current Worldline schema:

1. **PhotoMeta.filmSim** — per-entry default film simulation
2. **PhotoMeta.camera / .lens** — per-entry camera body + lens
3. **PhotoFrame.exif** — per-frame EXIF fields (ISO, aperture, shutter, focal)
4. **FictionMeta** — no confirmed content schema; chapters as a field TBD
5. **FictionChapter.id / .title / .body / .state** — confirmed in prototype
   but not in production schema

Do NOT wire photo or fiction preview to the content layer until Procyon
confirms or rejects these fields. Use mock data in the stub implementation.

---

## soul anchoring — prototype drift corrections

The following prototype elements diverge from the Worldline design system.
Each is flagged with the required soul-faithful equivalent.

| prototype element | drift class | production equivalent |
|---|---|---|
| `.pub-overlay { background: rgba(22,30,34,0.55) }` | SaaS dark-glass scrim | `rgb(var(--paper-deep-rgb) / 0.85)` — paper-deep wash |
| Device picker: `SELECT` dropdown | generic form control | `.ed-srctoggle` button pair (DESKTOP / 390PX), same style as SOURCE/PREVIEW toggle |
| `PUBLISH` button: any rounded/filled SaaS style | SaaS button | `.ed-btn-primary` — same instrument button class used in existing console |
| Drag indicator: filled colored bar | SaaS feedback | border-color change to var(--accent-orange), no fill |
| Chapter title: any bold sans-serif | non-Worldline type | Cormorant Garamond 24px — same as article entry title |

---

## references — existing patterns cited

| atom / component | catalog id | role in this spec |
|---|---|---|
| `.af-pill` base | worldline-atoms.css:200-207 | kind filter pills, base atom |
| `.af-pill.is-active` | worldline-atoms.css:207 | filled-ink active state |
| `corner-reticle` | worldline-atoms.css:~30-60 | FullPreview frame corners |
| `dashed-hairline` | worldline-atoms.css:~90 | section seams, pane borders |
| `ArticlePreview` | components/console/ArticlePreview.tsx | article preview pane |
| `ArticleEntryContent` | components/ArticleEntryContent.tsx | byte-identical public render |
| `ConsoleRail` | components/console/ConsoleRail.tsx | af-pill usage pattern (pending correction) |
| `ArchiveFilters` | components/ArchiveFilters.tsx | af-pill usage with intentional color override |
| `.ed-btn-primary` / `.ed-btn-ghost` | ArticleEditor.tsx | action button classes |
| `.ed-src` | ArticleEditor.tsx | source textarea class |
| `.ed-srctoggle` | ArticleEditor.tsx | mode toggle (orange-active pattern) |
| `.ed-prov` | ArticleEditor.tsx | provenance line class |

---

## non-goals

- No real wiring of PUBLISH/TRANSMIT to the content layer (mocked only)
- No EXIF auto-extraction from image files in this slice (input only)
- No multi-entry batch operations
- No version history UI (patches log is article-only and already exists in entry view)
- No comments system
- No reading-progress bar (global scroll-meter covers this)
- No print stylesheet
- No drag-and-drop between kinds (a photo cannot become an article)
- No dark mode (paper-observatory is the palette; INK variant is already accounted for via data-palette)
- No animation of the kind-switch content transition (instant swap; animated kind transition is SaaS delight, not instrument language)

---

*Betelgeuse · α-VIS-04 · signed 2026-06-07*
*Ground truth: worldline-atoms bundle d72810da-4995-4c96-9d69-766952cdee6b*
*Review path: .claude/visual-diffs/atlas-console-full-editor/REVIEW.md*
