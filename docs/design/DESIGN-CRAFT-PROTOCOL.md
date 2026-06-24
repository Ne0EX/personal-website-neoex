# DESIGN-CRAFT-PROTOCOL

Worldline design operates on three layers. This document is the precedence map.
Whenever any layer conflicts with a higher layer, the higher layer wins — no exceptions.

Install manifest for these sources: see `CRAFT-SKILLS.md`.

---

## Standing Policy — Auto-Fold Rule

Any craft skill Peat installs is automatically folded into this protocol as a subordinate
craft layer. On install: Worldline's committed register, palette, and slop-detection
machinery override every conflict; any rule that contradicts a Worldline non-negotiable
is suppressed; the addition is Algol-verified. Polaris reports what was suppressed and
what was adopted — she does not re-confirm the yes/no per skill. Peat's install is the
decision. (Policy established 2026-06-25.)

---

## 1. Precedence Chain

```
/worldline-soul    — JUDGMENT     why · exploration-not-exhibition · mystery · earned depth
/worldline-design  — VOCABULARY   what · tokens · atoms · type roles · non-negotiables
craft sources      — CRAFT        how-well · contrast · rhythm · motion discipline · interaction
```

**Hard rule:** on any conflict, Worldline's committed language beats every craft source.
Craft sources are discipline layers — they are not register authorities and they do not
negotiate identity. `PRODUCT.md` already fixes register = brand. That decision
is closed.

### Craft sources (four active, all subordinate to Worldline)

There are four active craft sources. Three are ordered by depth of motion/interaction
authority; the fourth is the accessibility rule-authority. On any conflict between them,
apply the rule that is more conservative (adds less, removes less from the committed
Worldline vocabulary).

**`emil-design-eng`** (installed at `.agents/skills/emil-design-eng/`) — deepest
motion/interaction authority. Animation decision framework, easing curve discipline,
spring mechanics, clip-path reveals, gesture physics, WAAPI, CSS performance under load,
asymmetric enter/exit timing, origin-aware popovers, and the Sonner component principles.

> **Worldline motion law, best articulated:** Emil's Animation Decision Framework
> (§ "Should this animate at all?") defaults toward NO for frequent or keyboard-initiated
> actions and requires every animation to have a stated purpose. This framework is the
> canonical gate for any new Worldline motion. Before writing any animation, answer
> Emil's four questions in order. If Q1 resolves to "no animation," stop there.

**`/impeccable`** — contrast, typography, motion easing, spacing rhythm, interaction
correctness. Supplies six active verbs for Betelgeuse and Sirius (see §4).

**`make-interfaces-feel-better`** (installed at `.agents/skills/make-interfaces-feel-better/`)
— 16 principles + Before/After Review Checklist covering typography rendering, surfaces,
animations, and performance. Principles are subject to the suppression rules in §3.

**`fixing-accessibility`** (installed at `.agents/skills/fixing-accessibility/`) —
accessibility rule-authority. Nine priority categories covering accessible names,
keyboard access, focus/dialog management, semantics, forms/errors, announcements,
contrast and states, media/motion, and tool boundaries. Its role in this layer: it
supplies the rule-level "how" beneath Worldline's existing numeric gate floor (Lighthouse
a11y ≥ 95 / 100 on the audience-fork, keyboard-reachable, visible focus, reduced-motion
respected). It deepens what the gate checks — it does not replace the gate's numeric
floor, which remains authoritative. Invoked as a constraint-set at spec-time
(`/fixing-accessibility`) and as a file-level audit at implement-time
(`/fixing-accessibility <file>`).

### What each layer owns

**`/worldline-soul` owns the why.** Five questions tested before any surface change:
front-load or invite? earned or given? splay or veil? which level? feeling before form?
If a change exposes inner meaning that should be earned through exploration, `/worldline-soul`
rejects it — regardless of what the other two layers say.

**`/worldline-design` owns the what.** Tokens in `app/globals.css` and
`app/colors_and_type.css` are the palette. Atoms in `worldline-atoms.css` are the
primitives. The three type roles are locked: Cormorant italic = voice · JetBrains Mono
uppercase = instrument · Special Elite = value. The non-negotiables (no gradients
outside the globe, no glassmorphism, no drop-shadows, no rounded corners, no emoji,
reserved orange) are identity — not stylistic preferences subject to craft override.

**Craft sources own the how-well.** Given that Worldline's judgment and vocabulary
are already set, craft sources add production-grade discipline at implementation.
They are subordinate layers — never overrides.

---

## 2. What the Craft Sources Contribute — The Active Layer

These rules align with Worldline and apply at every stage: spec, implementation, visual-diff
review. Items from all three craft sources are merged here into a single always-on checklist.
Where sources overlap, the rule appears once. Items from `emil-design-eng` that duplicate
coverage already given by `/impeccable` or `make-interfaces-feel-better` are cross-referenced
rather than restated.

