# docs/qa/REPORTS/TASK-2026-06-02-PHASE1-SHELL.md

## task · Phase-1 globe shell close-out QA (prior index fixes + this-run polish + regression)

## verdict · REVISE — one piece fails (camera orbit clip-through). Hold commit.

All other pieces CLEAR. Single blocker: camera dips below globe radius on the
neo-stratum re-entry path. REVISE handoff routed to Sirius (α-SUR-01).

## method note
The production server on :3000 (PID 49321) was serving a STALE build — the concurrent
archive workflow rebuilt `.next` out from under it, so `/_next/static/chunks/*` 404'd
with 500s (9 console errors, no JS hydration, globe never mounted). This is the
"builds collide" hazard the brief warned about, NOT a shell defect. I ran ONE fresh
`npm run build` (exit 0, incl. pagefind index step), served it on :3100, and verified
against that coherent artifact. Stopped the :3100 server on close. `.next` + `.playwright-mcp`
are gitignored; my QA left no tracked-tree residue (A2 tree-state assertion: clean).

## signature audit (this run)
  sirius      · v2 · TASK-2026-06-02-ALPHA-SOUL-ALIGN     · self_hash 17721ea5… REPRODUCES · roster/nomen OK
              · ⚠ steps:[] empty · harness_passed:false (undocumented) · files_touched=221 (full dirty tree)
  betelgeuse  · v2 · TASK-2026-06-02-FOOTER-HERO-LEGIBILITY · self_hash 4bd32611… REPRODUCES · roster/nomen OK · files_touched=221
  vega        · v2 · TASK-VEGA-2026-06-02-MANIFESTO-CITE   · self_hash 50d5a7eb… REPRODUCES · roster/nomen OK · files_touched=221

  All three self_hashes verify under canonical (without-newline) serialization.
  Designations valid (Sirius α-SUR-01/Pico, Betelgeuse α-VIS-04/Iris, Vega α-VOX-08/Quill);
  all next_recipient = Polaris α-OPS-00 (valid).

  ⚠ SCHEMA CONCERN (routed to Canopus, not blocking): all three signatures list the
  FULL 221-file dirty working tree in files_touched, not the task-scoped diff. Per
  SCHEMA.md the baseline-aware scoping (.claude/hook-logs/<task>--baseline.json) is
  not being applied — sign-work.sh fell back to full `git diff HEAD`. This makes the
  "no file outside files_touched changed" check non-discriminating for this run. The
  stronger signal — files_sha256 recompute — is unaffected and verifies. Sirius's empty
  steps[] compounds this. Likely a sign-work.sh / pre-task.sh baseline-snapshot bug.

## acceptance criteria — PRIOR FIXES (must still hold)
  ✓ strata · titles single-line, dots on line 1, badges in-frame
      (.atlas-strata-btn .label-id white-space:nowrap, α-VIS-04 2026-06-01 fix present;
       runtime: "1 · Ne0Surface · Archive", "2 · Ne0NPole · Bearer", "3 · NeXPossibility · Field" render clean)
  ✗ camera orbit · Ne0 transition camera.position.length() stays above globe radius (1.0)
      → FAIL. Real-UI Ne0Surface click from a near-α start range: 2.70→2.29→1.22→0.97→
        0.87→recovers. minRange 0.87, 3 samples < 1.0. CLIP-THROUGH on re-entry path.
        (Clean entry from range 4.20 = minRange 2.36, no clip — defect is start-state-dependent.)
        Root cause: softTrackCamera lock-handoff overshoots inward when camera starts near α.
  ✓ Ne0 α-lock · reticle pins 13.76°N · 100.50°E instantly and HOLDS through transition + settle
  ✓ coordinate hover-gate · RETICLE textContent="" at rest; real earth-fixed cursor coord on globe-sphere hit
  ✓ SurveyCursor · coord label hidden off-globe + on sphere-miss; real coord on hit
      (fake viewport-derived coord removed; WL_GLOBE_COORD_EVENT + [data-globe-canvas] wired end-to-end)

## acceptance criteria — THIS RUN'S POLISH
  ✓ on-α coordinate panel GONE · 0 `.atlas-coord-pin` in DOM; α = marker + ring + orange pulse only
      (the lat/lon overlay that duplicated the NETRA HUD reticle and misframed α as a Bangkok
       GPS pin is removed. worldline.soul-correct: removing a WRONG exposure.)
  ✓ footer manifesto-body first line aligns with channel list (~1px)
      (.manifesto-block padding-top zeroed + .manifesto-body padding-top:3px ascent comp;
       Betelgeuse Playwright reports 0px delta; CSS verified)
  ✓ HeroBlock subtitle uses --ink-body
      (className --ink-soft → --ink-body; runtime computed color rgba(31,80,99,0.82) = --ink-body, read-tier)
  ✓ manifesto cite finalized — REMOVED cleanly, no leftover TODO
      (Vega α-VOX-08: byline breaks the ambient register; the archive names itself by existing)

## regression scan
  ✓ npx tsc --noEmit · 0 errors
  ✓ eslint (changed Phase-1 files: WorldlineGlobe, FooterManifesto, HeroBlock, SurveyCursor) · 0 errors, 0 warnings
  ✓ npm run build (fresh, production) · exit 0, pagefind index built (13 pages, 261 words)
  ✓ audit-soul-atom-drift.sh · PASS (token_refs, font-chain, A1.4 source-bijection)
  ✓ audit-rail-barrier-class.sh · PASS (20/20 rails satisfy barrier_class contract)
  ✗→archive · audit-design-tokens.sh · FAIL: 4 raw-hex violations
      ALL in components/ArchiveMiniGlobeCanvas2D.tsx (#E8E2D5, #D4602A ×2 each).
      That file is UNTRACKED (??) and belongs to the CONCURRENT archive-build workflow —
      explicitly in the do-not-touch set (ArchiveMiniGlobe*). NOT a Phase-1 shell file.
      The 5 Phase-1 shell files have ZERO token violations. This FAIL is attributable to
      the archive workflow owner, not this run. Flagging for that owner; does not block
      the shell commit, but the design-tokens gate is a HARD-BARRIER and will block any
      commit that includes ArchiveMiniGlobeCanvas2D.tsx until those 4 hexes are tokenized.

## cross-impact scan
  ✓ WL_GLOBE_COORD_EVENT / GlobeCoordDetail centralized in lib/client-state/globe-store.ts;
    consumers (WorldlineGlobe emit, SurveyCursor subscribe) consistent.
  ✓ latLonFromGlobeHit in lib/globe-coordinates.ts; one producer (onHover raycaster), tsc-typed.
  ✓ Dead CSS left behind (non-blocking, see notes): `.atlas-coord-pin` rules (globals.css:695-709)
    and `.manifesto-cite` rule (globals.css:336-344) — their JSX consumers were removed this run.

## notes (non-blocking → Polaris for next task)
  - Dead CSS: `.atlas-coord-pin` and `.manifesto-cite` rules survive in globals.css with
    no DOM consumers after this run's removals. Harmless, but worth a Betelgeuse sweep so
    the token surface doesn't accumulate orphans. NOT a blocker.
  - The camera clip is start-state-dependent (clean from far, clips from near). A naive
    "click once from a fresh load" smoke test would MISS it. The regression guard I add
    after Sirius's fix must exercise the near-start re-entry path, not just first-entry.
  - sign-work.sh baseline scoping is broken for this whole run (221-file files_touched on
    all 3 signatures). Routed to Canopus. Until fixed, files_touched cannot be used to
    bound task scope; rely on files_sha256 + diff inspection.
