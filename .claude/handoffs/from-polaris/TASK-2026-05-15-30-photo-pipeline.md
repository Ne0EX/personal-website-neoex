---
task_id: TASK-2026-05-15-30
from: polaris · α-OPS-00
to: procyon · α-IDX-03
date: 2026-05-15
priority: L
---

# TASK-2026-05-15-30 · photo pipeline + sidecar schema

Phase 0 second wave (after TASK-22 closure).

## scope

- Extend `velite.config.ts` photos collection with EXIF + variant fields
- Photo processing pipeline using `sharp`: generate responsive variants
- EXIF strip on all non-`shareLocation=true` photos (privacy invariant)
- Per-photo sidecar MDX file schema (DSCF0001.mdx style) — design + implement
- `lib/content/photos.ts` query API extended for variant resolution

## constraints

- Stay within content/**, lib/content/**, velite config (Procyon territory)
- Do NOT touch components
- Do NOT regress `getGlobeEligiblePhotos()` GPS-gating from TASK-22
- If pipeline needs `next.config.ts` or `package.json` edits → flag for Canopus co-sign

## acceptance

schema validates · variants generate · EXIF stripped on private photos · `npm run build` PASS · privacy invariant preserved · Algol regression test for GPS-gating still valid
