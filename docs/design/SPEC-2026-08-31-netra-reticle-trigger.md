# NETRA reticle trigger

> TASK-2026-08-31-NETRA-RETICLE-TRIGGER
> owner · Betelgeuse (α-VIS-04)
> status · implementation-ready
> surface · fixed NETRA navigator trigger only

## intent

The fixed control is an attached probe mark, not a miniature chat console. It
must identify NETRA, invite pointer and keyboard interaction, and report
ready/open/busy state without occupying the observatory register. The existing
navigator panel remains the place for words and telemetry.

The signature moment is a restrained acquisition: the reticle finds its center
once, then stays quiet until the visitor interacts or a real survey is running.

## vision fidelity

- **soul baseline** · current main-branch observatory; Peat's 2026-08-31 capture
  of the lower-right trigger; `.claude/skills/worldline-design/_ref/atom-netra2.png`;
  soul-atlas `netra-console` and `corner-reticle` atoms; approved
  `Worldline Globe v7.html` relationship of NETRA as an ATLAS-attached probe.
- **aesthetic invariants** · I1 garden under measurement, I3 Peat in the
  instrument layer, I4 NETRA attached to ATLAS first, I5 visible craft.
- **Peat signal** · make the lower-right NETRA control minimal: one interactive,
  memorable animated logo instead of the cramped console label.
- **allowed evolution** · collapse the fixed console's permanent identity and
  readout columns into one reticle; add state-bound Anime.js motion to that mark.
- **forbidden dilution** · no generic chat bubble, assistant mascot, sparkle,
  glossy floating-action button, cyberpunk HUD, or idle spectacle. Do not detach
  NETRA from the observatory's reticle language.
- **rendered checkpoint** · day and night screenshots at 1440px and 375px, plus
  ready, keyboard-focus, acquired/open, busy, and reduced-motion evidence.

## composition and footprint

The control is one semantic `<button>` and one layered inline SVG. It retains
the existing `netra-trigger` hook but no longer uses the four-column
`.atlas-netra` console layout.

```text
       52px true-circle button
    ┌─────────────────────┐
    │       ──┬──         │  crosshair arms
    │      ╭──┼──╮        │  probe ring
    │      │ ┌┼┐ │        │  acquisition brackets
    │      ├─┼●┼─┤        │  state core
    │      │ └┼┘ │        │
    │      ╰──┼──╯        │  acquired / scan arc overlays ring
    │         ┴           │
    └─────────────────────┘
         32px SVG mark
```

### button

- box · exactly `52px × 52px`; `min-width` and `min-height` also `52px`
- shape · `border-radius: 50%`; this is the true-circle exception, not a rounded
  rectangle
- border · `1px solid var(--netra-soft)`
- surface · `rgb(var(--paper-base-rgb) / 0.96)`
- mark · centered `32px × 32px`
- padding · `9px`
- cursor · pointer
- reserved width · none; explicitly remove the old `12.5rem` width/min-width
- elevation · none: no shadow, glow, blur, filter, or backdrop filter

### SVG geometry

Use `viewBox="0 0 32 32"`, `fill="none"`, and one-unit strokes in
`currentColor`. All strokes use square/butt caps, miter joins, and
`vector-effect="non-scaling-stroke"`. SVG groups need an explicit center
transform origin so Chromium, Safari, and Firefox rotate around `(16, 16)`.

1. **Probe ring** · circle `cx=16`, `cy=16`, `r=10.5`.
2. **Crosshair** · four independent lines:
   - top `(16, 1.5) → (16, 6.5)`
   - right `(25.5, 16) → (30.5, 16)`
   - bottom `(16, 25.5) → (16, 30.5)`
   - left `(1.5, 16) → (6.5, 16)`
3. **Acquisition brackets** · four corner paths around an `11px` square:
   - north-west `M13 10.5 H10.5 V13`
   - north-east `M19 10.5 H21.5 V13`
   - south-east `M21.5 19 V21.5 H19`
   - south-west `M13 21.5 H10.5 V19`
4. **State core** · circle `cx=16`, `cy=16`, `r=2`; hollow in ready, filled in
   open/busy.
5. **Acquired arc** · a second circle on `r=10.5` with
   `stroke-dasharray="13.2 52.8"`, rotated `-90deg` about the center. This is one
   approximately 72-degree registration arc.
