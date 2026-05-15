# Worldline · Journey Architecture

> Status · α 1.130426 · 2026-05-15
> Author · Betelgeuse (α-VIS-04) · TASK-2026-05-15-08 · per-task opus escalation
> Predecessors · `REVIEW-2026-05-14-worldline-pages-v1.md` (source + opus rendered passes), PRD-01..05, `00-globe-ontology-1.2.md`
> Evidence · `.claude/visual-diffs/main-poc-2026-05-15/shots/` (7 PNGs), `.claude/visual-diffs/TASK-2026-05-14-06/stages/` (22 PNGs)
> Status of artifacts cited · Globe = implemented (`components/WorldlineGlobe.tsx`), entry surfaces = not built, NETRA chat = not built, photo entry = not built, search = not built
>
> This is the canonical journey doc. Every per-surface spec (β article, γ photo+atlas, δ NETRA prompt + chat UI) derives from this document. Where Peat's intent is genuinely ambiguous, a *most-defensible* decision is recorded and tagged `[Peat: confirm or redirect]`.

---

## 0 · ground rules

Three constraints frame every decision here.

1. **The Globe is the protagonist.** The currently-running `WorldlineGlobe.tsx` (A.T.L.A.S. instrument frame, stratum chooser, ALPHA ring, DivergenceMeter, ChapterIndex + AttractorFields below the fold, floating NETRA button bottom-left) is what we design around. We do not redesign the Globe in this document — we describe what travels INTO and OUT OF it.

2. **`00-globe-ontology-1.2.md` is more ambitious than the running Globe.** The ontology says strata are *co-equal and visible simultaneously, not a toggleable view*. The running Globe treats them as four camera framings (ALL / NeX / Ne0N / Ne0). This is a real divergence. I do not resolve it here — that's a Polaris→Peat conversation. I record the decision-as-shipped (toggleable framings remain) and note where the co-present model would change downstream specs. See §6 and §10.

3. **Anti-Codex.** Every decision is checked against the 6-point gauntlet in §10. If something doesn't reuse what exists, it's flagged.

---

## 1 · Journey moments end-to-end

Eight moments. Each is annotated `what main PoC already does · what gap remains`.

### M1 · LAND — visitor hits `/`

**What exists.** Boot sequence (currently always-on, no localStorage gate; runs ~2.5s of calibration micro-anim). After boot: `Nav` strip across the top, `HeroBlock` (FILE — 000 / GENESIS tagrow, italic title "an archive of unfinished thought, surveyed openly.", subhead, 047/012/∞ counts stack, compact DivergenceMeter), then the A.T.L.A.S. instrument framing the Globe.

**Gap.** Nothing on first paint asks the visitor *what kind of visit this is*. PRD-02 (Audience Fork) proposed a hard fork screen after boot; the running PoC does not show one. Two readings are defensible (§6).

**Decision.** **No hard fork screen.** The HeroBlock title + the stratum chooser inside ATLAS together *are* the soft fork. A returning recruiter goes Ne0 (surface archive — concrete entries by coordinate). A returning trace-curious visitor goes NeX (possibility field). A first-time visitor sees ALL and reads the meter. PRD-02 is reframed accordingly (§6). `[Peat: confirm or redirect]`

### M2 · PICK STRATUM — visitor reads the meter, decides direction

**What exists.** The left rail of A.T.L.A.S. has three large stratum buttons — `3 · NeX · Possibility · Field` / `2 · Ne0N · Pole · Bearer` / `1 · Ne0 · Surface · Archive` — plus an implicit "FULL · Ne0EX" state that acts as fourth button (the active de-toggled state). Keyboard 1 / 2 / 3 / 0 / ESC also drive it. Each click runs a 1400ms easeInOutCubic camera move plus shows/hides `nexField`, `axisGroup`, `contoursGroup`, `arcLine`.

**Gap.** None at desktop. At ≤880px the Globe canvas is currently *not rendered to the fold* (the lg: breakpoint in HeroBlock hides the counts stack and DivergenceMeter compact, and the canvas itself only shows up after scroll past the Hero strip). On 600px and 375px the fold is empty paper + N button.

**Decision.** See §7 (Mobile collapse).

### M3 · BROWSE GLOBE — visitor orbits, drags, hovers, jumps

**What exists.** Drag-to-orbit in `all` and `nex` strata only (locked in `neon` and `neo` because the camera is pinned). Pin click → `setSelectedId(fileNum)` → camera flies to coordinate (1100ms), opens the in-frame article side panel. NETRA bottom-right console shows live `RETICLE` lat/lon + `RANGE` + a `⟶ NEXT NODE` cycle button. Hover pin → cursor becomes pointer (no preview yet).

**Gap.**
- Hover does not show a preview tooltip. PRD-01 acceptance criterion `ATLAS pin click navigates to entry page; side panel preview still works on hover/tap-once` is not yet met — the side panel only opens on click.
- Photo nodes do not exist as a glyph distinct from article pins (PRD-03 §3.2: small square vs circle).
- Fiction nodes do not exist on the Globe at all (PRD-03 open question; ontology §1.2 says fiction lives in orbit too).
- No empty-stratum state. If `RECENT_ENTRIES` were empty, the Globe would render but no pins; no copy says "no traces surveyed."

**Decision.** See §2 (Globe mechanics spec).

### M4 · ENTER — visitor clicks a node, lands on a reading surface

**What exists.** Clicking a pin opens the in-Globe side panel (a 360px-wide article preview with FILE, place, status, reading time, title, summary, tags, `READ ENTRY →` link pointing to `#entry-${fileNum}` anchor). The actual entry page does not exist.

**Gap.** Everything past `READ ENTRY →`. This is what β (TASK-09 article) and γ (TASK-10 photo+atlas) build.

**Decision.** Two-step entry pattern (§3): the side panel stays as a *preview affordance* (hover or first click on desktop; tap-once on mobile); `READ ENTRY →` (or second tap on mobile) navigates to a full entry page at `/entries/<fileNum>` (articles), `/photos/<roll>/<id>` (photos), `/fiction/<slug>` (fiction). The side panel never tries to be the entry.

### M5 · SCAN — visitor wants a list, not a sphere

**What exists.** `ChapterIndex.tsx` renders below the A.T.L.A.S. block — a chronological table-like list of recent entries with file number, date, title, place, status, reading time. This is the *list fallback*. It is currently below the fold on desktop (~900px down) and requires a scroll past the Globe to reach.

**Gap.** No affordance on the Globe itself ("see as list →"). On mobile where the Globe doesn't reach the fold at all, the list IS the primary surface but currently has no header copy promoting it as such.

