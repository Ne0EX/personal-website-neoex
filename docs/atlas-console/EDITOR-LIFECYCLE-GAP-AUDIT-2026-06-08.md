# Console editor — content-lifecycle gap audit (2026-06-08)

> Polaris audit (workflow `editor-lifecycle-gap-audit`, 4 parallel readers). Triggered by Peat: "photo บกพร่องเยอะ — replace/add/delete รูปยังไง? ลบ content / convert to draft ได้มั้ย? เช็ค article + fiction ด้วย." Maps every lifecycle op × kind: **UI? · wired-real / mock / missing · blocked-on**. Evidence = file:line in the run transcript.

## The headline
The editor is a **beautiful shell whose content-lifecycle is almost entirely MOCK / in-memory.** The ONLY real write-path that persists to disk is **places-curation** (`savePlaceHighlights`/`savePlaceCoord`/`createPlace`). Everything else — edit-save body, create, delete, draft, publish, photo frame add/replace/delete, fiction chapters — is React-state-only (lost on reload) or has no control at all. Peat's instinct is right, and it's **broader than photo — the same across all 3 kinds.**

## Gap matrix

| operation | ARTICLE | PHOTO | FICTION | tier |
|---|---|---|---|---|
| edit body/frames + **SAVE to disk** | UI exists, **mock** (seeds `SAMPLE_MD`; velite has **no body field**) | frames mock (React state) | UI exists, **mock** (`MOCK_FICTION_CHAPTERS`) | **T2** (schema) |
| **DELETE entry** | ✗ none | ✗ none | ✗ none | **T1** (now) |
| **convert to DRAFT** | `status` field exists but **no toggle/write** | no status concept | mock toggle (UI only) | **T1*** |
| **PUBLISH** | mock 3-phase panel | — | mock panel | **T1*** |
| **REPLACE** frame image | — | ✗ none | — | **T3** (pipeline) |
| **ADD** frame / photo | — | UI exists, **mock** (blob URL, never persists) | add-chapter mock | T1 (sidecar) / **T3** (image) |
| **DELETE** frame / chapter | — | ✗ none | ✗ none | **T1** (now) |
| REORDER frame / chapter | — | in-memory only | ✗ none (chapters) | T1/T2 |

## Three deeper truths (the schema/product blockers)
1. **No body field in velite.** velite extracts frontmatter only, not the MDX body — so the editor seeds article/fiction body from hardcoded SAMPLE text and can't LOAD the real body. Save needs a body-write action (beyond `frontmatter-edit.ts`, which is frontmatter-only) + raw-.mdx loading.
2. **`status` (seed|ongoing|refined|settled) is a MATURITY ladder, NOT a visibility gate.** Everything in `content/` builds + serves regardless of status. **There is no "draft = hidden from the public site" concept today.** So "convert to draft" / "unpublish" needs a product decision: repurpose status, or add a real `draft`/`published` field + **filter the public routes on it** (a feature that touches the live site, not just local authoring).
3. **Fiction chapters + state are MOCK-ONLY** — the velite fiction schema has no `chapters[]`/`state`. The editor's chapter UI is a fiction on top of a single-body collection. Persisting chapters = a Procyon schema extension.

## The tiers (buildable-now → blocked)
- **T1 · buildable NOW** (dev-only file/frontmatter actions, same proven pattern as curation — `assertDev` + atomic write + path-containment): **delete entry** (article = rm `.mdx`; photo = rm sidecar + JPEG + 9 variants + cache), **delete frame/chapter**, **set status / "publish"** (wire PublishPanel's mock → `setFrontmatterField('status', …)` — helper exists). *T1\* draft/publish carry the product decision in §truth-2.*
- **T2 · needs Procyon schema**: edit+save **body** (article/fiction) · fiction **chapters[]** · a real **draft/published visibility field** + public-route filter.
- **T3 · needs the photo pipeline wired + Peat's JPEGs**: **replace / add a real photo image** — source-JPEG upload → `process-photos` as a server function → variant generation. `process-photos.ts` is a standalone CLI today, NOT wired to the editor. (Frame *delete* is T1; frame *add with a real image* is T3.)

## The one product decision (gates the rest)
**What does "draft / unpublish" MEAN?** (a) **hide from the live public site** → needs a visibility field + public-route filtering (touches the public site + schema), or (b) **a status label only** (no hiding). This determines whether the lifecycle build stays local-authoring or becomes a public-site feature.

## Recommendation
Build **T1 lifecycle write-path first** (delete + draft/publish + frame/chapter delete) — it's exactly what "manage content before launch" needs, all buildable now via the curation pattern. T2 (body/chapters) and T3 (real images, blocked on JPEGs) follow. Decide the draft-visibility semantics before wiring draft/publish.

---

## Resolved build decisions (Peat + advisor, 2026-06-08) — scope: T1 lifecycle + real-draft
- **Draft = hide from the live public site** (Peat: "ซ่อนจากเว็บจริง") — a new `draft?: boolean` (default false) on article + photoSidecar + fiction. **Orthogonal to `status`** (maturity ladder, untouched — advisor #4). DELETE = remove the content source.
- **Filter is PROD-ONLY** (advisor #1): `hidden = entry.draft && NODE_ENV==='production'`. Drafts stay visible on **dev** public routes (preserves Peat's localhost preview); hidden only in prod. Same NODE_ENV model as the `proxy.ts` console gate. The **console always sees all** (authoring view). Applied at 3 points: list queries · `generateStaticParams` · detail-page `notFound()` guard.
- **No real choke-point** (advisor #2): each `lib/content/*.ts` loads `.velite` independently, so the filter touches N sites. Completeness is NOT "remember each" — it is **Algol's positive leak-matrix on a PROD build**: seed 1 known draft per kind, assert it is ABSENT from every public surface — lists, detail-404, **globe**, **archive**, **worldline neighbors/links** (relational leak: public A links draft B → B must not surface), **RSS/Atom/JSON feeds**, **pagefind index**, **sitemap** (if any).
- **deleteEntry removes ONLY the `.mdx` source** (advisor #3 — blast-radius safety, [[feedback-beta-memory-blast-radius]]): `.mdx` is git-tracked → recoverable via git diff. Do **NOT** glob-rm `public/photos/<roll>/<id>-*` variants / source JPEG (gitignored = permanent loss + a hash-glob can over-match a malformed id). Leave regenerable artifacts. **Path-containment**: resolve the file from the velite record's path (exact), reject `..`/absolute/traversal; dev-only (`assertDev`); atomic. Algol adversarially tests a path-escape slug (`../articles/000`).
- **Actions** (Altair, dev-only): `setEntryDraft({kind, slug, draft})` (toggle frontmatter via `setFrontmatterField`) + `deleteEntry({kind, slug})`; both return authoritative state (decoupled — client updates from the return, no refetch). **Post-delete** (Sirius, advisor #5): if the open entry was deleted → close/redirect; update rail/canvas from the return.
