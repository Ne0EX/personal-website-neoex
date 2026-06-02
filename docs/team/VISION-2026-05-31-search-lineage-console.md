# Worldline vision lock · 2026-05-31 grill session

> **Status:** vision-locked · ready to ship-plan
> **Owner:** Polaris (α-OPS-00) — handoff to next-session for ship plan dispatch
> **Origin:** grill session triggered after TASK-2026-05-30-PHOTO-ENTRY-D3-SHIP closed; Peat raised 3 follow-on Qs (within-page nav · journey to photo-entry · filmSim fidelity) → expanded into full vision pass on search/archive/lineage/console architecture
> **Anchor inputs:** Claude Design bundle `XuDE8-ALJpqOH3InvtCa7g` (`Worldline Pages v1.html` triangulate-search section) · Peat's own articulation of "สวนความทรงจำ · self-portrait ที่ขยายได้"
> **Anti-pattern flagged + saved this session:** `feedback_grilling_proposal_wall.md` — Polaris must NOT present fully-formed N-option proposals when stewarding Peat through decision branches

---

## 0 · North star (drive every decision below)

> "ผมต้องการคนที่อยากอ่านความเป็นผมเข้ามาในเว็บนี้" — Peat, 2026-05-31

Worldline = **สวนความทรงจำ · self-portrait ที่ขยายได้** · ไม่ใช่ content platform · ไม่ใช่ findability-first. Design for growth at the **data/schema layer**, not by adding UI knobs at v1.

When choosing between feature scope levels, prefer the one that:
1. Lets the garden grow data-wise (schema ready for 100s of entries)
2. Keeps UI minimal at v1 (add complexity only when need is felt)
3. Reads as Peat showing his eye, not Peat shipping a CMS

---

## 1 · Decisions LOCKED this session

### 1.1 · Search & Browse

| decision | value | rationale |
|---|---|---|
| **Π1** primary cross-stratum navigation | Triangulate Search **overlay** (`/` hotkey, ESC close) | subsumes static `/archive` page · cross-stratum (4 strata) · hotkey ergonomics anywhere |
| Search engine | **pagefind** (SSG-native, bake-at-build, BM25 ranking) | design footer hint · scales when corpus grows · multilang config available |
| Field weights | title 3× · tags + domain (attractor) 2× · summary 2× · body/caption 1× · place 1× · filmSim/camera/lens as facet chip filter · fiction `delta_summary` + `divergence_cluster` 1.5× | reflects Peat's voice (titles are crafted, attractors are through-line) |
| Operators | implicit AND (multi-word) · `"quoted"` phrase · `-term` negative · `kind:photo`/`tag:coffee`/`place:bangkok`/`domain:method` field prefix (power-user) | known-item searchers efficient · casual visitors served by implicit AND |
| Tokenization | lowercase · whitespace split · EN stem · **ICU/Thai segmentation** (pagefind multilang plugin) | forward-proof for NETRA Thai voice content |
| Highlight | orange tint on substring match in result row title + meta | transparency = trust |
| **Sort = TIME ONLY** (asc/desc) | ใหม่สุด / เก่าสุด | Peat's call: "sort = เวลาเลย ที่เหลือ filter ล้วนๆ" |
| Sort other modes (DRIFT, LINEAGE, RELEVANCE) | **REMOVED** | Peat ฟัน: simplest sort axis is time; complexity belongs in filter/visualization |
| DRIFT (spatial proximity to α) | **moved to globe right-panel visualization** | observer-centric naturally on globe · not a sort mode |
| **Landing** state | pinned + newest first | "นี่คือผมตอนนี้" — invitation, not feed |
| `◇ ARCHIVE` Nav link | opens Triangulate overlay with empty query | reuses Nav infra · single navigation primitive |

### 1.2 · Lineage (L2 architecture)

Two coexisting sub-layers in `entry page`:

#### L2a · self-depth (intra-entry, vertical growth)
| kind | self-depth section | data source |
|---|---|---|
| Article | `§ patches` — timeline of edits | existing `patches: [{ n, date, ... }]` frontmatter schema |
| Fiction | `§ α variants` — alternate-timeline branching | existing `variants: [{ alpha, delta_summary, divergence_cluster, slug? }]` schema |
| Photo | `§ commentary thread` — Peat + NETRA dialogue accumulated over time | **NEW** — schema decision deferred (sidecar field vs bind chat history) |

