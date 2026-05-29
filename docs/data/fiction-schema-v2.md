# Fiction Schema v2 · Worldline Branching Extension

Owner: Procyon (α-IDX-03)
Task: TASK-2026-05-17-PROCYON-BRANCHING-SCHEMA
Date: 2026-05-17
Spec source: `docs/design/30-worldline-branching.md` v1.0 · §13.1 (schema needs) · §3 (data model) · §4.3 (coordinate model)

---

## Summary of changes from v1

Fiction schema v2 adds two optional fields to support the worldline branching feature
(30-worldline-branching.md). Both fields default to absent/empty; all existing fiction
files validate without modification.

| Field              | Added in | Consumer |
|-------------------|----------|----------|
| `variants[]`       | v2       | Sirius (§13.2 renderer) · NETRA voice strip |
| `divergence_cluster` | v2     | Sirius (sibling-set computation) · `getFictionSiblings()` |

---

## Field 1 · `variants[]`

### Purpose

Channel A of the worldline branching mechanic. Each entry in `variants[]` becomes one
dashed tendril arc when the visitor attends this fiction node under RW-5 orbital drift
(30-worldline-branching.md §5.1). Tendrils fan around the node's orbital position at
distances proportional to each variant's divergence magnitude (§4.3).

### Zod schema

```ts
s.array(
  s.object({
    alpha: s.string().regex(/^\d+\.\d+$/),    // "1.129801"
    delta_summary: s.string().min(1).max(120),
    drift: s.number().nonnegative().optional(),
    slug: s.string().regex(/^[a-z0-9-]+$/).optional(),
  })
)
.max(4)
.superRefine(/* alpha uniqueness check */)
.default([])
```

### Fields within each variant

#### `alpha` (string · required · unique within array)

The divergence value of the alternate worldline. String type preserves decimal precision —
same convention as site α `"1.130426"` (§13.1 explicit requirement).

Must be unique within the `variants[]` array. The velite schema enforces this via
`.superRefine()`. A build with duplicate alpha values fails validation.

The renderer uses alpha to compute `delta_alpha_i = |parseFloat(variant.alpha) − site.alpha|`
and from that:

```
distance_i = R × (0.06 + min(delta_alpha_i × 60, 0.10))
```

Closer variants pull tighter; farther variants reach further, clamped at R × 0.16 outward
(§4.3 coordinate model).

#### `delta_summary` (string · required · max 120 chars)

One-line prose description of what diverges in this variant. NETRA reads this at branch
activation (§13.2 step 7). If longer than ~80 chars, NETRA truncates to the first clause.
Write as a sentence fragment with a low tone — matches NETRA's calm-axis register.

Example values:
- `"the four-pours line never settles · extraction never converges"`
- `"the four-pours line lands one week earlier · the doc is shorter"`
- `"the four-pours line absorbs the entire essay · the entry is fiction, not method"`

#### `drift` (number · optional · non-negative)

Explicit divergence magnitude = `|variant.alpha − site.alpha|`. If absent, the renderer
derives it from `alpha` at render time using the site's canonical alpha (1.130426).

Provide this field only when the authoring intent attaches narrative significance to a
specific numeric distance that differs from the computed value, or when the renderer should
not access `SITE_ALPHA` directly. In most cases, omit it.

#### `slug` (string · optional · kebab-case)

Optional pointer to a materialized fiction file for this variant. E.g.
`"transmission-001-α-1129801"`. V1 renderer ignores this field (v1 is read-only per §6.1).
Included for forward-compatibility toward v1.1 hybrid interaction (§12 Q-A / Q-J).

### Cardinality

- Minimum: 0 (field may be absent or empty array)
- Maximum: 4 (enforced by `.max(4)`)
- Typical: 2–3 per attended fiction node (§3.3)
- Default: `[]` (empty array — backward-compatible with existing fiction files)

### Validation

- `alpha` unique within array (`.superRefine()`)
- Array length 0–4 (`.max(4)`)
- `delta_summary` 1–120 chars
- `alpha` regex `^\d+\.\d+$` (decimal string, no signs, no whitespace)
- `slug` regex `^[a-z0-9-]+$` (kebab-case)

---

## Field 2 · `divergence_cluster`

### Purpose

Channel B of the worldline branching mechanic. A kebab-case label shared with other fiction
entries that the author intends as siblings — "the unresolved-method cluster",
"the kyoto-roastery cluster". At render time (or pre-computed at build time), entries in the
same cluster become candidate sibling branches (up to 2, selected by shortest divergence
distance per §3.1).

Unlike `variants[]`, siblings have REAL orbital positions. Their tendril endpoints are
the sibling's own `domain + isoDate` coordinates in the NeX shell (§4.3 sibling tendrils).
The sibling glyph itself does NOT halo or highlight when targeted by a sibling tendril (§4.5).

### Zod schema

```ts
s.string()
  .regex(/^[a-z0-9-]+$/)
  .max(40)
  .optional()
```

### Validation

- Format: lowercase · digits · hyphens only (kebab-case)
- Max length: 40 chars
- Optional: omit if this fiction is not part of a cluster

### Sibling computation — `getFictionSiblings(slug)`

`lib/content/fiction.ts` exports `getFictionSiblings(slug: string): Promise<Fiction[]>`.

Algorithm (per §3.1):
1. Find all fiction entries sharing the same `divergence_cluster`.
2. Exclude the entry itself.
3. Compute divergence distance for each: `|alpha_self − alpha_sibling|`, where alpha_self
   is `parseFloat(self.variants[0].alpha)` if variants are present, else `SITE_ALPHA` (1.130426).
