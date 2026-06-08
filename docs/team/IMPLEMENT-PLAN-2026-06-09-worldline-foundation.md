# Worldline foundation — implementation plan (2026-06-09)

> The executable roadmap for the **Peat-approved foundation re-architecture** (grill `grill-me-until-prds-settled`, 2026-06-08). Full PRD + decision log (D0–D7) + the verbatim grill rationale: `~/.claude/plans/recursive-sparking-stardust.md`. Memory: [[project_worldline_foundation_redesign]] · [[feedback_form_over_foundation]].
>
> **Read this first:** the existing console / kind-aware editor / places-curation / real-draft+delete / two-tier toolbar / `proxy.ts` dev-gate / `lib/server/entries/*` dev-only file-writes were built on a **now-SUPERSEDED foundation** (files-as-source · dev-only file-write · static/refresh-on-deploy). This plan **adapts what survives** and **replaces the write-path + serving model**. Do NOT extend the old foundation.

## The architecture in one line
Source-of-truth = a **writable runtime store** (DB: entries + typed/weighted/provenance edges + embeddings) · **media → object storage + CDN** · **MDX-in-git = one-way async export** (history) · **author-from-anywhere** through an **auth-gated** (single-user) deployed editor → store-write → revalidate → **instant publish** · **hybrid weave** (explicit + derived-suggested, accept/reject = tending) · **graph-RAG NETRA**.

---