6. **Busy scan** · a third circle on `r=10.5` with
   `stroke-dasharray="8.25 24.74 8.25 24.74"`, rotated `-90deg` at rest. The two
   opposed arcs remain distinguishable from open even when motion is reduced.

The base ring and axes are always NETRA teal. Brackets, state core, and arc
layers inherit state color. Decorative SVG content is `aria-hidden="true"` and
must not become a second accessible name.

## placement and stacking

- Preserve fixed positioning and `z-index: 900`.
- Above 600px: `right: calc(28px + 1rem)` to clear the canonical 28px
  marginalia rail; `bottom: calc(1rem + env(safe-area-inset-bottom, 0px))`.
- At 600px and below: marginalia has collapsed to its 1px seam; use
  `right: calc(0.75rem + env(safe-area-inset-right, 0px))` and
  `bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px))`.
- Keep the circle's overflow visible for the tooltip. The panel/backdrop stacking
  and all panel dimensions remain unchanged.

The desktop anchor deliberately clears, rather than covers, the marginalia.
The 52px footprint may sit over paper evidence like any fixed instrument control;
it must not span or visually merge with the bottom register as the old 200px
console did.

## tokens

| role | token |
|---|---|
| resting surface | `rgb(var(--paper-base-rgb) / 0.96)` |
| tooltip surface | `var(--paper-warm)` |
| resting border | `var(--netra-soft)` |
| probe ring and axes | `var(--netra)` |
| restrained hover wash | `rgb(var(--netra-rgb) / 0.08)` |
| acquired wash | `rgb(var(--accent-orange-rgb) / 0.06)` |
| open/busy brackets, arc, core | `var(--accent-orange)` |
| tooltip text | `var(--ink-primary)` |
| tooltip rule | `var(--netra-soft)` |
| keyboard ring | `var(--ctl-focus-ring)` |
| tooltip type | `var(--font-mono)` |

No new token and no mode-specific override. Day/night and palette variants flow
through the existing variables.

## tooltip

The mark is sufficient as the persistent visual identity. A terse `NETRA`
tooltip may confirm identity without restoring the old console.

- position · vertically centered, `0.625rem` to the left of the circle
- surface · `var(--paper-warm)` with `1px dashed var(--netra-soft)`
- type · mono uppercase, `12px`, `500`, `0.14em` tracking, one line
- padding · `0.375rem 0.5rem`
- shape/elevation · square corners, no shadow
- behavior · pointer-events none; hidden by default; visible on keyboard
  `:focus-visible` and only inside `(hover: hover) and (pointer: fine)` for
  pointer hover
- transition · opacity plus `translateX(3px → 0)`, `140ms
  cubic-bezier(0.25, 1, 0.5, 1)` (`outQuart`); no delay on focus, `80ms` delay
  on hover; immediate under reduced motion
- narrow safety · it opens left, never right; `max-width: calc(100vw - 5rem)` and
  `overflow: hidden; text-overflow: ellipsis`; truncate rather than cause
  horizontal overflow
- semantics · `aria-hidden="true"`; the button's state-aware accessible name is
  authoritative

Do not show the tooltip persistently on touch and do not use it as the only
identification mechanism.

## visual states

| state | border / surface | geometry | motion |
|---|---|---|---|
| ready / idle | NETRA-soft border, paper surface | teal ring + axes, hollow teal core; brackets and both arc layers hidden | none after the one mount acquisition |
| hover | NETRA border, NETRA wash | teal bracket preview at 72% opacity; acquired arc at 55%; axes settle inward | 180ms lock-on, then still |
| focus-visible | same geometry as hover plus a `2px dashed var(--ctl-focus-ring)` outline at `2px` offset | tooltip visible; identity does not rely on hover | 180ms lock-on, then still |
| pressed | retain current state colors | SVG mark compresses to 94%, never the 52px hit area | 80ms `outQuad`; release/open resolves immediately |
| open / acquired | orange border, acquired wash | teal base ring/axes; orange brackets + one acquired arc + filled core | 240ms acquire, then still |
| busy / surveying | orange border, acquired wash | teal base ring/axes; orange brackets + two opposed scan arcs + filled core | scan loop only while the request is genuinely busy |

Meaning must survive without color: ready is an open center without brackets;
open has brackets, one arc, and a solid center; busy has brackets, two opposed
arcs, and a solid center.

