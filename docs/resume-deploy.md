# resume.neoex.dev — deployment notes

**v2 · revised 2026-07-02 · provenance: Peat**

v1 assumed the résumé lived at `/resume` inside the main Worldline repo and
reached `resume.neoex.dev` via a host-based rewrite into that path. That
model is retired. **Root `/` of this standalone app IS the résumé now** —
there is no rewrite, no path prefix, no shared deployment with the main
Worldline site.

## App and route

This app lives in its own worktree/repo (`worktree-genesis+resume-neoex`),
separate from the main Worldline codebase. `app/page.tsx` is the NETRA
Survey ledger — server-rendered, recruiter fast-scan surface. The old
observatory globe landing moved to `app/atlas/page.tsx`; `/resume` is a
permanent redirect to `/` (kept for any links already pointing at the old
path).

No host-based rewrite is needed and none should be added — the domain
points straight at this app's root.

## Deployment target

**Own Vercel project, not an alias/rewrite off `neoex.dev`.** Create a new
Vercel project for this repo/worktree; deploy it independently of the main
Worldline project.

### DNS

Point `resume.neoex.dev` CNAME → `cname.vercel-dns.com`, then add
`resume.neoex.dev` as the production domain on this app's own Vercel
project (not as an alias domain on the `neoex.dev` project — the two are
now separate deployments).

## Environment variables

`AI_GATEWAY_API_KEY` is required in the Vercel project's environment
(Production + Preview) for NETRA's real LLM path (`/api/chat`, Vercel AI
Gateway, `anthropic/claude-haiku-4.5`). Documented in `.env.example`;
`.env.local` stays untracked. Without this key, NETRA degrades honestly to
the local keyword-retrieval fallback — it does not fail closed on the page.

## Page metadata

Set in `app/page.tsx` via the `metadata` export (or `app/layout.tsx` for
site-wide defaults):

- `title`: `Krittiphong "Peat" Manachamni — AI Engineer`
- `description`: the Summary line in `docs/resume-content.md` / the
  `lede` field in `lib/resume-data.ts` — the two must not drift.
- `metadataBase`: `https://resume.neoex.dev`
- `alternates.canonical`: `https://resume.neoex.dev/`
- OpenGraph `type`: `profile`

No phone number appears in metadata, structured data, or any string
rendered on this surface — contact is email only.

## Print / PDF

The ledger ships a `@media print` stylesheet (ported from the old
`app/resume/resume.css` print rules into `app/survey-ledger.css`): bay,
strata console, and clearance are suppressed in print (`display: none
!important`), the "SURVEY FULL TRACE" `<details>` sections are forced open,
A4 layout, white paper / near-black ink. Chrome "Save as PDF" → A4 renders
clean pagination with no additional tooling.