### Contrast verification
- Body text ≥ 4.5:1 against background.
- Large text (≥18px or bold ≥14px) ≥ 3:1.
- Placeholder text: same 4.5:1 as body — the muted-gray-on-tinted-near-white failure
  applies here too; the aged-paper + teal-ink scale is high-contrast by design, so
  this check should pass easily, but verify rather than assume.

### Typography discipline
- Body prose capped at 65–75ch line length.
- Font pairing on a contrast axis only — Worldline's serif/mono/typewriter stack is
  already contrast-paired; this rule holds against any future additions.
- `text-wrap: balance` on display headings (≤6 lines); `text-wrap: pretty` on body
  and short-to-medium prose. These are deduplicated — both craft sources carry this rule.
- `-webkit-font-smoothing: antialiased` on the root layout (macOS rendering). Apply
  once at `html`, not per-element.

### Tabular numbers (STRONG FIT — first-class adoption)
Apply `font-variant-numeric: tabular-nums` to any dynamically updating number: coordinates,
file numbers, counters, timers, roll lengths, ATLAS readouts. Worldline's typewritten
numerals and coordinate strings must not layout-shift as values change. This is a
first-class adoption from `make-interfaces-feel-better` — treat it as a standing
implementation requirement, not an optional polish.

### Motion
**Hard constraint on all motion items: motion communicates a STATE CHANGE only. Never
decorative loops. Always honor `prefers-reduced-motion`. Staggers and scale-on-press
are state feedback — not ambient polish. Any motion that passes craft review but
violates this law is rejected at the Worldline gate.**

**Animation decision gate (from `emil-design-eng` — canonical for Worldline):**
Before writing any animation, answer in order:
1. **Should this animate at all?** Keyboard-initiated actions: never. High-frequency
   (hover, list navigation): remove or drastically reduce. Occasional (modals, overlays):
   standard. Rare/first-time: may add delight.
2. **What is the purpose?** Every animation must have a stated answer: spatial consistency,
   state indication, explanation, feedback, or preventing jarring changes. "It looks cool"
   alone = do not animate if the user will see it often.
3. **What easing?** Entering/exiting → ease-out. Moving/morphing on screen → ease-in-out.
   Hover/color change → ease. Constant motion → linear. Default → ease-out.
4. **How fast?** See Worldline timing windows below; Emil's duration table defers to them.

Within the Worldline motion law:
- **Strong custom easing curves** — the built-in CSS easings are too weak. Use:
  ```css
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  ```
  Worldline tokens must carry these values. Never `ease-in` on UI — it delays the
  initial movement at exactly the moment the user is watching most closely.
- **Interruptible CSS transitions over keyframes** — for any state change that can be
  triggered rapidly (toasts, toggles), CSS transitions retarget mid-animation; keyframes
  restart from zero. Cross-reference: `make-interfaces-feel-better` carries the same rule.
- **`@starting-style` + WAAPI for entry** — modern CSS entry animation without JavaScript.
  WAAPI gives programmatic control at CSS-level performance (hardware-accelerated,
  interruptible, no library). Use when browser support allows; fall back to `data-mounted`
  attribute pattern otherwise.
  ```css
  .element {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 300ms var(--ease-out), transform 300ms var(--ease-out);
    @starting-style { opacity: 0; transform: translateY(8px); }
  }
  ```
- **`clip-path` reveals** — `inset(0 100% 0 0)` → `inset(0 0 0 0)` is a hardware-
  accelerated reveal that requires no DOM duplication. Use for tab color transitions,
  hold-to-confirm overlays, and scroll-triggered image reveals. Transitions are
  interruptible; pair with WAAPI for programmatic control.
- **Asymmetric enter/exit timing** — deliberate press: slow (hold-to-delete: 2s linear);
  system response / release: fast (200ms ease-out). Slow where the user is deciding,
  fast where the system is responding. Apply broadly to any press-and-release pattern.
- **Origin-aware popovers** — `transform-origin` at the trigger point, not center.
  Use `var(--radix-popover-content-transform-origin)` (Radix) or `var(--transform-origin)`
  (Base UI). Exception: modals stay `transform-origin: center` — they are not anchored
  to a trigger.
- **`scale(0.95) + opacity: 0` — never `scale(0)`** — nothing in the real world appears
  from nothing. Start from 0.95 or higher. Cross-reference: `make-interfaces-feel-better`
  carries the icon-transition rule (0.25→1); both sources agree on the floor.
- **Hover gated behind `@media (hover: hover) and (pointer: fine)`** — touch devices
  trigger hover on tap, causing false positives. All hover-state animations must be
  inside this media query.
- **Animate `transform` and `opacity` only** — these properties skip layout and paint
  (GPU path). Never animate `padding`, `margin`, `height`, or `width` if avoidable.
  Cross-reference: `/impeccable` and `make-interfaces-feel-better` carry matching rules.