**Decision.** See §5 (Fallback list access).

### M6 · FILTER — visitor wants to slice by attractor field

**What exists.** `AttractorFields.tsx` renders below `ChapterIndex`. It is a tag-based filter UI organized around the four domains (identity / reflection / method / meta).

**Gap.** No two-way binding with the Globe. Selecting an attractor field does not currently highlight the matching nodes on the Globe. PRD-02 mentions a default-active per audience path; not yet wired.

**Decision.** v1: AttractorFields stays as a separate below-the-fold filter on the list. Two-way binding with the Globe is **deferred** (out of scope for current design wave; goes in a later TASK). The reason: implementing it now means changing `WorldlineGlobe.tsx`, which Polaris explicitly excludes. `[Peat: confirm or redirect]`

### M7 · ASK NETRA — visitor wants to converse with the archive

**What exists.** A floating "N" button in the bottom-left corner of every viewport (visible in all 7 captured screenshots, including 375px mobile). Currently inert — clicking it does nothing implemented yet. The NETRA console at the bottom of A.T.L.A.S. has a `voice` strip that narrates the current stratum or selected pin in lowercase italic instrumental register.

**Gap.** Everything PRD-05 specifies: `/api/chat`, system prompt, tool calls, streaming UI, rate limiting, history. This is what δ (TASK-11) builds.

**Decision.** See §4 (NETRA chat placement).

### M-RETURN · returning visitor — second visit, third visit, twentieth visit

**What exists.** Nothing. Boot runs every time. No localStorage state. No "you were last here" affordance. The floating N button is the only thing that *could* hold state across visits (chat history).

**Gap.** PRD-02 §3.3 promises persistence (`wl:audience-path` storage key). Stage 12 and stage 13 from Claude Design tried to fill this with bookmark/revisit dashboards — both of which the source review flagged as scope creep.

**Decision.** v1 ships with the following minimum return-visitor state:
- `wl:boot-seen` — boot skipped on visits 2+. Implementation note for Sirius: cookie or localStorage, either fine; check before mounting `BootSequence`.
- `wl:netra-history` — chat history (PRD-05 already specifies this via zustand persist).
- *No* audience-path persistence — the soft-fork decision (§6) makes this unnecessary.
- *No* return dashboards. Stage 12 (Return · Bookmark) and stage 13 (Return · Revisit) are DISCARDED (see §9). The Globe itself, with its 047/012 readouts and updated ALPHA, is the return-visit signal. `[Peat: confirm or redirect]`

---

## 2 · Globe mechanics spec — GAP-B

This describes the Globe as a *contract* — what it must do, not how. The implementation lives in `components/WorldlineGlobe.tsx` and is not rewritten by this spec.

### 2.1 stratum visual differences (camera framings, as shipped)

| stratum | camera position | what renders | what hides | NETRA voice line | pin behavior |
|---|---|---|---|---|---|
| ALL / FULL | (0, 0, 4.2) orbit · slow auto-rotate | contours, axis, nexField (faint), arcLine, all pins | nothing | "standing by, ne0ex aggregate in view…" | not interactive (pins too small) — visitor must enter a stratum to click |
| NeX (3) | (2.2, 1.2, 5.0) pulled-back · field highlighted | nexField (rays + shells), axis, arcLine | contours | "possibility shells, 247 rays emitting outward…" | pins de-emphasized; orbital nodes (articles/fiction) should be the focus *once they exist* |
| Ne0N (2) | (0, 3.1, 0.2) polar · top-down | axis prominent, polar beacons | nexField, contours | "polar bearer · viewed from the axis…" | no pin interaction at this framing — the axis is the subject |
| Ne0 (1) | over α (Bangkok) at radius 2.05 | contours, surface pins, alpha ring | nexField, axis | "surface archive · 047 patches anchored…" | pins fully interactive |

### 2.2 node visual per content type — DECISION

The ontology specifies different glyphs per content type (§3.2 photos = small square; §4 articles+fiction = circular orbital nodes). The running Globe currently uses **identical small spheres** for all `RECENT_ENTRIES` pins and slightly larger orange spheres for observer nodes (α, 012, 047).

**Decision for v1:**

| content type | glyph | size | color | layer | clickable |
|---|---|---|---|---|---|
| article | small circle (current pin sphere) | ~0.012 radius | `var(--ink-primary)` translated to Three.js color `0x1f5063` | Ne0 surface · also visible in ALL | yes — full click → entry page |
| photo (PRD-03) | small **square** (new glyph) | ~0.010 side | tinted by film simulation when available; default `var(--accent-orange)` `0xd4602a` | Ne0 surface only · also visible in ALL | yes — full click → photo entry |
| fiction | small **diamond** (new glyph, rotated square) | ~0.012 diagonal | `var(--ink-soft)` translated `0x4a6b7a` (a muted ink) | NeX orbit (per ontology §4) | yes — full click → fiction entry |
| observer node (α, 012, 047) | larger circle, with α having the pulsing ring | 0.018 / 0.010 | `var(--accent-orange)` for α; ink for 012/047 | Ne0N axis (per ontology) — current PoC places them on surface; this is a pre-existing ontology mismatch we do not fix in this TASK | NOT clickable |

The new glyphs (square for photo, diamond for fiction) are within the existing Three.js codebase's vocabulary — the alphaRing already uses a different shape. Sirius extends `pinObjects` to discriminate by `kind: 'article' | 'photo' | 'fiction'` on the `Entry` type.

**Important:** the *layer* column above is aspirational — the running Globe puts everything on the surface. Photo glyphs must live on the surface (per PRD-03 and ontology §3.1). Fiction glyphs in NeX orbit require a new placement pass — `[Peat: confirm fiction-in-orbit for v1 or defer fiction-on-Globe entirely]`. Defensible default for δ-Betelgeuse to assume: defer fiction-on-Globe; fiction is reached via the list + the NETRA `list_fiction` tool call.

### 2.3 click-on-node UX — full contract

Current behavior:
1. Click pin → `setSelectedId(fileNum)`.
2. `applySelected(id)` runs: clears netraLock, sets `setNetraLock(entry.coords, 2.4)`, runs 1100ms easeInOutCubic camera move to a tangent-offset position above the pin.
3. In-Globe article side panel slides in from the right (520ms transform + 320ms opacity, cubic-bezier(.2,.8,.2,1)).
4. The `READ ENTRY →` link in the panel currently anchor-links to `#entry-${fileNum}`. **This must change** to navigate to `/entries/<fileNum>` (or photo / fiction route).
5. ESC or click outside the panel reverses (returns to current stratum framing).

