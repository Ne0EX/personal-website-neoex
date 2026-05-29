# SAVE-POINT · 2026-05-18 · Phase 3 polish wave essentially COMPLETE

> Polaris session-handoff document · written for next-Polaris resume after Peat signs off
> Continuation of SAVE-POINT-2026-05-17.md · Phase 3 = post-Phase-2 polish + production prep

---

## §1 · WHERE WE ARE

**ARTICLE prototype = stable** (Algol W3 PASS-WITH-NOTES → Algol W4 included). **ARCHIVE prototype = full quality pass shipped** through 4 Betelgeuse iterations (typography overhaul · filter UX redesign · Three.js mini-globe Route B impl + depth pass · cool-token resolution). Three.js vendored locally · ad-blocker bypass shipped · all 16 Fuji filmSim palettes mapped.

7 waves dispatched today · 22 agents · all returned signed-clean except 2 REVISE rounds (both Algol-driven · auto-loop closed within same day).

### running surfaces (delta from 2026-05-17)

| surface | spec | prototype | post-W7 state | audit |
|---|---|---|---|---|
| ATLAS (iter-1) | spec-globe-v1-direction · binding v1.1 | LOCKED 2026-05-17 | unchanged | PASS-WITH-NOTES |
| ARTICLE (iter-2) | 09-article-entry.md v2.1 | `:8732` H1 44px · Thai specimen integrated · typography pass complete · sidenote overlap fixed dynamically | post-W4 stable | **Algol W3 PASS-WITH-NOTES** |
| ARCHIVE (iter-2) | 20-archive.md v1 (Option C hybrid) | `:8733` 26px title · Three.js mini-globe vendored · MeshStandardMaterial · geographic lines · rim light · row 26/20 padding · pill border-only desktop / 44px mobile · WCAG 2.5.3 fixed | post-W6 needs Peat verdict on globe depth | **Algol W4 REVISE→fixed · W7 re-audit pending** |
| WORLDLINE-BRANCHING | 30-worldline-branching.md v1 | renders in ATLAS | unchanged · merge-ready | APPROVE-WITH-NOTES |
| PHOTO+FILMSIM | 10-photo-entry.md v2 · 10-photo-atlas.md v1 · PRD-03 §8.1 (16/16 palettes now) | no proto · MDX drafts for 2026-05-bangkok roll | 4 Vega-authored sidecars · awaiting JPEG drop | (pending) |

### today's task chain (sig trail for resume continuity)

**Wave 1 (parallel · 2026-05-17 late):**
- TASK-2026-05-17-BETELGEUSE-WAVE1-BUNDLE · H1 38→44 + ARCHIVE mini-globe Route B spec
- TASK-2026-05-17-PROCYON-WAVE1-BUNDLE · Pullquote `source?: string` prop + Reala filmSim recon (11-sim gap surfaced)
- TASK-2026-05-17-CANOPUS-WAVE1-HOOK-PROPOSALS · P1+P2+P3 doc-only proposals
- TASK-2026-05-17-ALGOL-WAVE1-PROTOTYPE-AUDITS · ARTICLE PASS-WITH-NOTES · ARCHIVE REVISE
- TASK-2026-05-17-VEGA-ARTICLE-THAI-SPECIMEN · Thai prose translation

**Wave 2:**
- TASK-2026-05-17-BETELGEUSE-WAVE2-BUNDLE · sidenote overlap fix (dynamic positioning IIFE) + Thai typesetting Noto Serif Thai 400 · "เมื่อฉันหยุดกลางทาง" + ARCHIVE REVISE (NETRA L1 block remove)