- **CSS-over-JS under load** — CSS animations run off the main thread. Framer Motion
  shorthand props (`x`, `y`, `scale`) use `requestAnimationFrame` on the main thread
  and drop frames when the browser is busy. For predetermined animations use CSS;
  for dynamic/interruptible ones use WAAPI or CSS transitions. A motion library
  (framer-motion / motion) remains a **Polaris-gated dependency** — never assumed present.
- **Perceived performance** — a faster-spinning spinner and a 180ms transition feel
  faster than a 400ms one even with identical load time. Ease-out amplifies this because
  the user sees immediate movement. Optimize perceived speed alongside actual speed.
- Ease-out with exponential curves (ease-out-quart / quint / expo). No bounce, no elastic.
  Spring physics via `motion/react`: always `bounce: 0`.
- Every animation needs a `prefers-reduced-motion: reduce` alternative that reveals an
  already-visible default — never gates content behind a transition.
- Timing calibration set by Worldline: 100–150ms hover · 200–300ms selected ·
  300–500ms overlays · 700–1400ms ATLAS camera. Emil's duration table defers to these
  windows. **ATLAS camera moves (700–1400ms) are explicitly exempt from Emil's "<300ms
  UI rule" — they are justified instrument motion, not UI feedback.**
- CSS transitions for interactive state changes; keyframes only for one-shot sequences.
- Split and stagger enter animations into semantic chunks, ~100ms delay per chunk.
  Exits: shorter duration (150ms vs 300ms), small fixed `translateY`, softer than enters.
- Icon transitions: `scale 0.25→1`, `opacity 0→1`, `blur 4px→0px`. Bounce always `0`.
- `initial={false}` on `AnimatePresence` for elements in their default page-load state.
- Never `transition: all`. Specify exact properties: `transition-property: scale, opacity`.
- `will-change` only on `transform`, `opacity`, `filter`. Never `will-change: all`.
  Add only when first-frame stutter is observed, not preemptively.
- CSS custom properties: update `transform` directly on the element, not a CSS variable
  on a parent. Changing a CSS variable triggers style recalculation on all children;
  in lists or drawers this is expensive.

### Scale on press
`scale(0.96)` on click gives interactive elements tactile feedback. Always `0.96`. Never
below `0.95`. Add a `static` prop to disable when motion would be distracting.
Emil's equivalent: `scale(0.97)` on `:active` — both are within the 0.95–0.98 band; use
`0.96` (Worldline) as the canonical value. The principle is identical.

### Optical alignment
When geometric centering looks off, align optically. Buttons with icons: icon-side padding
= text-side padding − 2px. Play triangles: shift right 2px. Asymmetric SVGs: fix the
viewBox directly.

### Minimum hit area
Interactive elements: at least 40×40px hit area. Extend with a pseudo-element when the
visible element is smaller. Hit areas must not overlap between adjacent elements.

### Spacing and rhythm
- Vary spacing for rhythm. Flat uniform spacing is the lazy answer.
- Semantic z-index scale: dropdown → sticky → modal-backdrop → modal → toast → tooltip.
  Never arbitrary values (999 / 9999).

### Interaction correctness
- Dropdowns inside `overflow: hidden` / `overflow: auto` containers clip. Use native
  `<dialog>` / popover API, `position: fixed`, or a portal to escape stacking context.

### Absolute bans that AGREE with Worldline (remain active)
- **No gradient text** (`background-clip: text` + gradient) — Worldline bans gradients entirely (globe exception only).
- **No glassmorphism as default** — Worldline bans decorative blur/glass.
- **No side-stripe borders** — inconsistent with Worldline's hairline / dashed-rule vocabulary.
- **No identical card grids** — Worldline has no card affordance; PRODUCT.md calls this out explicitly.
- **No hero-metric template** — Worldline is not a SaaS app.

### Accessibility (`fixing-accessibility` — constraint set, always on)

These rules apply at every stage: spec, implementation, visual-diff review. They deepen
Worldline's existing gate step 4 (Lighthouse a11y ≥ 95 / 100 on audience-fork) with
rule-level specificity. Two reconciliations are noted inline; see §3 for full reasoning.

**Accessible names (critical)**
- Every interactive control must have an accessible name.
- Icon-only buttons must have `aria-label` or `aria-labelledby`. Decorative icons must
  be `aria-hidden`.
- Every `<input>`, `<select>`, and `<textarea>` must be labeled. Links must have
  meaningful text (no "click here").

**Keyboard access (critical)**
- Do not use `<div>` or `<span>` as buttons without full keyboard support — use native
  `<button>` instead.
- All interactive elements must be reachable by Tab. No `tabindex` greater than 0.
- Escape must close dialogs or overlays when applicable.
- **Focus visibility:** `fixing-accessibility` rule "do not remove focus outlines without
  a visible replacement" is SATISFIED by Worldline's own focus treatment. The accent-orange
  focus ring (token `var(--accent-orange)`) delivered via the corner-reticle vocabulary
  IS the visible replacement — removing the default browser outline in favor of it is
  compliant. See §3 for the full reconciliation note.

