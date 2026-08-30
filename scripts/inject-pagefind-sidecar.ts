#!/usr/bin/env tsx
/**
 * scripts/inject-pagefind-sidecar.ts
 * ---------------------------------------------------------------------------
 * Build-time pipeline step: inject static pagefind metadata into each HTML
 * file produced by `next build` in .next/server/app/.
 *
 * WHY THIS EXISTS
 * ---------------
 * Next.js 16 renders a sparse static HTML shell when the page tree contains
 * a `'use client'` component (PageShell). PageShell initialises state from
 * sessionStorage, so during SSR its state is null and it renders an empty
 * loading div. All real page content — including the data-pagefind-body div
 * authored in ArticleEntry/FictionEntry/etc — lives only in the RSC JSON
 * payload inside <script> tags, never as real HTML attributes.
 *
 * pagefind's static crawler reads HTML attributes only (not JS-rendered DOM).
 * Result: data-pagefind-body is invisible to the crawler → 2/13 pages indexed.
 *
 * FIX
 * ---
 * This script runs AFTER `next build` and BEFORE `pagefind --site ...`.
 * It reads the velite cache (.velite/*.json) and injects a real HTML element:
 *
 *   <div data-pagefind-body
 *        data-pagefind-ignore="nav header footer"
 *        style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">
 *     ...metadata spans...
 *   </div>
 *
 * into the <body> of every crawlable HTML page. The element is visually
 * hidden (1×1px clip — not display:none, which pagefind skips) but fully
 * parseable by the static HTML crawler.
 *
 * Because React hydration replaces the static HTML immediately on page load,
 * the injected block is never seen by real users.
 *
 * SCOPE (Procyon territory)
 * -------------------------
 * - Reads:  .velite/articles.json, .velite/fiction.json,
 *           .velite/photos.json, .velite/photoSidecars.json
 * - Writes: .next/server/app/**\/*.html (build output — not source files)
 * - Does NOT touch: any .tsx component, route handler, or hook
 *
 * IDEMPOTENT
 * ----------
 * Pages already containing a usable, visible HTML data-pagefind-body attribute
 * (genuine SSR output) are left untouched. Client-rendered entry shells can
 * contain a real attribute too, but with aria-hidden/display:none; those
 * placeholders are replaced with a crawlable sidecar.
 *
 * AUDIT GATE COMPATIBILITY
 * ------------------------
 * After this script runs, scripts/audit-search-index-completeness.sh must
 * report exit 0 (PASS). The injected element satisfies both assertions:
 *   Assertion 1: pagefind indexes all 13 pages → page_count == crawlable_count
 *   Assertion 2: data-pagefind-body is a real HTML attribute, not RSC-only,
 *                not hidden with display:none or visibility:hidden
 *
 * Usage:
 *   npx tsx scripts/inject-pagefind-sidecar.ts [--dry-run] [--verbose]
 *
 * Integration — add to package.json index:search step:
 *   "index:search": "npx tsx scripts/inject-pagefind-sidecar.ts && pagefind --site .next/server/app --output-path public/pagefind"
 *
 * Owner: Procyon (α-IDX-03)
 * Closes: search-index-completeness audit FAIL (2/13 pages indexed)
 * Referenced PRD: PRD-04 (search indexes)
 * Doc citation: node_modules/next/dist/docs/01-app/01-getting-started/
 *   05-server-and-client-components.md — "use client" boundary behaviour;
 *   once a file is marked 'use client', all child components are client-side.
 *   PageShell renders an empty loading div during SSR (booted===null).
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  localizedSidecarKey,
  localizedSidecarRows,
  sidecarLanguage,
  splitLocalizedHtmlPath,
  type SidecarLanguage,
} from './pagefind-sidecar-routing'

// ---------------------------------------------------------------------------
// Types (mirrors velite schema fields we need — no import from .velite to
// avoid a build dependency on the velite output shape in a pipeline script)
// ---------------------------------------------------------------------------

interface ArticleRecord {
  lang: SidecarLanguage
  fileNum: string
  title: string
  date: string       // YYYY.MM.DD
  isoDate: string    // YYYY-MM-DD
  domain: string
  tags: string[]
  status: string
  summary: string
  shareLocation: boolean
  /** Draft flag — hidden from public pagefind index in production. Default false. */
  draft?: boolean
  coords?: { lat: number; lon: number; place: string }
  patches?: Array<{ n: number; date: string; note: string }>
}

