# docs/design/16-worldline-schema.md
# Worldline Schema · S3 Data Foundation · design spec

> author · Procyon (α-IDX-03) · TASK-2026-05-31-S3-WORLDLINE-SCHEMA
> vision lock · VISION-2026-05-31-search-lineage-console.md §2.1 + §4
> ship · S3 — no upstream deps; unlocks S4 + S5

---

## 1 · worldline_links zod field

Add to `articles`, `fiction`, `photoSidecars` in `velite.config.ts`.
Do NOT add to the roll-level `photos` collection (roll.mdx has no entry identity).

**Frontmatter format:**
```yaml
worldline_links:
  - to: article/003
    label: "seeded the method question"   # Cormorant italic, optional, max 120 chars
  - to: fiction/transmission-001          # bare adjacency — no label is valid
  - to: photos/2026-04-chiang-mai/DSCF0001
```

**`to` format:** `<kind>/<identifier>`. `article` → 3-digit `fileNum`; `fiction` → kebab `slug`;
`photos` → `<roll>/<id>` (roll slug + camera filename).

**Zod sub-schema** (new shared constant in `velite.config.ts`; insert as `.optional().default([])` in each collection):
```typescript
const worldlineLinkSchema = s.object({
  to: s.string().regex(
    /^(article\/\d{3}|fiction\/[a-z0-9-]+|photos\/\d{4}-\d{2}-[a-z0-9-]+\/[A-Z0-9]+)$/,
    'worldline_links[].to must be article/<fileNum>, fiction/<slug>, or photos/<roll>/<id>'
  ),
  label: s.string().min(1).max(120).optional(),
})
// in each collection's .object({}):
worldline_links: s.array(worldlineLinkSchema).optional().default([]),
```

**Broken-link validation:** Cross-collection check cannot run inside velite's per-collection
`superRefine` (corpus not in scope at parse time). Broken links are detected post-build
in `lib/content/worldline.ts` and emit `console.warn`. Build does NOT fail; dangling
refs are preserved in the record.

---

## 2 · lib/content/worldline.ts API

New file. Loads articles + fiction + photoSidecars once; builds a
`Map<string, WorldlineEdge[]>` reverse-index keyed on canonical `to` strings.
Re-imported per server-component render — same lazy-load pattern as `articles.ts`.

**Types** (land in `lib/content/types.ts`):
```typescript
export type WorldlineLink = { to: string; label?: string }
export type WorldlineEdge = { from: string; fromKind: 'article' | 'fiction' | 'photo'; label?: string }
export type WorldlineNeighborhood = { outgoing: WorldlineLink[]; incoming: WorldlineEdge[] }
```

**Function signatures:**
```typescript
// Incoming edges computed from the reverse-index.
export async function getIncomingLinks(
  kind: 'article' | 'fiction' | 'photo',
  identifier: string,   // fileNum | slug | "roll/id"
): Promise<WorldlineEdge[]>

// Outgoing links from an entry's own worldline_links array.
export async function getOutgoingLinks(
  kind: 'article' | 'fiction' | 'photo',
  identifier: string,
): Promise<WorldlineLink[]>

// Full 1-hop neighbourhood. Consumed by <WorldlineLinks /> (Sirius).
export async function get1HopNeighborhood(
  kind: 'article' | 'fiction' | 'photo',
  identifier: string,
): Promise<WorldlineNeighborhood>
```

Callers omit the kind prefix (`"003"`, not `"article/003"`); the function builds
the canonical key internally. `getRollContacts` already lives in `lib/content/photos.ts` — no change for S3.

**lib/content/index.ts additions:**
```typescript
export type { WorldlineLink, WorldlineEdge, WorldlineNeighborhood } from './types'
export { getIncomingLinks, getOutgoingLinks, get1HopNeighborhood } from './worldline'
```

Also re-export `getPhotoByRollAndId` (exists in photos.ts; not yet in index.ts).

---

