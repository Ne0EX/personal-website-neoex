/**
 * app/console/editor/page.tsx — Worldline Console · Article Editor route
 * ─────────────────────────────────────────────────────────────────────────────
 * Tooling route — NOT in public Nav. No chrome beyond the root layout
 * (which injects only font vars + TriangulateSearchPortal).
 *
 * The ArticleEditor component is 'use client' and mounts full-viewport.
 * This page is an async Server Component that resolves searchParams before
 * passing data down to the client editor.
 *
 * searchParams is a Promise in Next 15+ (App Router). Awaited here per:
 *   node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
 *   — "searchParams is a Promise that resolves to an object; you must use
 *      async/await or React's use function to access the values."
 *
 * URL contract (from ConsolePage OPEN EDITOR links, Slice 2):
 *   /console/editor?kind=article&slug=003
 *   /console/editor?kind=fiction&slug=<fiction-slug>
 *   /console/editor?kind=photo&slug=<roll>/<id>
 *
 * Lookup strategy (tier-b — metadata only):
 *   article → getArticleByFileNum(slug)
 *   fiction → getFictionBySlug(slug)
 *   photo   → getPhotos() then find p where `${p.roll}/${p.id}` === slug
 *             (mirrors the fileId key the console page uses to build photo nodes)
 *
 * The found entry's metadata is mapped to Article shape for the editor
 * (fiction/photo use safe defaults for Article-only fields like fileNum/coords).
 * If no slug or entry not found → editor falls back to SAMPLE_DRAFT.
 *
 * Note on global chrome: the root layout (app/layout.tsx) does not inject
 * Nav / PageShell / dot-grid — those are per-route. The editor receives only
 * CSS variables + font classes from the root, which is correct.
 *
 * CONSOLE back-link: ⟵ CONSOLE → /console (Slice 2 — the front door now resolves this).
 *
 * Owner: Sirius (α-SUR-01) · atlas-console Slice 2 tier-b
 */

import type { Metadata } from 'next'
import type { Article, PhotoSidecar } from '@/lib/content/types'
// S6: all lookups switched to admin-reads (Supabase DB, includes drafts + new entries).
// Velite-backed getArticleByFileNum / getFictionBySlug removed — they can't see
// entries created via createEntry (store-only; not in velite cache).
import {
  getArticleBySlug,
  getFictionBySlugAdmin,
  getAllPhotoSidecars,
  getPhotoByRollAndIdAdmin,
  getSidecarsInRollAdmin,
  getAllRolls,
} from '@/lib/store/admin-reads'
import { EntryEditor }         from '@/components/console/EntryEditor'
import { ConsoleLogin }        from '@/components/console/ConsoleLogin'
import { createSupabaseServerClient } from '@/lib/store/supabase/server'

export const metadata: Metadata = {
  title: 'Worldline · Article Editor',
  robots: { index: false, follow: false },
}

// S4: maxDuration raised per spec §7 (ingestPhoto / sharp on 40MP JPEG needs headroom)
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
// Entry lookup — returns Article-shaped draft or null (fallback → SAMPLE_DRAFT)
//
// Article is the shape ArticlePreview/ArticleEntryContent accepts. For
// fiction/photo entries we construct a complete Article-shaped object so no
// downstream component crashes, using safe defaults for Article-only fields.
//
// Field gap notes (for Procyon):
//   fiction: no fileNum, no coords, no shareLocation, no readingTime, no patches
//   photo:   no title, no domain, no tags, no summary, no fileNum, no coords (roll-level),
//            no readingTime, no patches — same gaps the console page already flagged.
// ─────────────────────────────────────────────────────────────────────────────