interface FictionRecord {
  lang: SidecarLanguage
  slug: string
  title: string
  date: string
  isoDate: string
  domain: string
  tags: string[]
  summary: string
  /** Draft flag — hidden from public pagefind index in production. Default false. */
  draft?: boolean
}

interface PhotoRecord {
  roll: string
  id: string
  caption?: string
  date: string
  isoDate: string
  shareLocation: boolean
  coords?: { lat: number; lon: number; place: string }
}

interface PhotoSidecarRecord {
  lang: SidecarLanguage
  roll: string
  id: string
  caption?: string
  date: string
  isoDate: string
  shareLocation: boolean
  /** Draft flag — hidden from public pagefind index in production. Default false. */
  draft?: boolean
  coords?: { lat: number; lon: number; place: string }
}

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

const log = (...args: unknown[]) => console.log('[inject-pagefind-sidecar]', ...args)
const logv = (...args: unknown[]) => { if (VERBOSE) log(...args) }
const logErr = (...args: unknown[]) => console.error('[inject-pagefind-sidecar] ERROR:', ...args)

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const SITE_DIR  = path.join(REPO_ROOT, '.next', 'server', 'app')

// ---------------------------------------------------------------------------
// HTML sidecar generation helpers
// ---------------------------------------------------------------------------

/**
 * CSS class for visually-hidden elements accessible to static crawlers.
 * NOT display:none (pagefind skips it). NOT visibility:hidden.
 * 1×1px overflow clip — standard a11y visually-hidden pattern.
 * The pagefind audit's Case A only checks display:none, visibility:hidden,
 * width:0, height:0 — this passes.
 */
const VISUALLY_HIDDEN_STYLE =
  'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap'

/** Escape HTML special characters in text content. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Build the data-pagefind-body sidecar HTML block for an article. */
function articleSidecar(a: ArticleRecord): string {
  const tendedCount = (a.patches?.length ?? 0) + 1
  const tendedLast = a.patches && a.patches.length > 0
    ? [...a.patches].sort((x, y) => y.n - x.n)[0].date.replace(/-/g, '.')
    : a.date
  const coordStr = a.shareLocation && a.coords
    ? `${a.coords.lat.toFixed(2)}°N · ${a.coords.lon.toFixed(2)}°E`
    : ''

  return `<div data-pagefind-body style="${VISUALLY_HIDDEN_STYLE}">` +
    `<span data-pagefind-meta="kind">article</span>` +
    `<span data-pagefind-meta="fileNum">${esc(a.fileNum)}</span>` +
    `<span data-pagefind-meta="date">${esc(a.date)}</span>` +
    `<span data-pagefind-meta="isoDate">${esc(a.isoDate)}</span>` +
    `<span data-pagefind-sort="isoDate">${esc(a.isoDate)}</span>` +
    `<span data-pagefind-meta="tags">${esc(a.tags.join(', '))}</span>` +
    // DL1: status in sidecar = maturity value (served from store, not DB publish state)
    `<span data-pagefind-meta="status">${esc(a.status)}</span>` +
    (coordStr ? `<span data-pagefind-meta="coord">${esc(coordStr)}</span>` : '') +
    `<span data-pagefind-meta="tended-count">${tendedCount}</span>` +
    `<span data-pagefind-meta="tended-last">${esc(tendedLast)}</span>` +
    `<span>${esc(a.title)} ${esc(a.summary)} ${esc(a.domain)} ${esc(a.tags.join(' '))}</span>` +
    `</div>`
}