## 3 · pagefind build-integration plan

**Install:** `npm install --save-dev pagefind` (pin `^1.x`, record exact version).

**package.json additions:**
```json
"build":        "velite && next build && npm run index:search",
"index:search": "pagefind --site .next/server/app --output-path public/pagefind"
```
Verify `--site` path against the fork's output structure (AGENTS.md caveat).

**pagefind.json (project root):**
```json
{ "site": ".next/server/app", "output_path": "public/pagefind", "language": ["en", "th"] }
```
`"language": ["en", "th"]` enables ICU/Thai segmentation (bundled WASM; no system ICU).
Confirm exact API against pagefind v1.x docs at impl time (VISION §5 open follow-up 6).

**DOM annotation — Sirius places these attributes on entry page HTML:**

| field | attribute | weight |
|---|---|---|
| title | `<h1 data-pagefind-weight="3">` | 3× |
| tags, domain | `data-pagefind-weight="2"` + `data-pagefind-filter="tag:*"` | 2× |
| summary | `<p data-pagefind-weight="2" data-pagefind-body>` | 2× |
| body, caption, place | default | 1× |
| filmSim, camera, lens | `data-pagefind-filter="filmsim:*"` | facet |
| fiction delta_summary, divergence_cluster | `data-pagefind-weight="1.5"` | 1.5× |

**Gitignore:** `public/pagefind/` — index regenerates per build; never committed.

---

## 4 · atoms used

Schema layer has no rendered surface. The `<WorldlineLinks />` component (Sirius)
composes from these four existing atoms — listed here so Sirius's spec starts anchored:

| atom | role |
|---|---|
| `.section-rule-dashed` | seam above § worldline section |
| `.arc-node` | entry glyphs in the 1-hop list |
| `.t-mono` / `.t-display` | MONO for kind labels; Cormorant italic for edge labels |
| `[data-hud]` | section header "◇ WORLDLINE" in mono uppercase |

No new atoms needed. All four are in the existing 17-atom catalogue.

---

## 5 · acceptance criteria (Algol verification targets)

**AC-1 · schema compiles:** `npx velite build` exits 0;
`grep worldline_links .velite/index.d.ts` returns 3 matches (one per collection).

**AC-2 · bare link validates:** sidecar `worldline_links: [{to: "article/003"}]` passes velite.
Entry `{to: "bad/format"}` fails with message containing `worldline_links[].to must be`.

**AC-3 · empty default:** entry with no `worldline_links` key produces `worldline_links: []`
in `.velite/articles.json` (not `undefined`).

**AC-4 · outgoing lookup:** `getOutgoingLinks('article', '003')` returns the declared array;
returns `[]` for an article without worldline_links.

**AC-5 · reverse-lookup:** given article-003 declares `{to: "fiction/transmission-001"}`,
`getIncomingLinks('fiction', 'transmission-001')` contains `{from: "article/003", fromKind: "article"}`.

**AC-6 · 1-hop completeness:** `get1HopNeighborhood` outgoing equals `getOutgoingLinks`;
incoming equals `getIncomingLinks`; the two arrays share no entries.

**AC-7 · broken link warns, no throw:** `{to: "article/999"}` (non-existent) emits
`console.warn` containing `[worldline] broken link`; build exits 0; dangling ref
is preserved in the record.

**AC-8 · GPS gate unaffected:** photoSidecar with `worldline_links` and `shareLocation: false`
does NOT appear in `getGlobeEligiblePhotos()`; `servedCoords` is undefined.

**AC-9 · pagefind index emits:** after `npm run build`, `public/pagefind/pagefind.js`
exists and `index:search` exits 0.

**AC-10 · type exports stable:** `import type { WorldlineLink, WorldlineEdge, WorldlineNeighborhood }
from '@/lib/content'` resolves without TypeScript error; no `.velite` path in
the resolved import chain.

---

*procyon · α-IDX-03 · 2026-05-31*