**Focus and dialog management (critical)**
- Modals must trap focus while open, restore focus to the trigger on close, and set
  initial focus inside the dialog. Opening a dialog must not scroll the page unexpectedly.

**Semantics (high)**
- Prefer native elements (`<button>`, `<a>`, `<input>`) over role-based hacks.
- If a role is used, required ARIA attributes must be present.
- Lists must use `<ul>` or `<ol>` with `<li>`. Do not skip heading levels.
- Tables must use `<th>` for headers when applicable.

**Forms and errors (high)**
- Errors must be linked to fields using `aria-describedby`.
- Required fields must be announced; invalid fields must set `aria-invalid`.
- Helper text must be associated with inputs. Disabled submit actions must explain why.

**Announcements (medium-high)**
- Critical form errors should use `aria-live`. Loading states should use `aria-busy` or
  status text. Toasts must not be the only way to convey critical information.
- Expandable controls must use `aria-expanded` and `aria-controls`.

**Contrast and states (medium)**
- *Cross-reference:* contrast ratios (≥4.5:1 body / ≥3:1 large) are already governed
  by `/impeccable` and the legibility-registers feedback. Do not restate as a new
  `fixing-accessibility` rule — the existing entry covers it.
- Hover-only interactions must have keyboard equivalents.
- Disabled states must not rely on color alone.

**Media and motion (low-medium)**
- Images must have correct `alt` text (meaningful or empty string for decorative images).
- *Cross-reference:* `prefers-reduced-motion` is already core in `emil-design-eng` and
  `make-interfaces-feel-better`. Do not restate — every motion rule in §2 above already
  requires a reduced-motion alternative that reveals an already-visible default.

**Tool boundaries (critical)**
- Prefer minimal, targeted fixes. Do not refactor unrelated code.
- Do not add ARIA when native semantics already solve the problem.

---

## 3. Suppression List — Craft Guidance That Does Not Apply

These items are suppressed because Worldline overrides them. Applying them
would blend registers or reject committed vocabulary as slop.

### fixing-accessibility reconciliations (no suppressions — two explicit confirmations)

`fixing-accessibility` has no rules that conflict with Worldline's non-negotiables.
Two items require explicit reconciliation rather than suppression:

**Focus outlines.** `fixing-accessibility` rule: "do not remove focus outlines without a
visible replacement." Worldline removes the default browser focus outline in CSS and
replaces it with the accent-orange corner-reticle focus ring (`var(--accent-orange)`,
the same orange reserved for instrument accent throughout the design system). This IS a
visible replacement — prominent, distinct, and identity-consistent. Removing the browser
default in favor of Worldline's own focus treatment is fully compliant with this rule.
The rule is satisfied, not violated.

**Contrast and prefers-reduced-motion.** These two categories within `fixing-accessibility`
are cross-referenced to existing protocol entries rather than adopted as new rules:
contrast is already governed by `/impeccable` (§2 "Contrast verification" — ≥4.5:1 body /
≥3:1 large) and the legibility-registers feedback in MEMORY.md; `prefers-reduced-motion`
is already mandated by every motion rule in `emil-design-eng` and `make-interfaces-feel-better`
(§2 "Motion" — "every animation needs a `prefers-reduced-motion: reduce` alternative that
reveals an already-visible default"). Adding duplicate entries under `fixing-accessibility`
would create two sources of truth for the same constraint. Cross-reference, don't double-state.

### Register selection — SUPPRESSED
`PRODUCT.md` already fixes register = brand. Craft sources' register-inference
steps are skipped. The answer is already known.

### New-project palette guidance — SUPPRESSED
`/impeccable` setup step 5 runs `palette.mjs` when no committed brand colors
are found, and warns against "cream/sand/beige as AI-default body bg." This step
is explicitly skipped: the condition `"identity-preservation wins"` already
applies. Worldline's tokens are locked in `app/globals.css` +
`app/colors_and_type.css`. The aged-paper background is the committed identity,
not an AI default of 2026. `/impeccable` must not flag or propose replacing it.

### Font reflex-reject list — SUPPRESSED FOR COMMITTED FONTS
`/impeccable reference/brand.md` lists Cormorant · Cormorant Garamond as
training-data defaults to reject. That list applies to **new design choices**.
Worldline's type stack (Cormorant italic as the voice role, JetBrains Mono as
instrument, Special Elite as value) is committed identity that predates the
protocol. The reflex-reject list does not apply to it. Identity-preservation wins.

### Reflex-reject aesthetic lanes — SUPPRESSED
`/impeccable` identifies "editorial-typographic" (display serif + mono labels +
ruled separators + monochromatic restraint) as a saturated AI aesthetic lane.
This description partially matches Worldline's visual vocabulary. The lane-check
is suppressed: Worldline's vocabulary is committed and predates the protocol;
lane-saturation is a concern for greenfield identity decisions, not for an
established system with a named soul.

