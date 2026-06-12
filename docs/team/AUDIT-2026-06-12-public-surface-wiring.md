# Public-surface wiring audit · 2026-06-12

> **Status:** synthesized · classifications definitive
> **Author:** Polaris program, synth slice (merging 3 code-side interaction maps + 2 browser probes + full interaction inventory)
> **Baseline:** commit `d1168d8` (HEAD at probe time) on `genesis/soul-factory` · dev server `localhost:3000` · probes via chrome-devtools MCP, anonymous visitor, `/console` untouched
> **Soul anchors read first:** `.claude/skills/worldline-soul/SKILL.md` · `docs/team/VISION-2026-05-31-search-lineage-console.md`
> **Evidence:** `.harness/wl-probe/` (home/globe shots) · `.harness/probe-shots/` (archive/content shots)

---

## 0 · Method + rubric

Every interactive affordance on the public surfaces was (a) mapped code-side (handler → wiring destination), (b) probed in a real browser, then (c) merged here. Every **non-working** interaction gets exactly one classification:

| class | meaning |
|---|---|
| **BROKEN** | code intends behavior; it errors, mis-targets, or no-ops |
| **DATA-GAP** | wiring is fine; the target content/data is missing (place not in registry, 0 edges, placeholder URL) |
| **INTENTIONAL-INERT** | matches Worldline's soul — the site is an EXPLORATION; telemetry-shell level-1 is deliberate; depth is earned, not displayed |
| **ENV** | dev-only artifact (pagefind absence pre-build, on-demand route compile latency) |

**Strictness rule applied:** worldline-soul §"What this does and does NOT mean" — *"It does NOT mean leave bugs."* An affordance that visually invites interaction and then silently fails is a broken promise, not a veil. Nothing below is laundered as soul.

**Concurrent-edit caveat:** during the probe window, agent α-SUR-01 (wiring-wave1) landed **uncommitted working-tree fixes** for 5 findings (`ChapterIndex.tsx`, `FooterManifesto.tsx` mailto, `MarginaliaHUD.tsx`, `WorldlineGlobe.tsx` occlusion guard + fiction hit proxies). Classifications below reflect the **shipped HEAD state**; the `status` column marks in-flight fixes (verified present in working tree by this synth, diff-read 2026-06-12). One transient incident: a mid-flight JSX syntax error in `ChapterIndex.tsx` 500'd the entire dev server for ~1 min during the probe — recovered; not a site bug (logged in §8).

---

## 1 · Peat-named findings — definitive classification

### 1.1 · ATTRACTOR FIELDS dead click — **BROKEN · blocks-exploration**

- **Probe ground truth:** clicking the `coffee` pill restyles the pill to active and *nothing else* — URL unchanged, all 4 chapter entries still shown, no filter, no navigation, no console output. Confirmed against home §02, screenshot `.harness/wl-probe/11-attractor-coffee-active.png`.
- **Root cause:** `components/AttractorFields.tsx:28` — `onClick={() => setActive(tag)}` writes a local `useState` that **no consumer reads** outside the pill's own styling (`:23` `isActive = tag === active`). Dead handler + dead state. No filtering logic, no event dispatch, no router call anywhere downstream.
- **Why not INTENTIONAL-INERT:** the section header says `ATTRACTOR FIELDS // BROWSE BY DOMAIN` — an explicit invitation to browse. A pill that toggles its own active style and goes nowhere is a broken affordance promise (design-everyday-things signifier violation), not earned mystery. Soul check: an *invitation* must lead somewhere when accepted.
- **Owner:** sirius · **Fix-size:** M (the wiring target is a design decision — see §7 open question Q1; the smallest soul-consistent default is client-side filter of ChapterIndex, mirroring the dig idiom).

### 1.2 · Tokyo node "012" unclickable — **DATA-GAP · degrades**