**Wave 3:**
- TASK-2026-05-17-BETELGEUSE-WAVE3-ARCHIVE-QUALITY · typography 9→11 / 9→10 · filter B1 ratio + B2 YEAR scrubber + B3 SORT radio · initial Three.js mini-globe
- TASK-2026-05-17-ALGOL-WAVE3-ARTICLE-CONFIRMATION · ARTICLE PASS-WITH-NOTES (N1 lang="th" · N2 inline weight)
- TASK-2026-05-17-VEGA-WAVE3-PULLQUOTE-BUNDLE · pullquote tighten Option 1 + attribution copy convention
- TASK-2026-05-18-PROCYON-WAVE3-FILMSIM-COMPLETION · 11 palettes + ACROS+R normalize · 3 AMBER-FLAGs

**Wave 4:**
- TASK-2026-05-18-ALGOL-WAVE4-ARCHIVE-REAUDIT · REVISE · Three.js CDN 0.168 UMD-404 + WCAG 2.5.3 aria-label mismatch (7 entries)
- TASK-2026-05-18-BETELGEUSE-WAVE4-ARTICLE-TYPOGRAPHY · 22 CSS rules · 7.5/9px → 10/11px · N1+N2 fixed · spec v2.1
- TASK-2026-05-18-VEGA-PHOTO-ROLL-2026-05-BANGKOK · 5 MDX files · adjacency through-line

**Wave 5:**
- TASK-2026-05-18-BETELGEUSE-WAVE5-ARCHIVE-HOTFIX · CDN 0.168→0.160 + guard reposition (FPS 59.8 avg) · WCAG aria 6 anchors · title 18→26px · row noise no-op

**Wave 6:**
- TASK-2026-05-18-BETELGEUSE-WAVE6-ARCHIVE-DEPTH · MeshStandardMaterial (matches ATLAS) · geographic lines · rim light · vendored Three.js (ad-blocker bypass) · row 26/20 padding · ledger solid · pill border-only desktop / 44px mobile

**Wave 7 (parallel):**
- TASK-2026-05-18-BETELGEUSE-WAVE7-COOL-TOKENS · `--accent-cool: #3E5A6A` + `--accent-cool-soft` · 3 AMBER-FLAGs resolved · 5.93:1 contrast
- TASK-2026-05-18-CANOPUS-WAVE2-P1-IMPLEMENT · 9-line jq exclusion · 4 test cases PASS · dogfood self-validated

---

## §2 · KEY DECISIONS LOCKED TODAY (don't redebate)

### typography scale (Mac Retina readability gate)
- ARTICLE H1 = **44px** · line-height 1.08 · -0.015em tracking · responsive 32/26/22 (880/600/375)
- ARCHIVE entry-title = **26px** · line-height 1.25 · 2.36× over 11px mono row
- Primary instrument labels = **11px** (9px banned for functional text)
- Secondary rows = **10px** (8/7.5/7px banned)
- `--ink-faint` HARD-banned on any functional label (P1-6 enforcement)

### Thai type system (ARTICLE)
- **Prose face:** Noto Serif Thai 400
- **Mono face:** English-only JetBrains Mono (Thai glyph coverage gap accepted)
- **Line-height:** 1.9 (Thai diacritic stack breathing)
- **Pullquote italic-substitute:** Noto Serif Thai Light 300 + letter-spacing 0.04em
- **Headline Thai:** "เมื่อฉันหยุดกลางทาง" (Vega alt accepted · kinetic image · §3 echo)
- **Subtitle:** "ทำไมฉันถึงหยุดสตาร์ตอัพ" (literal · functional)
- **Integration:** Route C (second view below English · no toggle JS)
- **`lang="th"`** attribute on Thai section · WCAG enforced