#### L2b · worldline-weave (inter-entry, horizontal weaving)
- Cross-entry causal/influence DAG (git-node semantics)
- Example: Sendai trip (photo, geo'd Ne0) → fanfiction (NeX α-anchored, no geo) + reflection article (Ne0)
- **Asymmetric location OK** — nodes link by causality, not proximity
- Visualization at 2 zoom levels:
  - **Local view** = `§ worldline` section in entry page (1-hop neighborhood, incoming + outgoing as mini-DAG or list)
  - **Global view** = full DAG on NeX globe (Phase 2 · Debug MIRAI scope — M1/M2/M3 backlog)

#### "alive" signal
- **Card-level metadata, NOT sort axis** — every list/preview card shows "tended N× · last touched <date>" or equivalent
- Distributed across the garden, not concentrated as a rank
- Visitor sees aliveness naturally; doesn't need a sort mode for it

### 1.3 · Routes & Surfaces

| route | status | scope |
|---|---|---|
| `/` (homepage) | LIVE | Hero + Globe + ChapterIndex + AttractorFields + FooterManifesto (no change planned) |
| `/photos/<roll>/<id>` | **LIVE** (D3 ship 2026-05-30) | photo entry with paper-mount + EXIF + filmSim toggle + NETRA L1 |
| `/photos/<roll>` | **MISSING** — to ship | roll-index / contact-sheet (D3's back-link target) |
| `/articles/<slug>` | **MISSING** — to ship | article entry (promoted to dedicated route per γ2) |
| `/fiction/<slug>` | **MISSING** — to ship | fiction entry (promoted per γ2) |
| `/console` | **MISSING** — to ship | local-only authoring console + worldline graph editor |
| `/api/chat` | LIVE | NETRA chat endpoint (Altair) |

**Globe pin click pattern:**
- Photo / Article / Fiction pin click → **side panel preview** (existing camera-focus + 1100ms fly behavior)
- Side panel has `[OPEN ↗]` CTA → navigates to dedicated route
- Side panel = "preview while exploring globe spatially" idiom — kept

**Triangulate Search opening pattern:**
- `/` hotkey from anywhere → overlay opens with empty query (landing state = pinned + newest)
- Or via Nav `◇ ARCHIVE` click

### 1.4 · Within-page navigation (photo-entry)
- **Default:** prev/next button (visible in margin)
- **Desktop:** keyboard `←` / `→` arrow keys
- **Mobile:** swipe horizontal = สลับภาพไปข้างหน้า/ข้างหลัง
- **Scope decision DEFERRED** (impl-time): within current roll only? cross-roll? last entry's "next" → wrap to first / stop / cross to next chronological roll?

### 1.5 · filmSim fidelity
- **Vision A · CSS approximation** locked
- Quote Peat: *"ตอนถ่ายผมก็ตั้งใจถ่ายมาดีที่สุดแล้ว · คนที่อยากเปลี่ยนโทนของฟิล์มคืออยากลองเล่นดูหลายๆแบบ · ควรเปลี่ยนได้ไวๆมากกว่าทำอะไรซับซ้อน"*
- NETRA voice idiom = `· cc/ac/ra/vv` (Vega's revision 2026-05-30 stands) — instrument-code feel, no overclaim
- baked filmSim in sidecar (EXIF) = authentic record; toggle = playful lens game (honest)
- **Vision B (real LUT variants)** explicitly rejected — storage 4× + build cost + still fabricated (reverse-engineered from JPEG ≠ shot-with-X)

### 1.6 · Console (authoring instrument)

| dimension | locked value |
|---|---|
| **Mode v1** | local-only · gated by dev-mode check · production build strips console code via conditional bundle |
| **Migration path** | portable + auth-protected later if Peat wants "tend on the go" |
| **UI** | **GUI mandatory** — text-based ไม่ผ่าน (Peat: "เกิด node ต่อพันกันเยอะๆ ผมจะมึน · แยกไม่ออกเอา") |
| **Scope v1** | (1) entry CRUD (add article / drop photo / add fiction) · (2) worldline graph editor (drag-link nodes) · (3) search/filter existing entries to link |
| **Out of scope v1** | heavy MDX prose editing (Peat uses vim/vscode) · NETRA-assisted authoring (extend later) · publishing workflow (auto-deploy etc.) |
| **Tech direction** | react-flow lib · custom node renderer with Worldline kind-glyphs (◆ article · ◎ photo · △ fiction · ○ repo) · edge = dashed hairline + Cormorant italic label · matches instrument-feel idiom |
| **Tangle ergonomics** | drag-to-position · auto-arrange (dagre/elk) on-demand · hover-highlight 1-hop (others fade) · filter by kind · search-to-locate-and-fly |
| **Position storage** | workspace settings file `.console/positions.json` — NOT entry frontmatter (keep entry content portable across machines) |
| **Storage of entry data** | writes mdx files directly (filesystem = source of truth) · console = GUI on top · git history preserved · velite picks up changes |

---

## 2 · Schema additions needed

### 2.1 · Entry frontmatter (article + fiction + photo sidecar)
Add `worldline_links` array (outgoing-only declaration):
```yaml
worldline_links:
  - to: <kind>/<slug>
    label: <optional free-text prose>     # Cormorant italic micro-narrative
  - to: <kind>/<slug>                      # bare adjacency OK (no label)
```
- Direction: declare **outgoing** only (`to:`)
- Incoming auto-computed at build (reverse scan all entries · expose on entry page as "← seeded by" section)
- Label: **free-text optional** · ไม่ commit closed enum
- Park: relation patterns that emerge (spawned, reflected, seeded, etc.) may consolidate as vocabulary later (like tags) — data-driven, not designed upfront

### 2.2 · Photo sidecar — commentary thread
**Storage decision DEFERRED** between:
- (a) `commentary: [{ author: 'peat'|'netra', date, body }]` array in sidecar frontmatter — explicit, version-controlled, easy to render
- (b) bind to NETRA chat history at runtime — chat sessions tagged by photo id, promote individual messages to "commentary" on demand
- Recommended starting point: **(a) explicit sidecar field** + NETRA chat can write to sidecar via console as "promote message to commentary" action

### 2.3 · Console workspace state
- `.console/positions.json` — graph editor node positions (workspace-private, gitignored)
- `.console/drafts/` — unpublished drafts (gitignored)

---

## 3 · Routes & components to create

### 3.1 · Routes (new)
- `app/photos/[roll]/page.tsx` — roll-index / contact sheet
- `app/articles/[slug]/page.tsx` — article entry
- `app/fiction/[slug]/page.tsx` — fiction entry
- `app/console/page.tsx` — authoring console (dev-mode-gated)
- Overlay component mounted at root layout: `/` hotkey trigger → `<TriangulateSearch />` overlay

### 3.2 · Components (new — high-level)
- `<TriangulateSearch />` — overlay (`q.bar`, filter row, results grid, tri-panel with live mini-globe)
- `<TriangulateGlobe />` (or extend existing WorldlineGlobe) — mini-globe inside search overlay (348px aspect-1)
- `<ResultCard />` — search result row with kind glyph + title + meta + coord + range + alive signal
- `<EntryShell />` — common entry-page shell (title + body + § self-depth + § worldline + NETRA console)
- `<ArticleEntry />` (server) — article body render + patches/worldline sections
- `<FictionEntry />` (server) — fiction body + α variants + worldline sections
- `<PhotoCommentaryThread />` (server) — Peat + NETRA dialogue render
- `<WorldlineLinks />` (server) — bidirectional 1-hop graph for entry page
- `<RollIndex />` (server) — contact sheet of photo roll
- `<ConsoleShell />` (client) — console layout (entries list + worldline canvas)
- `<WorldlineCanvas />` (client) — react-flow graph editor
- `<EntryForm />` (client) — add/edit entry form
- `<PrevNextNav />` (client) — within-page navigation for photo entries (button + keyboard + swipe)

### 3.3 · Helpers / lib additions
- `lib/content/worldline.ts` — aggregate worldline_links · compute incoming · expose 1-hop neighborhood per entry
- `lib/content/photos.ts` — extend with `getRollContacts(roll: string)` for roll-index page
- `lib/content/index.ts` — search index builder hook (call pagefind during build)
- `lib/console/file-ops.ts` (server actions) — write mdx files · trigger photo processor · save positions

---

## 4 · Infrastructure additions needed

| item | owner | notes |
|---|---|---|
| pagefind install + build integration | Procyon (build pipeline) + Canopus (harness wrapper) | npm install pagefind · post-velite build step `pagefind --site .next` · multilang config for Thai segmentation |
| react-flow install + Worldline styling tokens | Sirius (console implementation) + Betelgeuse (token mapping) | npm install reactflow · custom node + edge renderers |
| Console route bundle splitting | Canopus (build config) | Next.js conditional rendering / dynamic import gated by `process.env.NODE_ENV` |
| Photo commentary → NETRA chat binding | Arcturus (NETRA territory) | new chat tool `comment_on_photo(photo_id, body)` · writes to sidecar commentary array |
| Worldline-weave reverse-lookup | Procyon (velite plugin) | build-time scan of all entries' `worldline_links: [{ to }]` arrays · emit reverse-index for entry page consumption |
| Worldline graph schema validation | Procyon (zod schema in velite) | validate `worldline_links[].to` resolves to existing entry · warn on broken links |
| Globe pin → side panel `[OPEN ↗]` CTA | Sirius (WorldlineGlobe.tsx edit) | extend existing side panel to include kind-specific dedicated-route link |

---

## 5 · Open follow-ups (impl-time decisions, NOT vision-time)

These do NOT need Peat input at vision level — answer when implementing:

1. **Within-page nav scope** — within roll only / cross-roll? · last entry's "next" wraps / stops / cross-roll?
2. **Photo commentary storage** — sidecar field (a) vs bind chat history (b) — recommend (a) explicit
3. **Console portable migration trigger** — observe Peat tending; offer when he says "I want to add note from phone"
4. **Edge taxonomy emergence** — track relation labels Peat writes free-text; consolidate as suggested vocabulary in console (like tag auto-complete) when patterns crystallize
5. **Worldline canvas position storage** — workspace settings file (decided) · re-verify when implementing if conflicts arise
6. **Pagefind multilang config exact form** — Thai segmentation plugin · check pagefind v1.x docs at implementation time
7. **Roll-index design** — contact-sheet layout · paper-strip grid? thumbnail bands? — needs Betelgeuse design spec
8. **Article entry design** — body render typography · §patches accordion vs always-visible? — needs Betelgeuse design spec
9. **Fiction entry design** — α variant cards · tendril-line connectors? — needs Betelgeuse design spec
10. **Console entry-form UI** — form fields per kind · MDX body editor (textarea + preview pane sufficient for v1?)

---

## 6 · What's currently LIVE vs what this vision adds

### Currently LIVE (as of session close)
- `/photos/<roll>/<id>` D3 ship (paper-mount + EXIF + filmSim CSS toggle + NETRA L1)
- Globe pin click → side panel (camera-focus + in-frame summary) — for all kinds
- `Nav` strip with `◇ INDEX · ◇ TRACES · ◇ ARCHIVE · ◇ TRANSMIT` (ARCHIVE link is dangling — to be wired to overlay)
- `ChapterIndex` (homepage section, RECENT_ENTRIES inline)
- `WorldlineGlobe` with stratum chooser (Ne0/NeX/Ne0N/FULL)
- `/api/chat` NETRA endpoint
- velite content pipeline (articles + fiction + photoSidecars collections)
- worldline-design skill (gitignored, Worldline reference) — `.claude/skills/worldline-design/`
- soul-atlas gallery v0.0.1 (17 atoms incl. paper-mount as of D3 ship)

### What this vision adds
- 5 new routes (`/photos/<roll>` · `/articles/<slug>` · `/fiction/<slug>` · `/console` · search overlay primitive)
- 2 schema additions (`worldline_links` + photo `commentary`)
- 1 new build-time index (pagefind)
- 1 build-time aggregation (worldline-weave reverse-lookup)
- 1 new lib dep (react-flow)
- Globe pin side panel: extend with `[OPEN ↗]` CTA
- WorldlineGlobe: NeX stratum gains full worldline-weave DAG visualization (MIRAI M1/M2/M3 scope)
- NETRA console + photo sidecar binding

---

## 7 · Recommended next-session entry point

**Multi-ship plan** — break into ~5 independent ships ที่สามารถ ship sequentially หรือ parallel ที่บางจุด:

| ship | scope | dependencies | owner-lead |
|---|---|---|---|
| **S1 · Roll-index** | `/photos/<roll>` contact sheet · closes D3's back-link gap | none | Betelgeuse spec → Sirius |
| **S2 · Article + Fiction entry routes** | `/articles/<slug>` · `/fiction/<slug>` · γ2 promotion · in-page §patches and §variants (L2a) | none | Betelgeuse spec → Sirius (per-kind) |
| **S3 · Worldline schema + reverse-lookup** | `worldline_links` velite schema + reverse-index helper · §worldline section component (L2b local view) | (none, but pairs with S2 to be useful) | Procyon (schema + helper) + Sirius (component) |
| **S4 · Triangulate Search overlay** | pagefind install + index + overlay component · `/` hotkey · Nav `◇ ARCHIVE` rewire | requires S1+S2+S3 for full result-set; can ship narrower scope first | Procyon (pagefind) + Betelgeuse (spec) + Sirius |
| **S5 · Console MVP** | `/console` route · entry CRUD form · react-flow worldline canvas · file-write actions | requires S3 (worldline schema) · ideally S2 (entry route templates) | Sirius + Altair (file-write actions) + Betelgeuse (spec) |
| **(later)** S6 · NeX globe worldline-weave global view | M1 branch node + M2 dense-cluster layout + M3 α-history trail | requires S3 data foundation | Sirius (Three.js) + Betelgeuse |
| **(later)** S7 · Photo commentary thread | `commentary` schema + NETRA chat binding | requires S2 entry route established + Arcturus chat tool | Procyon + Arcturus + Sirius |

**Suggested first ship next session:** S1 + S3 parallel (lowest dependencies · highest unlock value), OR S2 (kind-symmetry · γ2 promotion completes the route hierarchy)

---

## 8 · Materials referenced this session

- **Claude Design bundle** `XuDE8-ALJpqOH3InvtCa7g` — 122MB gzipped tarball
  - Extracted: `/tmp/wl-design-extracted/my-personal-website/README.md` + `project/Worldline Pages v1.html`
  - Useful section in HTML: lines 338-440 (CSS) + 1279-1410 (TriangulateSearch React component)
  - Note: bundle has 9 chat transcripts + 246 files total; only `Worldline Pages v1.html` triangulate-search section is current vision input. Other pages flagged by Peat as "concept มันยังพังๆอยู่" — DO NOT consume as canonical
  - If next session wants to re-extract: `curl -sS -o /tmp/wl-design-bundle.html "https://api.anthropic.com/v1/design/h/XuDE8-ALJpqOH3InvtCa7g" && gunzip -c ... | tar -xf -`

- **Memory written this session:**
  - `feedback_grilling_proposal_wall.md` — meta-feedback to Polaris (must NOT wall Peat with fully-formed N-option proposals)

- **Memory updated by Peat himself during session** (Polaris should respect):
  - `feedback_commit_at_boundary.md` — close-out must include propose-commit step
  - `feedback_main_branch_web_only.md` — main contains ONLY production website; soul-atlas + harness + team infra stay off main

---

## 9 · Process notes for next session

1. **Open this doc first** — it's the cold-start handoff for the multi-ship plan
2. **DO NOT re-grill** the locked decisions in §1 unless Peat explicitly opens them — they were Peat-driven and final
3. **Apply `feedback_grilling_proposal_wall`** memory — when stewarding through impl-time decisions, separate real branches from defaults; one narrow Q at a time
4. **Apply `feedback_main_branch_web_only`** — only the production-website pieces (routes, components, schema, build infra) go to main; console internal state (`.console/`) and team docs stay off
5. **Apply `feedback_commit_at_boundary`** — propose commit at every ship close, don't let dirty diffs accumulate
6. **D3 ship close-out memory bookkeeping** — already done at session close 2026-05-30 (STATUS.md entry exists)

---

*polaris · α-OPS-00 · 2026-05-31 grill session close*
