# docs/design/09a-article-entry-prototype-plan.md
# Article Entry Prototype · Build Plan

> Author · Betelgeuse (α-VIS-04)
> Task · TASK-2026-05-17-ARTICLE-PLAN · opus · PAIR A with Vega
> Type · PLANNING (precedes prototype build dispatch · not implementation)
> Source spec · `docs/design/09-article-entry.md` v2.0 (frozen)
> Soul baseline · `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html` (RW-5 AMEND-9b locked)
> Pair · Pair A = ARTICLE (this) · Pair B = ARCHIVE (concurrent, separate Betelgeuse+Vega)
> Status · PLAN COMPLETE · awaiting Peat review before prototype build dispatch

---

## purpose

The v2.0 spec defines *what* the article entry surface IS. This plan defines *how the
prototype build demonstrates it* — single self-contained HTML at
`.claude/visual-diffs/<task_id>/prototype/` with vendored fonts and zero build chain, iter-1
precedent verbatim. Not the prototype — the contract under which it is built.

---

## 1 · prototype scope & boundaries

### what renders

A **single article entry** at a chosen file number, with **every section of the v2.0 spec
present and styled**:

- Scroll-meter (top, 2px, accent-orange fill, scroll-driven)
- Nav strip (mirroring iter 1 Nav vocabulary)
- Header strip (`.article-head` · OBSERVATORY + FILE + date + status + readingTime; coords row; tags row; dashed rule)
- NETRA L1 bay (4-column grid inside the header strip, below dashed rule, above section-end dashed rule)
- Body zone (Cormorant h1 + Cormorant prose at 70ch + at least one sidenote anchor with sidenote rendered in the right 220px slot at desktop, footnote-collapsed at tablet/mobile)
- Pullquote (one instance, mid-body, left-hairline accent-orange)
- Patches log (`.paper-warm-surface` cushion, semantic `<ol>`, 3 entries)
- Related branches (3 entry-card pattern cards)
- Prev/Next nav row
- Marginalia HUD (fixed right 28px, vertical, hidden ≤600)

All breakpoints functional: 1180+ / 880 / 600 / 375.

### what is NOT in the prototype

- No real route wiring (Next.js App Router not used in the prototype HTML).
- No real MDX rendering pipeline. The body prose is **inlined as static HTML** styled with the prose vocabulary. The point is visual fidelity, not Velite plumbing.
- No real Three.js / Globe (article surface has no Globe).
- No Procyon-derived `isoDate`, drift-from-α math, or shareLocation gating logic at runtime — the prototype renders the *desired states*, with one state per page if needed.
- No back-to-Globe `sessionStorage` machinery — the `← ATLAS` affordance renders as a static link, behaviorally inert.

### file structure plan

Following the iter-1-globe-v1 precedent verbatim:

```
.claude/visual-diffs/UI-ITER-2-article-v1/
├── prototype/
│   ├── index.html                ← single self-contained HTML
│   └── fonts/                    ← reused from iter-1 (symlink or copy)
│       ├── cormorant-italic-400.woff2
│       ├── cormorant-italic-500.woff
│       ├── cormorant-regular-400.woff2
│       ├── cormorant-regular-500.woff
│       ├── jetbrains-mono-var.woff2
│       └── special-elite.woff2
├── REVIEW.md                     ← my review post-build
└── (peat-ref/, test-*.png ...)   ← added during review iteration
```

**Single-HTML rule:** all CSS lives in a `<style>` block at the top of `index.html`. All
JS (scroll-meter, IntersectionObserver for patches stagger, optional NETRA voice scroll-past
swap) lives in a `<script type="module">` block at the bottom. No external CSS/JS files. This
matches iter-1 and keeps the prototype reviewable as a single artifact.

**Visual-diff task_id:** `UI-ITER-2-article-v1` — explicit successor to `UI-ITER-1-globe-v1`.

---

## 2 · open questions before prototype build