### ARCHIVE mini-globe (Route B Three.js)
- Library: **vendored locally** (`three.module.js` + `three.core.js` · NOT CDN · ad-blocker bypass)
- Module type: `<script type="module">` + importmap
- Geometry: `SphereGeometry(1, 24, 24)`
- Material: **`MeshStandardMaterial(roughness: 0.88, metalness: 0.02)`** · matches `WorldlineGlobe.tsx` ATLAS production exactly
- Lights: ambient + directional + **rim `(0x2a3a48, 0.18)`** vector matches ATLAS
- Geographic overlay: equator (0.55) + 4 latitude rings ±30°/±60° (0.28) + 6 meridians 60° spacing (0.28) · matches ATLAS strengths
- Nodes: 4 `THREE.Points` at Bangkok α origin · public-locus only (privacy gate hard)
- Interactions: click empty → ATLAS · click node → entry · hover 120ms intensification
- Rotation: 60s/revolution · pause on hover · resume after 3s
- Reduced-motion: static frame
- Fallback: `renderCanvas2DFallback()` · auto if WebGL OR `typeof THREE === 'undefined'`
- Perf gate: ≥50fps · **measured 59.8 avg in Chrome** (60 sustained)

### filmSim palette system (16/16 complete)
- 5 original (Provia · Classic Chrome · Acros · Reala Ace · Velvia)
- 11 added by Procyon W3 (Astia · Pro Neg Hi/Std · Classic Neg · Eterna · Eterna Bleach Bypass · Acros R/G/Ye · Nostalgic Neg · Seal)
- 3 cool-axis palettes use `--accent-cool` (Classic Neg · Eterna Bleach Bypass · Seal)
- AMBER-FLAGs all resolved · ready for Sirius FilmSimSwitcher wiring

### cool-token pair
- `--accent-cool: #3E5A6A` (iron-slate)
- `--accent-cool-soft: rgba(62, 90, 106, 0.18)`
- Contrast: 5.93:1 vs `--paper-warm` · 4.71:1 vs `--paper-deep`
- Mechanism: `[data-palette]` overrides `--accent-orange` with `var(--accent-cool)` · CSS cascade · NO component touch needed

### article surface tweaks
- Sidenote overlap fix: `positionSidenotes()` IIFE · `getBoundingClientRect() + scrollY` · runs on DOMContentLoaded + fonts.ready + debounced 80ms resize · gated `>880px` · 16px collision guard
- Pullquote `source?: string` prop schema (Procyon) · Pullquote attribution voice convention (Vega) — em-dash carries relation · no "from/by/in"

### ARCHIVE surface tweaks
- Filter YEAR: `input[type=range]` scrubber · 2024-2027 · default ALL · keyboard arrows · clear reset
- Filter SORT: ARIA radiogroup · `◯`/`◉` glyphs · single-select clarity
- Filter pills: border-only resting state · desktop drop min-height-44 · mobile keep
- Entry rows: 26px/20px padding · ledger year border solid not dashed
- WCAG 2.5.3 aria-label fixed (6 entry-row anchors carry visible text verbatim)

### harness fix shipped
- Self-signature exclusion in `sign-work.sh` (9-line `jq` exclusion at convergence point) · exact-match only · paradox closed for all future agents

---

## §3 · PENDING PEAT DECISIONS

Carry over to next session:

1. **DSCF0003 Ixora caption** — wry "doing what ornamental hedges do, but saturated" vs instrument "Ixora · coral cluster in the compound hedge, late light." · Vega flagged for taste-axis decision
2. **Mini-globe further direction** — Peat said "ปรับอีกเยอะ ไม่งั้นจะไล่ไป redesign" but didn't specify what's missing post-W6. Polaris held W8 dispatch awaiting direction (continent silhouettes? scale? material punch? node halo? rotation visibility?)
3. **Canopus P2 · prototype discipline scope extension** — Polaris recommends approve scope · single-paragraph README · warn→blocking grace · still queued
4. **Canopus P3 · sign-work assignment stub fallback** — Polaris recommends Candidate A (synthesize stub) + pre-handoff flag · still queued
5. **JPEG drop** to `content/photos/2026-05-bangkok/` confirmed target · ping when ready → Procyon W4 pipeline dispatches

