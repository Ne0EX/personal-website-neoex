# SESSION LOG · 2026-06-25 · Design-Craft Layer + first use

Polaris (α-OPS-00). Work session. Caveman mode active throughout (Peat's hook).

## What we set out to do
Peat: plug `/impeccable` into the Worldline design skills to upgrade Betelgeuse's + Sirius's UI-design craft — without losing the soul.

## What happened (the arc)

1. **`/impeccable init`** → wrote `PRODUCT.md` (register = **brand**; soul-atlas / surveyed-paper instrument; exploration-not-exhibition; 5 design principles; anti-refs carried from `worldline-design`). Scope = main exploration site only (resume.neoex.com stays its own product-register surface). Added a Design Context pointer to `CLAUDE.md`.

2. **Wired a governed craft layer** — `docs/design/DESIGN-CRAFT-PROTOCOL.md`: precedence `worldline-soul (judgment) → worldline-design (vocabulary) → craft sources`, Worldline identity overrides every conflict. Folded in **4 craft skills** over the session (Peat installed 3 via `npx skills add`, /impeccable was repo-local):
   - emil-design-eng (deepest motion authority; its "should this animate at all?" framework promoted as the canonical motion gate)
   - make-interfaces-feel-better (detail/tactility)
   - fixing-accessibility (a11y rule-authority)
   - /impeccable (general craft + evaluation verbs)
   Blend-hazard handled: each skill's register/palette/slop machinery + any Worldline-non-negotiable-violating rule SUPPRESSED (border-radius, drop-shadows, bounce, decorative motion, "eyebrow"/"numbered-marker" slop bans that collide with FILE—NNN instrument vocabulary). Curated verbs per agent. Flow each fold: Betelgeuse extends protocol → Polaris applies persona-pointer edits **directly** (self-mod classifier blocks the subagent path) → Algol verify → Polaris self-verify git. **Algol PASS every round.**

3. **Standing policies adopted (Peat):**
   - **craft auto-fold** — any craft skill Peat installs auto-folds into the protocol; Polaris reports suppressed/adopted, no per-skill re-confirm.
   - **worktree-per-feature** — every new feature gets its own git worktree (`EnterWorktree` native). Memory `feedback_worktree_per_feature`.

4. **Committed + pushed** — branch `genesis/design-craft-protocol` (`3104209` protocol+personas+PRODUCT+CLAUDE · `84442c4` CRAFT-SKILLS manifest). Pushed to origin (Peat ran `git push`, gate-blocked for agents). Skills themselves stay **gitignored** (`.agents/`, `.claude/skills/` = "tooling not source"); the manifest tracks install commands, no third-party code vendored.

5. **First real USE of the craft layer** — Betelgeuse craft-critique of the article-continuation surface (`/[lang]/articles/[fileNum]`, the surface shipped earlier today in `bec2912`). Score 79/100, 9 findings, **caught a real a11y bug**: F1 (P0) — inline `outline:'none'` silently killing the keyboard focus ring via cascade. Triage → Sirius fixed F1–F6 (Algol PASS) → Peat live-tested.
   - Peat pushed a11y from checkbox → real journey: "ring is for keyboard users, but who Tabs 10 times to reach it?" Surfaced the real lever (focus order / heading-jump), NOT just the ring.
   - **Polaris false-green caught:** claimed "no skip-link exists" from a grep that never ran (unquoted `app/[lang]/` aborted the zsh command). Betelgeuse read the real code → skip-link present. Memory `reference_zsh_bracket_glob_aborts_command`. The real fix was smaller: F7 heading semantics (§PATCHES/§WORLDLINE → real `<h2>` so heading-jump works) — corrected to ALSO reset `margin-top:0` (h2 UA default would inject a gap; Betelgeuse's "change tag only" spec was wrong, caught by Peat's "ไล่เช็คว่าแต่ละอันทำไร"). Kept "Skip to entry" label (more on-soul than generic "Skip to content").
   - F1–F7 all Algol-PASS. Focus ring confirmed working by Peat on Tab.

## What shipped (committed)
- `genesis/design-craft-protocol`: PRODUCT.md, DESIGN-CRAFT-PROTOCOL.md, CRAFT-SKILLS.md, persona pointers, CLAUDE.md — pushed.

## What's parked / open
- **F1–F7 article-craft fixes** (6 components) — verified, **uncommitted on `genesis/store-as-source`**, PARKED by Peat ("ช่างมัน"). Needs: his live-check of the h2-gap + general look (focus ring already ✓), then commit + push. Owner: Peat.
- **F8** (entry-glitch `width`→`clip-path`, site-wide globals.css) + **F9** (folio aria-label padded-digits, VoiceOver check) — backlog.
- **`SPEC-2026-06-25-article-keyboard-journey.md`** — untracked; has a "change tag only" inaccuracy (missed the margin reset). Correct before tracking.

## Key decisions + who decided
All structural calls = Peat (craft-layer-only, curated verbs, one-page protocol, auto-fold policy, manifest-not-vendored, keep "Skip to entry", worktree-per-feature, park F1–F7). Polaris orchestrated; Betelgeuse/Canopus/Vega/Sirius/Algol owned their slices.