### AI-slop exemptions for Worldline's committed instrument vocabulary
These specific items appear in /impeccable's AI slop test or absolute-ban list
but ARE the brand vocabulary here — explicitly exempt:

> **"Tiny uppercase tracked eyebrow" and "numbered section markers (01 / 02 / 03)"
> are GATE-APPROVED Worldline patterns. Worldline's FILE—NNN file numbers, mono-
> uppercase 9px / 0.3em tracked instrument labels, and ATLAS readout sequences are
> the brand's instrument vocabulary — not AI scaffolding. /impeccable must never
> flag these as slop on this project.**

The distinction: /impeccable bans the *reflexive* application of these patterns
to generic SaaS sections. Worldline uses them because the site IS an observatory
instrument — they carry the meaning of the brand. One named deliberate system is
voice; that is exactly what this is.

### OKLCH palette strategy advice — SUPPRESSED
/impeccable's color strategy steps (choose Restrained / Committed / Full / Drenched,
run `palette.mjs` for a seed color, use OKLCH throughout for new work) are suppressed.
Worldline's palette is already in CSS custom properties; new color decisions go
through a TOKEN PROPOSAL to Polaris before touching `globals.css`.

### Concentric Border Radius (#1) — SUPPRESSED
`make-interfaces-feel-better` principle #1 ("outer radius = inner radius + padding")
and the entire `concentric border radius` checklist row are suppressed. Worldline has
**no rounded corners** — only true circles (used for node atoms at `border-radius: 50%`).
All `border-radius` guidance and any `rounded-*` Tailwind class usage is moot on this
project. Do not introduce border-radius on rectangular surfaces under any craft rationale.

### Shadows Over Borders (#3 + Common-Mistake "Hard borders → layered box-shadow") — SUPPRESSED
`make-interfaces-feel-better` principle #3 and the `surfaces.md` shadow-as-border
technique — including the `--shadow-border` / `--shadow-border-hover` variables and the
"Hard borders between sections → Use layered box-shadow with transparency" common-mistake
row — are suppressed. Worldline has **no drop-shadows**. Depth comes from dashed
hairlines (`.section-rule-dashed`) and corner reticles (`.corner-marks`, `.diverge-panel`
pseudo-elements), not from `box-shadow`. Never introduce `box-shadow` for depth, borders,
or elevation on any Worldline surface.

### Image Outlines (#11, the 1px rgba black/white outline) — SUPPRESSED
`make-interfaces-feel-better` principle #11 and `surfaces.md §Image Outlines` (the
`outline: 1px solid rgba(0,0,0,0.1)` / `rgba(255,255,255,0.1)` technique) are suppressed.

Worldline frames images with the **`.paper-mount` atom** (spec: 10-photo-entry §2.3 /
TASK-2026-05-30-PHOTO-ENTRY-D3-SHIP): `border: 1px solid var(--ink-faint)` inside a
`background: var(--paper-warm)` mount with 12px padding. This is a measured photographic
frame, not a generic rgba outline ring. Any image appearing without a `.paper-mount`
treatment must adopt the `.paper-mount` atom — not the rgba-outline fallback.

Do not use `outline: 1px solid rgba(0,0,0,0.1)` or `outline-black/10` on `<img>` tags.
The atom governs image edges.

### Bounce / spring bounce — SUPPRESSED (from `emil-design-eng`)
**`bounce: 0` always. No exceptions.** Emil's allowance of subtle spring bounce (0.1–0.3)
for playful or drag interactions is suppressed on Worldline. Both `/impeccable` and
`make-interfaces-feel-better` independently prohibit bounce/elastic. The Worldline
standard is stricter than Emil's floor: zero bounce in every context, including
drag-to-dismiss. Any spring configuration must read `bounce: 0`.

### Decorative motion (mouse-tracking springs, beauty-is-leverage delight) — SUPPRESSED
Emil's decorative mouse-tracking spring examples (`useSpring` tied to mouse position for
visual effect), celebration animations, and the "beauty is leverage" delight tier for
interactions that serve no state change are suppressed on Worldline. Worldline's motion
law is absolute: motion communicates a state change only. "It is decorative" is not a
valid purpose here. This does not suppress functional spring usage (drag momentum,
interrupted gesture recovery) — those have stated purposes.

### Emil's duration table — DEFERS to Worldline timing windows
Emil's duration guidance ("<300ms rule for UI," button 100–160ms, tooltip 125–200ms,
modal 200–500ms) is informative but defers to the Worldline calibration: 100–150ms hover ·
200–300ms selected · 300–500ms overlays. **ATLAS camera moves (700–1400ms) are explicitly
exempt from Emil's "<300ms" rule — they are justified instrument motion, not UI feedback.**
If Emil's table and the Worldline window conflict, the Worldline window wins.

### "Initial Response" / animations.dev plug — INTERNAL REFERENCE ONLY
The `emil-design-eng` skill's instruction to respond on first invoke with only a
reference to Emil's course (`animations.dev`) is an internal skill-invocation artifact.
Agents NEVER parrot this plug to users or include it in specs, handoffs, or reviews.
The skill is used as a craft reference layer, not as a course advertisement.

