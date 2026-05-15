# Worldline — Feature Brainstorm

> Status: Draft v0.1 — 2026.05.10
> Source: Iterated from chat thread on the `worldline` Next.js repo
> Audience: Self-reference for build planning + companion to `tech-proposal.md` and `prds/`

---

## 0 · Framing principles

Three filters every feature below has to survive:

1. **Where does the work live?** The site has to actually contain things — articles, photos, fiction, repos. A feature that doesn't connect to real content is decoration.
2. **Why come back?** Every feature should either *create* a loop (something changes between visits) or *deepen* an existing loop. Static showcase = one-and-done.
3. **Kinetic narrative.** The Steins;Gate Re:Boot reference frames feel alive because the worldline is *moving* — shattering, reassembling. The current build is paper sitting still with NETRA narrating over it. Features should make the worldline feel like it's *under repair*, not framed in glass.

Audience principle (per spec): both professional and curious visitors are equal. Fork at the entrance, single content base underneath. Don't build two sites.

Worldline-mechanic principle (per spec, this phase): **light only**. Mechanics serve mood, not gameplay. Heavy mechanics (visitor-driven divergence, multiplayer trace overlays, branching fiction) park in §7 for a later phase.

---

## 1 · Garden foundations (Tier 1)

The four content shapes that make this a real digital garden, not a mood board.

### 1.1 Articles

Long-form prose entries. Extends the existing `Entry` type in `lib/entries.ts`.

- Each entry has: `fileNum`, `title`, `date`, `domain`, `tags`, `status` (seed → ongoing → refined → settled), `readingTime`, `coords` (lat/lon — anchored to a real place that matters to the piece), `summary`, body.
- Status genuinely tracks lifecycle — seeds are public but flagged as raw, settled means done.
- ATLAS pin → entry page navigation already wired; the page itself is what's missing.

### 1.2 Photo journal — Fujifilm X-E5

The single feature with the highest aesthetic-leverage-per-effort ratio because it slots directly into the existing globe.

- Each photo is a node on the ATLAS globe at its real GPS coordinate (X-E5 embeds GPS in EXIF when paired with phone).
- EXIF — film simulation, aperture, shutter, ISO, focal length, GPS — surfaces as A.T.L.A.S. instrument readout, not a caption.
- "Roll" view groups photos by date or trip (analog film-roll metaphor); contact-sheet thumbnail grid.
- Film simulation toggle (Classic Chrome, Reala Ace, Acros, Provia, Velvia) acts as a **site-wide palette switcher**, hooking directly into the existing `data-palette="ink"` toggle in `globals.css`. Each Fuji simulation maps to a defined palette variant.
- Photos can be standalone (just image + EXIF) or paired with an entry (e.g., a photo-essay article).

### 1.3 Short fiction

Different shape from articles — needs a different reading mode.

- Framed as **"intercepted transmissions"** — recovered documents from alternate worldlines. The Steins;Gate framing earns its keep here because *it's fiction*. The metaphor is honest.
- Each story has its own divergence value, distinct from site α (1.130426).
- Reading mode: full-screen, paper texture deepened, typography shifts to a more book-like serif (Cormorant Garamond is already in the stack — variant tuning only).
- Chapter-based for longer pieces with persistent reading position.
- Optional ambient soundscape (Tone.js — already a transitive dep via dependencies). Toggleable, off by default.

### 1.4 GitHub-coupled writeups

Every meaningful repo gets a paired writeup. Bidirectional link.

- Repo card on each writeup pulls live GitHub data (description, stars, primary language, last commit timestamp).
- Each writeup answers four prompts: **what / why / what I learned / what I'd do differently.**
- Repo's commit history visualizes as a worldline timeline — the divergence aesthetic earns its keep here too.
- Tag-driven cross-linking: tags from `ATTRACTOR_FIELDS` in `lib/entries.ts` extend to repos.

> **Skill candidate:** if writeups will scale beyond ~5 repos, a Claude Skill that takes a repo URL + brief notes and produces a populated writeup template (frontmatter + four sections + tag suggestions) saves real time. Worth building once writeup #3 is on disk.

---

## 2 · Audience fork (Tier 2)

Resolves the "ทั้งคู่เท่ากัน" answer literally.

After boot sequence completes, before hero, two paths offered:

```
SURVEY BY CRAFT          SURVEY BY TRACE
(professional path)      (curious path)
↓                        ↓
portfolio · github       photos · fiction
articles · resume        coffee · films
```