/** Build the data-pagefind-body sidecar HTML block for a fiction entry. */
function fictionSidecar(f: FictionRecord): string {
  return `<div data-pagefind-body style="${VISUALLY_HIDDEN_STYLE}">` +
    `<span data-pagefind-meta="kind">fiction</span>` +
    `<span data-pagefind-meta="slug">${esc(f.slug)}</span>` +
    `<span data-pagefind-meta="date">${esc(f.date)}</span>` +
    `<span data-pagefind-meta="isoDate">${esc(f.isoDate)}</span>` +
    `<span data-pagefind-sort="isoDate">${esc(f.isoDate)}</span>` +
    `<span data-pagefind-meta="tags">${esc(f.tags.join(', '))}</span>` +
    `<span>${esc(f.title)} ${esc(f.summary)} ${esc(f.domain)} ${esc(f.tags.join(' '))}</span>` +
    `</div>`
}

/** Build the data-pagefind-body sidecar HTML block for a photo entry. */
function photoSidecar(p: PhotoSidecarRecord): string {
  const coordStr = p.shareLocation && p.coords
    ? `${p.coords.lat.toFixed(2)}°N · ${p.coords.lon.toFixed(2)}°E`
    : ''
  const caption = p.caption ?? ''

  return `<div data-pagefind-body style="${VISUALLY_HIDDEN_STYLE}">` +
    `<span data-pagefind-meta="kind">photo</span>` +
    `<span data-pagefind-meta="roll">${esc(p.roll)}</span>` +
    `<span data-pagefind-meta="id">${esc(p.id)}</span>` +
    `<span data-pagefind-meta="date">${esc(p.date)}</span>` +
    `<span data-pagefind-meta="isoDate">${esc(p.isoDate)}</span>` +
    `<span data-pagefind-sort="isoDate">${esc(p.isoDate)}</span>` +
    (coordStr ? `<span data-pagefind-meta="coord">${esc(coordStr)}</span>` : '') +
    (caption ? `<span>${esc(caption)}</span>` : '') +
    `</div>`
}

/** Build the data-pagefind-body sidecar HTML block for a roll index page. */
function rollIndexSidecar(roll: string, sidecars: PhotoSidecarRecord[]): string {
  const frameCount = sidecars.length
  const dates = sidecars.map(s => s.isoDate).sort()
  const dateRange = dates.length >= 2
    ? `${dates[0]} to ${dates[dates.length - 1]}`
    : dates[0] ?? ''
  const captions = sidecars
    .map(s => s.caption ?? '')
    .filter(Boolean)
    .join(' ')

  // Representative date for sort: earliest frame date in the roll.
  const sortDate = dates[0] ?? ''

  return `<div data-pagefind-body style="${VISUALLY_HIDDEN_STYLE}">` +
    `<span data-pagefind-meta="kind">photo-roll</span>` +
    `<span data-pagefind-meta="roll">${esc(roll)}</span>` +
    `<span data-pagefind-meta="frame-count">${frameCount}</span>` +
    (dateRange ? `<span data-pagefind-meta="date-range">${esc(dateRange)}</span>` : '') +
    (sortDate ? `<span data-pagefind-sort="isoDate">${esc(sortDate)}</span>` : '') +
    `<span>${esc(roll.replace(/-/g, ' '))}${captions ? ' ' + esc(captions) : ''}</span>` +
    `</div>`
}

/** Build a minimal data-pagefind-body for the home page. */
function homeSidecar(): string {
  return `<div data-pagefind-body style="${VISUALLY_HIDDEN_STYLE}">` +
    `<span data-pagefind-meta="kind">home</span>` +
    `<span>Worldline Neospirit digital garden archive observatory</span>` +
    `</div>`
}

/**
 * Build the data-pagefind-body sidecar for the /archive route.
 *
 * Purpose (docs/design/21-archive-route.md §7.3):
 *   Makes /archive a searchable pagefind page. A visitor who searches for an
 *   article title will find it via the archive route as well as the direct
 *   entry route result. Each entry title is injected at weight 3; domain tags
 *   carry a pagefind-filter so domain-filtered search works across the ledger.
 *
 * Idempotent: the caller already guards with hasUsablePagefindBody() before calling
 *   this function. The sidecar itself writes no HTML state.
 *
 * The visually-hidden pattern (1×1px clip) is identical to other sidecar blocks.
 * React hydration replaces the static HTML immediately — the block is never
 * seen by real users.
 */