## §1 · PRE-FLIGHT — resolve the open decisions (build-spec gate) ⟵ DO THIS BEFORE ANY PHASE-A CODE
Building before these are settled = repeating the under-design failure. Output: a **build-spec** that names the chosen stack with verified evidence (per the grill rule: verify primary sources, don't guess).

| # | Decision | Owner | Blocks | Resolve by |
|---|---|---|---|---|
| O1 | **Store tech** — Turso/libSQL (+sqlite-vec) vs Postgres+pgvector vs other. Must be writable-at-runtime + vector + edge queries on Vercel (Fluid Compute). | **Peat + Polaris** (Peat uses turbovec on Beta + pilots graph-query in personal-os → may share substrate) | A1, B1, C2 | verify runtime-write + vector limits/pricing |
| O2 | **Auth provider** — passkey vs OAuth (GitHub/Google) vs magic-link (Auth.js/Clerk). Single allowed identity. | Polaris-research → Peat | A3 | verify Vercel + single-user pattern |
| O3 | **Embedding model + vector index** — model + cost/latency per re-embed on tend. | Polaris-research → Peat | B2, C2 | verify model + dimensions + cost |
| O4 | **Media provider** — Vercel Blob vs Cloudflare R2 vs S3 + CDN; **RAW/HEIC decode** (libvips HEIC; libraw RAW). | Polaris-research → Peat | A2 | verify presigned-write + RAW/HEIC decode |
| O5 | **files↔store export** — store→MDX→git mechanism + cadence (commit-on-tend vs batch). | Polaris/Canopus | A5 | design + verify gate-safety |
| O6 | **personal-os ↔ NETRA shared context** — share the graph-query/context PATTERN (not impl). | **Peat** (boundary owner) | C2 | Peat confirms boundary |

---

## §2 · PHASE A — Foundation (the substrate swap) · gates the rest
| step | what | owner | depends | acceptance |
|---|---|---|---|---|
| **A0** | `.gitignore` binary fix (`/public/photos/`, `content/photos/**` except `.mdx`) | Canopus | — | ✅ **DONE 2026-06-09** (verified: .mdx tracked, binaries/cache/variants ignored) |
| **A1** | Provision the writable runtime store + **schema** (entries · edges · embeddings · media-refs · strata · status/draft · patches). Port the velite zod schema → store schema. | Procyon | O1 | store reachable from a Vercel function; schema migrations run |
| **A2** | Object storage + CDN wiring; **retarget the photo pipeline** (`process-photos` → object storage, not `public/photos/`; **RAW/HEIC decode** → web variants; RAW original → cold storage). | Procyon + Altair | O4 | a photo upload lands in object storage + CDN; `git status` shows no binary; RAW/HEIC → web variants |
| **A3** | **Single-user auth** — read-public / write-authed; single allowed identity (Peat). | Altair | O2 | unauth write → refused; read → public; Peat session → write allowed |
| **A4** | **Store-write server actions** — create / update / delete / draft / curation now write the STORE (supersede `lib/server/entries/*` dev-only file-writes + the `proxy.ts` dev-gate). | Altair | A1, A3 | every mutation persists to the store + revalidates |
| **A5** | **files↔store export** — one-way store→MDX→git for history/diff/revert/backup. | Altair + Canopus | A1, O5 | a tend produces a diffable MDX commit; gate-safe |
| **A6** | **Migrate** the 10 existing entries into the store; **adapt** console/editor/globe to read+write the store (UI survives; write-path swaps file→store; globe reads store cached/ISR). | Procyon (migrate) + Sirius (rewire) | A1–A4 | existing surfaces work on the store; **publish-without-redeploy live** (tend on deployed auth'd editor → live in seconds, no build; globe reflects it) |

**Phase A is the load-bearing milestone** — it makes the foundation real. Verify §8 A-row before Phase B.

---

## §3 · PHASE B — The weave (fix the 0-edge garden)
| step | what | owner | acceptance |
|---|---|---|---|
| B1 | Edge model in the store: `{from,to,type,weight,provenance}`; cross-stratum; rejected-edge memory. | Procyon | edges queryable both directions; types/weights stored |
| B2 | **Derived-edge engine** — signals (tags/domain/place/`divergence_cluster`) + **semantic embeddings** → ranked suggestions. | Procyon + Arcturus | given an entry, returns ranked candidate edges with provenance |
| B3 | **Accept/reject suggestions UI** (the forced-reflection tending loop) in the editor. | Sirius | accept persists an edge; reject suppresses it (stays suppressed) |
| B4 | Seed the graph — author the explicit spine + run suggestions over the 10 entries. | Peat + Polaris | graph is **non-empty**; NETRA + globe have a weave to use |

---

## §4 · PHASE C — NETRA graph-RAG (the blind shell → all-around)
| step | what | owner | acceptance |
|---|---|---|---|
| C1 | Wire the 5 stub tools (`search_entries`/`get_entry`/etc.) to the store. | Altair + Arcturus | tools return real data, not "not yet implemented" |
| C2 | **Graph-RAG** — semantic-retrieval seeds → weighted edge-walk neighborhood → assemble context. | Arcturus | answers cite an entry's **neighborhood**, not just the flat entry |
| C3 | **Context-caching** — per-entry cached summaries/embeddings; invalidate on tend. | Arcturus | repeat questions are fast; tend invalidates the affected cache |

---

## §5 · PHASE D — Tending (make the editor real)
| step | what | owner | acceptance |
|---|---|---|---|
| D1 | **Real body editing** on the store (replace mock `SAMPLE_MD`; load + save the actual body). | Sirius + Procyon | edit body → persists + live; loads the real body (not placeholder) |
| D2 | Patch-log + maturity (`status`) surfacing in the editor. | Sirius | a patch is recorded + shown |
| D3 | Reflection→article loop surfaces (interrogation prompts; personal-os boundary respected). | Sirius + Arcturus | the loop produces draft material Peat refines into an entry |

---

## §6 · PHASE E (Phase 2) — Debug Mirai · OFF critical path
Possibility lines / milestones / **potential-self vs current-self**. Extends the existing v1.0 spec `docs/design/30-worldline-branching.md` (tendrils from fiction `variants[].alpha` + `divergence_cluster`). M1 branch-node · M2 dense-cluster layout · M3 α-history trail. Do NOT pull forward.

---

## §7 · Adapts vs Superseded
| ADAPTS (survives, rewired) | SUPERSEDED (replaced) |
|---|---|
| console / kind-aware editor UI · globe rendering · velite schema (→ store schema) · curation / draft / toolbar / two-tier-toolbar work · Debug-Mirai v1.0 spec · the worldline_links *concept* (→ typed/weighted edges) | `lib/server/entries/*` dev-only file-writes · the `proxy.ts` dev-only gate (→ auth-gated store-write) · "files-as-source" · "static / refresh-on-deploy" · process-photos→`public/photos`-in-git |

## §8 · Verification (per phase — ground-truth, don't trust reports)
- **A:** publish-without-redeploy live (deployed auth'd tend → live in seconds, no build; globe reflects) · auth refuses unauth write, read public · media in object storage not git · existing UI works on the store.
- **B:** new entry surfaces ranked suggestions · accept persists / reject suppresses · graph non-empty.
- **C:** NETRA answer cites the neighborhood (graph-RAG) · cache fast + invalidates on tend.
- **D:** body edit persists + live + loads real body · patch-log records.
- Each phase: tsc=0 · public read paths intact · Algol six-step + Polaris own ground-truth.

## §9 · Owners (GENESIS roster)
Procyon (store schema · migration · derived-edge engine · media pipeline) · Altair (auth · store-write actions · NETRA tool wiring · files-export) · Arcturus (NETRA graph-RAG · embeddings · context-cache) · Sirius (editor/globe rewire · accept-reject UI · body editing) · Betelgeuse (any new design surfaces) · Canopus (gitignore · CI · export gate-safety) · Algol (QA per phase) · Polaris (orchestrate · resolve §1 with Peat).

---
*Close-out 2026-06-09. Next session: start at §1 (resolve open decisions → build-spec), then §2 Phase A. A0 done.*
