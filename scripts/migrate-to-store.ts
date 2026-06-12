/**
 * scripts/migrate-to-store.ts
 *
 * S2 - Idempotent migration of all existing MDX content into the Supabase store.
 * Spec: SPEC-2026-06-12-store-as-source-supabase.md sec.9.1-9.4
 *
 * Run locally with:
 *   npx tsx scripts/migrate-to-store.ts
 *
 * Re-running is SAFE - every insert is an upsert on natural keys.
 *
 * Upsert order (per spec sec.9.2):
 *   1. places  (from lib/content/place-registry.data.json - frozen after migration)
 *   2. rolls   (from content/photos/<roll>/roll.mdx - body comment-stripped)
 *   3. entries (articles, fiction, photo sidecars)
 *   4. photo_assets (stub rows with null exif/variants - console upload wires real data)
 *
 * Uses:
 *   - node:fs / node:path / node:readline (built-in Node 24)
 *   - native fetch (Node 24 built-in - no @supabase/supabase-js needed at migration time)
 *   - Inline YAML frontmatter parser (no gray-matter dep needed)
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 *
 * The SUPABASE_SECRET_KEY is scripts/** ONLY - never app runtime, never Vercel.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const contentRoot = join(projectRoot, 'content')
const envLocalPath = resolve(projectRoot, '.env.local')

function loadEnvLocal(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const lines = readFileSync(path, 'utf-8').split('\n')
  const env: Record<string, string> = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim()
    env[key] = val
  }
  return env
}

const envVars = loadEnvLocal(envLocalPath)
const SUPABASE_URL = (envVars['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '').replace(/\/$/, '')
const SECRET_KEY = envVars['SUPABASE_SECRET_KEY'] ?? process.env['SUPABASE_SECRET_KEY'] ?? ''

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local')
  process.exit(1)
}

const REST_BASE = `${SUPABASE_URL}/rest/v1`
const serviceHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SECRET_KEY}`,
  'apikey': SECRET_KEY,
  'Prefer': 'return=representation',
} as const

// ---------------------------------------------------------------------------
// Supabase REST helpers
// ---------------------------------------------------------------------------

async function supaUpsert(table: string, rows: Record<string, unknown>[], onConflict: string): Promise<void> {
  if (rows.length === 0) return
  const url = `${REST_BASE}/${table}?on_conflict=${encodeURIComponent(onConflict)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...serviceHeaders,
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Upsert into ${table} failed: ${res.status} ${body}`)
  }
}

async function supaCount(table: string): Promise<number> {
  const url = `${REST_BASE}/${table}?select=count`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...serviceHeaders,
      'Prefer': 'count=exact',
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Count ${table} failed: ${res.status} ${body}`)
  }
  const range = res.headers.get('content-range')
  if (range) {
    const m = range.match(/\/(\d+)$/)
    if (m) return parseInt(m[1], 10)
  }
  const data = await res.json() as Array<{ count: string }>
  return data.length > 0 ? parseInt(data[0].count, 10) : 0
}

async function supaQuery(table: string, select: string, filter?: string): Promise<unknown[]> {
  let url = `${REST_BASE}/${table}?select=${encodeURIComponent(select)}`
  if (filter) url += `&${filter}`
  const res = await fetch(url, {
    method: 'GET',
    headers: serviceHeaders,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Query ${table} failed: ${res.status} ${body}`)
  }
  return res.json() as Promise<unknown[]>
}

// ---------------------------------------------------------------------------
// Inline MDX frontmatter parser
// Handles the simple YAML used in these MDX files: strings, numbers, booleans,
// arrays (dash-lists), and nested objects (lat/lon/place coords, patches, variants).
// NOT a general YAML parser - tuned for this exact content schema.
// ---------------------------------------------------------------------------

interface ParsedMdx {
  frontmatter: Record<string, unknown>
  body: string
}

function parseMdx(raw: string): ParsedMdx {
  const trimmed = raw.trimStart()
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: raw }
  }
  const endIdx = trimmed.indexOf('\n---', 3)
  if (endIdx === -1) {
    return { frontmatter: {}, body: raw }
  }
  const yamlBlock = trimmed.slice(4, endIdx).trim()
  const body = trimmed.slice(endIdx + 4).trimStart()
  const frontmatter = parseYamlBlock(yamlBlock)
  return { frontmatter, body }
}

function parseYamlBlock(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) { i++; continue }

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) { i++; continue }

    const key = trimmed.slice(0, colonIdx).trim()
    const rest = trimmed.slice(colonIdx + 1).trim()

    if (rest === '' || rest === '|' || rest === '>') {
      // Could be a nested block - collect indented children
      const childLines: string[] = []
      const baseIndent = line.search(/\S/)
      i++
      while (i < lines.length) {
        const nextLine = lines[i]
        if (nextLine.trim() === '' && childLines.length === 0) { i++; continue }
        if (nextLine.trim() === '') break
        const nextIndent = nextLine.search(/\S/)
        if (nextIndent <= baseIndent && nextLine.trim() !== '') break
        childLines.push(nextLine)
        i++
      }
      if (childLines.length > 0 && childLines[0].trim().startsWith('-')) {
        // Array of objects or scalars
        result[key] = parseYamlArray(childLines)
      } else if (childLines.length > 0) {
        // Nested object
        result[key] = parseYamlBlock(childLines.map(l => l.slice(baseIndent + 2 < l.length ? baseIndent + 2 : 0)).join('\n'))
      } else {
        result[key] = null
      }
    } else if (rest.startsWith('[')) {
      // Inline array: [a, b]
      const inner = rest.slice(1, rest.lastIndexOf(']'))
      result[key] = inner ? inner.split(',').map(s => parseScalar(s.trim())) : []
      i++
    } else {
      result[key] = parseScalar(rest)
      i++
    }
  }

  return result
}

function parseYamlArray(lines: string[]): unknown[] {
  const result: unknown[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) { i++; continue }
    if (trimmed.startsWith('- ')) {
      const rest = trimmed.slice(2).trim()
      const colonIdx = rest.indexOf(':')
      if (colonIdx !== -1) {
        // This is the start of an object item: "- key: val"
        const itemLines: string[] = [line]
        i++
        while (i < lines.length) {
          const next = lines[i]
          const nextTrimmed = next.trim()
          if (nextTrimmed.startsWith('- ') || !nextTrimmed) break
          itemLines.push(next)
          i++
        }
        // Parse the object: strip leading "  - " from first line, "    " from rest
        const objLines = itemLines.map((l, idx) => {
          if (idx === 0) return l.replace(/^\s*-\s/, '  ')
          return l
        })
        result.push(parseYamlBlock(objLines.join('\n').trim()))
      } else {
        // Scalar in a dash list
        result.push(parseScalar(rest))
        i++
      }
    } else if (trimmed.startsWith('-')) {
      result.push(parseScalar(trimmed.slice(1).trim()))
      i++
    } else {
      i++
    }
  }
  return result
}

function parseScalar(s: string): unknown {
  if (s === 'true') return true
  if (s === 'false') return false
  if (s === 'null' || s === '~' || s === '') return null
  if (/^".*"$/.test(s)) return s.slice(1, -1)
  if (/^'.*'$/.test(s)) return s.slice(1, -1)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s  // ISO date - keep as string
  const num = Number(s)
  if (!isNaN(num) && s.trim() !== '') return num
  return s
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function dotDateToIso(dotDate: string): string {
  // "2026.04.20" → "2026-04-20"
  return dotDate.replace(/\./g, '-')
}

// ---------------------------------------------------------------------------
// Content readers
// ---------------------------------------------------------------------------

interface PlaceRegistryEntry {
  id: string
  level: number
  parentId: string | null
  name: string
  coord: { lat: number; lon: number }
}

function readPlaceRegistry(): PlaceRegistryEntry[] {
  const p = join(projectRoot, 'lib', 'content', 'place-registry.data.json')
  return JSON.parse(readFileSync(p, 'utf-8')) as PlaceRegistryEntry[]
}

interface RollMdx {
  roll: string
  id: string
  caption?: string
  shareLocation?: boolean
  coords?: { lat: number; lon: number; place: string }
  date: string
  body: string
}

function readRolls(): RollMdx[] {
  const photosDir = join(contentRoot, 'photos')
  if (!existsSync(photosDir)) return []
  const rolls: RollMdx[] = []
  for (const rollDir of readdirSync(photosDir)) {
    const rollMdxPath = join(photosDir, rollDir, 'roll.mdx')
    if (!existsSync(rollMdxPath)) continue
    const raw = readFileSync(rollMdxPath, 'utf-8')
    const { frontmatter, body } = parseMdx(raw)

    // Comment-strip body per spec sec.9.2:
    // "strip /<!--[\s\S]*?-->/g then trim, store '' if nothing remains"
    const strippedBody = body.replace(/<!--[\s\S]*?-->/g, '').trim()

    rolls.push({
      roll: frontmatter['roll'] as string,
      id: frontmatter['id'] as string,
      caption: frontmatter['caption'] as string | undefined,
      shareLocation: Boolean(frontmatter['shareLocation'] ?? false),
      coords: frontmatter['coords'] as { lat: number; lon: number; place: string } | undefined,
      date: frontmatter['date'] as string,
      body: strippedBody,
    })
  }
  return rolls
}

interface ArticleMdx {
  fileNum: string
  title: string
  date: string
  domain: string
  tags: string[]
  status: string  // velite status = maturity in DB (DL1)
  readingTime: number
  summary: string
  coords: { lat: number; lon: number; place: string }
  patches: Array<{ n: number; date: string; note: string }>
  shareLocation?: boolean
  placeId?: string
  highlightForPlace?: boolean
  draft?: boolean
  worldline_links?: Array<{ to: string; label?: string }>
  body: string
}

function readArticles(): ArticleMdx[] {
  const articlesDir = join(contentRoot, 'articles')
  if (!existsSync(articlesDir)) return []
  const articles: ArticleMdx[] = []
  for (const file of readdirSync(articlesDir).filter(f => f.endsWith('.mdx'))) {
    const raw = readFileSync(join(articlesDir, file), 'utf-8')
    const { frontmatter, body } = parseMdx(raw)
    articles.push({
      fileNum: String(frontmatter['fileNum']),
      title: frontmatter['title'] as string,
      date: frontmatter['date'] as string,
      domain: frontmatter['domain'] as string,
      tags: (frontmatter['tags'] as unknown[]).map(String),
      status: frontmatter['status'] as string,  // seed/ongoing/refined/settled → maturity col
      readingTime: Number(frontmatter['readingTime']),
      summary: frontmatter['summary'] as string,
      coords: frontmatter['coords'] as { lat: number; lon: number; place: string },
      patches: ((frontmatter['patches'] ?? []) as Array<{ n: number; date: string; note: string }>),
      shareLocation: Boolean(frontmatter['shareLocation'] ?? false),
      placeId: frontmatter['placeId'] as string | undefined,
      highlightForPlace: Boolean(frontmatter['highlightForPlace'] ?? false),
      draft: Boolean(frontmatter['draft'] ?? false),
      worldline_links: ((frontmatter['worldline_links'] ?? []) as Array<{ to: string; label?: string }>),
      body: body.trim(),
    })
  }
  return articles
}

interface FictionMdx {
  slug: string
  title: string
  date: string
  domain: string
  tags: string[]
  summary: string
  originLocus?: { lat: number; lon: number; place: string }
  variants?: Array<{ alpha: string; delta_summary: string; drift?: number; slug?: string }>
  divergence_cluster?: string
  draft?: boolean
  worldline_links?: Array<{ to: string; label?: string }>
  body: string
}

function readFiction(): FictionMdx[] {
  const fictionDir = join(contentRoot, 'fiction')
  if (!existsSync(fictionDir)) return []
  const fictions: FictionMdx[] = []
  for (const file of readdirSync(fictionDir).filter(f => f.endsWith('.mdx'))) {
    const raw = readFileSync(join(fictionDir, file), 'utf-8')
    const { frontmatter, body } = parseMdx(raw)
    fictions.push({
      slug: frontmatter['slug'] as string,
      title: frontmatter['title'] as string,
      date: frontmatter['date'] as string,
      domain: frontmatter['domain'] as string,
      tags: (frontmatter['tags'] as unknown[]).map(String),
      summary: frontmatter['summary'] as string,
      originLocus: frontmatter['originLocus'] as { lat: number; lon: number; place: string } | undefined,
      variants: frontmatter['variants'] as Array<{ alpha: string; delta_summary: string }> | undefined,
      divergence_cluster: frontmatter['divergence_cluster'] as string | undefined,
      draft: Boolean(frontmatter['draft'] ?? false),
      worldline_links: ((frontmatter['worldline_links'] ?? []) as Array<{ to: string; label?: string }>),
      body: body.trim(),
    })
  }
  return fictions
}

interface SidecarMdx {
  roll: string
  id: string
  caption?: string
  shareLocation?: boolean
  coords?: { lat: number; lon: number; place: string }
  overridePlace?: string
  date: string
  placeId?: string
  highlightRank?: number
  draft?: boolean
  worldline_links?: Array<{ to: string; label?: string }>
}

function readPhotoSidecars(): SidecarMdx[] {
  const photosDir = join(contentRoot, 'photos')
  if (!existsSync(photosDir)) return []
  const sidecars: SidecarMdx[] = []
  for (const rollDir of readdirSync(photosDir)) {
    const rollPath = join(photosDir, rollDir)
    for (const file of readdirSync(rollPath).filter(f => f.endsWith('.mdx') && f !== 'roll.mdx')) {
      const raw = readFileSync(join(rollPath, file), 'utf-8')
      const { frontmatter } = parseMdx(raw)
      // Only process photo-sidecar kind (not roll.mdx re-reads)
      if (frontmatter['kind'] !== 'photo-sidecar') continue
      sidecars.push({
        roll: frontmatter['roll'] as string,
        id: frontmatter['id'] as string,
        caption: frontmatter['caption'] as string | undefined,
        shareLocation: Boolean(frontmatter['shareLocation'] ?? false),
        coords: frontmatter['coords'] as { lat: number; lon: number; place: string } | undefined,
        overridePlace: frontmatter['overridePlace'] as string | undefined,
        date: frontmatter['date'] as string,
        placeId: frontmatter['placeId'] as string | undefined,
        highlightRank: frontmatter['highlightRank'] as number | undefined,
        draft: Boolean(frontmatter['draft'] ?? false),
        worldline_links: ((frontmatter['worldline_links'] ?? []) as Array<{ to: string; label?: string }>),
      })
    }
  }
  return sidecars
}

// ---------------------------------------------------------------------------
// Privacy helpers - DL13: served_coords is trigger-maintained in DB.
// Raw coords go into the `coords` column (anon-revoked).
// We do NOT compute served_coords here - the DB trigger handles it on upsert.
// ---------------------------------------------------------------------------

function roundLocality(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------------------------------------------------------------------------
// Migration steps
// ---------------------------------------------------------------------------

async function migratePlaces(): Promise<void> {
  console.log('\n--- 1. Places ---')
  const registry = readPlaceRegistry()
  console.log(`  Parsed ${registry.length} places from place-registry.data.json`)

  const rows = registry.map(p => ({
    id: p.id,
    level: p.level ?? 1,
    parent_id: p.parentId ?? null,
    name: p.name,
    lat: p.coord.lat,
    lon: p.coord.lon,
  }))

  await supaUpsert('places', rows, 'id')
  const count = await supaCount('places')
  console.log(`  places table count: ${count}`)
}

async function migrateRolls(): Promise<void> {
  console.log('\n--- 2. Rolls ---')
  const rolls = readRolls()
  console.log(`  Parsed ${rolls.length} rolls from content/photos/*/roll.mdx`)

  for (const roll of rolls) {
    console.log(`  Roll: ${roll.roll}  id=${roll.id}  body="${roll.body.slice(0, 40)}${roll.body.length > 40 ? '...' : ''}"`)
  }

  const rows = rolls.map(r => ({
    roll: r.roll,
    id: r.id,
    caption: r.caption ?? null,
    share_location: r.shareLocation ?? false,
    coords: r.coords ? { lat: r.coords.lat, lon: r.coords.lon, place: r.coords.place } : null,
    // served_coords: trigger-maintained by set_served_coords() - omit from insert
    date: r.date,
    iso_date: dotDateToIso(r.date),
    body: r.body,
  }))

  await supaUpsert('rolls', rows, 'roll')
  const count = await supaCount('rolls')
  console.log(`  rolls table count: ${count}`)
}

async function migrateArticles(): Promise<number> {
  console.log('\n--- 3a. Articles ---')
  const articles = readArticles()
  console.log(`  Parsed ${articles.length} articles`)

  const rows = articles.map(a => ({
    kind: 'article',
    slug: a.fileNum,               // article slug = fileNum (e.g. "000")
    // DL1: frontmatter `status` (maturity ladder) → DB `maturity`; DB `status` = draft/published
    status: a.draft ? 'draft' : 'published',
    maturity: a.status,            // seed/ongoing/refined/settled
    title: a.title,
    date: a.date,
    iso_date: dotDateToIso(a.date),
    domain: a.domain,
    tags: a.tags,
    summary: a.summary,
    coords: { lat: a.coords.lat, lon: a.coords.lon, place: a.coords.place },
    // served_coords: trigger-maintained - omit
    share_location: a.shareLocation ?? false,
    place_id: a.placeId ?? null,
    highlight_for_place: a.highlightForPlace ?? false,
    patches: a.patches ?? [],
    worldline_links: a.worldline_links ?? [],
    reading_time: a.readingTime,
    body: a.body,
  }))

  await supaUpsert('entries', rows, 'kind,slug')
  return articles.length
}

async function migrateFiction(): Promise<number> {
  console.log('\n--- 3b. Fiction ---')
  const fictions = readFiction()
  console.log(`  Parsed ${fictions.length} fiction entries`)

  const rows = fictions.map(f => ({
    kind: 'fiction',
    slug: f.slug,
    status: f.draft ? 'draft' : 'published',
    title: f.title,
    date: f.date,
    iso_date: dotDateToIso(f.date),
    domain: f.domain,
    tags: f.tags,
    summary: f.summary,
    origin_locus: f.originLocus ?? null,
    variants: f.variants && f.variants.length > 0 ? f.variants : null,
    divergence_cluster: f.divergence_cluster ?? null,
    worldline_links: f.worldline_links ?? [],
    body: f.body,
    // fiction has no coords / maturity / reading_time
  }))

  await supaUpsert('entries', rows, 'kind,slug')
  return fictions.length
}

async function migratePhotoSidecars(): Promise<{ entryCount: number; assetCount: number }> {
  console.log('\n--- 3c. Photo sidecars ---')
  const sidecars = readPhotoSidecars()
  console.log(`  Parsed ${sidecars.length} photo sidecars`)

  // Upsert entries first
  const entryRows = sidecars.map(s => ({
    kind: 'photo',
    slug: `${s.roll}/${s.id}`,    // photo slug = "<roll>/<id>"
    status: s.draft ? 'draft' : 'published',
    roll: s.roll,
    photo_id: s.id,
    caption: s.caption ?? null,
    share_location: s.shareLocation ?? false,
    coords: s.coords ? { lat: s.coords.lat, lon: s.coords.lon, place: s.coords.place } : null,
    // served_coords: trigger-maintained
    date: s.date,
    iso_date: dotDateToIso(s.date),
    tags: [],
    override_place: s.overridePlace ?? null,
    place_id: s.placeId ?? null,
    highlight_rank: s.highlightRank ?? null,
    worldline_links: s.worldline_links ?? [],
    body: '',   // photo sidecars have no body prose
  }))

  await supaUpsert('entries', entryRows, 'kind,slug')

  // Now upsert photo_assets rows (null exif/variants - real data comes via console upload)
  // We need the entry IDs to create photo_assets rows.
  // Fetch all photo entry IDs - simpler than encoding slugs with slashes in PostgREST in.() filter
  const entryRecords = await supaQuery('entries', 'id,slug', 'kind=eq.photo') as Array<{ id: string; slug: string }>

  const assetRows = entryRecords.map(e => ({
    entry_id: e.id,
    original_key: null,
    source_hash: null,
    exif: null,
    variants: null,
  }))

  if (assetRows.length > 0) {
    await supaUpsert('photo_assets', assetRows, 'entry_id')
  }

  const assetCount = await supaCount('photo_assets')
  console.log(`  photo_assets table count: ${assetCount}`)

  return { entryCount: sidecars.length, assetCount }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

async function verify(): Promise<void> {
  console.log('\n=== Verification ===')

  const placesCount = await supaCount('places')
  const rollsCount = await supaCount('rolls')
  const entriesTotal = await supaCount('entries')
  const assetsCount = await supaCount('photo_assets')

  // Direct counts by kind
  const articleEntries = await supaQuery('entries', 'slug,status,maturity,title,served_coords', 'kind=eq.article') as Array<{
    slug: string; status: string; maturity: string; title: string; served_coords: unknown
  }>
  const fictionEntries = await supaQuery('entries', 'slug,status,title', 'kind=eq.fiction') as Array<{
    slug: string; status: string; title: string
  }>
  const photoEntries = await supaQuery('entries', 'slug,status,roll,photo_id', 'kind=eq.photo') as Array<{
    slug: string; status: string; roll: string; photo_id: string
  }>

  console.log(`\n  places:      ${placesCount} (expected 4)`)
  console.log(`  rolls:       ${rollsCount} (expected 2)`)
  console.log(`  articles:    ${articleEntries.length} (expected 4)`)
  console.log(`  fiction:     ${fictionEntries.length} (expected 1)`)
  console.log(`  photos:      ${photoEntries.length} (expected 5)`)
  console.log(`  photo_assets: ${assetsCount} (expected 5)`)
  console.log(`  entries total: ${entriesTotal} (expected 10)`)

  // Gate check: spec sec.12 S2 - "counts 4/1/5 articles/fiction/photos + 2 rolls + 4 places"
  const gatePass =
    placesCount === 4 &&
    rollsCount === 2 &&
    articleEntries.length === 4 &&
    fictionEntries.length === 1 &&
    photoEntries.length === 5 &&
    assetsCount === 5

  if (gatePass) {
    console.log('\n  GATE PASS: all counts match spec sec.12 S2 expectations')
  } else {
    console.error('\n  GATE FAIL: one or more counts do not match expectations')
  }

  // Verify roll bodies (spec sec.12 S2 gate):
  // "bangkok roll body non-empty, chiang-mai body '' after comment-strip"
  const rolls = await supaQuery('rolls', 'roll,id,body,served_coords') as Array<{
    roll: string; id: string; body: string; served_coords: unknown
  }>
  console.log('\n  Roll body verification:')
  for (const r of rolls) {
    const bodyPreview = r.body === '' ? "''" : `"${r.body.slice(0, 60)}${r.body.length > 60 ? '...' : ''}"`
    const isCorrect =
      (r.roll === '2026-04-chiang-mai' && r.body === '') ||
      (r.roll === '2026-05-bangkok' && r.body.length > 0)
    console.log(`    ${r.roll}  id=${r.id}  body=${bodyPreview}  served_coords=${JSON.stringify(r.served_coords)}  ${isCorrect ? 'OK' : 'FAIL'}`)
  }

  // Verify article served_coords (rounded ≤2 decimals per DL13 trigger)
  console.log('\n  Article served_coords (trigger-rounded):')
  for (const a of articleEntries) {
    const sc = a.served_coords as { lat: number; lon: number } | null
    if (sc) {
      const latOk = String(sc.lat).replace(/\d+\./, '').length <= 2
      const lonOk = String(sc.lon).replace(/\d+\./, '').length <= 2
      console.log(`    ${a.slug} ${a.title}: served_coords=${JSON.stringify(sc)} decimals_ok=${latOk && lonOk}`)
    } else {
      console.log(`    ${a.slug} ${a.title}: served_coords=null`)
    }
  }

  // Verify photo served_coords match share_location
  console.log('\n  Photo served_coords (share_location gate):')
  const photoFull = await supaQuery(
    'entries',
    'slug,share_location,served_coords',
    'kind=eq.photo'
  ) as Array<{ slug: string; share_location: boolean; served_coords: unknown }>
  for (const p of photoFull) {
    const sc = p.served_coords
    const correct = p.share_location ? sc !== null : sc === null
    console.log(`    ${p.slug}  share_location=${p.share_location}  served_coords=${sc === null ? 'null' : 'set'}  ${correct ? 'OK' : 'FAIL'}`)
  }

  return
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== migrate-to-store.ts - S2 content migration ===')
  console.log(`Supabase URL: ${SUPABASE_URL}`)
  console.log(`Content root: ${contentRoot}`)
  console.log()

  // Check if this is an idempotent re-run
  const preCount = await supaCount('entries')
  if (preCount > 0) {
    console.log(`Note: entries table already has ${preCount} rows - idempotent upsert will run.`)
  }

  // Execute migration in order per spec sec.9.2
  await migratePlaces()
  await migrateRolls()
  const articleCount = await migrateArticles()
  const fictionCount = await migrateFiction()
  const { entryCount: photoCount, assetCount } = await migratePhotoSidecars()

  console.log(`\nMigrated: ${articleCount} articles, ${fictionCount} fiction, ${photoCount} photos`)

  await verify()

  console.log('\n=== Migration complete ===')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
