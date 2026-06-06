# atlas-console — implementation plan (build-agent brief)

> Internal routing artifact (Polaris). Each build dispatch reads THIS + the named files, then builds **one module, build-only**. Source of truth for the design = the prototype bundle (settled, 6-round Claude Design handoff).

## Goal
Implement the `atlas-console` design as Worldline **authoring tooling** (NOT the public website — the public entry pages already exist and we REUSE them). Branch: `feat/atlas-console` (off HEAD; `main` is stale and lacks the frontend).

## Scope ladder
- **Slice 1 (NOW — core MVP):** standalone **Article Editor**, Direction C (three-column), article kind only. Route + markdown engine + scoped preview (reusing `ArticleEntryContent`) + outline rail w/ color toggle + SPLIT/PAGE modes.
- **Slice 1.5 (next):** import zone · ◻ full-preview overlay (desktop/mobile) · ▲ mocked PUBLISH panel.
- **Slice 2:** the Console (node-graph authoring surface).
- **Slice 3:** photo & fiction kinds on the same engine (photo incl. film-sim).
- **Sub-project (not scheduled):** real publish wiring (touches the live mutating-action gate + the no-Peat-key-signing rule). Keep PUBLISH MOCKED until then.

## Phase-0 facts (established — do NOT re-derive)
- velite `articles` schema (`velite.config.ts`) has **no `body`/`code` field**. `ArticleEntry` renders `summary` as a placeholder lede (TODO(Procyon) for MDX body).
- `EntryShell` hardwires full PAGE chrome (PageShell boot anim, fixed `MarginaliaHUD`, `ScrollMeter`, `Nav`). No chrome-less variant.
- `ArticleEntry`/`EntryShell` are shared/agnostic (no `'use client'`, no server-only APIs) → importable into a `'use client'` editor. Client boundary is NOT a blocker.

## Option A — DONE (commit 7eca8a6)
`components/ArticleEntry.tsx` now exports **`ArticleEntryContent({ article, body? })`** — the presentational content (pagefind meta, title, domain, lede/**body region**, § patches, end coords). `body?: React.ReactNode`; when omitted → today's summary-placeholder (so the public page is byte-identical — **HARD INVARIANT**, Betelgeuse gates it). Public `ArticleEntry` = `EntryShell` + `<ArticleEntryContent article={article} />`.

## THE OPTION-A WIRING RULE (the crux)
The editor preview must **reuse `ArticleEntryContent`, not the prototype's `EntryPreview` markup.**
- Port the prototype's markdown ENGINE (`parseMarkdown`, `renderInline`, `Blocks`) → a TS module.
- Feed its output into the body slot: `<ArticleEntryContent article={draftArticle} body={<Blocks blocks={parseMarkdown(md)} />} />`.
- **Discard** the prototype's `EntryPreview` chrome (title/meta/etc.) — `ArticleEntryContent` already IS that chrome. You only need the prototype's *body-block rendering*.
- The preview wrapper supplies a **scoped inline shell** (NOT `EntryShell`): a scoped, non-fixed marginalia/header treatment, NO boot anim / `Nav` / `ScrollMeter` / fixed HUD. It's an inline pane, not a page.
- Build `draftArticle` by mapping the prototype's `SAMPLE_META` → the `Article` type (`lib/content/types.ts`).

## File layout (Sirius owns components/** + app/**/*.tsx)
- `app/console/editor/page.tsx` — route (tooling; NOT in public `Nav`). `⟵ CONSOLE` → `/console` placeholder (`// TODO: console slice`).
- `components/console/markdown.tsx` — ported engine: `parseMarkdown(md): Block[]`, `renderInline`, `Blocks`.
- `components/console/ArticlePreview.tsx` — scoped inline shell + `ArticleEntryContent` fed live body.
- `components/console/ArticleEditor.tsx` — `'use client'` three-column C: outline rail + color toggle + status line, source pane, SPLIT/PAGE modes, stable toolbar.

## Prototype pointers (`/tmp/wl-design-extracted/atlas-console/project/console/`)
- `editor-engine.jsx`: `SAMPLE_META`@7 · `SAMPLE_MD`@14 · `parseMarkdown`@43 · `renderInline`@77 · `Blocks`@93 · (`EntryPreview`@111 — read for body-block CSS hooks only, do NOT port its chrome) · (`ImportZone`@164 — slice 1.5).
- `editor-core.jsx`: `Toolbar`@6 (outline toggle@18 `⊟ OUTLINE` `is-on`; modes@21–23 SPLIT/PAGE) · `SourcePane`@35 · `Outline`@44 (§ headings rail) · `ArticleEditor`@65 (mode state@67 "split"/"wysiwyg"; outlineOpen@69) · threecol grid@99–106 (`212px 1fr 1fr` / `212px 1fr` / `1fr 1fr` / `1fr`) · status line@114 ("outline hidden").
- `Article Editor.html`: ALL the CSS — the `.ed-*` classes (`.ed-rail`, `.ed-2pane`, `.ed-srctoggle.is-on`, `.ed-mode.is-on`, `.outline-row`, `.ed-prov`, etc.). The outline-toggle **color state** (solid accent-orange when shown, neutral bordered when hidden) + the SPLIT/PAGE toggle styling live here. This is your styling source.

## Constraints (every module)
- **AGENTS.md: "This is NOT the Next.js you know."** Before writing ANY Next code, READ the relevant guides in `node_modules/next/dist/docs/` (routing, client/server components) + heed deprecations. Non-negotiable.
- **Compose from atoms (Rule 5):** use `app/globals.css` tokens + `.atlas-*`/`.af-pill`/`paper-canvas` classes; invoke `worldline-design` (colors/type/atoms) + `worldline-soul` (judgment; the preview must read faithful to the soul register). Literals the DS has no token for (≈212px rail, 4px halo) → use the literal, collect a token-gap list for Betelgeuse.
- **Shipped components are ground truth** where the prototype's preview markup drifts. Your refactor must NOT change the public page. Real entry-page design changes → flag for Betelgeuse, don't silently reimplement.
- a11y: keyboard-nav, skip-link/focus per entry-component precedent; chrome legible on narrow widths. Match surrounding code style (inline-style + atom-class; no CSS-module for these).

## BUILD-ONLY protocol (do this, nothing more)
Write code, then verify compile ONLY: `npx tsc --noEmit` (must be clean) and `npx next build` (route compiles, no type/RSC-boundary errors). **Do NOT** start a dev server, take screenshots, or run fidelity skills — Polaris drives the single end-to-end browser verification on the assembled editor. Keep commands minimal (a live hook frictions trigger-words like "build"/"check"/"lint" in command strings).

## Return to Polaris (lean)
Files created/changed (paths) · `tsc`+`build` result · key decisions + any token gaps / drift-from-prototype. Report results, not every edit.