- Same content base; different landing curation.
- Choice persists in `sessionStorage` (matching existing `wl:boot-seen` pattern in `PageShell.tsx`).
- "Switch worldline" affordance is always reachable from nav.
- ATLAS strata mapping holds: Ne0 = craft, NeX = trace, Ne0N = where they meet (about/values/manifesto).

---

## 3 · Reading & navigation (Tier 3)

What's missing that turns the site from showcase into something usable.

### 3.1 Entry page template

The current ATLAS side panel shows a summary; the actual reading surface doesn't exist yet.

- Header: drift coordinates, status badge, patches log link, reading time.
- Body: prose with marginal sidenotes (the existing right-edge marginalia HUD generalizes to per-entry footnotes).
- **Patches log** at the bottom — a real worldline-flavored revision history:
  ```
  PATCH 03 · 2026.05.08 — added section on extraction curve
  PATCH 02 · 2026.04.30 — fixed ratio math
  PATCH 01 · 2026.04.28 — initial commit
  ```
  Makes "digital garden" literal, not aspirational.
- Footer: related branches (entries sharing the same attractor field), navigation to next/previous in chronological worldline.

### 3.2 Triangulate search

Search reframed as a survey instrument.

- `/` hotkey opens search overlay.
- Results render as both a coordinate list *and* active pins on a mini-globe.
- Each result shows drift distance from α (Bangkok, the observer's locus).
- Implementation: static search index built at build time (Pagefind) — no server, fits the Next.js static-export aesthetic.

### 3.3 Worldline timeline view

`/timeline` route. Horizontal scroll. Every entry, photo, repo as a node on the divergence line. Time flows left to right; vertical position drifts with α value at that moment. Hover any node for a quick read, click to navigate.

### 3.4 Now page

`/now` — current state of the gardener. Updated frequently. Currently working on, currently reading, currently shooting (latest film roll), currently brewing. Signal that the site is *alive*, not abandoned. Industry convention from nownownow.com — fits the worldline vocabulary perfectly because "now" is just a point on the line.

### 3.5 RSS / Atom feeds

`/feed.xml`, `/photos.xml`, `/fiction.xml`, `/articles.xml`. Already promised in the footer; needs to actually exist. Critical for the digital-garden audience — they live in feed readers.

### 3.6 Colophon

`/colophon` — the "how this site was built" page. Tools, fonts (Cormorant Garamond, JetBrains Mono, Special Elite — already loaded), references, design philosophy, link to repo, list of intentional easter eggs you've already shared. Self-aware; doesn't spoil the unintentional ones.

---

## 4 · NETRA beyond narrator (Tier 4)

Currently NETRA narrates instrument state. Expanding the surface without breaking the voice.

### 4.1 NETRA chat — grounded

The original Ne0EX vision returns, but only now does it have *grounding* (real content to draw from).

- Pull entries / repos / photos into context based on query intent.
- Speaks in the established NETRA voice — italic, lowercase, terse. Same voice as `atlas-netra-voice` in the existing build.
- Rate limit: 50 messages/day per session (continues prior decision).
- Chat surface: opens as a dedicated stratum of ATLAS (a fifth strata-button option), or as a slide-in panel from right edge — designer's call. Leaning toward dedicated stratum since the framing is consistent.

### 4.2 NETRA whispers

Reader idles on an entry > 20 seconds → NETRA quietly inserts one marginal note in the right margin. Non-modal, non-blocking, fades in. Signal of presence, not intervention.

### 4.3 NETRA daily intercept

Single rotating line on the marginalia HUD that updates daily. Format: `day 042 since last patch · drift stable · α holding`. Generated from real site state (last commit date, current divergence drift, etc.). Site feels alive without having to actually update content every day.

### 4.4 NETRA as curator

The existing ATLAS `⟶ NEXT NODE` button gets smarter. Currently cycles through observer/entry nodes deterministically; upgrade to weighted suggestion based on what the visitor hasn't seen this session, what's recently been patched, and what shares attractor fields with what they've read.

---

## 5 · Light worldline mechanics (Tier 5)

Phase 1 mechanics only. Heavier mechanics → §7.

### 5.1 Per-visit drift

Every visit nudges the divergence value by a microscopic amount (±0.000001 range). Stored in `localStorage`. Each visitor accumulates their own personal drift. Visible only after multiple visits — payoff for return.

### 5.2 Patch counter

When any entry updates (build-time signal), divergence value executes one visible drift animation site-wide on next load. Microcopy: `PATCH DEPLOYED · α drift +0.000003`. Makes the "garden growing" claim tangible.

### 5.3 Anchor pinning

Bookmark equivalent. Reader anchors an entry → it gets a ⚓ glyph in all subsequent browse views. Personal anchored list at `/anchored`. Local storage only. No login required, ever.

### 5.4 Worldline weather

Site-wide ambient state shifting on a 24h cycle and weighted by recent activity (patches in the last 7 days). Subtle — appears as a one-line readout in the marginalia HUD: `worldline · clear · drift +0.000002/hr`. Not gameplay, just texture.

---

## 6 · Easter eggs (Tier 6)

Steins;Gate-flavored hidden moments. Volume is deliberately low so finding one feels like a real find.

### 6.1 Konami code → alternate palette

`↑↑↓↓←→←→BA` switches `data-palette` to the existing `ink` (navy) backup palette. The codebase already has the palette toggle wired; this just exposes it. Microcopy: `ALTERNATE WORLDLINE ACCESSED.`

### 6.2 El Psy Kongroo

Typing this string anywhere on the site triggers the glitch-shatter transition seen in the Re:Boot reference frames, then reloads with a rare boot sequence variant.

### 6.3 D-mail phone receiver

Single ☎ glyph hidden somewhere on the site. Click → "D-mail interface": short text input. The message you submit appears in the marginalia HUD of a future visitor (rotating, ephemeral pool, decays after N days). Read-only for everyone except the sender. Anonymous.

### 6.4 Schrödinger entry

One entry that renders differently on each visit (random selection from N variants). No flag, no announcement. Visitors who notice the variation on a return visit get a quiet acknowledgment.

### 6.5 Boot sequence variants

1% of page loads trigger a rare boot sequence with NETRA saying something off-script (`WORLDLINE 1.130426 — anomaly detected at coordinate α. patching.` etc.).

### 6.6 Glitch reporter

One intentional typo or off-by-one error somewhere on the site. Visitors who notice and report it via the contact channel get credit on `/colophon`. Lightweight community feedback loop.

---

## 7 · Phase 2 parking lot

Heavier mechanics. Park them; revisit when phase 1 ships.

- **Trace overlay** — visitors leave ephemeral markers at globe coordinates. Comments without being comments. Decay after 30 days.
- **Branching fiction** — choose-your-path stories. Each choice modifies a per-reader divergence value.
- **Reader-contributed divergence** — site α drifts based on aggregate visitor state, not just owner edits.
- **Worldline jumps** — unlockable alternate themed views (Re:0 noir mode, sun-bleached summer mode). The palette toggle is the technical scaffolding; new palettes are content.
- **Audio companion** — per-persona soundscape via Tone.js. Subtle ambient. Toggleable.

---

## 8 · Recommended build order

Numbered for build sequence; each item maps to a PRD in `/prds/`.

1. **Entry pages** (PRD 01) — three templates (article, photo, fiction), three real entries minimum. Proves the content layer works.
2. **Audience fork** (PRD 02) — post-boot path selector. Resolves the audience answer immediately.
3. **Photo + ATLAS integration** (PRD 03) — highest aesthetic leverage, uses existing globe code.
4. **Triangulate search + RSS** (PRD 04) — discoverability + feed-reader audience.
5. **NETRA chat — first answer** (PRD 05) — grounded chat over real content.

Tier 5 mechanics, Tier 6 eggs, GitHub coupling: layered in opportunistically once the above ship. Don't gate ship of (1)–(5) on (6)+.

---

## 9 · Open decisions

- **Content authoring format.** MDX vs plain markdown + remark/rehype vs a content-management library (velite, fumadocs). Tech proposal recommends velite; revisit if MDX components start fighting the React Server Components model in Next 16.
- **Photo storage.** Self-hosted in `/public/photos/` (simple, slow if collection grows) vs object storage (R2, S3) with a CDN. Start self-hosted; migrate when the folder hits ~500 images.
- **NETRA chat backend hosting.** Vercel route handler vs separate API service. Start with Next.js route handler; promote out only if rate-limit / cost shape demands it.
- **D-mail moderation.** Submitted messages need light moderation (spam, abuse). Manual review in v1; flag/block list later. Worth deferring until eggs ship.

---

## 10 · Skill candidates

Worth wrapping into Claude Skills if patterns recur:

- **Repo writeup template** — `repo-url + notes → frontmatter + four-section MDX draft`. Builds when writeup #3 is on disk.
- **Photo entry from EXIF** — `image file → frontmatter (date, GPS, EXIF, suggested tags) + draft body`. Builds when the photo journal hits ~20 entries.
- **Worldline patch log entry** — `git log diff → patches log line + microcopy`. Possibly a build-step utility, not a Skill.

---

*End of document. See `tech-proposal.md` for stack additions, `/prds/` for per-feature requirements.*
