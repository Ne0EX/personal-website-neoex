# Worldline · UX Journey Improvement Spec

> Status · FINAL · 2026-06-14
> Author · Betelgeuse (α-VIS-04)
> Predecessor docs · `journey-architecture.md` v1.2 · `60-responsive-system.md` v1.0
> Audit basis · Four persona audits (first-time / recruiter / explorer / mobile) · 2026-06-14
> Soul guard · worldline-soul (exploration not exhibition; meaning earned) · feedback_visual_language (one direction, one variable) · feedback_feeling_before_form
>
> This spec synthesizes the four persona audits into a prioritized improvement list.
> It does NOT redesign the Globe, the entry surfaces, or the NETRA surface — those
> have their own specs. It addresses the journey seams: how a visitor arrives, finds
> their footing, and moves forward without the site becoming an exhibition.

---

## 1 · Consolidated current-journey map

Four personas. Each column records the friction that actually blocks or degrades the
journey — not the soul of the surface, which is intact.

### 1.1 First-time anonymous visitor (cold, ~30 seconds of patience)

```
STEP                    SURFACE           EXPERIENCE                FRICTION           SEVERITY
─────────────────────────────────────────────────────────────────────────────────────────────────
1. Land on /            Hero + Nav        Aesthetic lands cleanly.  No person name.    DEGRADES
                                          Instrument register        No 'about' anchor.
                                          immediate.                 Nav opaque.
                                          No 'who is this?'

2. Globe block          A.T.L.A.S.        Visually dominant.        Zero context for   DEGRADES
                                          NeX / Ne0N / Ne0 strata   cosmological
                                          fully opaque. NETRA       vocabulary.
                                          STANDBY reads as error.

3. Chapter index        §01 RECENT        4 articles. FILE — 000    GENESIS article    COSMETIC
                        TRACES            ('notes from a paused     listed last; no
                                          engineer') gives first     'start here'
                                          identity signal.           hierarchy.

4. Attractor pills      §02 BROWSE        8 of 10 pills disabled.   HARNESS ENG. /     COSMETIC
                        BY DOMAIN         CUBIC COPPER / HARNESS    CUBIC COPPER are
                                          ENG. inscrutable.         insider terms.

5. Footer               FooterManifesto   Manifesto is good.        7 of 8 channel     DEGRADES
                                          Email is live.             links are href='#'.

6. Who is this?         All surfaces      Bangkok/Thailand known.   No full name.      DEGRADES
                                          Ne0EX / NEOSPIRIT are     No role. No bio.
                                          handles, not identity.

7. Article /000         /articles/000     Strongest identity        No byline. Name    DEGRADES
                                          surface. Voice clear.     never stated.
                                          Confirms: engineer,        No 'learn more
                                          paused startup, writer.   about author' hook.

8. /archive             Archive ledger    Ledger is useful.         No persistent Nav. DEGRADES
                                          CHATGPTIMAGE slug         Island routing.
                                          visible as first entry.

9. TRANSMIT dead-end    Footer #transmit  Email lives.              now page / rss /   DEGRADES
                                          Nothing else.             colophon all dead.

10. OG share card       Meta tags         No preview on any share.  Blank unfurl on    DEGRADES
                                          First impression for       Slack/LinkedIn.
                                          shared-link arrivals is
                                          nothing.
```

### 1.2 Recruiter (60 seconds, one goal: who / what / resume)

```
STEP                    SURFACE           EXPERIENCE                FRICTION           SEVERITY
─────────────────────────────────────────────────────────────────────────────────────────────────
1. Above-fold scan      / (hero + nav)    No name, no role,         Zero identity      BLOCKS
                                          no About, no resume.      signal above fold.

2. Nav scan             Nav.tsx           INDEX / TRACES /          No ABOUT slot.     BLOCKS
                                          FRAMES / ARCHIVE /        No forwarding
                                          TRANSMIT. None map        hint.
                                          to 'About' or 'Resume'.

3. Footer               FooterManifesto   GitHub label present.     GitHub href='#'.   BLOCKS
                                          LinkedIn absent.           No resume link.
                                          Email obfuscated.         No name expansion.

4. Article /000         /articles/000     Closest thing to a bio.   5-min philosophy   BLOCKS
                                          Rich voice. No name,       essay with zero
                                          no role, no stack,        extractable facts.
                                          no company history.

5. /archive             /archive          Full-viewport globe.      Vocabulary 100%    BLOCKS
                                          No projects list.          internal.
                                          No skills matrix.

6. No resume signpost   All surfaces      resume.neoex.com does     No placeholder,    BLOCKS
                                          not exist AND has no      no forwarding
                                          pointer anywhere on       text anywhere.
                                          the main site.
```