### blocking-NOT-resolved-yesterday (still open from 2026-05-17)
- Q-A v1.1 worldline-branching content treatment (variant teaser vs title-only) · BLOCKS v1.1 scope
- Q-G empty-state fiction stub coverage
- FLAG-2 breathing amplitude tune (browse-and-tune session pending)
- Phase 2 wave formal closure acknowledgement

---

## §4 · QUEUED FOR DISPATCH (post Peat verdict)

### immediate (zero-blocker)
- **Algol W7 ARCHIVE re-audit** — confirm W6 depth pass landed clean (MeshStandard + lines + rim + vendored Three.js + row density + pill compact + cool-tokens not yet wired to FilmSimSwitcher)
- **Vega Pullquote attribution MDX examples** — unblocked by Procyon W1 `source?: string` prop · she has the voice convention authored (Wave 3 handoff)

### awaiting Peat input
- **Procyon W4 photo pipeline run** — needs JPEGs in `content/photos/2026-05-bangkok/`
- **Betelgeuse W8 mini-globe further push** — needs specific direction
- **Canopus W3 P2/P3 implement** — needs approval
- **Betelgeuse cool-palette specimen** — visual swatch for Sirius reference (optional)

### production ports (Sirius · final phase)
- ARTICLE prototype → `components/Article*.tsx` + new article reading route
- ARCHIVE prototype → `components/ArchivePage.tsx` + filter components + Three.js mini-globe component
- PHOTO surface → tied to JPEG drop + Procyon pipeline · Sirius wires AFTER content lands
- FilmSimSwitcher wires 16 palettes including 3 cool-axis · token cascade ready

### content-side (Procyon · post photos)
- Photo pipeline merge: real EXIF overwrites Vega placeholder dates + adds technical fields · roll filenames may correct from DSCF0002-0005 to actual Fuji IDs

### harness (Canopus · pending verdict)
- P2 implement (scope extension + R4 README requirement)
- P3 implement (assignment stub synthesis)
- **NEW P4 proposal** queued from Betelgeuse W2 flag: prototype-only `post_edit_passed` exception handling (standalone HTML prototypes lack post-edit.sh applicability)

---

## §5 · CRITICAL FILES / PATHS

### canonical prototypes (visual sources of truth)
- `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html` (ATLAS · LOCKED · do not touch)
- `.claude/visual-diffs/UI-ITER-2-article-v1/prototype/index.html` (ARTICLE · stable post-W4)
- `.claude/visual-diffs/UI-ITER-2-archive-v1/prototype/index.html` (ARCHIVE · post-W6 depth · vendored three.js)
- `.claude/visual-diffs/UI-ITER-2-archive-v1/prototype/three.module.js` (vendored Three.js r160)
- `.claude/visual-diffs/UI-ITER-2-archive-v1/prototype/three.core.js` (vendored Three.js core)

### dev server ports (each prototype self-served)
- :8731 ATLAS (iter-1 · LOCKED)
- :8732 ARTICLE (iter-2 · post-W4)
- :8733 ARCHIVE (iter-2 · post-W6)
- :3000 Next.js production (branching renderer live · unchanged)

### canonical specs (updated this session)
- `docs/design/09-article-entry.md` **v2.1** (typography pass + Thai section + sidenote dynamic positioning · updated W4)
- `docs/design/20-archive.md` v1 (mini-globe Route B spec · §5 fully replaced W1)
- `docs/prds/prd-03-photo-atlas-deep-dive.md` **§8.1 expanded** (16/16 palettes · 3 cool-axis · AMBER-FLAGs resolved)

### tokens
- `app/globals.css` (cool-token pair added · semantic comment block)

### scripts
- `scripts/process-photos.ts` (normalizeFujiSim regex fixed for ACROS+R/G/Ye plus-sign form)
- `.claude/hooks/sign-work.sh` (9-line jq exclusion · paradox closed)