The v2.0 spec is structurally complete. The questions below are *prototype-build-specific*
— things the prototype must concretize that the spec deliberately leaves to implementation.

### Q1 · NETRA L1 reticle rendering — static text or animated?

**Spec position:** "static ◎ glyph in `var(--netra)`. Reduced-motion-safe by default (static = already reduced)." Article surface is reading-mode, no pulse.

**Q for prototype:** is the reticle a literal `◎` character, or is it the same SVG glyph used in the iter-1 NETRA console (which has the white-bishop variant)?

**Suggested answer:** literal `◎` Unicode character (U+25CE BULLSEYE), font-family JetBrains Mono, color `var(--netra)`, font-size 14px to match the prototype `.netra-id` icon size. This avoids inlining SVG, stays terse, and is what a 7.5px instrument readout would actually print. The white-bishop SVG variant is reserved for ATLAS L1 where animation matters.

### Q2 · patches log — real frontmatter or synthetic?

**Spec position:** spec defines the rendering, not the content source.

**Q:** the four existing articles in `content/articles/` all ship with `patches: []`. There are no real patches anywhere. Synthesize three for the prototype?

**Suggested answer:** synthesize a believable 3-entry patches list against article 003 (which has the richest body and metadata). The synthetic patches read like real revisions of a taste-architecture essay — content credibility for the visual test. Vega copy-request: write the three patch notes.

```
PATCH 03 · 2026.05.16 — clarified the kissaten/airport contrast
PATCH 02 · 2026.05.12 — expanded the "decorated vs tuned" section
PATCH 01 · 2026.05.07 — initial commit
```

(These are placeholder · final exact phrasing is a Vega COPY REQUEST — see §8 below.)

### Q3 · related branches — what data feed?

**Spec position:** 3–5 cards using the entry-card pattern; cards link to articles sharing a domain or tag.

**Q:** four articles exist; if the prototype renders article 003 ("architecture of taste", domain=identity, tags=[essay, identity]), articles 000 (domain=meta, tags=[genesis, meta]), 001, and 002 may or may not share tags. Render real related-branch cards or fabricate?

**Suggested answer:** render three real entry-card components against articles 000, 001, 002. Even if their tag overlap is weak, the *visual* test only needs three cards rendering the entry-card pattern. Add a small synthetic relation-strength badge if desired (e.g., "domain · identity · 2 shared tags"). For the prototype, real frontmatter avoids inventing fictional siblings. Procyon's actual relation algorithm is a later concern.

### Q4 · prev/next — real linkage?

**Spec position:** `← PREV` / `NEXT →` with file numbers.

**Q:** if prototype renders article 003, next=004 doesn't exist.

**Suggested answer:** **render prototype against article 002** (prev=001, next=003, both real — both-sides populated state, the more common future case). Article 002 has `coords: SF`, decent body, `status: ongoing` — useful state to render. Article 003 is fallback if Vega prefers a richer body.

### Q5 · NETRA L1 — `shareLocation: false` everywhere

**Spec position:** when `shareLocation: false`, NETRA L1 bay does not render.

**Q:** all four existing articles ship `shareLocation: false`. To demonstrate the NETRA L1 bay the prototype must override.

**Suggested answer:** prototype renders article 002 with `shareLocation: true` synthetic override. Inline HTML comment notes the override. The "shareLocation false" state is documented in the spec; the prototype demonstrates the loaded state (harder to validate).

### Q6 · pullquote source

**Q:** which sentence becomes the pullquote?

**Suggested answer:** Vega COPY REQUEST — Vega picks one line from article 002. Prototype placeholder: extract a strong-looking sentence verbatim; Vega refines in review.

### Q7 · scroll-past NETRA voice swap — in prototype?

**Q:** prototype implements the IntersectionObserver swap or only the static line?

**Suggested answer:** **implement.** Cheap (one observer on `#article-body`), demonstrates the behavior the spec hints at, lets Peat see the transition. If noisy in review, strip; if right, lock.