### 1.3 Returning explorer (knows the soul, wants to go deep)

```
STEP                    SURFACE           EXPERIENCE                FRICTION           SEVERITY
─────────────────────────────────────────────────────────────────────────────────────────────────
1. Homepage stats       HeroBlock         047 ENTRIES hardcoded.    Static hero stats  COSMETIC
                                          Archive shows 9 real      do not match
                                          entries.                  live count.

2. Chapter index        §01               4 entries from static     New store entries  DEGRADES
                                          RECENT_ENTRIES array.     never appear.
                                          Live store has 9.         8/10 attractor
                                                                    pills dead.

3. Article body         /articles/*       Header renders. Body      Full MDX body      BLOCKS
                                          shows lede only. 1        never rendered.
                                          paragraph. Page ends.     TODO(Procyon)
                                                                    wire unresolved.

4. WorldlineLinks       All entries       § WORLDLINE section       0 edges in store.  BLOCKS
                                          invisible everywhere.     No inter-entry
                                          0 edges in graph.         connective tissue.

5. Fiction              /fiction/*        Body renders in full.     Tag links dead     COSMETIC
                                          Strongest read surface.   (/?tag= ignored).
                                          WorldlineLinks absent.

6. /archive ledger      /archive          9 entries across types.   No persistent nav. COSMETIC
                                          Year grouping works.       CHATGPTIMAGE slug
                                          Triangulate works.         visible in ledger.

7. Tag pill links       EntryShell        Pills visible on all      /?tag= routes to   DEGRADES
                                          entries. Visually         homepage, filter
                                          suggest filtering.         param discarded.

8. Footer channels      FooterManifesto   Anilist / Letterboxd /    7 of 8 dead.       DEGRADES
                                          GitHub / Airtable.coffee  No indication
                                          all dead.                  links are future
                                                                    placeholders.

9. Photo gallery        /photos           CHATGPTIMAGE renders.     3 of 4 Bangkok     DEGRADES
                                          Captions evocative.       frames: AWAITING
                                                                    IMAGE.

10. Per-photo page      /photos/*/id      Page loads. Caption       Body field empty   DEGRADES
                                          present. No image for     for all photos.
                                          DSCF entries.             Nothing to dwell on.
```

### 1.4 Mobile visitor (iPhone 15, 390×844, iOS Safari)

```
STEP                    SURFACE           EXPERIENCE                FRICTION           SEVERITY
─────────────────────────────────────────────────────────────────────────────────────────────────
1. Hero above fold      /                 H1 legible. Nav two-row   Nav links 14px     DEGRADES
                                          (TRANSMIT wraps).         tall, 0px padding.
                                                                    Below 44px min.

2. Globe touch          / globe           Canvas renders 324×380.   setPointerCapture  DEGRADES
                                          Stratum buttons           prevents page
                                          adequate (48px).          scroll on touch.

3. NETRA HUD            / NETRA           NEXT NODE 94×24px.        Both buttons below DEGRADES
                                          ESC 44×17px.              44px min height.

4. Article cards        / chapter         354×146px. Full-width.    None.              NONE
                        index             Excellent.

5. Attractor pills      / attractor       Active pills 29px tall.   Below 44px min.    DEGRADES
                                          Disabled spans look       Spans non-
                                          tappable but are not.     interactive but
                                                                    indistinguishable.

6. Footer links         FooterManifesto   12px tall anchors.        All 8 links        DEGRADES
                                          Spaced 18px apart.        un-tappable.
                                          mailto is the only
                                          consequential one.

7. /archive             /archive          46px horizontal overflow. BLOCKS. Two-col    BLOCKS
                                          htmlScrollWidth=436 vs    grid has no mobile
                                          clientWidth=390.          breakpoint. Page
                                          Page unusable.             functionally
                                                                    broken on phone.

8. Article read         /articles/003     Clean. 13.5px / 334px     Nav links 14px     COSMETIC
                                          width. Comfortable.       still. Tag links
                                                                    25px. Skip 24px.

9. Fiction read         /fiction/*        Clean. Same specs.        Nav links only.    COSMETIC

10. Photo gallery       /photos           Gallery cells 326px.      Roll header links  DEGRADES
                                          Tappable. Roll labels     14px tall — the
                                          link to sub-rolls.         primary drill-down
                                                                    affordance fails.

11. Per-photo page      /photos/*/id      Film sim buttons 44px.    objectFit: fill    DEGRADES
                                          BACK TO ROLL 44px.        stretches photos.
                                                                    BACK TO ATLAS
                                                                    31px tall.

12. 404                 /not-found        Brand-consistent.         CTA link 17px tall. DEGRADES
                                          Terse. Good.              Only recovery
                                                                    path un-tappable.
```

