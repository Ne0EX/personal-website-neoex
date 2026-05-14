# REVIEW · Worldline Pages v1 · 2026-05-14

**reviewer** · Betelgeuse · α-VIS-04 · the Red Sentinel
**source** · `Worldline Pages v1.html` (handoff bundle from Claude Design)
**scope** · all 13 artboards in the bundle EXCLUDING Hero/Globe (per Peat)
**verdict** · NOT READY for Sirius implementation as-is · structural issues + token system conflict · revise required before per-surface specs are written
**operating tier** · Opus 4.7 high effort (session-level; not a per-task escalation — Polaris's authority unchanged)

---

## what this design is

Single 2481-line HTML/CSS/JS prototype with 13+ stage artboards, fixed 1180×760 each, designed in a "Figma frame view" style. Token system declared at `:root`. React+Babel runtime included but the file reads as static comps. The artboards represent intended surfaces:

| # | label | maps to PRD | status in current codebase |
|---|---|---|---|
| 01 | Article Entry (EN) | PRD-01 entry pages | not yet built |
| 01B | Article Entry (Thai) | PRD-01 + Thai locale | not yet built; no `--font-thai` wired |
| 02 | Audience Fork | PRD-02 | not yet built (this was once TASK-2026-05-13-01 in older notes) |
| 03 | Photo Entry / Atlas | PRD-03 | not yet built |
| 04 | Triangulate Search | PRD-04 | not yet built |
| 05 | NETRA Chat | PRD-05 | not yet built |
| 06 | Ne0 Index — Log | (not in PRDs cleanly) | overlaps current `ChapterIndex.tsx` |
| 07 | Ne0 Index — Feed | (not in PRDs cleanly) | overlaps current `ChapterIndex.tsx` |
| 08 | NeX Contact Sheet | photo-related | new |
| 09 | NeX Index Board (scatter) | photo-related | new — high novelty |
| 10 | Boot · Calibration | observer onboarding | partial · current `BootSequence.tsx` |
| 11 | Boot · Scrubber | observer onboarding | partial · current `BootSequence.tsx` |
| 12 | Boot · Complete | observer onboarding | partial · current `BootSequence.tsx` |
| 12* | Return · Bookmark | return-user welcome | new |
| 13 | Return · Revisit | return-user welcome | new |

(Label collision at 12 between "Boot Complete" and "Return Bookmark" — bug in the design's own numbering.)

---

## anti-Codex gauntlet (6 checks)

### 1 · reference fidelity — **PARTIAL PASS**

Article entry has the patches log, related branches, header strip, coordinate readout, status pill — all promised structural elements present. Three-column meta/body/aside is correct. Sidenotes hang in margin. Pullquote and codeblock are styled. **Reference fidelity at the article level is genuinely good.**

But: every surface assumes a fixed 1180×760 frame. **There is zero responsive behavior shown.** Below 880px and below 600px are unaddressed — the persona spec template requires both. Without this, "reference fidelity" only holds at desktop.

### 2 · token compliance — **FAIL · 50+ raw rgba/hex values outside the palette block**

The `:root` declares clean tokens, but the rest of the stylesheet leaks raw values constantly. A non-exhaustive count from a quick grep:

- `rgba(26,40,50,...)` (raw ink) appears ~30+ times for borders, dashed dividers, surfaces — every one of these should be `var(--ink-dashed)` / `var(--ink-faint)` / etc.
- `rgba(212,96,42,...)` (raw orange) appears ~10+ times for hover backgrounds, faint glows — should be `var(--orange-faint)` / `var(--orange-faint)` mixes.
- `rgba(232,226,213,...)` (raw paper) appears ~5+ times for translucent paper overlays — should be `var(--paper-bright)` at a documented alpha.
- `rgba(26,24,21,...)` (a black that is NOT in the palette at all) appears ~6+ times in the photo frame for film-stamp backings — this is a NEW color introduced inline.
- `#d3cdbf`, `#e0d9c8`, `#c8c1b1` (raw body-background hex) — three raw hex shades for the page backdrop. None are tokens.

This violates the project's anti-Codex contract head-on. If Sirius implements this directly, the codebase ends up with a token system that is decorative — formally declared, materially unused. The same condition that produced the Codex incident.

### 3 · pattern reuse — **CRITICAL DRIFT · token names + opacity values diverge from current site**

This is the most dangerous finding. The design declares tokens that look like the current site's tokens but **mean different things or use different names**:

| Token | Design v1 | Current `app/globals.css` | Conflict |
|---|---|---|---|
| paper base | `--paper` | `--paper-base` | NAME |
| ink | `--ink` (hex) | `--ink-primary` (via `--ink-rgb` math) | NAME + STRUCTURE |
| orange | `--orange` | `--accent-orange` | NAME |
| orange soft | `--orange-soft` at α 0.55 | `--accent-orange-soft` at α 0.18 | **SAME NAME, OPPOSITE BRIGHTNESS** |
| ink faint | `--ink-faint` at α 0.18 | `--ink-faint` at α 0.30 | SAME NAME, DIFFERENT VALUE |
| dashed | (raw rgba inline) | `--ink-dashed` at α 0.25 | MISSING TOKEN in design |
| hairline | (raw rgba inline) | `--ink-hairline` at α 0.12 | MISSING TOKEN in design |
| Thai font | `--font-thai` (Noto Serif Thai) | (not declared) | MISSING in current |

**Worst case** is the `*-soft` opacity flip: a Sirius who reads "use `--orange-soft` for the hover ring" will get a dim 18% ring in the live site versus the visible 55% ring in the design. Surfaces will look broken without any obvious error.

**Architectural mismatch** also: current site uses a `[data-palette="ink"]` selector to swap entire palette stacks (single-source palette tokens behind data-palette toggle, per commit `abceb2f`). Design v1 doesn't acknowledge the palette-switching layer. Implementing this design as-is collapses dual-palette into single-palette.

### 4 · accessibility — **NOT SPECIFIED**

The design ships no a11y annotations: no keyboard map, no focus styles (focus relies on browser default), no skip-link, no aria-labels, no reduced-motion stories, no contrast audit. The NETRA reticle pulses indefinitely — `prefers-reduced-motion` will not stop it without code changes.

Decorative dotted-grid + lined-paper overlays on every artifact will register as visual texture for Lighthouse contrast but not impair text. Acceptable.

The fork path CTA mentions `kbd` keys (1 / 2) but no keyboard handler is wired in the JSX. Aspirational, not implemented.

### 5 · mobile fidelity — **NOT EVALUABLE**

Fixed 1180×760 frame · zero breakpoint behavior · no touch target sizing. Reading at 375px viewport is impossible from this file alone. Sirius cannot implement without a separate mobile spec (or a "mobile is a separate artboard" decision from Peat).

### 6 · motion calibration — **MOSTLY PASS, ONE VIOLATION**

| Motion | Design value | Worldline spec | verdict |
|---|---|---|---|
| copy-btn hover | 180ms | 100–150ms hover | slightly slow, acceptable |
| fork-path hover | 250ms | 100–150ms hover | TOO SLOW for hover; this is selected-state pacing |
| NETRA reticle pulse | 2.4s ease-in-out **infinite** | "no looping decorative motion" | **VIOLATION** |

The reticle pulse is the kind of motion the project explicitly rejects. Either retire it or convert to a single non-looping breath on first paint.

---

## top problems · framed in priority order

1. **TOKEN COLLISION is the head wound.** Until the design's `:root` is harmonized with `app/globals.css`, every Sirius implementation will introduce drift. The fix is not optional and not cosmetic — it is the project's central contract.

2. **Raw rgba/hex spray.** Treat every inline rgba in the design as a missing token. Decide which ones become new tokens and which were always supposed to be the existing ones (`--ink-dashed`, `--ink-hairline`, an opacified `--paper-bright`, etc.).

3. **No responsive story.** The design is a desktop comps file, not a system. Either author the 880/600/375 stories as additional artboards, OR state explicitly that responsive is a separate Sirius-side concern derived from the desktop comps via documented rules.

4. **NETRA reticle pulse is the only motion violation** but it's a visible one — it's a "casino-on-the-corner" pattern (always animating) that fights the rest of the site's stillness. Replace with one-time-on-load fade-in.

5. **`--font-thai` is invented in this file and not yet wired in the codebase.** Either Procyon wires Noto Serif Thai through `next/font` and Polaris approves the token name, OR the Thai variant gets cut from v1 scope.

6. **Indexes overlap unclear.** Ne0 Index Log (06) + Ne0 Index Feed (07) feel like alternative renderings of the same data, not different routes. Ditto NeX Contact Sheet (08) + NeX Index Board (09). Need Peat's intent: are these variants of one surface (user choice or context-driven), or are they four distinct routes? Without intent, Sirius will build all four; that is probably wrong.

7. **The `12 Boot · Complete` / `12 Return · Bookmark` numbering collision is a small symptom** of the design being mid-iteration. Inventory and rename before specs are written.

---

## recommended cuts (what should not advance to per-surface specs yet)

- **NeX Index Board (scatter)** — high novelty. Either keep as a private experimental detour OR commit to it as the canonical photo-index. Don't ship both alongside a contact sheet variant; pick one.
- **Return · Revisit dashboard** — Return-user delight features should defer to after the first-time-visitor flow is solid. Bookmark variant of Return is enough for v1.
- **Both Ne0 Index variants** — collapse to one. Either Log or Feed. Choosing Log preserves the file-system feel; choosing Feed is more conventional.

---

## what I recommend next (routing decisions for Polaris)

1. **TASK · token harmonization spec** (mine + Polaris) — produce a single canonical `:root` that reconciles design v1 with current `app/globals.css`. Decide naming. Output: `docs/design/design-system.md` proper, the canonical token reference. Until this exists, no per-surface spec is sound.

2. **TASK · responsive system spec** (mine) — write the 880 / 600 / 375 stories at the system level (grid collapse rules, touch target multipliers, type scale shifts). One doc covers all surfaces; per-surface specs reference it.

3. **TASK · intent clarification with Peat** (Polaris) — resolve the index-variant ambiguity (06/07, 08/09) and the Return-variant ambiguity (12/13) before any spec is written. These are PRD-level decisions not design ones.

4. **THEN** per-surface specs in this order: Audience Fork → Article Entry (EN first, Thai once font is wired) → NETRA Chat → Photo Atlas → Boot sequence → Index → Return. This roughly matches first-time-visitor flow and progressive complexity.

---

## non-goals of this review

- Did not evaluate the Globe/Hero artboards (excluded by Peat).
- Did not evaluate Ne0EX OMNI / Ne0EX Wireframes — different scope from "Worldline Pages."
- Did not read the chat transcripts in the bundle (harness blocked them as untrusted external content; Peat can summarize intent directly if needed).
- Did not render the file in a browser; per the bundle README, source-reading is preferred.
- Did not propose specific token names for the harmonized system — that is the work of the harmonization TASK.

---

## rendered-output findings (2026-05-14 pass · opus)

**reviewer** · Betelgeuse · α-VIS-04 (S2 of TASK-2026-05-14-06, per-task opus escalation)
**evidence** · 22 PNGs at `.claude/visual-diffs/TASK-2026-05-14-06/stages/` produced by Canopus S1
**scope** · second-pass verdicts on the 7 original findings + new findings only the rendered output surfaces
**method** · viewed all 13 native-viewport (1180×760) PNGs + 9 responsive PNGs (stages 01, 02, 05 at 880 / 600 / 375); appended verdicts, did not rewrite source verdicts

### top-line

Rendered evidence **strongly upholds** the source review. Every leverage finding holds; two strengthen (responsive failure and pattern-reuse drift). The most important rendered-only discovery: cross-surface consistency of the instrument frame is **better** than expected — the design's vocabulary actually *holds together* across 13 artboards, which makes the token-system drift more recoverable than I feared in the source pass. The headline correction is that the design is not incoherent at the surface level — it is coherent **as a comp**, but incoherent **as a system**, and the system layer is what Sirius would inherit.

### per-finding verdict table

| # | source finding | verdict | rationale (PNG evidence) |
|---|---|---|---|
| 1 | TOKEN COLLISION head wound | **CONFIRMED** | rendered output uses values that look correct in the bundle but collide with current `globals.css`; not visible in PNG alone, but `05-netra-chat-1180x760.png` shows orange used at exactly the brightness the bundle defines (~55% alpha for accent fills) — proves the design is calibrated against ITS palette, so rendering this against current site palette will look measurably dimmer |
| 2 | raw rgba/hex spray | **CONFIRMED** | every surface renders the dashed dividers, hairline corner reticles, and patch-log warm-paper surface — confirming the inline raw rgbas materially shape the look (not vestigial). `01-article-entry-1180x760.png` patches-log block is visibly warmer than the main paper, exactly the `rgba(232,226,213,...)` overlay the source review flagged |
| 3 | no responsive story | **UPGRADED to CRITICAL** | this is the biggest delta. See `02-audience-fork-600x760.png` and `02-audience-fork-375x760.png`: Vector B ("by trace") is **entirely off-screen**, meaning a phone user CANNOT FORK because the second path doesn't exist on their viewport. `05-netra-chat-600x760.png` clips chat bodies mid-line. `01-article-entry-600x760.png` clips article body at "tast..." — words literally truncate. Hypothesis was "no responsive story is a gap"; rendered shows it's a **showstopper for any mobile user**. Bumping this above token harmonization in the priority order. |
| 4 | NETRA reticle pulse violation | **DOWNGRADED to LOW** | first-frame PNG cannot capture pulse, BUT the reticle in `02-audience-fork-1180x760.png` (bottom right HUD), `05-netra-chat-1180x760.png` (also bottom right), `08-nex-contact-sheet-1180x760.png`, `09-nex-index-board-1180x760.png`, and the boot sequence `10-boot-calibration-1180x760.png` is **visually quiet at rest** — small, low-contrast, positioned in the corner HUD. Even if it pulses, it's the kind of micro-motion (~12px circle in the corner) that the reduced-motion convention covers easily. Source review treated this as a critical violation; rendered evidence says it's a one-line fix wrapped in `@media (prefers-reduced-motion)` and not worth re-prioritizing. |
| 5 | `--font-thai` unwired | **CONFIRMED** (untested) | Thai variant 01B was excluded from S1 capture per task contract, so no rendered evidence; verdict remains as source — must be wired by Procyon or cut from v1 |
| 6 | indexes overlap unclear (06/07, 08/09) | **CONFIRMED + sharpened** | rendered shows the four surfaces are **visually distinct enough that they cannot be one component with a view-toggle**. `06-ne0-index-log-1180x760.png` is a dense table view with status pills and read-time columns; `07-ne0-index-feed-1180x760.png` strips the table down and adds a right-rail metadata pane; `08-nex-contact-sheet-1180x760.png` is a 5×N photo grid with film-stamp metadata; `09-nex-index-board-1180x760.png` is a fully-2D scatterplot with axis labels. These are **four different mental models**, not four views of one component. Polaris needs to confirm with Peat: ship all four, or pick. |
| 7 | 12 numbering collision is a symptom | **CONFIRMED (cosmetic)** | both `12-return-bookmark-1180x760.png` and the excluded "12 Boot · Complete" share the label number; trivial rename |

### NEW findings (rendered-only · prioritized)

#### N1 · cross-surface header-strip drift — MEDIUM
The header strip (top 60px: corner reticle, file/status meta, navigation crumb, A 1.130426 readout, NAV tag) appears on 12 of 13 stages. Comparing `01-article-entry-1180x760.png`, `02-audience-fork-1180x760.png`, `08-nex-contact-sheet-1180x760.png`, `11-boot-scrubber-1180x760.png`: **the header is structurally consistent but the right-side readout drifts.**

- `01` has `A 1.130426 · ◉ LOCKED` (boxed lock pill, right of version number)
- `02` has `A 1.130426 · NAV STANDBY` (text only, two atoms)
- `08` has `A 1.130426 · NAV NETRA` (text only, two atoms)
- `11` has `A 1.130426 · NAV STANDBY`
- `12` has `A 1.130426 · ◉ LOCKED` (back to the boxed pill)

The "right side readout" is doing two jobs: status indicator (locked / standby) and contextual mode (NAV NETRA / NAV STANDBY). When this becomes a real component, Sirius will need a single contract for it. Source pass didn't notice because the pattern feels consistent in code; rendered shows the inconsistency.

**fix shape** · header-strip component spec must enumerate which atoms appear where. Not a blocker; a clarification.

#### N2 · 03 Photo Entry's striated mountain placeholder reads as accidentally-finished — MEDIUM
`03-photo-entry-1180x760.png` shows the photo viewer with a center-stage image that is **a flat horizontal gradient of three sandy tones**, no actual photographic content. In context, surrounded by a film-strip border and metadata, the gradient stripes read as a deliberate "atmospheric desert horizon" composition — they look intentional. They are not; per the design source they are an empty `<div>` with a CSS gradient.

Risk: if Sirius builds this surface and a real image is loaded, the visual weight will jump dramatically and the careful balance of the metadata panels around it will collapse. The placeholder is too well-styled for its role.

**fix shape** · photo-entry spec must show this surface with BOTH a real image (heavy visual weight, dark photograph) and an empty state (different placeholder treatment — checkered film leader, or solid grain texture, not a beautiful gradient).

#### N3 · 09 NeX Index Board coheres better than expected — POSITIVE / no change
The source pass flagged 09 as "high novelty, recommend cut." Rendered `09-nex-index-board-1180x760.png` shows a sophisticated scatterplot with a legend, axis labels (CEREBRAL↔SENSORY, FRESH↔AGED), and a focused-item right-rail. It reads as **a genuine instrument**, not a gimmick. The dashed-grid plot area and labeled axes are coherent with the rest of the site's instrument vocabulary.

I'm revising my source recommendation: **09 is keepable** if Peat wants the dual contact-sheet (08) + board (09) framing as "two views into the same trace stratum." It's not novelty drift; it's a second projection of the same data. Source review said "cut one." Rendered evidence says "keep both is defensible — they're not competing, they're orthogonal."

**fix shape** · ask Peat directly: is 08+09 intended as "default contact sheet · user can switch to spatial board" (toggleable views), or "contact sheet is the surface · board is a private experiment"? Same question as N6 confirmed above for 06/07.

#### N4 · 10 Boot Calibration is the densest surface in the bundle — INFO
`10-boot-calibration-1180x760.png` is **simultaneously the most beautiful and most over-loaded artboard.** It runs a triangle-graph (NeO / NeON / NeX nodes with labeled edges), a left-side metadata column, a right-side "expected behavior" column, AND a footer HUD — at 1180×760 it works because of generous whitespace inside the triangle. At 880px (not captured per S1 contract for stage 10, but extrapolating) the triangle will need to dominate at the cost of the side columns.

This is the surface most likely to break when Sirius tries to implement it at production breakpoints. Spec must isolate the triangle as the load-bearing element and let the side columns collapse into a single below-the-triangle stack at <880px.

**fix shape** · spec note in 10-calibration spec. Not a blocker for v1 desktop.

#### N5 · type hierarchy holds at 1180px — POSITIVE / no change
On `01-article-entry-1180x760.png`, the relationship between the 38px italic Cormorant h1 ("on the architecture of taste") and the 16px serif body is correctly balanced — generous gap, no sense of either size starving the other. The 9px tracking-0.3em meta strip ("FILE", "STATUS", "READ" labels) feels appropriately quiet, sitting clearly below the body's voice. The 11px monospace patch-log lines read as instrument noise.

Source pass was honest that it couldn't verify type rhythm without rendering. Rendered evidence: **type rhythm is one of the design's strongest features.** No change needed.

#### N6 · color-on-paper grain texture reads correctly — POSITIVE / no change
Across every artboard the grain/noise overlay on the warm paper surface is present but not aggressive. Orange against paper (in `02-audience-fork-1180x760.png` accent fills, `06-ne0-index-log-1180x760.png` status pills, `12-return-bookmark-1180x760.png` cards) reads as warm-not-loud — the brightness calibration is correct. The paper grain doesn't wash out at full-viewport scale.

**This is what's at stake in the token harmonization TASK** — if the harmonized tokens flatten the alpha values to current-site defaults (0.18 vs 0.55), the orange will go from "muted instrument accent" to "barely visible afterthought." Carry this evidence into the harmonization spec.

#### N7 · 13 Return · Revisit's "worldline has drifted" composition is hierarchy-weak — LOW
`13-return-revisit-1180x760.png` opens with `worldline·has·drifted, four patches, three new entries.` as a large italic header — good. Below it, two side-by-side patch cards. The cards each have their own internal header strip + body — which means the artboard has **three header layers stacked**: page header, "drifted" sentence header, per-card header. The visual hierarchy reads as flat because every header level uses similar weight.

Source pass didn't catch this. **fix shape** · per-card headers should drop in weight (mono 9px instead of mono 11px, or italic Cormorant instead of mono) to demote them below the page-level "drifted" voice. Not a blocker; a clarification in the spec.

### responsive collapse — empirical verdict at 9 PNGs

Original hypothesis: "no responsive story." **Confirmed and upgraded.**

Specific failures observed:
- `01-article-entry-880x760.png` — usable; meta column + body fit; right-rail patches log truncates but not catastrophically
- `01-article-entry-600x760.png` — body text clips at right edge mid-word ("tast...", "differen..."); right-rail entirely gone; **unreadable**
- `01-article-entry-375x760.png` — same as 600 but worse; even the h1 clips at "on the" / "of tas..."; **broken**
- `02-audience-fork-880x760.png` — usable; both vectors visible
- `02-audience-fork-600x760.png` — **Vector B entirely off-screen** (right half of split-fork is gone); user cannot make the fork choice the entire page is built around
- `02-audience-fork-375x760.png` — Vector B gone; even Vector A button truncates ("NAVIGATE NE0 STRATU...")
- `05-netra-chat-880x760.png` — usable; chat body clips slightly on long lines but readable
- `05-netra-chat-600x760.png` — chat body clips mid-sentence ("three branches in the archive carry the co..."); send button half off-screen
- `05-netra-chat-375x760.png` — chat body shows ~5 characters per line; **completely unusable**

The CSS is **fixed-pixel layout, no fluid-grid fallback**. At 880px the design degrades gracefully (it's close enough to design width that breaks don't trip); at 600px every surface clips load-bearing content; at 375px every surface fails.

This refutes any optimistic reading that "the CSS is fluid enough to mostly hold." It is not. **Mobile is unaddressed full-stop and v1 cannot ship without an explicit responsive system spec.**

### recommendation delta for Polaris

Source review's TASK order was: (1) token harmonization, (2) responsive system spec, (3) intent clarification with Peat, (4) per-surface specs.

**Revised order based on rendered evidence:**

1. **Responsive system spec** (was #2) — promoted to #1. Without this, no surface is shippable. Rendered evidence shows mobile failure is total, not partial. This is the new head wound.
2. **Intent clarification with Peat** (was #3) — kept here. Specifically: 06/07 (Ne0 Index Log vs Feed) and 08/09 (NeX Contact Sheet vs Index Board) need Peat's decision on "toggleable views of one surface" vs "two separate routes." Rendered evidence sharpens this from "ambiguous" to "structurally distinct surfaces requiring routing decision."
3. **Token harmonization spec** (was #1) — demoted to #3. Still critical, but rendered evidence shows the design's token system is internally coherent — Sirius can implement against the design's `:root` as a stand-in while harmonization is worked through in parallel. It's not blocking the next step in the way I claimed in source pass.
4. **NETRA reticle motion** — descoped from "critical violation" to "one-line fix in the eventual NETRA chat spec." No separate TASK needed.
5. **Per-surface specs** (was #4) — kept last. Specifically the ordering: Audience Fork → Article Entry (EN) → NETRA Chat → Photo Atlas → Boot · Calibration → Boot · Scrubber → Index (Ne0 + NeX, paired pending Peat decision) → Return (Bookmark + Revisit, paired pending decision).
6. **N1, N2, N3, N4, N7 from this pass** are spec-level concerns folded into the per-surface work, not separate TASKs.

### evidence trail

- All 22 PNGs at `.claude/visual-diffs/TASK-2026-05-14-06/stages/`
- MANIFEST at `.claude/visual-diffs/TASK-2026-05-14-06/MANIFEST.md`
- Canopus S1 handoff at `.claude/handoffs/from-canopus/TASK-2026-05-14-06--to-betelgeuse.md`
- This review's source pass above (lines 1–149) remains the source-only verdict — appended, not rewritten

---

*betelgeuse · α-VIS-04 · TASK-2026-05-14-06 S2 complete · opus tier*
*routing back to Polaris with revised TASK ordering*