4. Sort ascending by distance.
5. Return up to 2 closest siblings.

Sirius calls `getFictionSiblings(slug)` at RW-5 drift activation to obtain the `Fiction[]`
records whose `domain + isoDate` give `p_endpoint` for sibling tendrils.

---

## Coordinate projection support for the renderer

Per 30-worldline-branching.md §4.3, the renderer needs the following from each fiction record
to compute branch geometry:

### Variant tendrils (Channel A)

From the attended fiction node:
- `variants[i].alpha` → `delta_alpha_i = |parseFloat(alpha) − site.alpha|`
- `variants.length` → `N` (total variant count; governs `angle_i = 2π × i / N + phase_offset_node`)
- `slug` → `fileNum`-equivalent for `phase_offset_node` (deterministic hash of node identity)

From scene context:
- `p_node` — world-space position of attended node (derived from `domain + isoDate`)
- `R` — orbital shell radius
- `t_yaw, t_pitch` — tangent basis perpendicular to divergence vector

The schema carries `alpha` and `variants.length` (via the array). All other inputs come
from the Three.js scene. No additional schema fields are required for variant projection.

### Sibling tendrils (Channel B)

From `getFictionSiblings(slug)`:
- Each `Fiction.domain` → sibling's orbital longitude (meridian angle)
- Each `Fiction.isoDate` → sibling's orbital latitude (date-derived position)

These two fields are already in the fiction schema (v1). No new fields required for
sibling endpoint computation.

### What the renderer reads per attended node

```ts
// From FictionPin (via getAllGlobePins or getFictionBySlug):
pin.variants         // FictionVariant[] — Channel A data
pin.divergence_cluster  // string | undefined — signals sibling channel availability

// Via getFictionSiblings(pin.slug):
const siblings = await getFictionSiblings(pin.slug)
// siblings[0].domain, siblings[0].isoDate → p_endpoint for first sibling tendril
// siblings[1].domain, siblings[1].isoDate → p_endpoint for second sibling tendril (if any)
```

No derived field needs to be pre-computed at build time for the §4.3 math. The coordinate
projection happens entirely in the renderer's RAF loop using the schema fields above plus
Three.js scene state.

---

## Example frontmatter

### Transmission t.001 — with variants and cluster

```yaml
---
slug: transmission-001
kind: fiction
title: "first transmission"
date: "2026.05.15"
domain: identity
tags:
  - transmission
  - genesis
summary: "An opening signal. The first intercepted fragment from the NeX orbital layer."
divergence_cluster: "unresolved-method"
variants:
  - alpha: "1.129801"
    delta_summary: "the four-pours line never settles · extraction never converges"
  - alpha: "1.130892"
    delta_summary: "the four-pours line lands one week earlier · the doc is shorter"
  - alpha: "1.131204"
    delta_summary: "the four-pours line absorbs the entire essay · the entry is fiction, not method"
---
```

This entry has 3 variant tendrils + at most 2 sibling tendrils from the
`unresolved-method` cluster = up to 5 total branches (§3.3 cardinality cap).

### Transmission t.004 — sibling-only (no variants, same cluster)

```yaml
---
slug: transmission-004
kind: fiction
title: "unresolved"
date: "2026.06.01"
domain: method
tags:
  - method
  - transmission
summary: "A method that did not resolve. Held in the cluster alongside t.001."
divergence_cluster: "unresolved-method"
---
```

When the visitor attends t.001, this entry's orbital position becomes the endpoint of
the sibling tendril. When the visitor attends t.004, t.001's position becomes the
sibling tendril endpoint for t.004 (if t.004 declares no variants of its own, only
the sibling tendril draws).

### Transmission t.002 — no branching fields

```yaml
---
slug: transmission-002
kind: fiction
title: "second signal"
date: "2026.05.20"
domain: reflection
tags:
  - transmission
summary: "A quieter intercept. No speculative orbits at this transmission."
---
```

Existing fiction without `variants` or `divergence_cluster` validates normally.
`variants` defaults to `[]`. `divergence_cluster` is absent. NETRA acknowledges:
`// netra · this transmission holds. no speculative orbits read at this α.`

---

## Backward compatibility

- `variants` has `.default([])` — all existing fiction files yield `variants: []`.
- `divergence_cluster` is `.optional()` — all existing fiction files yield `divergence_cluster: undefined`.
- The `Fiction` TypeScript type gains two new fields (`variants: FictionVariant[]` and
  `divergence_cluster?: string`) inferred from the velite schema. Consumers that spread
  or destructure `Fiction` without exhaustive type checks receive the new fields silently
  (empty array / undefined). No breakage.
- `FictionPin` (used by WorldlineGlobe.tsx) now includes `variants` and `divergence_cluster`.
  If Sirius reads `FictionPin` and has not yet been updated for §13.2, the new fields are
  simply ignored. TypeScript will surface any structural mismatches at compile time.

---

## Migration state

Zero existing fiction files require migration. The new fields are optional/defaulted.
Confirm: `content/fiction/transmission-001.mdx` validated against the v2 schema — clean.

If Peat authors variants or cluster fields on existing transmissions, update the frontmatter
directly. No migration script required (no mandatory fields added).

---

## Build query integration

`getFictionSiblings` is exported from `lib/content/fiction.ts` and re-exported from
`lib/content/index.ts`. Sirius imports it directly:

```ts
import { getFictionSiblings } from '@/lib/content'
const siblings = await getFictionSiblings('transmission-001')
// returns Fiction[], sorted by ascending divergence distance, max 2
```

---

*procyon · α-IDX-03 · 2026-05-17 · fiction schema v2 · branching extension*