---

## 2 · The two-persona reframe

### 2.1 The primary tension

Worldline's soul is exploration — meaning is earned, not splayed. This is load-bearing.
The recruiter arrives wanting the opposite: fast extraction.

These two personas are not reconcilable inside the same surface. The right answer is
not to make the main site serve both equally. The right answer is to serve the explorer
fully, and signpost the recruiter toward where they need to go.

The main site:
- stays exploration-first (soul intact)
- does not exhibit Peat's interiority (no biographical page, no skills matrix, no project showcase)
- makes clear, at one or two key moments, that a different surface exists for a different intent

The signpost:
- does not apologize for the exploration-first design
- does not redirect the explorer (they never need to see it)
- lives in a place the recruiter would naturally look (footer + maybe a subtle nav slot)
- uses the instrument register (stays in-voice), not a conversion UI

### 2.2 What the main site owes the recruiter

Very little — and that's correct. The main site owes the recruiter exactly three things:

1. **A legible person name.** Not a bio. Not a role. One first name — "Peat" — visible
   somewhere above the fold or in the nav-id strip. Currently "∇ NEOSPIRIT // WORLDLINE"
   is the only identification. A handle is not a name.

2. **A forwarding pointer to the recruiter-facing surface.** One line, once, in the footer
   (TRANSMIT section): something that says "looking for resume / projects → resume.neoex.com"
   in the instrument register. This is a hook, not a page. When resume.neoex.com does not
   exist, the hook is grayed-out or absent. When it exists, the hook activates.

3. **A working GitHub link.** The recruiter's fastest professional signal is Peat's GitHub.
   The footer already names it — it just needs to be live.

That is the complete recruiter obligation for the main site. Nothing more. The ABOUT zone
(Peat will build it) expands this in-site. The resume site (separate domain) serves the
deep recruiter need. The main site only needs to not be a dead end.

### 2.3 What the main site owes the explorer

Everything else. The globe, the archive, the NETRA, the worldline links, the fiction, the
photography — this is the explorer's territory. The spec improvements in §3 serve the
explorer primarily.

### 2.4 Signpost placement — soul-preserving rules

The signpost to the coming about-me zone and resume.neoex.com must not:
- live above the fold (the explorer sees it as noise; it becomes a bio-page teaser)
- use CTA language ("Check out my work!" / "Hire me →")
- exhibit anything not already in the archive (no new content about Peat for the main site)

The signpost may:
- live in the footer TRANSMIT section as a peer to the mailto link
- use the instrument register: `→ resume.neoex.com` with no label elaboration
- be dimmed (var(--ink-soft)) when the target does not exist, visually consistent with
  the disabled-attractor-pill treatment
- live in the nav-id strip as a name clarification: "∇ NEOSPIRIT // WORLDLINE · Peat"
  (adds first name to an existing instrument strip — no new element, no new register)

---

## 3 · Prioritized improvement list

Each item is tagged CLEAR-WIN or NEEDS-PEAT, then by urgency tier.

### TIER 0 — BLOCKS (nothing about soul; these are broken states)

---

**CW-01 · /archive mobile horizontal overflow (CLEAR-WIN)**

The `/archive` page has a confirmed 46px horizontal overflow at mobile widths. The
`.archive-body` grid (`minmax(0,1fr) 340px`, gap 56px, padding-left 40px) has no
`≤600px` or `≤768px` breakpoint. The 340px rail escapes the 390px viewport; the
ledger collapses to 0. The page is functionally unusable on phone.

Fix: collapse `.archive-body` from a two-column grid to a single-column at ≤768px.
The rail content (globe readout, filters) stacks above the ledger. Existing single-column
layout patterns from `60-responsive-system.md` §4 apply directly.

Scope: `app/archive/page.tsx` or `ArchiveClient.tsx` — wherever `.archive-body` is defined.
Token: no new tokens. Uses existing breakpoint boundary.
References: `60-responsive-system.md` §4 (MID layout), mobile audit step 7.
Soul-safe: yes. Structure collapses; the ledger is still the ledger.
Reversible: yes.

---

**CW-02 · 404 CTA touch target (CLEAR-WIN)**

The single recovery link on the branded 404 ("[ ◯ return to atlas ]") is 170×17px.
On a real phone, a visitor who lands on a 404 cannot reliably tap their way back.
This is the only exit from the 404.

Fix: wrap the anchor in a `<span>` or `<div>` with `display: block; padding-block: 14px;`
— brings the tap zone to 45px tall. Or apply `min-height: 44px; display: inline-flex;
align-items: center;` on the anchor. No visual change at desktop. On mobile the text
gains comfortable vertical tap room.