The two-step pattern stays. The side panel is the *preview*. The full entry page is the *destination*. This is what PRD-01 explicitly calls out in its acceptance criteria.

### 2.4 states — exhaustive list

| state | trigger | visual | NETRA voice |
|---|---|---|---|
| default | first paint, no selection | ALL stratum, slow auto-rotate, NETRA says "STANDBY" line | standby voice line |
| hover-pin | pointer over a pin hit-sphere | cursor:pointer; pin head brightens (TBD — currently no hover style); preview tooltip appears anchored to cursor | unchanged (the voice strip is reserved for selection, not hover) |
| selected-pin | click pin OR keyboard activation on focused pin | camera flies, side panel slides in, NETRA voice updates to "trace · '<title>'. patched <date>…" | selection voice line |
| loading | stratum change in flight | camera animation playing; UI not interactable for 1.4s; cursor:wait NOT shown (the animation itself is the feedback) | unchanged |
| empty-stratum | no nodes match current stratum (e.g., Ne0 with zero photos opted in) | Globe renders normally, no pins; below-the-canvas copy: `// no traces surveyed at this stratum. cycle ⟶ JUMP or strike another key.` | "no trace surveyed. try another stratum." (new voice line for δ-Betelgeuse to author into the NETRA voice taxonomy) |
| error | WebGL context lost / scene init failed | container shows a single line: `// observatory offline · α drift exceeded · refresh to reattempt.` in italic Cormorant; ChapterIndex below the fold remains usable as fallback | n/a — voice strip hidden |
| keyboard-focused-pin | pin reached via Tab (keyboard nav) | a thin ink ring around the pin (~3px stroke at scale), pulsed once (not looped) to confirm focus reception | unchanged |

### 2.5 hover / focus affordances

**Mouse hover.** Pin glyph color shifts toward `var(--accent-orange)` (already a hint via cursor:pointer; add a 120ms color tween). A 240px-wide preview card anchored at cursor offset (12px right, 12px below) shows:
- file number + date (mono 9px tracking 0.3em)
- title (italic Cormorant 14px)
- one-line summary (italic Cormorant 11px, `var(--ink-soft)`)

Preview card uses `--paper-warm` background, 1px solid `--ink-primary`, 3px 3px 0 shadow `rgba(31,80,99,0.16)` — visually identical to the side panel's frame.

**Keyboard.** Pins must be reachable via Tab. The current Three.js implementation does not provide native focus management — Sirius adds an off-canvas DOM list of `<button>` elements, one per pin, with `aria-label` `"FILE <num> · <title> · enter to read"` and onClick mapping to the same handler. The button list is `position: absolute; clip-path: inset(50%); width: 1px; height: 1px;` (screen-reader-accessible, visually hidden) but Tab order works. When a button receives focus, the Three.js scene shows the keyboard-focused-pin state (§2.4) and the side panel previews. Enter activates → entry page.

**Reduced motion.** All camera moves shrink from 1100/1400ms to 0ms (instantaneous cut). Auto-rotation halts. Pulsing observer ring on α halts. NETRA reticle pulse halts. Globe still renders, still interactive.

### 2.6 accessibility for the Globe

- Off-canvas pin list (above) provides keyboard + screen reader equivalence.
- Skip-link at viewport top: `Skip to entries list` jumps past the Globe to `#chapter-index`.
- Stratum buttons in the left rail are already real `<button>` elements with keyboard handlers — they work.
- The Globe canvas itself has `role="application"` and `aria-label="A.T.L.A.S. — interactive worldline globe. Use stratum buttons or tab to focus a node."`
- The NETRA voice strip has `aria-live="polite"` already (verified in source). Good.
- Lighthouse a11y target: ≥95 on the home page with Globe present.

---

## 3 · Entry-surface contract — GAPS A + C

This is the *contract* every entry surface signs. β (TASK-09 article) and γ (TASK-10 photo) write the surfaces themselves; this section says what they receive from the Globe and what they must hand back.

### 3.1 what every entry surface receives from the Globe

When a visitor clicks a pin (or clicks `READ ENTRY →` from the side panel preview):

```
navigate(routeFor(entry))

where routeFor(entry) =
  article  → /entries/<fileNum>
  photo    → /photos/<roll>/<id>
  fiction  → /fiction/<slug>
```

Route receives nothing in URL params *beyond the slug*. State the surface needs (return-coordinate, prior stratum, scroll position) lives in zustand `useGlobeStore` or session storage — Sirius decides which. β and γ specs must not assume URL params for state.

### 3.2 article entry — contract surface (β)

The article entry receives:
- frontmatter via velite (PRD-01 schema): fileNum, title, date, domain, tags, status, coords, summary, patches, share-location.
- MDX body (compiled).
- adjacent-by-tag list of related entries (computed at build).
- prev/next in chronological worldline (computed at build).

The article entry hands back to the Globe:
- a `[← back to ATLAS]` affordance that navigates `/` with `state: { returnTo: <fileNum>, stratum: 'neo' }` so the Globe can restore the visitor to where they were. Implementation note: this is reached via the Nav strip (the existing `INDEX` nav link) augmented with the back affordance.

**Surface vocabulary (β must use):** corner reticles, dashed hairline section rules, mono uppercase labels at 9px tracking 0.3em, italic Cormorant Garamond for body, `t-mono` (JetBrains Mono) for metadata. Patches log lives below the body. Related branches block reuses the ChapterIndex entry-card pattern. Header strip is structurally identical to the A.T.L.A.S. `atlas-head` element.

