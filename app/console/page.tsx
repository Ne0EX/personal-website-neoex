/**
 * app/console/page.tsx — Worldline Console front door
 * ─────────────────────────────────────────────────────────────────────────────
 * Server Component — fetches real velite entries and seeds ConsoleApp.
 * Async because it awaits the three lib/content helpers (build-time safe).
 *
 * Kills the `// TODO: console slice` placeholder from Slice 1 editor route.
 * The `⟵ CONSOLE` link in ArticleEditor.tsx already points to /console — this
 * route now resolves that link without any code change in the editor.
 *
 * Robots: noindex/nofollow — not in public Nav — mirrors editor route (Slice 1).
 *
 * Node synthesis (server side):
 *   articles → ConsoleNode (kind='article', fileId=fileNum)
 *   fiction  → ConsoleNode (kind='fiction',  fileId=slug)
 *   photos   → ConsoleNode (kind='photo',    fileId=roll/id)
 *   Canvas x,y: synthesized using the prototype's auto-arrange grid math
 *   (cols=3, gx=230, gy=158, ox=90, oy=70) — deterministic, no Math.random().
 *   No canvas-position field exists in velite (flagged to Procyon — it's
 *   authoring state, not content metadata).
 *
 * Edges: derived from worldline_links in articles + fiction + photos.
 *   Link format: "article/<fileNum>" | "fiction/<slug>" | "photos/<roll>/<id>"
 *   Maps to node ids to build ConsoleEdge objects.
 *   Dangling links (target not found) are silently dropped.
 *
 * Field gaps flagged to Procyon:
 *   - Photo: no `title` field → caption used as fallback (may be undefined → roll name).
 *   - Photo: no `domain` field → empty string (Photo velite schema has no domain).
 *   - Photo: no `summary` field → caption or empty string.
 *   - No canvas x,y in velite — synthesized at route level (authoring state not content).
 *   - No body/code in any velite collection — editor stays on SAMPLE_DRAFT (Slice 3 scope).
 *
 * Owner: Sirius (α-SUR-01) · atlas-console Slice 2
 * Pattern mirrors: app/console/editor/page.tsx (Slice 1)
 */

import type { Metadata } from 'next'
// S6: switch to full admin-reads (all data from store, including photo sidecars + rolls)
import { getAllArticles, getAllFiction, getAllPhotoSidecars, getAllRolls } from '@/lib/store/admin-reads'
import { getAllPlaces, getPlaceContent } from '@/lib/content/places'
import { ConsoleApp }   from '@/components/console/ConsoleApp'
import { ConsoleLogin } from '@/components/console/ConsoleLogin'
import { createSupabaseServerClient } from '@/lib/store/supabase/server'
import type { ConsoleNode, ConsoleEdge, PlaceDTO } from '@/components/console/console-types'

export const metadata: Metadata = {
  title: 'Worldline · Console',
  robots: { index: false, follow: false },
}

// S4 note: maxDuration raised per spec §7 (ingestPhoto / sharp on 40MP JPEG needs headroom)
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic canvas layout — 3-column tidy grid (mirrors prototype arrange math)
// cols=3, gx=230, gy=158, ox=90, oy=70
// ─────────────────────────────────────────────────────────────────────────────