- **Probe ground truth:** exact-coordinate click at sphere 35.33/139.50 (0.38° from Tokyo) plus a 3px-grid fine scan ±12px: cursor never becomes pointer, click produces no panel/selection, NETRA stays standby. The nearest pointer-cursor footprint belongs to Kyoto's hit proxy.
- **Root cause:** Tokyo exists **only** in `OBSERVER_NODES` (`lib/entries.ts:42-45`, label `"012"`, *"narrative · active branch"*) and is **absent from `lib/content/place-registry.data.json`** (which contains exactly bangkok, kyoto, chiang-mai, yirgacheffe). Place hit proxies are built per `PLACE_REGISTRY` entry (`WorldlineGlobe.tsx:451-497` via `getPlacesSummary()`); observer nodes get no raycast proxy by design. The click wiring itself is fine — there is simply no place data behind Tokyo.
- **Why DATA-GAP not BROKEN:** observer nodes (α, 047 Point Nemo) are deliberately jump-only camera anchors — that pattern is intentional and α/047 are classified INTENTIONAL-INERT below. Tokyo is the carve-out: it *renders indistinguishably from a clickable node* and references a place with no registry entry and no store records — the literal data-gap case. It IS reachable via NETRA `⟶ NEXT NODE` jump (camera lock, no panel), so the earned path exists; the surface click can't be honored because the data isn't there.
- **Owner:** procyon (place registry + records) with sirius assist (if the decision is to visually differentiate observer nodes instead) · **Fix-size:** S either way · decision seam in §7 Q2.

---

## 2 · Surface tables

Severity scale: **blocks-exploration** > **degrades** > **cosmetic**. `status` = shipped / **in-flight** (α-SUR-01 working-tree fix present, needs verify+commit).

### 2.A · Home — boot, hero, chrome

| element | probe result | class | severity | root cause | owner | fix | status |
|---|---|---|---|---|---|---|---|
| BootSequence typing + session gate | 7 lines ~2.7s, `wl:boot-seen` set, replay suppressed; auto-timed (no button — inventory wording corrected) | WORKS | — | — | — | — | shipped |
| HeroBlock stagger fade-in | all elements at rest opacity 1, blur 0 | WORKS | — | — | — | — | shipped |
| Divergence meter (ambient) | live drift 1.130426↔1.130393, display-only by design | WORKS | — | — | — | — | shipped |
| Corner marks | pure decoration, aria-hidden | WORKS | — | — | — | — | shipped |
| MarginaliaHUD drift + scroll meter | −1.300→+1.300, 100.00% fill | WORKS | — | — | — | — | shipped |
| MarginaliaHUD section label | §02 ATTRACTOR / §03 FOOTER unreachable — fixed 40%-viewport line never crossed on this page height; bottom still reads § INDEX | BROKEN | cosmetic | `components/MarginaliaHUD.tsx:48` (`mid = innerHeight * 0.4`) | sirius | S | **in-flight** (scroll-proportional mid 0.4→0.85) |

### 2.B · Home — WorldlineGlobe