### Q8 · skip-link visibility

**Q:** vanilla HTML prototype has no Tailwind `sr-only`. Equivalent?

**Suggested answer:** reuse iter-1 inline `.sr-only` snippet (clip:rect(0,0,0,0); position:absolute). One line of CSS, established pattern.

---

## 3 · responsive checkpoints

Four target shots per the v2.0 spec breakpoint table. The prototype must visibly resolve at
each, captured for the REVIEW.md.

| breakpoint | viewport | target shots | what must read correctly |
|---|---|---|---|
| desktop | 1180×900 | header strip full / body + sidenote / patches log / related branches / prev-next / marginalia HUD visible | NETRA L1 4-column grid · sidenote in 220px right slot · marginalia vertical right · 70ch body centered |
| tablet | 880×1100 | header strip full / body with inline-footnote sidenote / NETRA L1 retained | NETRA L1 still full grid (enough space) · sidenote dropped below paragraph as footnote · marginalia still visible (per spec it hides at ≤600, not ≤880) |
| mobile | 600×900 | header strip stacked (3 rows) / NETRA L1 single-line strip / single-column patches and related-branches | header rows stack · NETRA L1 collapsed to 8px single-line strip with ellipsis on voice · marginalia hidden |
| narrow | 375×800 | px-4 padding / vertically stacked prev-next / patches list wrapping naturally | no horizontal scroll · touch targets ≥44px verifiable · NETRA L1 strip still legible |

Capture cadence: t0 (page load) for all four. Single t10 capture at desktop scrolled mid-body
to verify scroll-meter advance and patches-log stagger fade-in. Single t20 capture at desktop
fully-scrolled to verify prev/next layout. Five screenshots total in the REVIEW.md.

---

## 4 · asset checklist

### fonts

**Reuse iter-1 vendored set verbatim.** The article surface uses exactly the same three
families: Cormorant Garamond (regular + italic), JetBrains Mono, Special Elite. All six woff/woff2
files already live at `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/fonts/`. The article
prototype either symlinks that directory or copies it. Recommendation: **copy**, so the article
prototype directory is fully self-contained for review (no cross-directory dependencies).

**Thai font:** v2.0 spec non-goal explicitly states "No Thai variant. `--font-thai` not wired (Procyon dependency). Thai variant deferred. English only." Prototype matches: **English only · no Thai font vendored.**

### sample content

- **Reference article:** `content/articles/002-stride-pause.mdx`
- **Override applied for prototype:** `shareLocation: true` (so NETRA L1 bay renders)
- **Synthetic patches log:** 3 entries (Vega writes final copy)
- **Real prev:** `content/articles/001-four-pours.mdx`
- **Real next:** `content/articles/003-architecture-of-taste.mdx`
- **Real related branches:** articles 000, 001, 003

### iter-1 carry-overs (CSS classes)

The prototype's `<style>` block needs to bring forward, verbatim from iter-1 prototype, these
class definitions (the ones used on the article surface but NOT yet promoted to `app/globals.css`):

- `.frame-head` (prototype lines 467–476 — for `.article-head` rhythm)
- `.netra-console` (prototype lines 855–862)
- `.netra-id`, `.netra-id .lab`, `.netra-id .target`, `.netra-readout` (prototype lines 868–897)
- `.netra-voice .tag`, `.netra-voice .body` (prototype lines 945–953)

Globals.css already has: `.atlas-head`, `.paper-warm-surface`, `.corner-marks`, `.t-meta`,
`.t-meta-accent`, `.t-mono`, `.t-type`, `.section-rule-dashed`, `.scroll-meter`, `.marginalia`,
`.entry-glitch`. These reference correctly via the same token vocabulary.

---

## 5 · token-mention audit

Every token the v2.0 spec touches, audited against `app/globals.css`:

| token | exists in globals.css? | line | notes |
|---|---|---|---|
| `--paper-base` | YES | 19 | confirmed |
| `--paper-warm` | YES | 20 | confirmed |
| `--ink-rgb` | YES | 28 | confirmed |
| `--ink-primary` | YES | 29 | confirmed |
| `--ink-soft` | YES | 30 | confirmed |
| `--ink-faint` | YES | 31 | spec explicitly bans on functional labels — verified |
| `--ink-hairline` | YES | 32 | confirmed |
| `--ink-dashed` | YES | 33 | confirmed |
| `--netra-rgb` | YES | 36 | confirmed |
| `--netra` | YES | 37 | confirmed |
| `--netra-soft` | YES | 38 | confirmed |
| `--accent-orange` | YES | 41 | confirmed |
| `--accent-orange-soft` | YES | 42 | confirmed (not used by article spec, but available) |
| `--font-display` | YES | 71 | confirmed (Cormorant) |
| `--font-mono` | YES | 72 | confirmed (JetBrains Mono) |
| `--font-type` | YES | 73 | confirmed (Special Elite) |
| `--font-thai` | NO | — | non-goal · Thai deferred · no action |
| `rgba(232,226,213,.92)` (NETRA paper-patch) | RAW (no token) | — | **TOKEN FLAG to Polaris** (already in v2.0 spec §anti-Codex audit) — propose `--paper-patch` when surface count hits 3 (currently 2: ATLAS NETRA console + article NETRA bay) |

**Verdict:** zero missing tokens block the prototype build. The one raw value
(`rgba(232,226,213,.92)`) is documented in the v2.0 spec as a deliberate verbatim carry-over
from `.netra-console`. Sirius is instructed to use the literal value in the prototype and the
production build until Polaris canonicalizes it.

**Token proposal candidate for Polaris (defer until 3rd surface):**

```css
/* in app/globals.css, alongside --paper-warm */
--paper-patch: rgba(232, 226, 213, 0.92);
```

Naming rationale: matches the existing `--paper-base` / `--paper-warm` family. "Patch" reads as
"a cushion patch on the surface" — the NETRA console literally is a patch on the ATLAS frame.

**No tokens to add for this prototype build.** All visual requirements achievable with current
tokens.

---

## 6 · interactive elements scope

The article surface is a reading surface. Interactivity is restrained. For the prototype:

| element | interactivity | implementation in prototype |
|---|---|---|
| Nav links (`◇ INDEX`, `◇ TRACES`, `◇ ARCHIVE`, `◇ TRANSMIT`) | hover (color + dashed underline draw) | functional · 150ms transition · href stubs (`#`) |
| `← ATLAS` affordance | hover only · navigation inert | functional hover · `href="#"` |
| Tags in header strip | hover (color shift) · click inert | functional hover · `href="#"` (real link target: AttractorFields anchor on archive) |
| Scroll-meter (top 2px bar) | scroll-driven width | functional · vanilla JS `window.addEventListener('scroll')` reading `scrollY / scrollHeight` |
| Body links (inline) | hover (color + underline) | functional if any present · prototype body may have none |
| Sidenote anchor (`†` superscript) | hover (color), click inert | functional hover · `href="#sidenote-1"` (real focus jump in browser) |
| Pullquote | non-interactive | static |
| Patches log entries | non-interactive · no expand | static · entries render fully on first paint |
| Patches log fade-in stagger | IntersectionObserver on first viewport entry | functional · 220ms fade + 60ms stagger · runs once |
| Related-branches cards | hover (entry-glitch underline draw + bg color) | functional · 150ms + 460ms underline · `href="#"` |
| Prev/Next nav | hover (color shift) | functional · `href="#"` |
| NETRA L1 reticle | non-interactive · no pulse on article surface | static glyph |
| NETRA L1 voice line | optional scroll-past swap (per Q7) | implement if §2 Q7 resolved yes |
| Focus rings on all interactive | dashed orange (P2-10) | functional via `:focus-visible` |