async function lookupDraft(
  kind: string | string[] | undefined,
  slug: string | string[] | undefined,
): Promise<Article | null> {
  // Narrow: both must be plain strings
  if (typeof kind !== 'string' || typeof slug !== 'string' || !slug) return null

  if (kind === 'article') {
    // S6: use admin-reads (DB lookup) so newly-created entries (not yet in velite) resolve.
    const entry = await getArticleBySlug(slug)
    if (!entry) return null
    // Article maps fully — no field gaps.
    return entry
  }

  if (kind === 'fiction') {
    // S6: use admin-reads so new fiction drafts resolve.
    const entry = await getFictionBySlugAdmin(slug)
    if (!entry) return null
    // Map fiction to Article shape. fiction has: slug, title, date, isoDate, domain,
    // tags, summary, kind, variants, divergence_cluster, worldline_links, originLocus.
    // FIELD-GAP(Procyon): fiction has no fileNum, coords, shareLocation, readingTime, patches.
    return {
      kind:           'article',  // ArticlePreview/ArticleEntryContent type expects 'article'
      fileNum:        slug,       // Use slug as display stand-in for fileNum
      title:          entry.title,
      date:           entry.date,
      isoDate:        entry.isoDate,
      domain:         entry.domain,
      tags:           entry.tags,
      summary:        entry.summary,
      status:         'seed',           // FIELD-GAP: fiction has no status field
      readingTime:    1,                // FIELD-GAP: fiction has no readingTime field
      coords:         { lat: 0, lon: 0, place: '' },  // FIELD-GAP: fiction has no GPS coords
      shareLocation:  false,            // FIELD-GAP: always suppress coords display
      patches:        [],               // FIELD-GAP: fiction has no patches log
      worldline_links: entry.worldline_links ?? [],
      highlightForPlace: false,         // FIELD-GAP: fiction has no place highlight
      draft:          entry.draft ?? false,
      body:           entry.body ?? '', // DL4: store body; editor shows md placeholder
    }
  }

  if (kind === 'photo') {
    // S6: use admin-reads PhotoSidecars (sidecar-level, with body + draft status)
    // slug format: "roll/id" — matches fileId used in console page node synthesis
    const sidecars = await getAllPhotoSidecars()
    const entry = sidecars.find((p) => `${p.roll}/${p.id}` === slug)
    if (!entry) return null
    return {
      kind:           'article',          // ArticlePreview type expects 'article'
      fileNum:        slug,               // Use "roll/id" as display stand-in for fileNum
      title:          entry.caption ?? entry.roll,
      date:           entry.date,
      isoDate:        entry.isoDate,
      domain:         'identity',
      tags:           [],
      summary:        entry.caption ?? '',
      status:         'seed',
      readingTime:    1,
      coords:         { lat: 0, lon: 0, place: '' },
      shareLocation:  false,
      patches:        [],
      worldline_links: entry.worldline_links ?? [],
      highlightForPlace: false,
      draft:          entry.draft ?? false,  // S6: real draft status from DB
      body:           '',                    // photo sidecar body lives in caption / roll body, not entry body
    }
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// REAL photo sidecar lookup — for the PHOTO preview's real film-sim system.
//
// The editor's PHOTO preview reuses the REAL <PhotoEntry> + working FilmSimSwitcher
// (the public /photos/<roll>/<id> render). To feed it, load the REAL velite
// PhotoSidecar here (server-only — lib/content reads the .velite cache; a client
// component cannot await these loaders). PhotoSidecar is a plain serializable
// object → safe to pass across the RSC→client boundary to EntryEditor.
//
// Slug format: "roll/id" (same key the lookupDraft photo branch + console node use).
// Returns the sidecar plus its roll sequence context (sequenceIndex / rollTotal),
// mirroring the public photo route. Null when no slug / no match → EntryEditor's
// PhotoPreview falls back to its MOCK styled-slot path (graceful, no crash).
// ─────────────────────────────────────────────────────────────────────────────

async function lookupPhotoSidecar(
  kind: string | string[] | undefined,
  slug: string | string[] | undefined,
): Promise<{ photo: PhotoSidecar; sequenceIndex: number; rollTotal: number } | null> {
  if (kind !== 'photo') return null
  if (typeof slug !== 'string' || !slug) return null

  // slug = "roll/id" — split on the FIRST slash only (rolls never contain '/',
  // ids are DSCF-style with no slash, so a single split is safe).
  const sep = slug.indexOf('/')
  if (sep <= 0) return null
  const roll = slug.slice(0, sep)
  const id = slug.slice(sep + 1)
  if (!roll || !id) return null

  // BUG-B fix: use admin reads (authenticated server client) so DRAFT sidecars
  // are visible. The anon getPhotoByRollAndId is blocked by RLS for drafts
  // (entries_read: status='published' OR is_owner()). This page is already
  // behind the auth gate above, so is_owner() holds for the cookie client.
  const photo = await getPhotoByRollAndIdAdmin(roll, id)
  if (!photo) return null

  // Roll context — sequence index + total, also using admin reads so draft
  // photos in the same roll are included in the count.
  const rollPhotos = await getSidecarsInRollAdmin(roll)
  const sequenceIndex = rollPhotos.findIndex((s) => s.id === id)
  const rollTotal = rollPhotos.length

  return {
    photo,
    sequenceIndex: sequenceIndex >= 0 ? sequenceIndex : 0,
    rollTotal: rollTotal > 0 ? rollTotal : 1,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────────────────────────────────────

export default async function ArticleEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // S4: server-side auth gate (defence-in-depth behind proxy.ts choke point).
  // Identical pattern to app/console/page.tsx — see that file for rationale.
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <ConsoleLogin />
  }

  // Await the searchParams Promise (Next 15+ App Router requirement).
  // See page.md: "searchParams is a Promise; use async/await to access values."
  const { kind, slug } = await searchParams

  // Look up the entry. Returns null → editor uses SAMPLE_DRAFT fallback.
  const initialDraft = await lookupDraft(kind, slug)

  // Load the REAL photo sidecar (photo kind only) so the PHOTO preview reuses
  // the real <PhotoEntry> + working FilmSimSwitcher. Null → PhotoPreview MOCK
  // fallback (graceful). Runs server-side; passes a serializable plain object.
  const photoCtx = await lookupPhotoSidecar(kind, slug)

  // Load available rolls for the roll picker (photo kind: needed when editor
  // opens with no roll/id slug so the picker can list existing rolls).
  // Always fetched for photo kind — negligible overhead (owner console only).
  const availableRolls = kind === 'photo'
    ? await getAllRolls()
    : []

  // Seed the editor's top-level kind state from the URL ?kind param. The draft's
  // `.kind` is hardcoded 'article' (ArticlePreview's type constraint); the URL
  // kind param is the semantic kind the console node carries, and it drives the
  // kind-switcher's default tab.
  const entryKind =
    typeof kind === 'string' && ['article', 'fiction', 'photo'].includes(kind)
      ? (kind as 'article' | 'fiction' | 'photo')
      : undefined

  return (
    <EntryEditor
      initialDraft={initialDraft ?? undefined}
      kind={entryKind}
      initialPhoto={photoCtx?.photo}
      photoSequenceIndex={photoCtx?.sequenceIndex}
      photoRollTotal={photoCtx?.rollTotal}
      availableRolls={availableRolls}
    />
  )
}