Closing/de-acquiring restores ready geometry over `180ms outQuart`. Focus
restoration may immediately place the control in its focus-visible preview;
that is expected and must not replay the mount acquisition.

## Anime.js v4 motion contract

The existing component is already a Client Component. Import only the installed
Anime.js v4 APIs needed by this mark (`animate`, `createScope`); do not add a
package, a second animation library, or a new client boundary.

Create one Anime.js scope rooted at the trigger button. All selector queries and
registered interaction methods stay inside that root. Every animation handle is
cancelled/reverted before its state replacement starts; `scope.revert()` runs on
effect cleanup. A repeated React development effect must not replay the mount
sequence—guard it with a component-lifetime ref.

### mount acquisition — the signature sequence

The static ready mark renders before JavaScript; never hide the button or base
ring while waiting for hydration.

| layer | values | delay | duration | ease |
|---|---|---:|---:|---|
| acquired arc | opacity `0 → 0.85 → 0`; rotation `-70deg → 0deg` | 0ms | 460ms | `outQuart` |
| brackets | opacity `0 → 0.65 → 0`; scale `0.86 → 1` | 50ms | 360ms | `outQuart` |
| core | opacity `0.45 → 1`; scale `0.7 → 1` | 150ms | 240ms | `outExpo` |

Run once per actual component mount, do not block click/focus, and leave no
animated property running afterward.

### interaction methods

- **lock on** · brackets `opacity 0 → 0.72`, `scale 1.12 → 1`; acquired arc
  `opacity 0 → 0.55`, `rotate -18deg → 0deg`; axes group `scale 1 → 0.9`;
  `180ms outQuart`.
- **release lock** · reverse to ready over `140ms outQuart`, unless state is open
  or busy.
- **press** · mark root `scale 1 → 0.94` over `80ms outQuad`. The subsequent
  open/release state returns it to `1`; no bounce or overshoot.
- **acquire/open** · brackets and acquired arc to opacity `1`, core to filled
  geometry, mark scale to `1`; `240ms outExpo`. Color and surface resolve through
  the state selectors over the same interval.
- **survey/busy** · busy-scan group `rotate 0deg → 360deg`, `1000ms linear`,
  looping; core opacity `0.5 → 1 → 0.5`, `1000ms inOutSine`, looping. Brackets,
  button, ring, and axes remain still. Stop and revert both loops the instant
  `busy` becomes false.
- **de-acquire** · busy/acquired layers return to ready geometry in
  `180ms outQuart`; never replay mount.

Animate only SVG transform, opacity, and bounded stroke/dash values. Do not
animate width, height, inset, padding, margin, border width, filter, or shadow.
Do not leave a permanent `will-change`. The mark must remain responsive while
animation is running.

## reduced motion

`prefers-reduced-motion: reduce` is a static rendering mode, not merely faster
motion.

- skip mount acquisition entirely
- skip hover/focus geometry movement, press compression, open/de-acquire
  movement, rotation, and busy loop
- change geometry and token colors immediately by `data-state`
- keep ready/open/busy distinguishable with the geometry table above
- show/hide the tooltip immediately
- retain the focus ring and all interaction/focus behavior
- retain the existing panel's own reduced-motion rules

Both CSS and the Anime.js branch must enforce this. A global tiny duration is not
sufficient if a JavaScript loop is still instantiated.

## accessibility and input

- Keep the current state-aware localized `aria-label`, `aria-expanded`,
  `aria-controls`, `aria-busy`, and `aria-haspopup="dialog"` contracts.
- The SVG and tooltip are presentational. A visually hidden NETRA/state string is
  acceptable, but do not create duplicate announcements beside `aria-label`.
- Tab reaches the circle. Enter and Space open the unchanged dialog. Escape closes
  it. Focus returns to this same circle.
- Pointer, keyboard, and touch all receive the same open/close behavior. Hover is
  enhancement only.
- The target is always 52×52 CSS pixels, exceeding the 44×44 WCAG floor.
- State is never communicated by color or movement alone.
- Preserve the current dialog focus trap, body-scroll lock, live regions, and
  error behavior untouched.

## breakpoints

| viewport | trigger | placement / behavior |
|---|---|---|
| 1440px and wide desktop | 52×52 | clear the 28px marginalia; tooltip opens left; panel unchanged |
| 601–1439px | 52×52 | same desktop anchor and mark; no old console width |
| 600px | 52×52 | mobile anchor; clear the 1px marginalia seam and safe areas |
| 375px | 52×52 | no horizontal overflow; tooltip left and bounded; bottom sheet unchanged |
| 320px | 52×52 | no shrink and no clipping; touch use does not depend on tooltip |