**Out of prototype scope:**
- Real route navigation (all hrefs `#`)
- Real article-MDX rendering pipeline
- Real Procyon frontmatter contract reads at runtime
- Skeleton/loading states
- `prefers-reduced-motion` toggle UI (the spec is honored via the standard `@media (prefers-reduced-motion: reduce)` CSS block, but the prototype doesn't expose a toggle)
- Cross-route `sessionStorage` for `wl:entry-origin`
- Light/dark theme switch

---

## 7 · cross-coordination with Pair B (ARCHIVE)

Pair B is defining the ARCHIVE landing page concurrently. The article entry has three
surface-points that touch ARCHIVE:

### 7.1 prev/next link target

Article-to-article links, not to ARCHIVE. **No coordination needed.**

### 7.2 "← ATLAS" affordance + Nav vocabulary

When arriving from Globe, Nav shows `← ATLAS`. When from ChapterIndex (archive listing), `◇ INDEX` serves as return. v2.0 spec uses both `◇ INDEX` and `◇ ARCHIVE` labels in Nav row — ambiguous. **Question for Pair B:** is ARCHIVE a new route, or `◇ INDEX` renamed? **Resolution:** defer to Pair B's plan; cross-reference when their doc lands at `docs/design/<NN>-archive-plan.md` and post a clarification handoff if divergent.

### 7.3 RELATED BRANCHES card styling

The 3–5 cards use the entry-card pattern. Entry cards almost certainly live on ARCHIVE too — same vocabulary, no two flavors. **Resolution:** prototype uses existing iter-1 `.entry-card` / `.entry-glitch` classes. If Pair B modifies entry-card vocabulary, my prototype updates to match before either surface ships.

### 7.4 attractor-pill / tag link target

Tag links point to AttractorFields anchors, most plausibly on ARCHIVE (`/archive#field-coffee`?). **For prototype:** `href="#"` placeholder. Pair B confirms final anchor format.

### Pair B doc — status at write-time

**Pair B's plan not yet present (2026-05-17 mid-session).** Coordination points 7.1–7.4 flagged as open, no blocking. Follow-up cross-pair handoff to Polaris once both plans land.

---

## 8 · NETRA voice cues catalog

Vega delivered Candidate A for the static L1 voice line:
```
"locus confirmed. FILE — {fileNum} · {coords} · {status}."
```

This is the recommended ship copy. The prototype renders Candidate A by default.

Additional voice cues the prototype needs — each is a Vega COPY REQUEST:

### V1 · scroll-past voice swap

Trigger: `IntersectionObserver` on `#article-body`, threshold 0.1. Vega draft: `"observation in progress. {fileNum} · depth surveying."` Prototype renders exactly, `{fileNum}` resolved to "002". **Vega action:** confirm ship-ready or refine.

### V2 · reduced-motion fallback

Suggested: under `prefers-reduced-motion: reduce` the voice line stays static (Candidate A only, no swap). Removes voice churn for motion-sensitive readers. **Vega action:** confirm (a) static-only — no swap, vs (b) snap swap (no fade).

### V3 · hover state on NETRA L1 bay

Spec: non-interactive. **No V3.** No hover affordance.

### V4 · idle/standby variant

Suggested: **no.** Article voice is observational, not chatty. Idle-driven voice changes drift toward chatbot-on-every-page (SBA-3 dilutive). Static + scroll-past only.

### V5 · α-proximate / drift-aware variants

Vega draft Candidate C was drift-aware. **Prototype: Candidate A only.** Drift variants are follow-up after Procyon ships the `drift` computed field.

### V6 · `shareLocation: false` variant

Bay hides entirely. **No copy needed.** Silence is correct.

### voice catalog summary for Vega

| cue | needed in prototype? | Vega action |
|---|---|---|
| V1 scroll-past static | yes — render variant from draft | confirm or refine "observation in progress. {fileNum} · depth surveying." |
| V2 reduced-motion fallback | yes — clarify behavior | decide static-only vs snap-swap |
| V3 hover state | no | n/a |
| V4 idle timer | no | confirm no |
| V5 drift variants | no (post-Procyon) | n/a for this prototype |
| V6 no-coord variant | no (silence) | n/a |

Total Vega COPY REQUESTS for the prototype build: **2** (V1 confirm + V2 decide). The static
ship line (Candidate A) is already approved.

---

## 9 · build sequence proposal

Single dispatch to Sirius (sonnet tier) is sufficient. The prototype is smaller and more
self-contained than iter-1 globe-v1 — no Three.js, no Globe shader, no camera math.

### proposed build order within the dispatch

1. **Skeleton HTML scaffold** — `<!doctype>`, `<head>` with six `@font-face` declarations, `:root` token block (copy from globals.css verbatim), vendored class defs from globals.css (`.atlas-head`, `.paper-warm-surface`, `.corner-marks`, `.t-meta` family, `.section-rule-dashed`, `.scroll-meter`, `.marginalia`, `.entry-glitch`) and from iter-1 prototype (`.frame-head`, `.netra-console`, `.netra-id`, `.netra-readout`, `.netra-voice`)
2. **Article chrome** — Nav strip + scroll-meter + header strip + NETRA L1 bay + footer prev/next. Capture desktop t0 here for sanity-check before proceeding.
3. **Body zone** — h1 + Cormorant prose at 70ch + one sidenote in 220px right slot + one pullquote. Real article-002 prose inlined.
4. **Patches log + related branches** — `.paper-warm-surface` cushion + 3 synthetic patches; 3 entry-cards.
5. **Responsive at 880 / 600 / 375** — header strip stack, sidenote footnote-collapse, NETRA L1 strip-collapse, marginalia hide ≤600.
6. **JS interactivity** — scroll-meter, patches IntersectionObserver fade-in stagger, NETRA voice scroll-past swap. (`:focus-visible` is CSS-only, covered in step 1.)
7. **Reduced-motion guard** — `@media (prefers-reduced-motion: reduce)` collapses patches fade, NETRA mount fade, voice swap.
8. **Five screenshots → REVIEW.md** — desktop t0/t10/t20, tablet 880, mobile 600, narrow 375.

### complexity vs iter-1

| dimension | iter-1 globe-v1 | iter-2 article-v1 | delta |
|---|---|---|---|
| total lines | ~3946 | est. 1200–1500 | **smaller** (~⅓) |
| JS volume | high (Three.js, camera, raycaster, NETRA pulse) | low (scroll-meter, 2 observers) | **smaller** |
| visual density | observatory — many instrument bays | reading surface — calm | **simpler** |
| breakpoints | 3 | 4 (added 375) | slightly more |
| novel components | Globe, NETRA console, ATLAS frame | none — all carried from iter-1 | **none new** |

Smaller, simpler, single-dispatch buildable. **Estimate one sonnet session covers it**, with
~2 review rounds (initial build → Peat + Betelgeuse review → refine → lock).

---

## 10 · vision fidelity

```text
soul baseline      · `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html`
                     RW-5 AMEND-9b locked · iter 1 canonical · teal palette active
                     `docs/team/.soul-baseline/visual.md` (SBA-1) — atlas-frame vocabulary
                     `docs/team/.soul-baseline/voice.md` (SBA-2) — Vega-protected patterns
aesthetic invariants · I1 (garden under measurement — article has file number, coords, status, patches)
                       I3 (Peat in the instrument layer — NETRA L1 reflects locus, not biography)
                       I5 (quality visible — reading surface calmer than ATLAS, not thinner)
Peat signal        · "ดีไซน์น่าจะมีครบแล้ว แต่อยากให้ทุกอย่างโชว์ลง PROTOTYPE มาเลย" (2026-05-17)
                     · this plan is the contract for that prototype build
allowed evolution  · prototype as single self-contained HTML (iter-1 precedent) ·
                     vendoring iter-1 fonts + iter-1 NETRA classes for surface continuity ·
                     IntersectionObserver scroll-past voice swap (low-risk behavioral texture)
forbidden dilution · introducing new components not in v2.0 spec ·
                     inventing tokens during build (token additions go to Polaris first) ·
                     dark-theme code block — keep `--paper-warm` cushion ·
                     ink-faint on any functional label (P1-6) ·
                     looping decorative motion on reading surface ·
                     NETRA companion-chat register on article surface (L1 only)
rendered checkpoint · five screenshots in REVIEW.md ·
                      desktop t0 (full layout) ·
                      desktop t10 (mid-scroll, patches fade visible) ·
                      desktop t20 (footer, prev/next visible) ·
                      tablet 880 (sidenote collapsed inline) ·
                      mobile 600 (header strip stacked, NETRA strip) ·
                      narrow 375 (px-4 padding, no horizontal scroll)
loss budget        · same as v2.0 spec §loss budget — no new acceptable losses,
                     no new unacceptable losses; prototype must demonstrate all unacceptable-loss items
review gate        · Betelgeuse signs prototype against this plan AND the v2.0 spec ·
                     6-point anti-Codex audit re-run on the rendered HTML ·
                     Lighthouse a11y ≥95 verified before lock
```

---

## acceptance checklist (for the next dispatch)

The sonnet build is complete when:

- [ ] Single self-contained `index.html` at `.claude/visual-diffs/UI-ITER-2-article-v1/prototype/index.html`
- [ ] All six fonts vendored under `prototype/fonts/`
- [ ] Renders correctly at 1180 / 880 / 600 / 375
- [ ] Every section from v2.0 spec layout block is present
- [ ] NETRA L1 bay renders (synthetic `shareLocation: true` for prototype)
- [ ] Voice line Candidate A renders by default
- [ ] Scroll-past swap to V1 variant functional (or pulled per Q7 outcome)
- [ ] Patches log fade-in stagger functional on first viewport entry
- [ ] Scroll-meter advances on scroll
- [ ] Focus rings (dashed orange, P2-10) visible via keyboard tab
- [ ] Reduced-motion media query honored (manual test via OS toggle)
- [ ] Zero raw color values outside the documented `rgba(232,226,213,.92)` exception
- [ ] Zero new tokens introduced
- [ ] Five REVIEW.md screenshots captured
- [ ] Lighthouse a11y ≥95 on desktop and mobile

---

## non-goals (this prototype build)

- No real route wiring (Next.js)
- No real MDX pipeline (Velite)
- No real frontmatter consumption at runtime
- No Procyon contract validation
- No real prev/next next-link target generation
- No Thai font / `--font-thai`
- No print stylesheet
- No audio companion
- No NETRA L3 companion register
- No reading-progress bar (scroll-meter covers it)
- No comment system
- No `← ATLAS` `sessionStorage` machinery (link is visually present, behaviorally inert)
- No fiction-entry or photo-entry variants
- No article-photo pairing
- No light/dark theme toggle
- No Tailwind utility wiring (vanilla CSS only)

---

## next steps after this plan lands

1. Peat reviews this plan → accepts / revises
2. (If accepted) Polaris dispatches sonnet build to Sirius — task likely `TASK-2026-05-18-ARTICLE-PROTOTYPE-BUILD` or similar
3. Sirius produces `UI-ITER-2-article-v1/prototype/index.html`
4. Betelgeuse reviews against this plan + v2.0 spec — signs or revises
5. Pair B's ARCHIVE plan cross-referenced — any coordination divergences resolved
6. Algol QA pass — anti-Codex audit + Lighthouse + visual diff
7. Polaris closes the iter-2 article cycle

---

*betelgeuse · α-VIS-04 · the Red Sentinel · TASK-2026-05-17-ARTICLE-PLAN · opus*
*planning · zero new tokens · iter-1 grounded · prototype-build-ready*
*pair A with vega · pair B coordination flagged · awaiting Peat review*