Scope: `app/not-found.tsx`.
Token: no new tokens. Uses existing padding.
Soul-safe: yes. The copy and glyph are unchanged.
Reversible: yes.

---

**CW-03 · GitHub footer link wired to github.com/Ne0EX (CLEAR-WIN)**

`FooterManifesto.tsx` — the CHANNELS → github entry is `href="#"`. A recruiter who
clicks it goes nowhere. An explorer who wants to see Peat's code goes nowhere. The
link already exists; it needs its target.

Fix: `href: "https://github.com/Ne0EX"` (or confirmed GitHub URL). Open in new tab
(`target="_blank" rel="noopener noreferrer"`).

Scope: `components/FooterManifesto.tsx`.
Token: no new tokens.
Soul-safe: yes. External link to an existing public profile.
Reversible: yes.

---

**CW-04 · Nav link touch targets — minimum 44px (CLEAR-WIN)**

All five nav links measure 14px tall with 0px padding-block. This affects every page
on the site at every mobile viewport. The audit confirmed `◇ INDEX`, `◇ TRACES`,
`◇ FRAMES`, `◇ ARCHIVE`, `◇ TRANSMIT` all fail the touch target minimum.

Fix: add `padding-block: 15px;` to the `.nav-links a` selector in `globals.css` (or
wherever the nav link class is defined). This brings the tap zone to ~44px without
changing the visual line-height or layout at desktop. Alternatively use
`min-height: 44px; display: inline-flex; align-items: center;` on each anchor.

Scope: `app/globals.css` (nav-links class) or `components/Nav.tsx` inline styles.
Token: no new tokens.
Soul-safe: yes. Invisible at desktop. Only changes mobile tap area.
Reversible: yes.

---

### TIER 1 — DEGRADES · identity and signposting

---

**CW-05 · Add Peat's first name to the nav-id strip (CLEAR-WIN)**

Currently: `∇ NEOSPIRIT // WORLDLINE 1.130426` on the first row of the Nav.
`NEOSPIRIT` is a handle. A cold visitor and a recruiter cannot connect it to a person.

Fix: change the first row to `∇ NEOSPIRIT // WORLDLINE 1.130426 · Peat` or
`∇ Ne0EX · Peat // WORLDLINE 1.130426`. One word — first name only. In the same
`t-meta-accent` register. No new element. The strip already carries `Bangkok / Thailand`
on the second row; a first name on the first row anchors the identity without adding
biographical weight.

This is the minimum the main site owes the explorer's orienting moment and the
recruiter's 3-second scan.

Scope: `components/Nav.tsx` — the `nav-id` div, first row span.
Token: no new tokens. Same `t-meta-accent` class.
Soul-safe: yes. First name ≠ biography. Worldline already names itself — this names
its author once, in the same register.
Reversible: yes.

**Evidence that this is unambiguously better:** The first-time audit (gap 1, severity:
degrades) and the recruiter audit (gap 1, severity: blocks) both identify absence of a
person name as the top identity gap. The name appears in the article body (Peat writes
in first person) and in the email (peat@—). Adding it once to the nav-id strip resolves
both audits without adding new surface or new register.

---

**CW-06 · Footer resume pointer — disabled placeholder (CLEAR-WIN)**