function archiveSidecar(
  articles: ArticleRecord[],
  fictions: FictionRecord[],
  photoSidecars: PhotoSidecarRecord[],
): string {
  // Collect all unique domains for pagefind-filter injection.
  const domains = new Set<string>()

  // Per-entry title spans at weight 3.
  const entrySpans: string[] = []

  for (const a of articles) {
    entrySpans.push(`<span data-pagefind-weight="3">${esc(a.title)}</span>`)
    domains.add(a.domain)
  }
  for (const f of fictions) {
    entrySpans.push(`<span data-pagefind-weight="3">${esc(f.title)}</span>`)
    domains.add(f.domain)
  }
  for (const s of photoSidecars) {
    const caption = s.caption ?? s.id
    entrySpans.push(`<span data-pagefind-weight="3">${esc(caption)}</span>`)
    // Photos carry no domain in the schema — omit from domain filter.
  }

  // Domain filter spans — one per unique domain value present in the ledger.
  const domainSpans = [...domains].map(
    (d) => `<span data-pagefind-filter="domain[${esc(d)}]">${esc(d)}</span>`,
  )

  return (
    `<div data-pagefind-body style="${VISUALLY_HIDDEN_STYLE}">` +
    `<span data-pagefind-meta="title:ARCHIVE LEDGER,type:archive">ARCHIVE LEDGER</span>` +
    `<span data-pagefind-weight="5">ARCHIVE LEDGER</span>` +
    entrySpans.join('') +
    domainSpans.join('') +
    `</div>`
  )
}

// ---------------------------------------------------------------------------
// Real HTML attribute detector
// A real HTML element has data-pagefind-body as an attribute in an opening tag,
// not inside a <script> JSON payload. A real attribute is not necessarily
// usable: client-rendered entry shells emit an aria-hidden/display:none body.
// ---------------------------------------------------------------------------

interface PagefindBodyTag {
  start: number
  end: number
  text: string
}

/** Find real HTML opening tags, excluding Next.js RSC script payloads. */
function findPagefindBodyTags(html: string): PagefindBodyTag[] {
  // Replace script contents with same-length whitespace so match offsets still
  // refer to the original HTML when a stale hidden attribute is removed.
  const withoutScripts = html.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    (script) => ' '.repeat(script.length),
  )
  const tags: PagefindBodyTag[] = []
  const openingTag = /<[a-zA-Z][^>]*>/g

  for (const match of withoutScripts.matchAll(openingTag)) {
    const text = match[0]
    if (/\bdata-pagefind-body\b/i.test(text)) {
      tags.push({ start: match.index ?? 0, end: (match.index ?? 0) + text.length, text })
    }
  }

  return tags
}

/** Return CSS/ARIA reasons why a pagefind body is inaccessible to the crawler. */
function hiddenPagefindBodyReasons(tag: string): string[] {
  const reasons: string[] = []
  const style = tag.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i)?.[1]
    ?? tag.match(/\bstyle\s*=\s*([^\s>]+)/i)?.[1]
    ?? ''
  const lowerStyle = style.toLowerCase()

  const ariaHidden = tag.match(
    /\baria-hidden(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/i,
  )
  const ariaHiddenValue = ariaHidden?.[1] ?? ariaHidden?.[2] ?? ariaHidden?.[3] ?? 'true'
  if (ariaHidden && ariaHiddenValue.toLowerCase() !== 'false') reasons.push('aria-hidden')
  if (/\bhidden(?:\s*=\s*(?:""|hidden|true|'true'))?(?:\s|\/?>)/i.test(tag)) {
    reasons.push('hidden')
  }
  if (/display\s*:\s*none/i.test(lowerStyle)) reasons.push('display:none')
  if (/visibility\s*:\s*hidden/i.test(lowerStyle)) reasons.push('visibility:hidden')
  if (/width\s*:\s*0(?:px|em|rem|vw|%|ch)?(?:\b|;|\s)/i.test(lowerStyle)) reasons.push('width:0')
  if (/height\s*:\s*0(?:px|em|rem|vh|%|ch)?(?:\b|;|\s)/i.test(lowerStyle)) reasons.push('height:0')

  return reasons
}