### tests
- `tests/harness/sign-work-self-exclusion.sh` (4 cases T1-T4 PASS)

### audit trail (today's signed work)
- All sigs at `.claude/signatures/TASK-2026-05-1[78]-*.json` (v2 schema · all PASS gates)
- `.claude/signatures/AUDIT.md` (audit log appended Algol W1+W3+W4)
- All handoffs at `.claude/handoffs/from-{agent}/TASK-2026-05-1[78]-*.md`

### content
- `content/photos/2026-05-bangkok/roll.mdx` + `DSCF0002.mdx` through `DSCF0005.mdx` (Vega drafts · awaiting JPEG EXIF merge)

---

## §6 · PR/GIT STATE

- PR #1 still open · draft · `do-not-merge` · contains GENESIS infra + iter-1 + Phase 2 + **all Phase 3 polish work**
- Branch: `genesis/orchestration-foundations`
- Target: `main` (DO NOT MERGE)
- Merge strategy when ready: cherry-pick production payload (`components/**` · `app/**` · `lib/**` · `content/**` · `docs/design/**` · `docs/prds/**` · `scripts/**` · `.claude/hooks/sign-work.sh`) · leave `.claude/handoffs/**` · `.claude/signatures/**` · `.claude/visual-diffs/**` · `docs/team/**` in branch

### today's significant untracked / modified
- `app/globals.css` (cool-tokens)
- `docs/design/09-article-entry.md` v2.1
- `docs/design/20-archive.md` (mini-globe §5)
- `docs/prds/prd-03-photo-atlas-deep-dive.md` §8.1
- `scripts/process-photos.ts` (normalize regex)
- `.claude/hooks/sign-work.sh` (self-sig exclusion)
- `tests/harness/sign-work-self-exclusion.sh` (new)
- `.claude/visual-diffs/UI-ITER-2-article-v1/` (post-W4)
- `.claude/visual-diffs/UI-ITER-2-archive-v1/` (post-W6 + vendored three.js)
- `content/photos/2026-05-bangkok/` (5 MDX drafts)
- All Phase 3 handoffs in `.claude/handoffs/from-*/`
- All Phase 3 signatures in `.claude/signatures/`

---

## §7 · NEXT-POLARIS RESUME PROTOCOL

When Peat opens new session (likely 2026-05-19+):

1. **Read this file first** (SAVE-POINT-2026-05-18.md) · understand current state
2. **Cross-reference SAVE-POINT-2026-05-17.md** for Phase 2 baseline
3. **Greet** in calm-axis Thai register (Polaris default · don't shift register)
4. **Surface Peat-pending decisions** from §3 above · 5 items today
5. **If Peat drops JPEGs first** → dispatch Procyon W4 pipeline immediately (highest-leverage waiting task)
6. **If Peat specifies mini-globe direction** → dispatch Betelgeuse W8 push
7. **Don't redebate locked decisions** in §2

### suggested opener (Thai · calm-axis · Peat-default)

> "ตื่นแล้วค่ะ · session ก่อนหน้าปิด Phase 3 polish wave · 7 waves · 22 agents · ARTICLE prototype stable · ARCHIVE post-depth-pass · 16/16 filmSim palettes complete · self-signature paradox ปิด · Peat-pending 5: globe direction · JPEG drop · Ixora caption · Canopus P2/P3 · เดินต่อจุดไหน"

### resume signal: mini-globe threshold

Peat used "ไล่ไป redesign" phrasing in Wave 6 review · this is his escalation tone for "I am running out of patience with iterative polish on this surface." Treat W8 mini-globe push as **last shot before approach reset** — Betelgeuse brief must be tight · specific to Peat's described gap · NOT a generic "more depth" iteration.

---

*polaris · α-OPS-00 · 2026-05-18 → 2026-05-19 rollover · session save-point · Phase 3 polish wave closure documented · Peat signed off post 19:00ish Bangkok local for evening errands*