### Framer Motion / motion JS patterns — prefer CSS equivalents
Emil's examples using `useSpring` (framer-motion), `AnimatePresence`, and `motion.div`
shorthand properties are illustrative. Worldline's preference is dependency-free CSS
equivalents (CSS transitions, `@starting-style`, WAAPI, `clip-path`). A motion library
(framer-motion / motion) remains a **Polaris-gated dependency** — never assumed present.
Where a motion library is already in use (verified by `package.json`), its patterns may
apply, but the CSS-first preference still holds for new surfaces.

---

## 4. Verb Map by Agent

### Betelgeuse (design · spec · gate)
Active /impeccable verbs: **critique · polish · bolder · quieter · typeset · layout**

`make-interfaces-feel-better` contributes its **Review Checklist** and **Before/After table
format** into Betelgeuse's critique and polish verbs. When writing a REVISE handoff,
Betelgeuse may use the Before/After table structure to show exactly what changed and why.
The checklist is a gate tool — not a deliverable.

`emil-design-eng` contributes its **Animation Decision Framework** as the canonical motion
gate and its **Review Checklist** (Before/After table) for motion-specific findings. When
a handoff includes animation work, Betelgeuse runs Emil's four-question framework against
every animated element before signing.

`fixing-accessibility` is pulled into the **accessibility step of the seven-check gate
(gate step 4)**. When Betelgeuse reviews a visual-diff or writes a REVISE handoff,
`/fixing-accessibility <file>` is the review verb for gate step 4: it checks accessible
names, keyboard reachability, focus/dialog management, semantics, form/error wiring, and
announcement patterns against the rules in §2 above. If any critical finding (accessible
names / keyboard / focus / tool boundaries) appears, the handoff is rejected at step 4.

These serve the existing seven-check anti-Codex gate — they add craft precision
to what is already checked, they do not replace or supersede it. The Worldline gate
is authoritative and is the final word. Any craft output that passes these checks
but drifts from a Worldline non-negotiable is still rejected.

Gate priority: reference fidelity → token compliance → pattern reuse → accessibility →
mobile fidelity → motion calibration → atom reuse. Craft verbs operate inside gate
steps 1–7, not above them.

### Sirius (build · implementation)
Active /impeccable verbs: **audit · adapt · optimize · harden · animate**

`make-interfaces-feel-better` is an **always-on implementation checklist** for Sirius.
Run the Review Checklist at implement-time: tabular-nums on every dynamic number,
antialiased at root, specific transition properties, will-change only on compositor
properties, hit areas ≥ 40×40px, stagger enters, soften exits, initial={false} for
default-state elements.

`emil-design-eng` supplies the CSS implementation patterns: custom easing tokens,
`@starting-style` entry, WAAPI for programmatic animations, `clip-path` reveal patterns,
CSS variable performance rules, and hardware-acceleration guidance. When Sirius is
implementing animation, these are the implementation-level how.

`fixing-accessibility` is an **implement-time constraint-set** for Sirius. Run
`/fixing-accessibility <file>` on every component that includes buttons, links, inputs,
menus, dialogs, tabs, forms, or custom keyboard interactions. Apply the §2 accessibility
rules as standing constraints, not post-hoc audit items. Prefer native elements before
adding ARIA. Minimal targeted fixes only — do not refactor unrelated code.

If a checklist finding conflicts with the Betelgeuse spec, Sirius sends a HANDOFF to
Betelgeuse — the spec is not silently overridden.

### Both agents — always-on checklist
All four craft sources' general rules (§2 above) function as an always-on checklist at
every stage: spec-writing, implementation, and visual-diff review. This includes the
`make-interfaces-feel-better` Review Checklist, the `emil-design-eng` Review Checklist
(with suppressed items removed — see §3), and the `fixing-accessibility` accessibility
constraint-set (§2 "Accessibility" block above).

---

## 5. Relationship to the Existing Gate

The seven-check anti-Codex gate in `betelgeuse.md` remains authoritative:

1. Reference fidelity
2. Token compliance (grep for raw hex outside `globals.css`)
3. Pattern reuse (does this surface belong to Worldline, not a generic SaaS dashboard?)
4. Accessibility (Lighthouse a11y ≥ 95 / 100 on audience-fork)
5. Mobile fidelity (≤880px · ≤600px · no horizontal scroll · touch targets ≥ 44px)
6. Motion calibration (timing windows above, no decorative loops, reduced-motion respected)
7. Atom reuse (every primitive must cite its gallery atom id)