No breakpoint may reintroduce a wordmark row, readout column, or `12.5rem`
trigger width.

## loss budget

- **acceptable loss** · permanent visible `NETRA`, ready/open/busy words, and
  `STATE ◇/◆` readout disappear from the fixed trigger.
- **compensation** · reticle geometry carries state; state-aware accessible name
  remains; a hover/focus tooltip confirms identity; the opened panel retains all
  identity and telemetry.
- **unacceptable loss** · reticle identity, NETRA teal, acquired orange, 44px
  target, state semantics, keyboard focus, focus restoration, reduced-motion
  behavior, or ATLAS-attached instrument character.

## implementation-critical cautions

1. The current `.atlas-netra .reticle` atom owns a decorative 2.4s pulse. The
   fixed trigger must explicitly opt out; idle is still. Do not remove the atom's
   behavior from unrelated surfaces.
2. Split the current shared busy selector so the trigger no longer receives the
   whole-mark CSS opacity pulse. Only the scoped Anime.js scan/core may loop.
3. Keep `triggerRef` as the button root: focus restoration already depends on it.
   Do not wrap the button in a focusable animation container.
4. Do not let Anime.js inline styles strand the mark between states. Cancel the
   prior state animation and clean/reapply final state deterministically.
5. React Strict Mode can run an effect setup/cleanup cycle twice in development.
   The mount-acquisition guard must prevent a visible double-fire without
   weakening cleanup.
6. SVG transform origins vary without explicit `transform-box`/origin handling.
   Verify rotation around `(16,16)` in Safari as well as Chromium.
7. The existing UI source audit assumes a permanent visible wordmark. Algol may
   update that sensor to accept state-aware accessible identity plus this
   approved icon-only geometry; the accessibility contract itself must not be
   weakened.
8. Preserve every pre-existing dirty change in `NetraNavigator.tsx` and its CSS.
   Replace trigger markup and trigger-only rules, not transport or panel logic.

## visual acceptance

Accept only when all are true:

- the resting control reads as a Worldline survey reticle, not a chat product
- the fixed footprint is exactly 52×52 and clears desktop marginalia
- the old permanent wordmark/readout rectangle is gone at every breakpoint
- mount acquisition occurs once, completes within 460ms, and leaves idle still
- hover and keyboard focus visibly lock on without bounce, glow, or layout shift
- open is a static acquired mark; busy alone scans continuously
- reduced motion produces zero movement and still distinguishes all three states
- day/night palettes use only the existing token cascade
- no gradient, shadow, blur, rounded rectangle, icon library, raw color, or new
  visual primitive appears
- no horizontal overflow or collision at 1440, 600, 375, and 320px
- keyboard open, Escape close, and trigger-focus return are unchanged
- the navigator panel, transport, page context, copy, history, and API behavior
  are pixel/behaviorally outside this redesign
- animation remains smooth at 60fps on a 375px mobile viewport

## atom and code references

- soul-atlas `netra-console` · `.atlas-netra`, `.reticle`, NETRA teal and paper
  probe lineage
- soul-atlas `corner-reticle` · acquisition bracket geometry
- soul-atlas `survey-cursor` · crosshair as instrument affordance, not generic icon
- `components/NetraNavigator.tsx` · current accessible trigger/dialog contract
- `components/NetraNavigator.css` · current anchor, panel, focus, and reduced-motion
  behavior
- `docs/design/80-interactive-states.md` · focus-ring and control-state language
- `/Users/neospiritth/.agents/skills/animejs/SKILL.md` · Anime.js v4 React
  `createScope` and cleanup pattern
- `.agents/skills/impeccable/reference/animate.md` · one signature moment,
  state-bound motion, timing, and performance budget

## non-goals

- no navigator panel, transcript, composer, copy, transport, RAG, or tool-calling
  redesign
- no header-reticle redesign unless implementation correctness requires sharing
  the exact SVG primitive
- no package, global token, theme, z-index system, or route change
- no sound, haptic, cursor replacement, particle effect, spring, bounce, elastic,
  scroll animation, or perpetual idle pulse
- no commit, deployment, or live-provider call