The TRANSMIT footer section currently has: mailto (live), rss/atom (#), now page (#),
colophon (#). No resume pointer anywhere on the site.

Fix: add a fifth entry to the TRANSMIT list: `→ resume.neoex.com` — but render it
at `var(--ink-faint)` opacity with `pointer-events: none` and no href (or `href="#"`)
until the domain is live. The visual treatment is identical to the disabled attractor
pills (same dimmed register, no interaction affordance). This sets the semantic slot
without creating a functional dead link.

When resume.neoex.com goes live, Peat (or Sirius on instruction) sets the live href
and restores full opacity. No structural change needed at that point.

Scope: `components/FooterManifesto.tsx` — TRANSMIT list.
Token: uses `var(--ink-faint)` (already exists). No new tokens.
Soul-safe: yes. One grayed line in the footer does not exhibit interiority. It
signals: "there is a surface for a different kind of visit — it is not here yet."
Reversible: yes.

---

**CW-07 · Footer channel links — add working URLs for Anilist, Letterboxd (CLEAR-WIN)**

The CHANNELS section lists anilist, letterboxd, github, airtable.coffee — all `href="#"`.
These are real public profiles. Wiring them requires only knowing the URLs.

This is a CLEAR-WIN only for links where the URL is known and confirmed. GitHub is
CW-03. For Anilist and Letterboxd: wire them if Peat has confirmed public profile URLs.
For airtable.coffee: wire if the project URL is public.

Fix: update `href` values in `FooterManifesto.tsx` CHANNELS array with confirmed URLs.
All with `target="_blank" rel="noopener noreferrer"`.

Scope: `components/FooterManifesto.tsx`.
Token: no new tokens.
Soul-safe: yes. These are external profiles Peat chose to list.
Reversible: yes.

**Caveat:** The specific URLs are not in the audit data. Sirius confirms with Peat before
wiring each one. This item is CLEAR-WIN in classification (no taste judgment), but
requires Peat to supply the confirmed URLs.

---

**CW-08 · Footer links touch target — add padding-block (CLEAR-WIN)**

Footer anchor links (`→ anilist`, `→ github`, etc.) are 12px tall. All eight are
functionally un-tappable on mobile. The mailto is the most consequential.

Fix: add `padding-block: 10px;` to the footer `ul li a` selector — brings tap zone to
~32px. Not ideal but far better than 12px. Combined with list `leading-[2]` the tap
zones will still overlap slightly. Alternatively space the list items with `gap: 4px`
on a flex column and use `display: block; padding-block: 12px` on each anchor — brings
each to ~44px cleanly.

Scope: `components/FooterManifesto.tsx` + `app/globals.css` (if a shared footer-link
class exists) or inline via Tailwind `py-3`.
Token: no new tokens.
Soul-safe: yes. Invisible at desktop. Mobile-only tap area expansion.
Reversible: yes.

---

**CW-09 · CHATGPTIMAGE-1781389399360 slug — raw dev filename visible in archive (CLEAR-WIN)**

The first entry visible in /archive is titled `CHATGPTIMAGE-1781389399360`. This is
the camera/system filename used as the Supabase slug. It is visible to every visitor
who browses the archive ledger.

This leaks an internal naming convention and reads as unfinished. The fix is one of:
(a) update the `id` field in Supabase for this entry to a descriptive slug
    (`chatgpt-generated-portrait-2026-06` or similar)
(b) ensure the display in `ArchiveLedger.tsx` uses the caption or title field
    when the id looks like a raw machine slug

Option (a) is the correct fix — the slug should be human-readable. Option (b) is a
fallback if slugs are immutable.

This is a CLEAR-WIN: there is no taste judgment involved. A visible raw filename slug
is unambiguously worse than a descriptive slug.

Scope: Supabase `entries` table (photo entry id field) or `ArchiveLedger.tsx`.
Token: no new tokens.
Soul-safe: yes.
Reversible: yes (Supabase id can be updated; update photo route references in parallel).

---

**CW-10 · Tag pill links — wire /?tag= routing on homepage (CLEAR-WIN)**

Tag pills on all entry pages (`EntryShell`) link to `/?tag=essay`, `/?tag=identity`, etc.
The homepage (`app/page.tsx`) does not read the `tag` search param and does not pass it
to `AttractorFilterShell`. The links are visually interactive but silently discard the
intent.

Fix: read `searchParams.tag` in `app/page.tsx` and pass it as the initial active filter
to `AttractorFilterShell` / `AttractorFields`. The AttractorFields component already has
filter state — the entry is adding an initial-state-from-URL path.

Scope: `app/page.tsx` + `components/AttractorFields.tsx` or `components/AttractorFilterShell.tsx`.
Token: no new tokens.
Soul-safe: yes. This makes an existing affordance actually work.
Reversible: yes.

---

**CW-11 · Globe pointer capture on mobile — release on vertical swipe (CLEAR-WIN)**

`WorldlineGlobe.tsx` calls `setPointerCapture(e.pointerId)` in its `pointerdown` handler.
On mobile this captures all subsequent pointer events including vertical scroll gestures.
A finger resting on the 324×380px canvas cannot scroll past it.

Fix: in the `pointermove` handler, if the gesture is predominantly vertical
(`|deltaY| > |deltaX|`) AND exceeds a small threshold (~8px), call
`renderer.domElement.releasePointerCapture(e.pointerId)`. This frees the scroll gesture
while keeping horizontal drag for globe rotation.

Alternatively: detect if `e.pointerType === 'touch'` and only call `setPointerCapture`
when the initial movement direction is horizontal.

Scope: `components/WorldlineGlobe.tsx` — pointerdown / pointermove handlers.
Token: no new tokens. No CSS change.
Soul-safe: yes. The globe still rotates on horizontal drag. Vertical scroll is restored.
Reversible: yes.

---

**CW-12 · Gallery roll header links touch target (CLEAR-WIN)**

In `/photos`, the roll header links (date/roll-name labels that drill into a roll) are
14px tall. They are the primary navigation affordance on the gallery page — the main
way to enter a roll — and they are un-tappable on mobile.

Fix: `GalleryGrid.tsx` (or wherever roll headers render) — add `display: block;
min-height: 44px; display: flex; align-items: center;` on the roll header anchor.
Or pad with `py-3` via Tailwind.

Scope: `components/GalleryGrid.tsx` or `app/photos/page.tsx`.
Token: no new tokens.
Soul-safe: yes. Visual text unchanged; only tap area grows.
Reversible: yes.

---

**CW-13 · Per-photo objectFit: fill → objectFit: cover (CLEAR-WIN)**

The photo `img` element on per-photo pages uses `objectFit: fill`, which stretches images
to fill the container without preserving aspect ratio. This will visibly distort
landscape or portrait photos that don't match the container's aspect ratio.

Fix: change to `objectFit: cover` (or `contain` if full-image visibility matters more
than filling the frame). `cover` preserves aspect ratio and fills the container.

Scope: `components/PhotoEntry.tsx` or `app/photos/[roll]/[id]/page.tsx` — the `<img>`
element's style prop.
Token: no new tokens.
Soul-safe: yes. Photos no longer stretch.
Reversible: yes.

---

**CW-14 · Back-to-atlas link touch target on per-photo page (CLEAR-WIN)**

The `[← BACK TO ATLAS]` link on per-photo pages is 95×31px — height fails the 44px
minimum. It is the only path from a photo page back to the homepage without the Nav.

Fix: same pattern as CW-02 — `padding-block: 7px` or `min-height: 44px` on the anchor.

Scope: `components/PhotoEntry.tsx` or the back-link component on photo pages.
Token: no new tokens.
Soul-safe: yes.
Reversible: yes.

---

**CW-15 · NETRA NEXT NODE and ESC buttons touch targets (CLEAR-WIN)**

NEXT NODE button: 94×24px. ESC button: 44×17px. Both below 44px height minimum.
These are the primary interactive affordances in the NETRA HUD on mobile.

Fix: add `min-height: 44px` and `align-items: center; display: flex` to both button
elements. Visual label unchanged. HUD layout may need slight height adjustment.

Scope: `components/WorldlineGlobe.tsx` — the NETRA HUD button elements.
Token: no new tokens.
Soul-safe: yes.
Reversible: yes.

---

**CW-16 · Attractor filter pills touch target — active pills (CLEAR-WIN)**

Active filter pills (ALL, coffee, meta) are 29px tall on mobile — below the 44px minimum.
The fix is `min-height: 44px` on the pill button elements in `AttractorFields.tsx`.

The disabled span pills (non-interactive domains) are a separate question — see NP-04.

Scope: `components/AttractorFields.tsx` — button elements for active pills.
Token: no new tokens.
Soul-safe: yes.
Reversible: yes.

---

### TIER 2 — DEGRADES · content and wiring

---

**CW-17 · /archive persistent nav (CLEAR-WIN)**

`/archive` does not render the global `Nav` component. The visitor is on an island —
to reach `/photos` they must go back to `/` first. This was confirmed in the audit
(step 8, severity: degrades).

The existing `Nav.tsx` with its five links (INDEX/TRACES/FRAMES/ARCHIVE/TRANSMIT) is
already the right affordance. The archive page only needs to mount it.

Fix: add `<Nav />` to `app/archive/page.tsx` (or its layout file). The Nav is already
server-safe; it uses `useEffect` for the clock only.

Scope: `app/archive/page.tsx` or `app/archive/layout.tsx`.
Token: no new tokens. Reuses existing `Nav.tsx`.
Soul-safe: yes. The archive gets the same navigation frame as every other route.
Reversible: yes.

---

### TIER 3 — DEGRADES · dead channels and placeholders

---

**NP-01 · How prominent should the about-me / resume signpost be? (NEEDS-PEAT)**

CW-06 adds a grayed `→ resume.neoex.com` to the TRANSMIT footer. CW-05 adds "Peat" to
the nav-id strip. But the deeper question is: should there be a moment earlier in the
journey that explicitly acknowledges the two-persona split?

**Options:**
(A) Footer only (CW-05 + CW-06 as specified). The main site stays purely exploratory.
    The recruiter finds the pointer if they scroll to the footer. Expectation: most
    recruiters won't scroll; the main site remains a dead end for them until the
    resume.neoex.com domain goes live.

(B) A single line in the hero strip below the H1 ("a separate surface exists for
    hiring contexts → resume.neoex.com") in small t-mono register. Visible above the
    fold. Explicit acknowledgment of the split. Risk: it foregrounds the recruiter
    persona in a space the explorer owns.

(C) An ABOUT item in the Nav — currently a grayed-out placeholder, live when Peat
    builds the about-me zone. Structural slot only; no content until built.

Question for Peat: which approach preserves the soul while serving the recruiter
persona acceptably? Option A is the most soul-preserving. Option B is the most
recruiter-legible. Option C is the most structurally forward-compatible.

---

**NP-02 · Should FILE — 000 ('notes from a paused engineer') be visually elevated
          as a 'start here' entry? (NEEDS-PEAT)**

Currently, article 000 is the de-facto about page — the strongest identity surface
on the site — but it is listed last in the chapter index (chronological order) and
has no visual hierarchy distinguishing it from the other three articles.

The first-time audit identified this as a cosmetic gap but it is a taste call.

**Options:**
(A) No change. Chronological order stays. An explorer who reads the article titles
    will find it. The sequence is intentional: the site makes the visitor work for
    the starting point.

(B) Pin article 000 to the top of the chapter index — visually identical to the
    others but listed first. Re-orders the GENESIS entry above newer work.

(C) Add a visual marker — a small `◎ START` or `◎ GENESIS` glyph in the mono label
    row — that distinguishes it without changing order or adding prose.

Question for Peat: should the archive make the beginning explicitly findable, or is
the current obscurity intentional?

---

**NP-03 · How should the 'now page' and 'colophon' footer links be handled? (NEEDS-PEAT)**

The footer's TRANSMIT section has four entries: mailto (live), rss/atom (#), now page (#),
colophon (#). The now page would be the highest-value identity surface for the first-time
visitor — "who is this person right now" — and is currently dead.

**Options:**
(A) Leave dead until Peat builds them. Add no visual treatment — they appear as
    placeholder links (current state).

(B) Visually dim them with `var(--ink-faint)` to signal they are coming but not live
    (same treatment as CW-06 resume pointer).

(C) Remove them from the footer until they exist — no dangling dead links.

Question for Peat: which treatment is correct for links you intend to build but haven't yet?

---

**NP-04 · Should disabled attractor pills be visually distinct from active pills? (NEEDS-PEAT)**

Currently, disabled attractor domains (AI · ML, NARRATIVE, CUBIC COPPER, etc.) are
`<span aria-disabled>` elements styled identically to the active pill buttons. On mobile
they look tappable but are not. On desktop, the `aria-disabled` styling implies they are
future-tense content domains.

**Options:**
(A) No change. The dimmed-but-present treatment is intentional — the ghost domains
    signal the archive's expansion path. The non-interactivity is acceptable friction.

(B) Add a visual signal on hover/focus that they are inactive — a tooltip or cursor:not-allowed.
    Desktop-only affordance, doesn't help mobile.

(C) Render them at lower opacity than they currently have (e.g. `var(--ink-faint)`)
    versus the current `var(--ink-soft)` to deepen the ambient/ghost quality and make
    the distinction from active pills clearer.

Question for Peat: should the ghost-domain pills be dimmer (C), get an interaction
affordance (B), or stay as-is (A)?

---

**NP-05 · How much of the cosmological vocabulary (NeX / Ne0N / Ne0 / NETRA) needs
          an entry ramp for cold visitors? (NEEDS-PEAT)**

The audits identified the cosmological vocabulary as a consistent gap — the Globe is
visually dominant but fully opaque to uninitiated visitors. The NETRA STANDBY reads
as an error state. The strata labels (NeX POSSIBILITY FIELD, Ne0N POLE BEARER,
Ne0 SURFACE ARCHIVE) are evocative but require decoding.

This is the central soul-vs-legibility tension. The site is exploration not exhibition.
Making the cosmology legible to cold visitors could mean explaining it — which shifts
the posture from earned-understanding to pre-digested onboarding.

**Options:**
(A) No entry ramp. The cosmology is part of the fabric. Cold visitors decode it or
    they find the list below the Globe. The 30-second patience horizon filters to
    explorers by design.

(B) A minimal tooltip or hover state on the stratum buttons that briefly names the
    layer: "Ne0 · the surface archive — what exists" / "NeX · the possibility field —
    what might". 120ms hover reveal. No full explanation. Just the mapping.

(C) A subtle intro line below the ATLAS head that reads: "// three strata: what was
    surveyed · what is becoming · what is carried" — present on first visit only
    (localStorage gate), gone after one viewport intersection.

Question for Peat: how much decoding support is soul-preserving? Option A is the most
exploration-first. Option C risks tipping into onboarding. Option B is the middle path.

---

**NP-06 · OG meta tags — which routes get them and what content? (NEEDS-PEAT)**

No OG tags exist on any route. Shared links produce blank unfurl cards. This is a
concrete degradation for recruiter and first-time personas (links shared on Slack,
LinkedIn, iMessage).

OG tags are a CLEAR-WIN in category (unambiguously better), but the content is a
taste question.

**Technical implementation (Sirius):** Next.js `generateMetadata` in `app/layout.tsx`
for site-wide defaults; per-route overrides in each route's `page.tsx`.

**Content decision for Peat:**
- `og:title`: `"Worldline · Ne0EX"` vs `"Worldline · Peat"` vs the article/photo title
- `og:description`: the manifesto excerpt? the H1? something else?
- `og:image`: the Globe rendered as a static PNG? Peat's portrait?

Question for Peat: what does a shared link to Worldline look like? Who is it attributed
to, and what is the one-line description?

---

## 4 · Items explicitly NOT in scope

The following are degradations noted in the audits that fall outside the journey-improvement
mandate or require separate tracks:

- **Article MDX body not rendering** (explorer audit, step 3) — this is Procyon's wiring
  gap (`TODO(Procyon): Wire MDX body rendering`). It is a content-layer engineering task,
  not a UX-journey task. Tracked separately.

- **WorldlineLinks 0-edge graph** (explorer audit, step 4) — no worldline edges exist in
  Supabase. Adding edges is a content/data task. The UI component is already built.
  Journey-spec cannot fix an empty graph.

- **DSCF photo AWAITING IMAGE** (explorer audit, step 9) — no image files uploaded to
  Supabase storage for the Bangkok roll. Asset upload is Peat's content task.

- **Homepage ChapterIndex hardcoded to RECENT_ENTRIES** (explorer audit, step 2) — the
  static vs. live-store wiring is an engineering task (Procyon or Sirius). The result
  (8/10 attractor pills dead) is a data-availability problem, not a journey-design problem.

- **Pagefind search index stale** — a build-time vs. runtime architecture question.
  Deferred to the search spec (TASK-40).

- **Boot sequence localStorage gate** (first-time vs returning) — per `journey-architecture.md`
  §6.2, the `wl:boot-seen` check is specified but not implemented. This is a Sirius
  implementation task.

- **Per-photo body field empty** — Peat adds photo prose notes. Content gap, not design gap.

---

## 5 · Non-goals of this spec

- Does not redesign the Globe (WorldlineGlobe.tsx is not touched).
- Does not build the about-me zone (Peat will build it — this spec only reserves the hook).
- Does not build resume.neoex.com (separate domain and surface — this spec only adds a pointer).
- Does not specify OG image creative (NP-06 is a flag to Peat, not a design decision).
- Does not propose new design tokens. Every improvement uses existing `globals.css` tokens.
- Does not add new typefaces, new colors, or new visual patterns.

---

## 6 · Token compliance

All CLEAR-WIN items use only existing tokens:
- `var(--ink-faint)` — for disabled/placeholder signposting (CW-06, NP-03 option B)
- `var(--ink-soft)` — existing nav-id and meta register
- `var(--ink-primary)` — existing interactive element color
- `var(--accent-orange)` — existing hover state
- `var(--paper-base)`, `var(--paper-warm)` — existing surface tokens

No new tokens are proposed. No raw hex. No new font sizes.

---

## 7 · References

- `docs/design/journey-architecture.md` — the canonical journey doc; §7 (mobile collapse), §3 (entry contract), §8 (search)
- `docs/design/60-responsive-system.md` — breakpoint table locked; §4 (MID layout), §9 (touch targets audit)
- `components/Nav.tsx` — nav-id strip, nav-links
- `components/FooterManifesto.tsx` — CHANNELS + TRANSMIT columns
- `components/WorldlineGlobe.tsx` — pointer capture behavior, HUD button elements
- `components/AttractorFields.tsx` — pill state and interactivity
- `app/globals.css` — full token set
- `app/not-found.tsx` — branded 404

---

## 8 · Handoff

**To Sirius:** Implement the CLEAR-WIN items (CW-01 through CW-17) in order of tier.
Tier 0 items block real functionality; implement first. For CW-07 (external profile URLs),
confirm URLs with Peat before wiring.

**To Polaris:** NEEDS-PEAT items (NP-01 through NP-06) require Peat's input before
implementation. Queue for next Peat session. Do not guess or default.

**To Procyon:** CW-10 (tag pill URL routing) requires a `searchParams.tag` read in
`app/page.tsx`. Confirm the search param name aligns with the `AttractorFields` filter
state shape.

---

*betelgeuse · α-VIS-04 · the Red Sentinel · 2026-06-14 · ux-journey spec v1.0*
*synthesis of four persona audits · soul-guard verified · anti-Codex compliant*
*no new tokens · no new typefaces · no new visual patterns · all improvements cite existing atoms*