function gridPosition(index: number): { x: number; y: number } {
  const cols = 3, gx = 230, gy = 158, ox = 90, oy = 70
  return {
    x: ox + (index % cols) * gx,
    y: oy + Math.floor(index / cols) * gy,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────────────────────────────────────

export default async function ConsolePage() {
  // S4: server-side auth gate (defence-in-depth behind proxy.ts choke point).
  // getUser() validates the token with the Supabase Auth server — not just
  // reading from cookie. An unauthenticated request renders ConsoleLogin
  // instead of the console. The proxy.ts rewrite should prevent unauthenticated
  // requests from reaching here, but this guard ensures correct behaviour even
  // if a future routing change bypasses the proxy for this specific path.
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <ConsoleLogin />
  }

  // S6: Fetch all collections from the store (admin-reads — includes drafts).
  // getAllPhotoSidecars gives us the sidecar-level entries (per-photo, with exif + variants).
  // getAllRolls gives us the roll descriptors for the photo manager.
  const [articles, fictions, photoSidecars] = await Promise.all([
    getAllArticles(),
    getAllFiction(),
    getAllPhotoSidecars(),
  ])

  // ── Build place DTOs for the console (server-side; never ships velite internals) ──
  // Uses getPlaceContent per place so the DTO carries split article/photo counts,
  // highlights, and picker lists — getPlacesSummary only carries a combined weight.
  const allPlaces = await getAllPlaces()
  // includeHidden=true: console picker must show all content, incl. drafts.
  const placeContents = await Promise.all(
    allPlaces.map((p) => getPlaceContent(p.id, true))
  )
  const initialPlaces: PlaceDTO[] = placeContents
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((content) => ({
      id:           content.place.id,
      name:         content.place.name,
      coord:        content.place.coord,
      // movable-alpha: propagate is_alpha from the DB so the console can show
      // the α indicator and the SET AS α LOCUS control.
      isAlpha:      content.place.isAlpha,
      articleCount: content.articles.length,
      photoCount:   content.sidecars.length,
      highlights: {
        articleHighlight: content.highlights.articleHighlight
          ? {
              fileNum: content.highlights.articleHighlight.fileNum,
              title:   content.highlights.articleHighlight.title,
            }
          : null,
        photoHighlights: content.highlights.photoHighlights.map((s, i) => ({
          roll: s.roll,
          id:   s.id,
          rank: s.highlightRank ?? i + 1,
        })),
      },
      // Article pick-list for typeahead (ordered newest-first by isoDate)
      articlePicks: content.articles.map((a) => ({
        fileNum: a.fileNum,
        title:   a.title,
        isoDate: a.isoDate,
      })),
      // Photo frame pick-list (ordered roll+id ascending per places.ts sort)
      photoPicks: content.sidecars.map((s) => ({
        roll:      s.roll,
        id:        s.id,
        thumbWebp: s.thumbWebp,
        isoDate:   s.isoDate,
      })),
    }))

  // ── Build nodes ──
  const nodes: ConsoleNode[] = []
  let idx = 0

  for (const a of articles) {
    nodes.push({
      id:      `article-${a.fileNum}`,
      kind:    'article',
      fileId:  a.fileNum,
      title:   a.title,
      date:    a.date,
      domain:  a.domain,
      tags:    a.tags,
      summary: a.summary,
      ...gridPosition(idx++),
    })
  }

  for (const f of fictions) {
    nodes.push({
      id:      `fiction-${f.slug}`,
      kind:    'fiction',
      fileId:  f.slug,
      title:   f.title,
      date:    f.date,
      domain:  f.domain,
      tags:    f.tags,
      summary: f.summary,
      ...gridPosition(idx++),
    })
  }

  // S6: PhotoSidecar has roll + id + caption — same field gaps as before
  // but now from the DB (not velite). fileId = "roll/id" format preserved.
  for (const p of photoSidecars) {
    nodes.push({
      id:      `photo-${p.roll}-${p.id}`,
      kind:    'photo',
      fileId:  `${p.roll}/${p.id}`,
      title:   p.caption ?? p.roll,
      date:    p.date,
      domain:  '',
      tags:    [],
      summary: p.caption ?? '',
      ...gridPosition(idx++),
    })
  }

  // ── Build node lookup for edge mapping ──
  const nodeById = new Map<string, ConsoleNode>(nodes.map((n) => [n.id, n]))

  // Helper: resolve worldline link target string to a node id
  function resolveToId(to: string): string | null {
    // "article/003" → "article-003"
    const articleMatch = to.match(/^article\/(\d{3})$/)
    if (articleMatch) return `article-${articleMatch[1]}`
    // "fiction/<slug>" → "fiction-<slug>"
    const fictionMatch = to.match(/^fiction\/([a-z0-9-]+)$/)
    if (fictionMatch) return `fiction-${fictionMatch[1]}`
    // "photos/<roll>/<id>" → "photo-<roll>-<id>"
    const photoMatch = to.match(/^photos\/([^/]+)\/([^/]+)$/)
    if (photoMatch) return `photo-${photoMatch[1]}-${photoMatch[2]}`
    return null
  }

  // ── Build edges from worldline_links ──
  const edges: ConsoleEdge[] = []
  const edgeSeen = new Set<string>()

  // Helper: add edge if both nodes exist and not duplicate
  function addEdge(sourceId: string, targetId: string, label?: string) {
    if (!nodeById.has(sourceId) || !nodeById.has(targetId)) return
    const key = [sourceId, targetId].sort().join('→')
    if (edgeSeen.has(key)) return
    edgeSeen.add(key)
    edges.push({ id: `e-${edges.length}`, source: sourceId, target: targetId, label: label ?? '' })
  }

  for (const a of articles) {
    const sourceId = `article-${a.fileNum}`
    for (const link of a.worldline_links ?? []) {
      const targetId = resolveToId(link.to)
      if (targetId) addEdge(sourceId, targetId, link.label)
    }
  }
  for (const f of fictions) {
    const sourceId = `fiction-${f.slug}`
    for (const link of f.worldline_links ?? []) {
      const targetId = resolveToId(link.to)
      if (targetId) addEdge(sourceId, targetId, link.label)
    }
  }
  // S6: photoSidecars now carry worldline_links from the DB (store sidecar entries)
  for (const p of photoSidecars) {
    const sourceId = `photo-${p.roll}-${p.id}`
    for (const link of p.worldline_links ?? []) {
      const targetId = resolveToId(link.to)
      if (targetId) addEdge(sourceId, targetId, link.label)
    }
  }

  return <ConsoleApp initialNodes={nodes} initialEdges={edges} initialPlaces={initialPlaces} />
}