**β picks up:** the layout, the patches log component spec, the marginal sidenote pattern, the prev/next nav. Token compliance: must use existing globals.css tokens only (no new tokens — that's a separate eventual TASK).

### 3.3 photo entry — contract surface (γ)

The photo entry receives:
- frontmatter via velite (PRD-01 + PRD-03 schemas): roll, sourceFile, caption?, share-location, exif (derived), variants (derived), coords (derived).
- prev/next within the roll (computed at build).
- the roll's mini-map data (all photos in roll with GPS opted in).

The photo entry hands back:
- `[← back to ATLAS]` affordance — same pattern as article.
- `[contact sheet]` affordance → `/photos/<roll>` for roll context.
- film simulation propagation: the photo's `exif.filmSim` value, if present, becomes a *suggestion* for the site palette. The visitor sees a small affordance: `[match palette to CLASSIC CHROME · ⌃P]` — keyboard-toggleable. Does NOT auto-apply (visitor controls). When applied, persists to `wl:film-sim` localStorage (PRD-03 §3).

**Decision on PRD-03 open question "photos as nodes on Globe like articles? or own layer?":** **photos are nodes on the surface, alongside article pins, but visually distinguished by glyph (square vs circle) per §2.2.** They do NOT get their own stratum. Surface is shared. This matches `00-globe-ontology-1.2.md` §1.1's "co-equal strata" principle for the data layer even though the camera framings remain toggleable.

**Photo entry's "instrument readout" panel** (PRD-03 §3.3) — the EXIF block — reuses the A.T.L.A.S. readout panel vocabulary (`atlas-readout-row is-trio` pattern, mono labels). γ-Betelgeuse: do not invent a new visual language for this. The readout panel on the right of the Globe is your reference.

**Surface vocabulary (γ must use):** identical to article's (instrument frame), with two additions:
- a *film-strip border* around the photo: 4px ink-faint border with 8px paper-warm margin, evoking 35mm negative carrier sleeves. This is the only new visual element. It is consistent with the cartographer/instrument language because film leaders are themselves cartographic artifacts (sprocket holes = measured intervals). γ spec must show this with both a real heavy photograph AND an empty/loading state (the rendered-output finding N2 from REVIEW: the gradient placeholder from Claude Design's stage 03 reads as *accidentally finished* — replace with a checkered film-leader pattern when no image).
- a *roll context strip* below the photo: prev / next thumbnail at 60×60, plus `[ ⇋ FULL ROLL ]` link.

### 3.4 fiction entry — contract surface (γ-secondary or deferred)

The fiction entry receives:
- frontmatter via velite (PRD-01 fiction schema): slug, title, date, divergence (narrative α value), length, chapters?, summary.
- body MDX.

**Decision:** fiction entry is **out of v1 design wave scope.** PRD-01 includes it; PRD-02 doesn't gate on it; PRD-03 explicitly defers fiction-on-Globe. The fiction reading template needs its own minor spec (TASK in a later wave). For v1, fiction is reachable via:
- a `FICTION ARCHIVE` link in `ChapterIndex`'s list view (which γ may not write — `[Polaris: assign separately]`)
- NETRA's `list_fiction()` tool call (δ wires this)

`[Peat: confirm fiction can wait one wave]`

### 3.5 surface vocabulary that all entry surfaces share

To prevent drift across β/γ specs:

- **Header strip** — single contract spec. Atoms: corner reticle (top-left), file/date/status/read-time meta row, navigation crumb (`◇ INDEX · ◇ TRACES · ◇ ARCHIVE · ◇ TRANSMIT` from `Nav.tsx`), `A 1.130426 · NAV STANDBY` readout (right side). The right-readout has TWO states only: `NAV STANDBY` (no active NETRA) and `NAV NETRA` (NETRA active). The lock pill variant in stage 01 vs the text-only variant in stages 02/08/11 (REVIEW finding N1) is RESOLVED to: **always text, never pill**. β/γ both use text-only.
- **Section rules** — 1px dashed `var(--ink-dashed)` between major sections. Never solid.
- **Pullquote** — italic Cormorant 24px, indented 32px left, with a left vertical hairline (`1px solid var(--accent-orange)`).
- **Code block (article only)** — shiki via rehype-pretty-code, paper-aesthetic theme. β spec includes the theme tuning.
- **Patches log block** — `--paper-warm` surface, mono 11px lines, format `PATCH NN · YYYY.MM.DD — single-line note`. Ordered list semantically (`<ol>`).
- **Footer / next-prev nav** — single row, `← PREV in chronological worldline · NEXT →`.

---

## 4 · NETRA chat placement — GAP-D

The floating "N" button (visible bottom-left at every viewport, including 375px mobile) is the single entry point. PRD-05 recommends "dedicated ATLAS stratum" as the chat surface (a fifth stratum: `chat`); offers "slide-in panel" as alternative.

### 4.1 DECISION — overlay drawer from the right, not a fifth stratum

**Rationale:**
- A fifth stratum requires changing `WorldlineGlobe.tsx` (adding chat state to the STRATA record, camera framing, voice line) — Polaris explicitly excludes Globe rewrites from this design wave.
- A fifth stratum forces the chat to live ONLY when the Globe is on screen. The N button is visible everywhere; the chat surface should be too. From an article entry page, from a photo roll, from `/colophon` — N should open chat.
- A right-edge overlay drawer matches the existing in-Globe article side panel (which already slides from the right at 520ms cubic-bezier(.2,.8,.2,1) per `WorldlineGlobe.tsx` lines 1246–1248). Sirius reuses that motion contract verbatim.

### 4.2 placement spec

When N is tapped/clicked:
1. A `min(420px, calc(100vw - 32px))` wide drawer slides in from the right edge of the viewport.
2. On desktop the drawer overlays the right ~35% of the Globe (when Globe is present) but does NOT dismiss the Globe state — visitor can still see the stratum buttons on the left + the bottom NETRA voice console.
3. On mobile (≤600px) the drawer takes the full viewport width and the N button moves into the drawer header as the close affordance.
4. The drawer has three regions:
   - **Header** (60px): `◎ NETRA` label · live `α 1.130426` readout · `✕ ESC` close
   - **Thread body** (flex-1, scrollable): chat messages, NETRA's italic lowercase register, tool-call status lines as instrument readouts
   - **Composer** (auto-height up to 30%): input field + send button, with rate-limit remaining count `[ 47 / 50 today ]` to the right of send

### 4.3 NETRA knows Globe state

When invoked from inside the observatory:
- The system prompt receives a hidden context block on the first message of each session:
  ```
  // observer context
  // active stratum: <current stratum key>
  // selected pin: <fileNum or null>
  // active palette: <film sim key or 'provia'>
  ```
- NETRA can reference this context naturally: `"you're looking at the surface archive. 047 patches anchored. ask me which ones cluster."`
- Arcturus (δ-S1) owns this context-injection design. The contract is: Globe state flows IN via a `useGlobeStore` zustand selector → the chat composer reads it → passes through `/api/chat` request body as a `context` field → system prompt template interpolates.

### 4.4 refusal routes

PRD-05 already specifies the refusal taxonomy in NETRA's voice rules ("outside the worldline. no signal." / "the archive is what i can speak to."). On refusal:
- NETRA stays in the chat drawer (does NOT close).
- A small chip below the refusal: `[← back to ATLAS]` — keyboard `Esc Esc` (double-tap) closes the drawer and returns focus to the Globe.
- Single `Esc` just clears the composer. Double `Esc` closes the drawer.

### 4.5 mobile chat specifics

- Input field positioned ABOVE the mobile keyboard via `dvh` units (`position: fixed; bottom: 0;` does not work reliably with virtual keyboards on iOS Safari — use `interactive-widget=resizes-content` viewport meta + `100dvh` height container).
- Composer keeps focus when sending (don't blur — keyboard stays open for follow-up messages).
- Send button minimum 44×44 px touch target.

---

## 5 · Fallback list access — M5/M6

### 5.1 DECISION — ChapterIndex and AttractorFields stay below-the-fold on desktop; they become the *primary* surface on mobile

**On desktop (≥881px):**
- Globe is the primary surface (fills the fold).
- ChapterIndex is reached by scrolling past the Globe. A subtle affordance at the bottom-right of the A.T.L.A.S. footer: `[ ↓ AS LIST ]` — internal anchor link to `#chapter-index`. New affordance to add (small, low-priority — not a button, just an underlined mono link). Sirius adds this to `atlas-foot` in the A.T.L.A.S. frame.
- AttractorFields stays below ChapterIndex. A `[ ⌕ FILTER BY FIELD ]` mono link beside `[ ↓ AS LIST ]` in the same A.T.L.A.S. footer anchors directly to it.

**On mobile (≤880px):**
- Globe is *secondary* (see §7).
- ChapterIndex IS the primary surface — it appears immediately below the HeroBlock title and counts stack.
- AttractorFields renders below ChapterIndex.
- A `[ ↑ GLOBE VIEW ]` affordance at the top of ChapterIndex lets the visitor scroll back UP to the Globe (which on mobile is a shrunken or replaced version per §7).

### 5.2 the left rail does NOT get a list-view toggle

The stratum chooser stays purely as the stratum chooser. Mixing in a `[LIST]` toggle there would dilute its role (the stratum chooser is about *spatial framing*; list-view is about *list-form access*). The two are reached separately.

`[Peat: confirm or redirect — alternative is a small `[ LIST ]` link in the A.T.L.A.S. head bar, beside the stratum buttons]`

---

## 6 · Audience Fork reframing — cancels stage 02 from Claude Design

### 6.1 DECISION — confirm: the Globe's stratum chooser IS the fork

The original PRD-02 designed a hard fork screen post-boot: two columns, `SURVEY BY CRAFT` vs `SURVEY BY TRACE`, with explicit `NAVIGATE Ne0 →` / `NAVIGATE NeX →` buttons. Claude Design's stage 02 implemented this.

The live PoC does not have it. **And it shouldn't.** Here's why:

- A hard fork screen says: "the site has two different shapes." It doesn't. Both audiences see the same Globe, same ChapterIndex, same AttractorFields. Curation differs subtly.
- The stratum chooser already names the choice: Ne0 (surface archive, work-history-flavored) vs NeX (possibility field, exploration-flavored). A recruiter who reads the meter and the strata understands which feels like their path. A trace-curious visitor does too.
- A hard fork before the visitor has seen *anything* is friction. The site is small and intimate; making the visitor declare an identity before they've looked is the wrong shape.

**Verdict:**
- **Stage 02 (Audience Fork screen) is DISCARDED** (see §9).
- PRD-02's *curation map* (HeroBlock tagline, ChapterIndex ordering, AttractorFields default, Nav order, ATLAS default stratum) still has value — it's preserved as **a passive default-active rule keyed on the visitor's first stratum choice in the session**, not as a screen. If the visitor picks Ne0 first, the curation tilts toward the craft path for the rest of the session (ChapterIndex ordering, AttractorFields default). If they pick NeX first, it tilts toward trace. If they never enter a stratum, it stays neutral (chronological).
- **No localStorage persistence of audience path.** Each session is fresh.

`[Peat: confirm or redirect — this is the biggest decision in this doc and the one most likely to be revised. If you want a hard fork screen, this entire section flips back to PRD-02 as written.]`

### 6.2 first-time vs returning — what differs

**First-time:**
- Boot sequence runs (~2.5s calibration).
- HeroBlock title + meter visible.
- Globe lands in ALL (FULL · Ne0EX) stratum. Auto-rotating slowly. The slow rotation is a soft invitation to look without demanding interaction.

**Returning (visit 2+):**
- Boot skipped (`wl:boot-seen` check).
- HeroBlock identical.
- Globe lands in ALL. No memory of prior stratum choice.

The ONLY difference is whether boot plays. Everything else is the same. The intimacy of the site is that it does not pretend to know you.

`[Peat: confirm or redirect — alternative is "Globe lands in the last-visited stratum, but only for that session"]`

---

## 7 · Mobile collapse strategy — GAP-E

This is the largest concrete gap. Evidence:

- `main-880x900-fold.png` shows the Globe block does not reach above the fold; only Nav + a faint "FILE — 000 / GENESIS" appears.
- `main-600x900-fold.png` same.
- `main-375x900-fold.png` shows the fold is *empty paper* with just the N button.

The `lg:` Tailwind breakpoint (1024px) in `HeroBlock.tsx` hides the counts stack AND the compact DivergenceMeter below it. Combined with the Globe's own large vertical footprint, mobile users see nothing on the fold.

### 7.1 DECISION — mobile is list-primary with Globe peek

| breakpoint | behavior |
|---|---|
| ≥1024px (lg+) | full A.T.L.A.S. frame · Globe is the fold · 3-column layout intact · counts stack + compact DivergenceMeter visible in HeroBlock top strip |
| 881–1023px | A.T.L.A.S. frame compacts: left rail (stratum chooser) drops to a horizontal pill row above the Globe; right readout drops to a horizontal pill row below the Globe; Globe canvas takes 100% width; HeroBlock counts stack hides (acceptable density loss); DivergenceMeter compact stays |
| 600–880px | **Globe replaced by a 280px-tall "ATLAS · STANDBY" placeholder card** with the meter reading and a `[ OPEN ATLAS ↗ ]` button that routes to a dedicated `/atlas` page where the Globe gets a full-viewport instance. Below the placeholder on `/`: ChapterIndex IS the fold-primary surface. AttractorFields follows. |
| 375–599px | identical to 600–880px but with tighter padding (px-4 instead of px-7) and the ATLAS placeholder card shrinks to 220px tall |

### 7.2 the ATLAS placeholder card (mobile-primary breakpoints)

```
┌──────────────────────────────────────────┐
│ ┌─┐                                       │
│ └─┘  WORLDLINE 1.130426                   │
│      ATLAS · STANDBY · 047 surveyed       │
│                                            │
│      α 1.130426 · drift -1.300            │
│                                            │
│      [ OPEN ATLAS ↗ ]    [ ↓ AS LIST ]    │
└──────────────────────────────────────────┘
```

- Same visual vocabulary (corner reticles, mono uppercase, ink-on-paper). Reuses A.T.L.A.S. head atom.
- Two CTAs: open the Globe in a dedicated route (full-viewport), or scroll down to the list.
- This avoids loading Three.js entirely on the mobile-primary fold — perf win.

### 7.3 the /atlas route (mobile-primary breakpoints only — desktop falls back to `/`)

- Full-viewport Globe instance.
- The stratum chooser becomes a bottom-sheet drawer (tap to expand).
- The article side panel becomes a full-viewport modal on pin tap.
- NETRA voice strip stays at the bottom.
- `[ ← BACK ]` returns to `/` (with the visitor's session preserved).

### 7.4 touch interactions on the Globe

- Single-finger drag → orbit (ALL and NeX strata only — same constraint as desktop).
- Single-finger tap on a pin → select + camera fly + show modal.
- Pinch-zoom is **disabled** for v1 (Three.js camera zoom adds a vector the visitor cannot reverse with reduced motion). The four stratum framings give discrete zoom levels. `[Peat: confirm or redirect — alternative is enable pinch with a clear "reset framing" affordance]`
- Two-finger drag is reserved (no-op) so it doesn't conflict with system gestures.

### 7.5 the floating N button on mobile

- Stays bottom-left, 56×56px touch target (already correctly sized in PoC).
- On `/atlas` route, it moves to top-right of the chat drawer when chat is open.
- Drawer overlays the Globe → drawer dismiss returns to Globe state preserved.

---

## 8 · Search affordance — GAP-F

PRD-04 specifies `/` hotkey opens a search overlay with two simultaneous views (results list + mini-globe pin map). Placement options: in NETRA, in top bar, inline on Globe, dedicated route.

### 8.1 DECISION — top-bar affordance + `/` hotkey + overlay panel · not in NETRA · not on Globe

- A small `⌕` glyph + label `TRIANGULATE` added to the Nav strip's right side (after the existing `⊹ TRANSMIT` link). Same mono uppercase rhythm as existing nav links.
- `/` keypress (when no input is focused) opens the search overlay.
- The overlay is a *full-page modal* (not a drawer like NETRA — search needs the full canvas to show both list + mini-globe).
- ESC closes.

**Why not in NETRA:** PRD-04 calls for keyboard-driven, instant, no-AI search. Bundling it into NETRA conflates two flows (the chat is for synthesis; search is for retrieval). Keep them separate UI-wise, even if NETRA's `search_entries` tool internally reuses the Pagefind index.

**Why not on the Globe:** the search experience needs results-list + map. Trying to project that into the existing A.T.L.A.S. frame would crowd it. The dedicated overlay can be its own composition.

**Why not a dedicated route:** `/search?q=...` is fine to support (deep-link friendly), but the *primary* affordance is the overlay. Pressing `/` from anywhere should not navigate away — it should open over the current page.

### 8.2 mini-globe in search

PRD-04 §3 recommends SVG orthographic mini-globe (not a Three.js mini-instance). Confirmed — that's the right call. The mini-globe is a *map preview*, not an interactive instrument. SVG is lighter and matches the cartographer aesthetic without dragging Three.js into yet another route.

### 8.3 search on mobile

- The Nav strip's `⌕` glyph is reachable on mobile (Nav is responsive).
- `/` hotkey is desktop-only by definition (no `/` key on mobile soft keyboards).
- Overlay collapses on mobile per PRD-04: results list above, mini-globe below.

---

## 9 · Inventory · Claude Design stages 01–13

Verdict legend:
- **ADOPT** — keep as designed; per-surface spec proceeds from it
- **ADOPT-WITH-REVISION** — keep the structure, fix specific issues (named below)
- **REINVENT** — discard the proposed design; replace with a pattern derived from the running PoC
- **DISCARD** — drop entirely; the gap it tried to fill is no longer a gap (or filled differently)

| # | label | verdict | reason | what replaces it (if anything) |
|---|---|---|---|---|
| 01 | Article Entry (EN) | **ADOPT-WITH-REVISION** | structural elements (header strip, patches log, related branches, sidenotes) match PRD-01 and reuse running PoC vocabulary. Revisions: (a) responsive must be authored at 880/600/375; (b) header right-readout normalized to text-only "NAV STANDBY/NETRA" — never pill (REVIEW finding N1); (c) all raw rgba inlines replaced with existing `--ink-*` and `--paper-*` tokens (REVIEW finding #2); (d) Thai font wiring deferred (REVIEW finding #5) — Thai variant out of v1 | β (TASK-09) writes the spec |
| 01B | Article Entry (Thai) | **DISCARD-FOR-V1** | `--font-thai` not wired in codebase; Procyon dependency. Cut from current wave. Re-cut as a later TASK once Noto Serif Thai is wired through `next/font` and Polaris approves the token name | — |
| 02 | Audience Fork | **DISCARD** | the stratum chooser IS the fork (§6). No hard fork screen | curation map preserved as session-passive default (§6.1) — no UI surface needed |
| 03 | Photo Entry / Atlas | **ADOPT-WITH-REVISION** | structural intent matches PRD-03 §3.3 (instrument readout for EXIF, roll context strip). Revisions: (a) the gradient placeholder reads as accidentally finished (REVIEW finding N2) — spec must show both a real image AND an empty/loading state with a checkered film-leader treatment; (b) film-strip border is the only new visual element allowed; (c) responsive 880/600/375 authored; (d) film-simulation toggle is a *suggestion* not auto-apply (§3.3 of this doc) | γ (TASK-10) writes the spec |
| 04 | Triangulate Search | **ADOPT-WITH-REVISION** | layout (left list + right mini-globe) matches PRD-04. Revisions: (a) mini-globe is SVG orthographic, not Three.js mini-instance; (b) overlay opens via `⌕` nav link OR `/` hotkey, full-page modal not drawer; (c) responsive collapses mini-globe below list at ≤600px | a later TASK after δ closes — search depends on Pagefind index being built |
| 05 | NETRA Chat | **REINVENT** | PRD-05 proposed a fifth ATLAS stratum; Claude Design's stage 05 implemented that. **§4 of this doc reverses that decision** — chat is a right-edge overlay drawer, not a fifth stratum. The composer + thread structure can be salvaged | δ-S2 (TASK-11 Betelgeuse chat UI) writes the spec from §4 |
| 06 | Ne0 Index — Log | **DISCARD** | overlaps existing `ChapterIndex.tsx`. The PoC list IS the index. No second route needed | `ChapterIndex.tsx` already serves this role |
| 07 | Ne0 Index — Feed | **DISCARD** | second variant of #06; pick one only. Even if Peat wanted both renderings, ship one. The PoC's chronological table is closer to the Log variant — keep that mental model | — |
| 08 | NeX Contact Sheet | **DEFER** | photo-related; structurally distinct from #09 (REVIEW opus pass N3 says both are defensible as orthogonal projections). v1 ships γ photo entry + roll page (PRD-03 §3.2 `/photos/<roll>`) which is the contact-sheet surface. The "NeX" framing is a stratum chooser interaction, not a separate route | `/photos/<roll>` (per PRD-03) fulfills this; γ writes the spec |
| 09 | NeX Index Board (scatter) | **DEFER** | high novelty; second projection of photo data on CEREBRAL↔SENSORY × FRESH↔AGED axes. REVIEW opus pass upgraded its standing (N3 says it coheres better than feared) but it is NOT load-bearing for v1. Keep as a parked experiment | — for v1 |
| 10 | Boot · Calibration | **ADOPT-WITH-REVISION** | partial existing `BootSequence.tsx` covers this; stage 10 adds the triangle-graph (NeO / NeON / NeX vertices with labeled edges). The triangle is beautiful and load-bearing for the worldline metaphor. Revision: at <880px the triangle dominates and side columns collapse to a single stack below it (REVIEW finding N4) | a later TASK; not in current design wave |
| 11 | Boot · Scrubber | **ADOPT-WITH-REVISION** | same as 10 — `BootSequence.tsx` partial coverage exists. Scrubber is the second beat in the boot animation. Same responsive note as 10 | a later TASK; not in current design wave |
| 12 | Boot · Complete (numbering collision with Return · Bookmark) | **ADOPT-WITH-REVISION** | rename to avoid collision; same revision notes as 10/11 | a later TASK |
| 12* | Return · Bookmark | **DISCARD** | M-RETURN decision (§1) — no return dashboards in v1. The Globe is the return-visit signal | — |
| 13 | Return · Revisit | **DISCARD** | same as 12*; also has hierarchy-weak header stacking (REVIEW finding N7) | — |

### 9.1 summary: what the design wave actually ships

After this inventory, the design wave ships specs for **three surfaces** in the immediate next round:

1. **β · article entry** (TASK-09 · Betelgeuse · sonnet) — derives from stage 01 ADOPT-WITH-REVISION
2. **γ · photo entry + atlas integration** (TASK-10 · Betelgeuse · sonnet) — derives from stage 03 ADOPT-WITH-REVISION + PRD-03 globe pin glyph
3. **δ · NETRA prompt + chat UI** (TASK-11 · Arcturus opus S1 + Betelgeuse sonnet S2) — Arcturus owns the prompt architecture per PRD-05; Betelgeuse writes the right-edge drawer chat UI per §4

Search (#04), boot variants (#10/11/12), and the Globe mechanics enhancements (hover preview, photo/fiction glyphs) are **logged as next-wave TASKs**. The fork screen (#02), index variants (#06/07), and return dashboards (#12*/13) are **closed.**

---

## 10 · Anti-Codex rule audit — 6-point gauntlet per decision

For each major decision above, six checks. ✓ pass · ✕ fail · ⚠ partial / needs follow-up.

### decision matrix

| § | decision | 1 ref fidelity | 2 token compliance | 3 pattern reuse | 4 a11y | 5 mobile | 6 motion |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 (M1) | no hard fork screen on first visit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 1 (M2-M4) | stratum chooser + side panel preview + entry page navigation | ✓ | ✓ | ✓ | ⚠ (off-canvas pin list TBD by Sirius) | ⚠ (depends on §7) | ✓ |
| 1 (M-RETURN) | minimum return state · no dashboards | ✓ | n/a | ✓ | ✓ | ✓ | ✓ |
| 2.2 | photo = square glyph; fiction = diamond | ✓ | n/a (color tokens only) | ✓ (reuses existing pin pattern) | ✓ (off-canvas list lists by kind) | ✓ | ✓ |
| 2.3 | two-step entry: side panel preview → full entry page | ✓ | ✓ | ✓ | ✓ | ⚠ (full-modal on mobile) | ✓ (reuses 520/320ms contract) |
| 2.5 | off-canvas pin list for keyboard a11y | ✓ | ✓ | ✓ (HTML standard pattern, no new vocab) | ✓ | ✓ | ✓ |
| 3.1 | route shape `/entries/<fileNum>` etc | ✓ | n/a | ✓ | ✓ | ✓ | n/a |
| 3.3 | film-strip border + roll-context strip | ✓ | ⚠ (needs `--ink-faint` and `--paper-warm` — both exist) | ✓ (new but tiny vocabulary, anchored in cartographer/instrument language) | ✓ | ✓ | ✓ |
| 4.1 | NETRA chat as right-edge drawer, NOT 5th stratum | ✓ | ✓ | ✓ (reuses 520ms drawer motion from existing side panel) | ✓ | ✓ (full-width on ≤600px) | ✓ |
| 4.3 | Globe state flows in via zustand context | ✓ | n/a | ✓ (consistent with existing zustand usage in PRD-02/05) | ✓ | ✓ | n/a |
| 4.5 | mobile composer uses dvh + interactive-widget | ✓ | n/a | ✓ (web standard) | ✓ | ✓ | ✓ |
| 5.1 | ChapterIndex below fold desktop, primary mobile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 5.1 | `[ ↓ AS LIST ]` mono link in A.T.L.A.S. footer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 6.1 | discard hard fork; curation as session-passive default | ✓ | n/a | ✓ | ✓ | ✓ | ✓ |
| 7.1 | mobile breakpoint table · Globe shrinks at 881–1023, replaces at 600–880, replaces tight at 375–599 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 7.2 | ATLAS · STANDBY placeholder card | ✓ | ✓ | ✓ (reuses head atom) | ✓ | ✓ | ✓ (no motion) |
| 7.3 | `/atlas` route for mobile full-viewport Globe | ✓ | ✓ | ✓ | ⚠ (back-button history TBD by Sirius) | ✓ | ✓ |
| 7.4 | pinch-zoom disabled on Globe | ✓ | n/a | ✓ (matches reduced-motion ethos) | ✓ | ⚠ (visitor expectation friction — note for QA) | ✓ |
| 8.1 | search affordance: top-bar `⌕` + `/` hotkey + full-page modal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (200ms fade) |
| 9 | inventory verdicts | ✓ | n/a | ✓ | n/a | n/a | n/a |

### audit summary

- No FAILs (✕). Three partials (⚠) flagged for Sirius implementation attention:
  - Off-canvas pin list a11y (§2.5) — Sirius confirms keyboard reach works end-to-end during implementation
  - Full-modal entry on mobile (§2.3) — Sirius decides modal mechanics (route-as-modal vs in-place)
  - Back-button history for `/atlas` route (§7.3) — Sirius uses `router.back()` or session-stack
- One ⚠ flagged for QA (Algol): pinch-zoom disabled may surprise mobile visitors (§7.4). Algol's QA pass should test reduced-motion specifically since Three.js camera moves are 1100–1400ms and reduced-motion users should hit 0ms cuts.

### anti-Codex headline: this spec passes its own gauntlet

Every decision either reuses an existing vocabulary atom from the running PoC (corner reticles, dashed hairlines, mono uppercase 9px 0.3em, italic Cormorant, `atlas-head` / `atlas-hud` / side panel motion) or extends it minimally (square pin glyph, diamond pin glyph, film-strip border, ATLAS · STANDBY placeholder). No new design tokens are proposed (per Polaris constraint). No raw hex/rgba values are introduced.

---

## 11 · what each downstream TASK picks up

This is the operational handoff Polaris asked for explicitly — what β/γ/δ each inherit.

### β · TASK-09 · article entry (Betelgeuse · sonnet)

Picks up from §3.2 (article contract), §3.5 (shared vocabulary), §9 row 01 (revisions to stage 01), and §10 audit row 3.3.

Specific deliverables in β spec:
- header strip component spec (single contract per §3.5 — text-only right readout, no pill)
- body / sidenotes / pullquote / codeblock layout
- patches log component spec (semantic `<ol>`, mono 11px, warm paper surface)
- related branches block (reuses ChapterIndex card pattern)
- prev/next chronological nav
- responsive collapse at 880 / 600 / 375 (REVIEW's upgraded-to-critical finding)
- token compliance audit appendix (grep for raw rgba; replace with existing globals.css tokens)
- accessibility map (keyboard, focus order, skip-link, screen reader text for the patches log revision history)

Out of β scope: Thai variant (deferred), photo embedding in articles (note this as open question — PRD-01 §open-questions has it).

### γ · TASK-10 · photo entry + atlas integration (Betelgeuse · sonnet)

Picks up from §2.2 (square glyph), §3.3 (photo contract), §3.5 (shared vocabulary), §9 row 03, and §10 audit rows 2.2 + 3.3.

Specific deliverables in γ spec:
- photo entry layout (full-bleed photo with film-strip border, instrument-readout block reusing `atlas-readout-row` pattern, roll context strip)
- empty/loading state (checkered film-leader pattern — REVIEW N2 finding)
- `/photos` roll index layout (per PRD-03 §3.2)
- `/photos/<roll>` single-roll layout with contact sheet + mini-map (mini-map is SVG, not Three.js)
- film-simulation suggestion affordance (`[ match palette to CLASSIC CHROME · ⌃P ]` — keyboard toggle, no auto-apply)
- responsive collapse at 880 / 600 / 375
- the Globe-side change spec: square glyph extension to `pinObjects` discriminated by `kind`. This is a *spec for Sirius to extend WorldlineGlobe.tsx*; γ describes the visual + interaction, Sirius implements.

Out of γ scope: fiction entry surface (deferred per §3.4); NeX Index Board scatter projection (deferred per §9 row 09).

### δ-S1 · TASK-11 · NETRA prompt + tool surface (Arcturus · opus)

Picks up from §4.3 (Globe state flowing into prompt context), §4.4 (refusal routes), §10 audit row 4.3, and PRD-05 in full.

Specific deliverables in Arcturus's spec (per Arcturus's own contract — Betelgeuse doesn't write the prompt itself):
- system prompt finalization (italic / lowercase / terse register)
- tool definitions and result shapes (compact, link-out)
- refusal taxonomy ("outside the worldline. no signal." / "the archive is what i can speak to." / etc.)
- context-injection mechanism for Globe state (stratum, selected pin, palette)
- rate-limit response copy (`α drift exceeded · NETRA dormant until next worldline.` per PRD-05 cost ceiling discussion)

Out of δ-S1 scope: chat UI design (that's S2).

### δ-S2 · TASK-11 · chat UI (Betelgeuse · sonnet)

Picks up from §4 (placement, motion, regions), §7.5 (mobile N button positioning), §10 audit rows 4.1 + 4.3 + 4.5.

Specific deliverables in δ-S2 spec:
- right-edge overlay drawer layout (420px max width desktop, full viewport mobile)
- three regions: header / thread / composer
- motion contract (520ms slide-in cubic-bezier(.2,.8,.2,1) — REUSE from existing side panel)
- tool-call status line treatment (instrument readout, `NETRA · surveying archive ───── resolved: 3 entries`)
- streaming response rendering with italic Cormorant
- composer behavior (mobile keyboard handling, send button 44×44 minimum, rate-limit pill display)
- a11y (focus trap inside drawer, ESC-to-clear vs ESC-ESC-to-close, screen reader announcements for streaming tokens)
- N button state transitions (resting → drawer-open with close affordance)

Out of δ-S2 scope: the prompt itself (Arcturus); the search overlay (deferred to its own TASK).

---

## 12 · non-goals of this document

- Do not propose new design tokens (per Polaris constraint).
- Do not write per-surface specs (β/γ/δ do that).
- Do not modify any component.
- Do not assume the Three.js Globe is rewritten — every decision is *around* the existing Globe.
- Do not resolve the ontology-v1.3 vs running-Globe divergence (strata co-equal vs toggleable). That's a Polaris→Peat conversation. This doc records the as-shipped behavior.
- Do not specify boot sequence revisions — Boot is partially built; the Boot revision TASK is a separate later wave.
- Do not specify search overlay surface in full — only the placement decision (§8). The search spec is its own future TASK.

---

## 13 · open items flagged to Peat

The following decisions are tagged `[Peat: confirm or redirect]` throughout. Listed here for fast review:

1. §1 M1 — no hard fork screen (entire PRD-02 reframe)
2. §1 M6 — AttractorFields ↔ Globe two-way binding deferred to a later wave
3. §1 M-RETURN — no return dashboards in v1
4. §2.2 — fiction-on-Globe deferred for v1 (only article + photo glyphs land)
5. §3.4 — fiction entry surface waits one wave
6. §5.2 — left rail stays purely as stratum chooser; alternative is a `[LIST]` link in the A.T.L.A.S. head bar
7. §6.1 — discard PRD-02 fork screen entirely (biggest single decision; most likely to be revisited)
8. §6.2 — Globe lands in ALL on every visit; alternative is remember-last-stratum-per-session
9. §7.4 — pinch-zoom disabled on mobile Globe

Any one of these can flip; the rest of the doc would re-thread cleanly.

---

*betelgeuse · α-VIS-04 · the Red Sentinel · TASK-2026-05-15-08 · opus tier · journey-architecture v1.0*