| element | probe result | class | severity | root cause | owner | fix | status |
|---|---|---|---|---|---|---|---|
| Place-node click ×4 (Bangkok / Chiang Mai / Kyoto / Yirgacheffe) | front-door panel + camera slerp + selected ring, all 4 verified | WORKS | — | — | — | — | shipped |
| Place-node hover glow + pointer cursor | raycast→cursor→NETRA hover narration fires | WORKS | — | — | — | — | shipped |
| Hover coord readout (reticle + SurveyCursor) | live earth-fixed lat/lon stream, mode switching | WORKS | — | — | — | — | shipped |
| Drag-to-orbit | −28.86° for +100px = 0.005 rad/px exact; lock cleared on drag | WORKS | — | — | — | — | shipped |
| Stratum buttons 3/2/1 + toggle-to-all | camera transitions + CURRENT STRATUM labels correct | WORKS | — | — | — | — | shipped |
| Keyboard 1/2/3/0/ESC/D ladder | all verified incl. dig expand + 2-stage ESC | WORKS | — | — | — | — | shipped |
| NETRA ⟶ NEXT NODE jump cycle | full cycle α→012→047→4 places (panels open)→t.001→repeat | WORKS | — | — | — | — | shipped |
| Fiction branch activation via JUMP | t.001 "3 speculative orbits in drift", camera to orbital shell | WORKS | — | — | — | — | shipped |
| Place panel ✕ ESC close · empty-globe click close | both close paths verified | WORKS | — | — | — | — | shipped |
| Dig-deeper records (real links) | `/articles/000`, `/photos/2026-05-bangkok` links render in dig panel | WORKS | — | — | — | — | shipped |
| **Tokyo "012" node click** | **dead — see §1.2** | **DATA-GAP** | degrades | `lib/entries.ts:42-45` vs `lib/content/place-registry.data.json` (absent) | procyon | S | shipped (open) |
| Through-globe phantom click | clicking empty ocean over Panama opened PLACE · CHIANG MAI from far side; 13 phantom pointer points on visible hemisphere | BROKEN | degrades | `WorldlineGlobe.tsx:1226,1241` — onClick/onHover raycast placeObjects hit proxies with no globe-sphere occlusion test | sirius | M | **in-flight** (sphere-distance occlusion guard, ε=0.06) |
| Fiction NeX node direct click | dead — no hit proxy, no cursor affordance; reachable only via JUMP | BROKEN | degrades | `WorldlineGlobe.tsx:1226` raycast list excludes fiction glyphs (built `:1719-1738` without proxies) | sirius | M | **in-flight** (fictionHitObjects registry + occlusion gate) |
| NETRA voice line after ESC-close | keeps narrating closed place until next interaction | BROKEN | cosmetic | stale narration state not reset in close path (panel close → NETRA standby transition missing) | sirius | S | shipped (open) |
| Wheel / zoom | no wheel handler exists; camera radius driven only by stratum/selection | INTENTIONAL-INERT | — | drag-only camera is the instrument design (globe-camera-orbit rule: don't over-zoom) | — | — | by design |
| Observer nodes α / 047 (jump-only camera lock, no panel) | camera lock without panel via JUMP; not surface-clickable | INTENTIONAL-INERT | — | observer anchors are telemetry-shell texture, not place front-doors | — | — | by design |

### 2.C · Home — §01 Chapter Index + §02 Attractor Fields

| element | probe result | class | severity | root cause | owner | fix | status |
|---|---|---|---|---|---|---|---|
| ChapterIndex FILE 000–003 cards | self-referencing anchors — `<a href="#entry-003">` carries `id="entry-003"` itself; click does nothing while real `/articles/00X` routes exist | BROKEN | blocks-exploration | `components/ChapterIndex.tsx:40-46` (HEAD) | sirius | S | **in-flight** (`href={/articles/${e.fileNum}}` landed; needs verify after its transient JSX-error incident) |
| **AttractorFields tag pills (11)** | **dead handler — see §1.1** | **BROKEN** | blocks-exploration | `components/AttractorFields.tsx:28` setState with zero consumers | sirius | M | shipped (open) |

### 2.D · Home — footer (CHANNELS + TRANSMIT)

| element | probe result | class | severity | root cause | owner | fix | status |
|---|---|---|---|---|---|---|---|
| 7 channel/transmit links (anilist, letterboxd, github, airtable.coffee, rss/atom, now page, colophon) | all `href="#"` placeholders; click yanks scroll to top (URL → `/#`) | DATA-GAP | degrades | `components/FooterManifesto.tsx:36-39,61-63` — destination URLs never supplied | procyon (URLs, Peat input) + sirius (wire) + altair (rss/atom feed endpoint) | S (links) / M (feed) | shipped (open) |
| mailto link | was empty `mailto:` at HEAD | DATA-GAP | degrades | `FooterManifesto.tsx:60` | — | S | **in-flight** (real address landed, Peat-authorized) |

### 2.E · Navigation (Nav, global)

| element | probe result | class | severity | root cause | owner | fix | status |
|---|---|---|---|---|---|---|---|
| ◇ ARCHIVE link | navigates to /archive from every surface | WORKS | — | — | — | — | shipped |
| ◇ INDEX / TRACES / TRANSMIT on home | scroll to #hero/#index/#transmit correct | WORKS | — | — | — | — | shipped |
| ◇ INDEX / TRACES / TRANSMIT on entry pages | DEAD on every entry page — fragment targets exist only on home; click appends hash + jumps scroll to top (reads as a reset) | BROKEN | degrades | `components/Nav.tsx:11-16` — `NAV_ITEMS` hrefs are bare fragments (`#hero`) with no home-path prefix | sirius | S | shipped (open) |
| ARCHIVE active-state (accent-orange) | dead code — Nav never mounts on /archive (archive renders its own OBSERVATORY header), so `pathname==='/archive'` never true where Nav exists | BROKEN | cosmetic | `Nav.tsx:153` | sirius | S | shipped (open) |
| StratumIndicator | display-only, aria-hidden, hidden off-globe — per spec | WORKS | — | — | — | — | shipped |

### 2.F · Archive (/archive)

| element | probe result | class | severity | root cause | owner | fix | status |
|---|---|---|---|---|---|---|---|
| Filter pills ART/PHO/FIC click + active-pill re-click → all + URL sync | exact per spec, aria-checked tracks | WORKS | — | — | — | — | shipped |
| Pill hover / focus-blur styling | exact per spec (orange 0.5 border; dashed outline) | WORKS | — | — | — | — | shipped |
| Ledger row click / Enter | router.push(entry.route) both paths | WORKS | — | — | — | — | shipped |
| Row hover ↔ globe pin sync (both directions) | blue highlight ring / `.archive-row-hovered`, verified both ways | WORKS | — | — | — | — | shipped |
| Keyboard `f` → first filter pill | focuses `⟶ NEXT NODE` instead | BROKEN | cosmetic | `ArchiveClient.tsx:173` — `data-archive-filter-region` wraps the ENTIRE right rail; `ArchiveLedger.tsx:373` querySelector returns the readout button that precedes the pills in DOM | sirius | S | shipped (open) |
| Empty-state "clear all filters" | DEAD — clears URL but ledger stays at 0 rows, then flips to the FALSE "// NO ENTRIES SURVEYED YET · RETURN TO ATLAS" branch while 9 entries exist; reachable via unvalidated `?type=<junk>`; only recovery is clicking a filter pill | BROKEN | degrades | dual source of truth: `ArchiveClient.tsx:67-69` init-once `useState` from searchParams (unvalidated `as EntryType` cast, never resyncs) vs `ArchiveLedger.tsx:287-289` live searchParams; clear button (`ArchiveLedger.tsx:439`) does `router.push(pathname)` which only one of the two sees | sirius | M | shipped (open) |
| Empty-state "RETURN TO ATLAS" link | link itself fine, but the state showing it lies (appears with 9 real entries); honest trigger (truly empty archive) unreachable | BROKEN (same cluster as above) | degrades | same root — fold into the clear-filters fix | sirius | (incl.) | shipped (open) |
| /archive skip link | no focus-reveal mechanism at all (inline sr-only, no focus styles); Enter works | BROKEN | cosmetic (a11y) | skip-link block in archive page header (shares pattern with EntryShell — see 2.H) | sirius | S | shipped (open) |
| [ ◯ ATLAS ] header link | navigates home | WORKS | — | — | — | — | shipped |
| In-page query box | not mounted — `ArchiveClient.tsx:22` documents removal; search is overlay-only per FINAL archive-route decision (/archive = EXPLORE, overlay = SEARCH) | INTENTIONAL-INERT | — | decision provenance: Peat 2026-06-04 | — | — | by design (cleanup: untracked orphan `components/ArchiveQuery.tsx` should be removed) |
| Mini-globe: pin click / pin hover preview / free-orbit drag / bare-click anti-bounce | all verified exact (incl. 0.005 rad/px drag, RETICLE STANDBY on bare click, no home-bounce) | WORKS | — | — | — | — | shipped |
| NEXT NODE click + hover/focus | cycles locks correctly; disabled at 0 pins | WORKS | — | — | — | — | shipped |
| [ ⌕ survey ] affordance | dispatches `triangulate:open`, overlay opens | WORKS | — | — | — | — | shipped |
| LOAD NEXT 20 pagination | correctly gated below 20-entry threshold (unreachable with 9-entry corpus — gating verified in code) | WORKS | — | — | — | — | shipped |

### 2.G · Triangulate Search overlay

| element | probe result | class | severity | root cause | owner | fix | status |
|---|---|---|---|---|---|---|---|
| `/` hotkey + `triangulate:open` event (global portal) | opens on every probed route, input autofocused | WORKS | — | — | — | — | shipped |
| pagefind search | ONLINE in this dev checkout (index built): coffee→1, bangkok→5, taste→1 | WORKS | — | — | — | — | shipped |
| "kyoto" → NO MATCH | place names / locus text not in the index — search can't find entries by place | DATA-GAP | degrades | pagefind index build omits place/locus fields (VISION §1.1 weights spec place 1× — unimplemented in index config) | procyon | S–M | shipped (open) |
| Result hrefs (canonical), result hover ↔ pin sync, ↑↓ clamp, Enter nav, 2-stage Escape, Tab trap both ways, kind chips, sort toggle, backdrop close, overlay-globe pin click | all verified exact (kind chips are pure radio + ALL reset — inventory's "toggles on re-click" corrected) | WORKS | — | — | — | — | shipped |
| THREE.BufferGeometry "buffer too small" warn | fires on /archive after overlay open/close — globe remount resizes points buffer without dispose | BROKEN | cosmetic | overlay/archive globe teardown missing `.dispose()` on points geometry | sirius | S | shipped (open) |

### 2.H · Entry pages (articles · fiction · EntryShell)

| element | probe result | class | severity | root cause | owner | fix | status |
|---|---|---|---|---|---|---|---|
| Tag pills → `/?tag=…` | navigates (native links); **consumer of `?tag=` on home unverified — see §7 Q1** | WORKS (navigation) | — | — | — | — | shipped |
| Skip link (#entry-main) focus reveal | never becomes visible — inline `left:-9999px` beats the `focus:left-2` class; Enter still works (SR-fine, sighted-keyboard broken) | BROKEN | cosmetic (a11y) | `components/EntryShell.tsx:177-192` inline style vs Tailwind focus class specificity | sirius | S | shipped (open) |
| § worldline neighbor rows | absent on every page — **correctly gated** (`EntryShell.tsx:315-325`) because the corpus has ZERO `worldline_links` frontmatter anywhere: the worldline graph has 0 edges | DATA-GAP | degrades (the L2b weave layer of the vision is invisible) | content gap, not wiring — form-over-foundation known state | procyon | M (author first edges; console/weave tooling) | shipped (open) |
| Pullquotes | zero instances — `components/Pullquote.tsx` exists, no MDX uses it | DATA-GAP | cosmetic | content never authored | procyon | S | shipped (open) |
| Fiction page (transmission-001) | renders complete (variants region, fragment-loss interstitials); console clean | WORKS | — | — | — | — | shipped |

### 2.I · Photos (RollIndex · PhotoEntry · FilmSimSwitcher)

| element | probe result | class | severity | root cause | owner | fix | status |
|---|---|---|---|---|---|---|---|
| Contact-sheet frame links | navigate to `/photos/{roll}/{id}`, PhotoEntry renders (inventory's "roll route does not exist" note outdated — `app/photos/[roll]/page.tsx` exists and works) | WORKS | — | — | — | — | shipped |
| Chiang Mai roll | renders gracefully but EMPTY ("NO FRAMES RECORDED") — store-as-source DB has the roll with 0 published photos; MDX sidecar `DSCF0001.mdx` is NOT the source; direct URL correctly 404s | DATA-GAP | degrades | store (Supabase) publication state, `lib/content/photos.ts` → `lib/store/reads` | procyon | S | shipped (open) |
| Photo / contact images | placeholder boxes ("No image available" / "PRE-STORE IMPORT") — documented v1 no-image state, asset migration pending | DATA-GAP | degrades | object-storage migration not done (foundation-redesign D-track) | procyon | M–L | shipped (open) |
| FilmSimSwitcher (5 sims) | palette dataset + NETRA voice `· cc/vv` + hover all work | WORKS | — | — | — | — | shipped |
| FilmSim current-sim indicator | no aria-pressed / visual active state marks the CURRENT sim | BROKEN | cosmetic (a11y) | `components/FilmSimSwitcher.tsx` buttons lack pressed state | sirius | S | shipped (open) |
| Back links ×4 (ATLAS / ROLL variants) | all hrefs correct, navigation verified | WORKS | — | — | — | — | shipped |
| Frame prev/next nav | absent — VISION §1.4 locked it (button + ←/→ + swipe) but it is unbuilt, deferred scope; not a wiring bug | INTENTIONAL-INERT (deferred backlog) | — | vision-locked, Phase-1-scope deferral | sirius (when scheduled) | M | backlog |
| Optical trace / dig affordance on public photo page | console-only (`components/console/PhotoManager.tsx`) — earned-depth boundary: the public shell shows the instrument surface, authoring depth lives in the console | INTENTIONAL-INERT | — | — | — | — | by design |

### 2.J · Cross-cutting (routes · index · environment)

| element | probe result | class | severity | root cause | owner | fix | status |
|---|---|---|---|---|---|---|---|
| `/articles`, `/photos` index routes | absent by design — /archive IS the explore/index surface (vision routes table never specced kind-index routes) | INTENTIONAL-INERT | — | archive-route decision | — | — | by design |
| 404 rendering for those URLs | **unbranded default Next.js not-found** — no Worldline chrome, no way back | BROKEN | degrades | no `app/not-found.tsx` | sirius | S | shipped (open) |
| pagefind in dev without build | offline fallback by design (`usePagefind.ts:158-165` catch → phase 'offline', ledger unaffected); this checkout has the index so the fallback path itself was unexercisable | ENV | — | — | — | — | by design |
| Dev on-demand route compile latency (~2–3s, looks dead) + Fast Refresh console noise | dev-server artifacts only | ENV | — | — | — | — | dev-only |

---

## 3 · Counts

| classification | count |
|---|---|
| WORKS | 52 |
| BROKEN | 14 |
| DATA-GAP | 7 |
| INTENTIONAL-INERT | 6 |
| ENV | 2 |
| **total distinct affordances audited** | **81** |

Zero console errors across both probe sessions (the only error was the transient concurrent-edit build failure, §8).

---

## 4 · Prioritized fix plan — SIRIUS (components)

| pri | fix | findings covered | size | note |
|---|---|---|---|---|
| P0 | **Wire AttractorFields** — give the pills a consumer | §1.1 | M | blocked on one narrow design Q (§7 Q1); default = client-filter ChapterIndex |
| P0 | **Verify + land the in-flight wiring-wave1 fixes** (ChapterIndex hrefs, globe occlusion guard, fiction hit proxies, MarginaliaHUD mid-line, footer mailto) | 2.C, 2.B ×2, 2.A, 2.D | S (verify) | already in working tree; ChapterIndex had a transient syntax error mid-probe — re-verify in browser before commit |
| P1 | **Archive filter single-source-of-truth** — resync `ArchiveClient.activeType` on URL change (or route the clear button through `handleTypeChange`), validate `?type` against the `EntryType` union, kill the false "no entries surveyed yet" branch | 2.F clear-filters cluster (3 rows) | M | the BUG-1 perf fix drifted into a state bifurcation; keep the no-remount property |
| P1 | **Nav fragment hrefs** → `/#hero` etc. so INDEX/TRACES/TRANSMIT work from entry pages | 2.E | S | |
| P1 | **Branded `app/not-found.tsx`** | 2.J | S | unbranded 404 is the only no-way-back dead end on the site |
| P2 | **Skip-link focus reveal** — drop inline `left:-9999px` for an sr-only class with focus styles; apply to EntryShell AND /archive header | 2.H + 2.F | S | one shared pattern fix |
| P2 | **`f` shortcut scope** — move `data-archive-filter-region` onto the pills wrapper (or tighten the selector) | 2.F | S | |
| P3 | Cosmetics: NETRA stale narration reset on panel close · points-geometry `.dispose()` on overlay globe teardown · FilmSim `aria-pressed` · remove (or properly mount) Nav ARCHIVE active-state dead code | 2.B, 2.G, 2.I, 2.E | S each | |

## 5 · Prioritized fix plan — PROCYON (data/store)

| pri | fix | findings covered | size | note |
|---|---|---|---|---|
| P0 | **Tokyo "012"** — either (a) promote to `place-registry.data.json` + publish records at Tokyo, or (b) keep as observer anchor and have the globe render observer nodes visually distinct from clickable places | §1.2 | S | decision seam §7 Q2; (b) is the soul-conservative default until Tokyo records exist |
| P1 | **Pagefind place/locus coverage** — index place names so "kyoto" finds Kyoto-locus entries (VISION §1.1 specs place at 1× weight) | 2.G | S–M | |
| P1 | **Footer channel URLs** — collect real destinations from Peat (anilist, letterboxd, github, airtable.coffee, now, colophon) and wire; until then render as non-links | 2.D | S | scroll-yank side effect disappears with the sirius wire-up |
| P2 | **Chiang Mai roll** — publish the photos in the store or close the roll out of the registry | 2.I | S | store is the source; the MDX sidecar is a red herring |
| P2 | **First worldline edges** — author initial `worldline_links` so the L2b weave layer exists at all | 2.H | M | the 0-edge graph keeps §worldline invisible site-wide; pairs with foundation-redesign tending tools |
| P3 | Photo asset migration (placeholders → real images) | 2.I | M–L | tracked under foundation redesign D-track |
| P3 | Pullquote: author one or remove the component | 2.H | S | |

## 6 · Prioritized fix plan — ALTAIR (server)

| pri | fix | findings covered | size | note |
|---|---|---|---|---|
| P2 | RSS/Atom feed endpoint (backing the footer `rss / atom` link) | 2.D | M | only server-side gap this audit; everything else server-side held clean |

## 7 · Open decision seams (Peat input, one narrow Q each)

1. **Q1 — where should a tag/domain click land?** AttractorFields pills (§1.1) and EntryShell tag pills (`/?tag=…`) need ONE shared destination. Today `/?tag=` has no verified consumer on home — likely the same dead-end. Options: client-filter ChapterIndex in place (default) · open Triangulate pre-queried · a tag facet on /archive. Whatever is chosen should serve both pill families.
2. **Q2 — is Tokyo a place or an observer?** If a place: registry entry + records (panel earns its open). If an observer: keep jump-only but make observer nodes read visually distinct from place nodes so the surface never invites a click it can't honor.

## 8 · Incident + housekeeping notes

- **Concurrent-edit incident:** α-SUR-01's mid-probe `ChapterIndex.tsx` edit briefly shipped a JSX syntax error (`Expected '</', got 'ident'`, line 44) that 500'd ALL dev routes for ~1 min before self-correcting. Audit classifications were taken against pre-fix HEAD; the in-flight fix needs a browser re-verify before commit (feedback: verify what matters).
- **Inventory corrections recorded:** kind chips are radio not toggle · `/photos/{roll}` route exists · pagefind is online in this dev checkout · home DOES mount the globe instrument (the "console-only" claim was wrong) · BootSequence has no button (auto-timed).
- **Orphan file:** untracked `components/ArchiveQuery.tsx` is dead weight after the overlay-only decision — remove at next cleanup.
- **Probe hygiene note:** screenshots saved into the watched project dir (`.harness/wl-probe/`, `.harness/probe-shots/`) trigger Fast Refresh; future probes should save outside the watch root.

---

*polaris program · synth slice · 2026-06-12 — sources: 3 code maps (globe/nav-archive-search/content surfaces) + 2 chrome-devtools probes (33 + 40+ interactions) + full interaction inventory; soul + vision docs read before classification.*