/** Returns true if the HTML contains a usable, visible static pagefind body. */
function hasUsablePagefindBody(html: string): boolean {
  return findPagefindBodyTags(html).some((tag) => hiddenPagefindBodyReasons(tag.text).length === 0)
}

/** Remove a stale hidden marker before adding the replacement sidecar. */
function removeHiddenPagefindBodyMarkers(html: string): string {
  const tags = findPagefindBodyTags(html)
  let result = html

  for (const tag of tags.reverse()) {
    if (hiddenPagefindBodyReasons(tag.text).length === 0) continue
    const withoutMarker = tag.text.replace(
      /\s+data-pagefind-body(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/i,
      '',
    )
    result = result.slice(0, tag.start) + withoutMarker + result.slice(tag.end)
  }

  return result
}

// ---------------------------------------------------------------------------
// HTML injection
// Injects the sidecar block just before </body>.
// ---------------------------------------------------------------------------

function injectSidecar(html: string, sidecar: string): string {
  // Inject just before </body>
  const bodyCloseIdx = html.lastIndexOf('</body>')
  if (bodyCloseIdx === -1) {
    // No </body> tag — append to end
    return html + '\n' + sidecar
  }
  return html.slice(0, bodyCloseIdx) + sidecar + html.slice(bodyCloseIdx)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log('start')
  if (DRY_RUN) log('DRY RUN — no files will be written')

  // --- Verify build output exists ---
  try {
    await fs.access(SITE_DIR)
  } catch {
    logErr(`SITE_DIR not found: ${SITE_DIR}`)
    logErr('Run `npm run build:next` first.')
    process.exit(1)
  }

  // --- Load from Supabase store (DL5/DL7: reads via map.ts-served records, anon client) ---
  // Anon client uses NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from .env.local
  // RLS returns published rows only — draft filter is enforced by the DB, not here.
  // DL1 mapping: served status = maturity; served_coords consumed (never raw coords, DL13).
  // This replaces the old .velite/*.json reads (DL7: velite out of build).

  // Load .env.local if not already set (local build without Vercel env injection)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const envPath = path.join(REPO_ROOT, '.env.local')
    try {
      const raw = await fs.readFile(envPath, 'utf-8')
      for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
        if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
      }
    } catch { /* .env.local absent on Vercel — env already injected */ }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  if (!supabaseUrl || !publishableKey) {
    logErr('NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set')
    process.exit(1)
  }

  /** Fetch all rows from an entries or rolls query via PostgREST. */
  async function storeGet(table: string, params: string): Promise<unknown[]> {
    const url = `${supabaseUrl}/rest/v1/${table}?${params}`
    const res = await fetch(url, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`store GET ${table}: ${res.status} ${await res.text()}`)
    return res.json() as Promise<unknown[]>
  }

  const ENTRY_COLS = [
    'kind', 'slug', 'status', 'title', 'lang', 'date', 'iso_date', 'domain', 'tags',
    'summary', 'served_coords', 'share_location', 'patches', 'worldline_links',
    'maturity', 'reading_time', 'roll', 'photo_id', 'caption',
  ].join(',')

  // Anon client, RLS = published only
  const [rawArticles, rawFiction, rawPhotos] = await Promise.all([
    storeGet('entries', `select=${ENTRY_COLS}&kind=eq.article&status=eq.published`),
    storeGet('entries', `select=${ENTRY_COLS}&kind=eq.fiction&status=eq.published`),
    storeGet('entries', `select=${ENTRY_COLS}&kind=eq.photo&status=eq.published`),
  ]) as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[]]

  // DL1 mapping: served status = maturity
  const articles: ArticleRecord[] = rawArticles.map((r) => ({
    lang: sidecarLanguage(r.lang),
    fileNum: r.slug as string,
    title: (r.title as string) ?? '',
    date: r.date as string,
    isoDate: r.iso_date as string,
    domain: r.domain as string,
    tags: (r.tags as string[]) ?? [],
    status: (r.maturity as string) ?? 'seed',
    summary: (r.summary as string) ?? '',
    shareLocation: r.share_location as boolean,
    // DL13: served_coords is the only coords we expose
    coords: r.served_coords as ArticleRecord['coords'],
    patches: (r.patches as ArticleRecord['patches']) ?? [],
  }))

  const fictions: FictionRecord[] = rawFiction.map((r) => ({
    lang: sidecarLanguage(r.lang),
    slug: r.slug as string,
    title: (r.title as string) ?? '',
    date: r.date as string,
    isoDate: r.iso_date as string,
    domain: r.domain as string,
    tags: (r.tags as string[]) ?? [],
    summary: (r.summary as string) ?? '',
  }))

  const photoSidecars: PhotoSidecarRecord[] = rawPhotos.map((r) => ({
    lang: sidecarLanguage(r.lang),
    roll: r.roll as string,
    id: r.photo_id as string,
    caption: r.caption as string | undefined,
    date: r.date as string,
    isoDate: r.iso_date as string,
    shareLocation: r.share_location as boolean,
    // DL13: served_coords used for coord display
    coords: r.served_coords as PhotoSidecarRecord['coords'],
  }))

  log(`loaded from store: ${articles.length} articles, ${fictions.length} fiction, ${photoSidecars.length} photo sidecars (published only via RLS)`)

  // Build lookup maps
  const articleByFileNum = new Map(
    articles.map(a => [localizedSidecarKey(a.lang, a.fileNum), a]),
  )
  const fictionBySlug = new Map(
    fictions.map(f => [localizedSidecarKey(f.lang, f.slug), f]),
  )

  // Group sidecars by roll
  const sidecarsByRoll = new Map<string, PhotoSidecarRecord[]>()
  for (const s of photoSidecars) {
    const key = localizedSidecarKey(s.lang, s.roll)
    const arr = sidecarsByRoll.get(key) ?? []
    arr.push(s)
    sidecarsByRoll.set(key, arr)
  }

  // Sidecar lookup by roll+id
  const sidecarByKey = new Map(
    photoSidecars.map(s => [localizedSidecarKey(s.lang, s.roll, s.id), s]),
  )

  log(`loaded: ${articles.length} articles, ${fictions.length} fiction, ${photoSidecars.length} photo sidecars`)

  // --- Find all crawlable HTML files ---
  const htmlFiles: string[] = []

  async function collectHtml(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // Skip Next.js internal directories
        if (entry.name.startsWith('_')) continue
        await collectHtml(fullPath)
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.html') &&
        entry.name !== '_global-error.html' &&
        entry.name !== '_not-found.html'
      ) {
        htmlFiles.push(fullPath)
      }
    }
  }

  await collectHtml(SITE_DIR)
  htmlFiles.sort()
  log(`found ${htmlFiles.length} crawlable HTML files`)

  // --- Process each HTML file ---
  let injected = 0
  let skipped = 0
  let unmatched = 0

  for (const htmlPath of htmlFiles) {
    const relPath = path.relative(SITE_DIR, htmlPath)
    const html = await fs.readFile(htmlPath, 'utf-8')

    // Skip only if a usable static body already exists (idempotent). A hidden
    // client-rendered placeholder must not suppress sidecar injection.
    if (hasUsablePagefindBody(html)) {
      logv(`skip (already has usable pagefind-body): ${relPath}`)
      skipped++
      continue
    }

    // Determine what content to inject based on path
    let sidecar: string | null = null

    // Preserve the served locale while normalising the route path. Translated
    // siblings share slugs, so locale must remain part of every lookup key.
    const { lang: pageLang, routeParts } = splitLocalizedHtmlPath(relPath)

    // routeParts breakdown for path 'a/b/c.html': ['a', 'b', 'c.html']
    // routeParts.length === 1: 'index.html' or 'archive.html'
    // routeParts.length === 2: 'articles/000.html', 'fiction/slug.html',
    //   'photos/roll.html'
    // routeParts.length === 3: 'photos/roll/DSCF0001.html'

    if (routeParts.length === 1 && routeParts[0] === 'index.html') {
      // Home page
      sidecar = homeSidecar()
      logv(`home: ${relPath}`)
    } else if (routeParts[0] === 'articles' && routeParts.length === 2) {
      // articles/<fileNum>.html
      const fileNum = path.basename(routeParts[1], '.html')
      const article = articleByFileNum.get(localizedSidecarKey(pageLang, fileNum))
      if (article) {
        sidecar = articleSidecar(article)
        logv(`article ${fileNum}: ${article.title}`)
      } else {
        logv(`unmatched article: ${relPath}`)
        unmatched++
      }
    } else if (routeParts[0] === 'fiction' && routeParts.length === 2) {
      // fiction/<slug>.html
      const slug = path.basename(routeParts[1], '.html')
      const fiction = fictionBySlug.get(localizedSidecarKey(pageLang, slug))
      if (fiction) {
        sidecar = fictionSidecar(fiction)
        logv(`fiction ${slug}: ${fiction.title}`)
      } else {
        logv(`unmatched fiction: ${relPath}`)
        unmatched++
      }
    } else if (routeParts[0] === 'photos' && routeParts.length === 2) {
      // photos/<roll>.html — roll index
      const roll = path.basename(routeParts[1], '.html')
      const rollSidecars = sidecarsByRoll.get(localizedSidecarKey(pageLang, roll)) ?? []
      sidecar = rollIndexSidecar(roll, rollSidecars)
      logv(`roll index ${roll}: ${rollSidecars.length} frames`)
    } else if (routeParts[0] === 'photos' && routeParts.length === 3) {
      // photos/<roll>/<id>.html — photo entry
      const roll = routeParts[1]
      const id   = path.basename(routeParts[2], '.html')
      const key = localizedSidecarKey(pageLang, roll, id)
      const sc   = sidecarByKey.get(key)
      if (sc) {
        sidecar = photoSidecar(sc)
        logv(`photo ${key}: ${sc.caption ?? '(no caption)'}`)
      } else {
        logv(`unmatched photo sidecar: ${relPath} (key=${key})`)
        unmatched++
      }
    } else if (
      // archive/index.html  — Next.js renders /archive as archive/index.html
      // OR archive.html — depending on Next.js output mode
      (routeParts[0] === 'archive' && routeParts.length === 2 && routeParts[1] === 'index.html') ||
      (routeParts[0] === 'archive' && routeParts.length === 1) ||
      relPath === 'archive.html'
    ) {
      // /archive route — cross-stratum ledger (docs/design/21-archive-route.md §7.3)
      const localizedArticles = localizedSidecarRows(articles, pageLang)
      const localizedFictions = localizedSidecarRows(fictions, pageLang)
      const localizedPhotos = localizedSidecarRows(photoSidecars, pageLang)
      sidecar = archiveSidecar(localizedArticles, localizedFictions, localizedPhotos)
      logv(`archive (${pageLang}): ${localizedArticles.length} articles, ${localizedFictions.length} fiction, ${localizedPhotos.length} photos injected`)
    } else {
      logv(`unrecognised path pattern: ${relPath}`)
      unmatched++
    }

    if (sidecar === null) continue

    const modified = injectSidecar(removeHiddenPagefindBodyMarkers(html), sidecar)

    if (DRY_RUN) {
      logv(`[dry-run] would write: ${relPath}`)
    } else {
      await fs.writeFile(htmlPath, modified, 'utf-8')
    }
    injected++
  }

  log(`done — injected: ${injected}, already-present: ${skipped}, unmatched: ${unmatched}`)
  if (unmatched > 0) {
    logErr(`${unmatched} HTML file(s) could not be matched to store data — check above`)
  }
}

main().catch(err => {
  logErr('fatal:', err)
  process.exit(1)
})