Craft sources are tools that sharpen steps in this pipeline — contrast verification
sharpens step 4; easing-curve discipline sharpens step 6; tabular-nums sharpens step 3
(coherent instrument register); interaction correctness sharpens steps 3 and 4; hit area
sharpens steps 4 and 5. Emil's animation decision framework sharpens step 6 (motion
calibration) with a Q1 gate that precedes the timing check. `fixing-accessibility`
sharpens step 4 (accessibility) with rule-level specificity: accessible names, keyboard
access, focus/dialog management, semantics, forms/errors, and announcements are now
explicit sub-checks inside the step-4 pass rather than implicit under the Lighthouse
score alone. They do not add new steps above the gate.

Any craft output that conflicts with a Worldline non-negotiable — committed tokens,
committed type roles, instrument vocabulary, the reserved orange, the globe-only gradient
exception — is rejected at the gate. The gate does not bend for craft rationale.

---

## Quick Reference: What Passes Through, What Stops

| Guidance | Source | Status | Reason |
|---|---|---|---|
| Contrast ≥4.5:1 body / ≥3:1 large | /impeccable | ACTIVE | Aligns; Worldline is high-contrast by design |
| 65–75ch line length | /impeccable | ACTIVE | Aligns; article entry spec already states this |
| Ease-out curves, no bounce/elastic | /impeccable | ACTIVE | Aligns; adds easing precision inside Worldline windows |
| Semantic z-index scale | /impeccable | ACTIVE | Aligns; no conflict |
| Interaction correctness (portal/dialog) | /impeccable | ACTIVE | Aligns; implementation discipline |
| No gradient text | /impeccable | ACTIVE | Agrees with Worldline non-negotiable |
| No glassmorphism | /impeccable | ACTIVE | Agrees with Worldline non-negotiable |
| No side-stripe borders | /impeccable | ACTIVE | Agrees with Worldline non-negotiable |
| No identical card grids | /impeccable | ACTIVE | Agrees; no cards in Worldline |
| `text-wrap: balance/pretty` | both | ACTIVE | Deduplicated; applied once |
| `-webkit-font-smoothing: antialiased` | make-interfaces | ACTIVE | Root-level; no conflict |
| **Tabular numbers (`tabular-nums`)** | make-interfaces | **ACTIVE — first class** | Worldline's coords/file numbers must not layout-shift |
| CSS transitions for interactive state | make-interfaces | ACTIVE | Agrees with Worldline motion law |
| Split + stagger enters (~100ms) | make-interfaces | ACTIVE | State-change framing; honors reduced-motion |
| Subtle exits (shorter, small translateY) | make-interfaces | ACTIVE | State-change framing; honors reduced-motion |
| Icon: scale/opacity/blur, bounce=0 | make-interfaces | ACTIVE | Agrees; bounce=0 matches no-elastic rule |
| `initial={false}` on AnimatePresence | make-interfaces | ACTIVE | No conflict |
| Never `transition: all` | make-interfaces | ACTIVE | Aligns; exact-property discipline |
| `will-change` only on transform/opacity/filter | make-interfaces | ACTIVE | Aligns; sparingly |
| Scale on press `0.96` + `static` escape | make-interfaces | ACTIVE | State feedback, not decorative; static prop guards |
| Optical over geometric alignment | make-interfaces | ACTIVE | No conflict |
| Minimum 40×40px hit area | make-interfaces | ACTIVE | Aligns with mobile fidelity gate (gate 5 ≥44px) |
| **Animation Decision Framework (Q1–Q4)** | emil-design-eng | **ACTIVE — canonical motion gate** | Best articulation of Worldline's state-change-only law; Q1 default = no animation for frequent/keyboard actions |
| **Strong custom easing curves (`cubic-bezier`)** | emil-design-eng | **ACTIVE** | Built-in CSS easings too weak; tokens carry `--ease-out`, `--ease-in-out`, `--ease-drawer` |
| **Interruptible CSS transitions over keyframes** | emil-design-eng | ACTIVE | Deduped with make-interfaces; both agree |
| **`@starting-style` + WAAPI for entry** | emil-design-eng | **ACTIVE** | Modern CSS entry without JS; hardware-accelerated |
| **`clip-path` reveals** | emil-design-eng | **ACTIVE** | Hardware-accelerated directional reveal; no DOM duplication |
| **Asymmetric enter/exit timing** | emil-design-eng | **ACTIVE** | Slow deliberate press, snappy release; applies broadly |
| **Origin-aware popovers (`transform-origin` at trigger)** | emil-design-eng | **ACTIVE** | Modals exempted (stay centered) |
| **`scale(0.95)+opacity` never `scale(0)`** | emil-design-eng | ACTIVE | Deduped with make-interfaces icon rule |
| **Hover gated behind `@media (hover:hover) and (pointer:fine)`** | emil-design-eng | **ACTIVE** | Touch devices trigger hover on tap |
| **Animate transform/opacity only** | emil-design-eng | ACTIVE | Deduped with /impeccable and make-interfaces |
| **CSS-over-JS-under-load / WAAPI** | emil-design-eng | **ACTIVE** | CSS runs off main thread; framer shorthand drops frames |
| **Perceived-performance reasoning** | emil-design-eng | **ACTIVE** | Easing + speed perception; informs motion calibration |
| **CSS variable direct-update (not parent var)** | emil-design-eng | **ACTIVE** | Prevents child style recalc on drag/swipe |
| **Accessible names (aria-label on icon buttons; aria-hidden on decorative icons)** | fixing-accessibility | **ACTIVE** | Critical; every interactive control must have a name |
| **Keyboard access (native button; Tab-reachable; no tabindex>0; Escape closes)** | fixing-accessibility | **ACTIVE** | Critical; div-as-button never |
| **Focus/dialog management (trap + restore + initial focus)** | fixing-accessibility | **ACTIVE** | Critical; modals must trap focus while open |
| **Semantics (native elements over ARIA hacks; heading order; lists)** | fixing-accessibility | **ACTIVE** | High; prefer native before adding role= |
| **Forms/errors (aria-describedby + aria-invalid + required announced)** | fixing-accessibility | **ACTIVE** | High; error wiring mandatory on all form fields |
| **Announcements (aria-live critical errors; aria-expanded + aria-controls)** | fixing-accessibility | **ACTIVE** | Medium-high; expandable controls must declare state |
| **Hover-only interactions must have keyboard equivalents** | fixing-accessibility | **ACTIVE** | Medium; no pointer-only affordances |
| **Tool boundaries (minimal targeted fixes; don't add aria if native solves it)** | fixing-accessibility | **ACTIVE** | Critical; minimal targeted fix discipline |
| Focus outline reconciliation | fixing-accessibility | RECONCILED — NOT SUPPRESSED | Worldline's accent-orange corner-reticle ring (`var(--accent-orange)`) IS the visible replacement; removing browser default in its favor is compliant |
| Contrast (≥4.5:1 / ≥3:1) | fixing-accessibility | CROSS-REF to /impeccable | Already governed by §2 "Contrast verification"; not restated as a new rule |
| prefers-reduced-motion | fixing-accessibility | CROSS-REF to emil + make-interfaces | Already mandated in §2 "Motion"; every animation requires a reduced-motion alternative that reveals content |
| Register selection step | /impeccable | SUPPRESSED | PRODUCT.md = brand, already fixed |
| `palette.mjs` / OKLCH seed | /impeccable | SUPPRESSED | Identity-preservation wins; tokens locked |
| Cormorant on font reflex-reject list | /impeccable | SUPPRESSED | Committed identity, not a new choice |
| Editorial-typographic lane warning | /impeccable | SUPPRESSED | Worldline's vocabulary predates the lane-check |
| "Tiny uppercase tracked eyebrow" ban | /impeccable | SUPPRESSED | FILE—NNN / 9px mono labels are gate-approved instrument vocabulary |
| "Numbered section markers 01/02/03" ban | /impeccable | SUPPRESSED | ATLAS file numbers are gate-approved instrument vocabulary |
| Warm-neutral bg warning ("cream AI-default") | /impeccable | SUPPRESSED | Aged-paper bg is committed identity |
| **Concentric border radius (#1)** | make-interfaces | **SUPPRESSED** | **Worldline has NO rounded corners; only true circles. All border-radius / `rounded-*` guidance is moot here.** |
| **Shadows over borders (#3 + "hard borders → box-shadow")** | make-interfaces | **SUPPRESSED** | **Worldline has NO drop-shadows. Depth comes from dashed hairlines + corner reticles. Never introduce box-shadow.** |
| **Image outlines (#11, rgba 0,0,0,0.1)** | make-interfaces | **SUPPRESSED** | Worldline frames images with `.paper-mount` atom (`border: 1px solid var(--ink-faint)`). Use that atom — not the rgba-outline fallback. |
| **Bounce / spring bounce (bounce: 0.1–0.3)** | emil-design-eng | **SUPPRESSED** | **`bounce: 0` always. Worldline + make-interfaces both prohibit bounce/elastic. Emil's 0.1–0.3 allowance does not apply here — not even for drag-to-dismiss.** |
| **Decorative mouse-tracking springs** | emil-design-eng | **SUPPRESSED** | **Worldline motion law: state change only. "Beauty is leverage" delight that serves no state change is suppressed.** |
| **Emil duration table ("<300ms UI rule")** | emil-design-eng | **SUPPRESSED / DEFERS** | **Defers to Worldline timing windows. ATLAS camera moves (700–1400ms) are explicitly exempt from Emil's "<300ms" rule — justified instrument motion.** |
| **"Initial Response" / animations.dev plug** | emil-design-eng | **SUPPRESSED** | Internal skill artifact. Agents never parrot it. |
| **Framer Motion / motion JS patterns** | emil-design-eng | DEFERS | Prefer CSS equivalents. Motion library = Polaris-gated dependency, never assumed. |

---

*This document is owned by Betelgeuse (α-VIS-04). Changes to the precedence chain
or suppression list require a TOKEN PROPOSAL or escalation to Polaris. Canopus
wires the pointers from betelgeuse.md and sirius.md to this file.*
