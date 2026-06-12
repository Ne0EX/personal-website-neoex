/**
 * scripts/export-mdx.ts
 *
 * S7 — Export store → MDX snapshots.
 * Spec: SPEC-2026-06-12-store-as-source-supabase.md §10, slice S7.
 *
 * Reads the store (secret key, local) and writes MDX snapshots into content/
 * in today's exact layout.  Drafts ARE included (full backup, owner-only script).
 *
 * Output layout:
 *   content/articles/<fileNum>-<kebab-title>.mdx
 *   content/fiction/<slug>.mdx
 *   content/photos/<roll>/roll.mdx
 *   content/photos/<roll>/<photo_id>.mdx
 *
 * Backup clause (§10): the npm script `backup:content` runs this export then
 * `git add -f content && git commit` onto branch backup/content (S8 owns the
 * branch-creation gate).  This script is correct and dry-runnable on its own.
 *
 * Run locally only:
 *   npx tsx scripts/export-mdx.ts [--dry-run] [--out-dir <path>]
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 *
 * The SUPABASE_SECRET_KEY is scripts/** ONLY — never app runtime, never Vercel.
 */

// server-action: altair

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
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

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const outDirIdx = args.indexOf('--out-dir')
const OUT_DIR = outDirIdx !== -1 ? resolve(args[outDirIdx + 1]) : join(projectRoot, 'content')

if (DRY_RUN) {
  console.log('[dry-run] No files will be written.')
}
console.log(`Output directory: ${OUT_DIR}`)

// ---------------------------------------------------------------------------
// Supabase REST helpers (secret key — full row access incl. raw coords)
// ---------------------------------------------------------------------------

const serviceHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SECRET_KEY}`,
  'apikey': SECRET_KEY,
} as const

async function supaQuery<T = unknown>(table: string, select: string, filter?: string): Promise<T[]> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`
  if (filter) url += `&${filter}`
  const res = await fetch(url, {
    method: 'GET',
    headers: serviceHeaders,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Query ${table} failed: ${res.status} ${body}`)
  }
  return res.json() as Promise<T[]>
}

// ---------------------------------------------------------------------------
// DB row types (secret key — includes raw coords, drafts)
// ---------------------------------------------------------------------------

interface DbArticle {
  slug: string                  // fileNum e.g. "000"
  title: string
  date: string                  // "2026.04.20"
  domain: string
  tags: string[]
  maturity: string              // seed/ongoing/refined/settled
  reading_time: number
  summary: string
  coords: { lat: number; lon: number; place: string } | null
  share_location: boolean
  place_id: string | null
  highlight_for_place: boolean
  patches: Array<{ n: number; date: string; note: string }>
  worldline_links: Array<{ to: string; label?: string }>
  body: string
  status: 'draft' | 'published' // DB publish state
}

interface DbFiction {
  slug: string
  title: string
  date: string
  domain: string
  tags: string[]
  summary: string
  origin_locus: { lat: number; lon: number; place: string } | null
  variants: Array<{ alpha: string; delta_summary: string; drift?: number; slug?: string }> | null
  divergence_cluster: string | null
  worldline_links: Array<{ to: string; label?: string }>
  body: string
  status: 'draft' | 'published'
}

interface DbPhoto {
  slug: string                   // "<roll>/<photo_id>"
  roll: string
  photo_id: string
  caption: string | null
  share_location: boolean
  coords: { lat: number; lon: number; place: string } | null
  date: string
  place_id: string | null
  highlight_rank: number | null
  override_place: string | null
  worldline_links: Array<{ to: string; label?: string }>
  body: string
  status: 'draft' | 'published'
}

interface DbRoll {
  roll: string
  id: string
  caption: string | null
  share_location: boolean
  coords: { lat: number; lon: number; place: string } | null
  date: string
  body: string
}

// ---------------------------------------------------------------------------
// YAML serialiser — reproduces today's quoting conventions
//
// Rules observed from the original MDX files:
//   - Top-level string values that contain special chars: double-quoted
//   - Simple strings (single word, no punctuation): unquoted (e.g. domain: meta)
//   - Numbers: unquoted
//   - Booleans: unquoted (true/false)
//   - null / absent: field omitted (same as original; optional fields not emitted when falsy)
//   - Arrays: multi-line dash-list
//   - Coords / origin_locus / patches: multi-line nested blocks
//   - variants: multi-line array-of-objects with indentation
// ---------------------------------------------------------------------------

/** Whether a string value needs double-quoting in YAML. */
function needsQuotes(s: string): boolean {
  if (s === '') return true
  // Quote if contains any of: :  #  {  }  [  ]  ,  &  *  ?  |  >  !  '  "  %  @  `
  // or starts with -, whitespace, or a digit that's followed by non-digit chars
  // or looks like a boolean/null
  if (/^(true|false|null|~)$/i.test(s)) return true
  if (/[:{}\[\],&*?|>!'"#%@`]/.test(s)) return true
  if (/^\s/.test(s) || /\s$/.test(s)) return true
  // Contains \n
  if (/\n/.test(s)) return true
  return false
}

function yamlStr(s: string): string {
  if (needsQuotes(s)) {
    // Double-quote with internal " escaped as \"
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return s
}

function yamlStrArray(arr: string[]): string {
  if (arr.length === 0) return '[]'
  return arr.map(s => `  - ${yamlStr(s)}`).join('\n')
}

/** Serialise a coords object as indented YAML block. */
function yamlCoords(c: { lat: number; lon: number; place: string }): string {
  return [
    `  lat: ${c.lat}`,
    `  lon: ${c.lon}`,
    `  place: ${yamlStr(c.place)}`,
  ].join('\n')
}

/** Serialise patches array. */
function yamlPatches(patches: Array<{ n: number; date: string; note: string }>): string {
  if (patches.length === 0) return '[]'
  return patches.map(p =>
    `  - n: ${p.n}\n    date: "${p.date}"\n    note: "${p.note.replace(/"/g, '\\"')}"`
  ).join('\n')
}

/** Serialise fiction variants array. */
function yamlVariants(variants: Array<{ alpha: string; delta_summary: string; drift?: number; slug?: string }>): string {
  if (variants.length === 0) return '[]'
  return variants.map(v => {
    const lines = [`  - alpha: "${v.alpha}"`, `    delta_summary: "${v.delta_summary.replace(/"/g, '\\"')}"`]
    if (v.drift !== undefined && v.drift !== null) lines.push(`    drift: ${v.drift}`)
    if (v.slug) lines.push(`    slug: ${yamlStr(v.slug)}`)
    return lines.join('\n')
  }).join('\n')
}

// ---------------------------------------------------------------------------
// Filename derivation
// ---------------------------------------------------------------------------

/** Convert title to kebab-case slug for article filenames. */
function titleToKebab(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // strip non-alphanumeric (except space/hyphen)
    .trim()
    .replace(/\s+/g, '-')           // spaces → hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .replace(/^-|-$/g, '')          // trim leading/trailing hyphens
}

// ---------------------------------------------------------------------------
// MDX serialisers — one per content kind
//
// Frontmatter key order mirrors the original files exactly.
// ---------------------------------------------------------------------------

function serializeArticle(a: DbArticle): string {
  const lines: string[] = ['---']

  lines.push(`fileNum: "${a.slug}"`)
  lines.push(`kind: article`)
  lines.push(`title: ${yamlStr(a.title)}`)
  lines.push(`date: ${yamlStr(a.date)}`)
  lines.push(`domain: ${a.domain}`)

  // tags
  const tagsYaml = a.tags.length === 0 ? '[]' : '\n' + a.tags.map(t => `  - ${t}`).join('\n')
  lines.push(`tags:${tagsYaml}`)

  // DL1: DB `maturity` → frontmatter `status` (the old velite maturity ladder)
  lines.push(`status: ${a.maturity}`)
  lines.push(`readingTime: ${a.reading_time}`)
  lines.push(`summary: ${yamlStr(a.summary)}`)

  // coords
  if (a.coords) {
    lines.push(`coords:`)
    lines.push(`  lat: ${a.coords.lat}`)
    lines.push(`  lon: ${a.coords.lon}`)
    lines.push(`  place: ${yamlStr(a.coords.place)}`)
  }

  lines.push(`shareLocation: ${a.share_location}`)

  // placeId — only if set
  if (a.place_id) {
    lines.push(`placeId: ${a.place_id}`)
  }

  // highlightForPlace — only if true
  if (a.highlight_for_place) {
    lines.push(`highlightForPlace: true`)
  }

  // patches
  if (a.patches.length === 0) {
    lines.push(`patches: []`)
  } else {
    lines.push(`patches:`)
    for (const p of a.patches) {
      lines.push(`  - n: ${p.n}`)
      lines.push(`    date: "${p.date}"`)
      lines.push(`    note: "${p.note.replace(/"/g, '\\"')}"`)
    }
  }

  // worldline_links — only if non-empty
  if (a.worldline_links.length > 0) {
    lines.push(`worldline_links:`)
    for (const l of a.worldline_links) {
      lines.push(`  - to: ${yamlStr(l.to)}`)
      if (l.label) lines.push(`    label: ${yamlStr(l.label)}`)
    }
  }

  // DL1: if status='draft' emit draft: true
  if (a.status === 'draft') {
    lines.push(`draft: true`)
  }

  lines.push('---')
  lines.push('')
  lines.push(a.body)
  if (!a.body.endsWith('\n')) lines.push('')
  return lines.join('\n')
}

function serializeFiction(f: DbFiction): string {
  const lines: string[] = ['---']

  lines.push(`slug: ${f.slug}`)
  lines.push(`kind: fiction`)
  lines.push(`title: ${yamlStr(f.title)}`)
  lines.push(`date: ${yamlStr(f.date)}`)
  lines.push(`domain: ${f.domain}`)

  const tagsYaml = f.tags.length === 0 ? '[]' : '\n' + f.tags.map(t => `  - ${t}`).join('\n')
  lines.push(`tags:${tagsYaml}`)

  lines.push(`summary: ${yamlStr(f.summary)}`)

  if (f.origin_locus) {
    lines.push(`originLocus:`)
    lines.push(`  lat: ${f.origin_locus.lat}`)
    lines.push(`  lon: ${f.origin_locus.lon}`)
    lines.push(`  place: ${yamlStr(f.origin_locus.place)}`)
  }

  if (f.variants && f.variants.length > 0) {
    lines.push(`variants:`)
    for (const v of f.variants) {
      lines.push(`  - alpha: "${v.alpha}"`)
      lines.push(`    delta_summary: "${v.delta_summary.replace(/"/g, '\\"')}"`)
      if (v.drift !== undefined && v.drift !== null) lines.push(`    drift: ${v.drift}`)
      if (v.slug) lines.push(`    slug: ${yamlStr(v.slug)}`)
    }
  }

  if (f.divergence_cluster) {
    lines.push(`divergence_cluster: ${f.divergence_cluster}`)
  }

  if (f.worldline_links.length > 0) {
    lines.push(`worldline_links:`)
    for (const l of f.worldline_links) {
      lines.push(`  - to: ${yamlStr(l.to)}`)
      if (l.label) lines.push(`    label: ${yamlStr(l.label)}`)
    }
  }

  if (f.status === 'draft') {
    lines.push(`draft: true`)
  }

  lines.push('---')
  lines.push('')
  lines.push(f.body)
  if (!f.body.endsWith('\n')) lines.push('')
  return lines.join('\n')
}

function serializeRoll(r: DbRoll): string {
  const lines: string[] = ['---']

  lines.push(`roll: ${r.roll}`)
  lines.push(`id: ${r.id}`)
  lines.push(`kind: photo`)
  lines.push(`date: ${yamlStr(r.date)}`)

  if (r.caption) {
    lines.push(`caption: ${yamlStr(r.caption)}`)
  }

  lines.push(`shareLocation: ${r.share_location}`)

  if (r.coords && r.share_location) {
    lines.push(`coords:`)
    lines.push(`  lat: ${r.coords.lat}`)
    lines.push(`  lon: ${r.coords.lon}`)
    lines.push(`  place: ${yamlStr(r.coords.place)}`)
  }

  lines.push('---')
  lines.push('')

  // Body: empty = chiang-mai comment-placeholder was stripped; write literal empty body
  // Bangkok roll has real body prose
  if (r.body && r.body.trim().length > 0) {
    lines.push(r.body)
    if (!r.body.endsWith('\n')) lines.push('')
  }

  return lines.join('\n')
}

function serializePhotoSidecar(p: DbPhoto): string {
  const lines: string[] = ['---']

  lines.push(`roll: ${p.roll}`)
  lines.push(`id: ${p.photo_id}`)
  lines.push(`kind: photo-sidecar`)
  lines.push(`date: ${yamlStr(p.date)}`)

  if (p.caption) {
    lines.push(`caption: ${yamlStr(p.caption)}`)
  }

  lines.push(`shareLocation: ${p.share_location}`)

  if (p.coords && p.share_location) {
    lines.push(`coords:`)
    lines.push(`  lat: ${p.coords.lat}`)
    lines.push(`  lon: ${p.coords.lon}`)
    lines.push(`  place: ${yamlStr(p.coords.place)}`)
  }

  if (p.override_place) {
    lines.push(`overridePlace: ${yamlStr(p.override_place)}`)
  }

  if (p.place_id) {
    lines.push(`placeId: ${p.place_id}`)
  }

  if (p.highlight_rank !== null && p.highlight_rank !== undefined) {
    lines.push(`highlightRank: ${p.highlight_rank}`)
  }

  if (p.worldline_links.length > 0) {
    lines.push(`worldline_links:`)
    for (const l of p.worldline_links) {
      lines.push(`  - to: ${yamlStr(l.to)}`)
      if (l.label) lines.push(`    label: ${yamlStr(l.label)}`)
    }
  }

  if (p.status === 'draft') {
    lines.push(`draft: true`)
  }

  lines.push('---')
  // Photo sidecars have no body (the body is ''); end with trailing newline
  lines.push('')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// File writer
// ---------------------------------------------------------------------------

function ensureDir(p: string): void {
  if (!existsSync(p)) {
    mkdirSync(p, { recursive: true })
  }
}

function writeFile(filePath: string, content: string): void {
  if (DRY_RUN) {
    console.log(`  [dry-run] would write: ${filePath}`)
    return
  }
  ensureDir(dirname(filePath))
  writeFileSync(filePath, content, 'utf-8')
}

// ---------------------------------------------------------------------------
// Export steps
// ---------------------------------------------------------------------------

async function exportArticles(): Promise<number> {
  console.log('\n--- Articles ---')
  const rows = await supaQuery<DbArticle>(
    'entries',
    'slug,title,date,domain,tags,maturity,reading_time,summary,coords,share_location,place_id,highlight_for_place,patches,worldline_links,body,status',
    'kind=eq.article&order=slug.asc'
  )
  console.log(`  Fetched ${rows.length} articles`)

  for (const a of rows) {
    const kebab = titleToKebab(a.title)
    const filename = `${a.slug}-${kebab}.mdx`
    const filePath = join(OUT_DIR, 'articles', filename)
    const content = serializeArticle(a)
    writeFile(filePath, content)
    console.log(`  ${filename}`)
  }

  return rows.length
}

async function exportFiction(): Promise<number> {
  console.log('\n--- Fiction ---')
  const rows = await supaQuery<DbFiction>(
    'entries',
    'slug,title,date,domain,tags,summary,origin_locus,variants,divergence_cluster,worldline_links,body,status',
    'kind=eq.fiction&order=slug.asc'
  )
  console.log(`  Fetched ${rows.length} fiction entries`)

  for (const f of rows) {
    const filename = `${f.slug}.mdx`
    const filePath = join(OUT_DIR, 'fiction', filename)
    const content = serializeFiction(f)
    writeFile(filePath, content)
    console.log(`  ${filename}`)
  }

  return rows.length
}

async function exportPhotos(): Promise<number> {
  console.log('\n--- Rolls + Photo sidecars ---')

  const rolls = await supaQuery<DbRoll>(
    'rolls',
    'roll,id,caption,share_location,coords,date,body',
    'order=roll.asc'
  )
  console.log(`  Fetched ${rolls.length} rolls`)

  for (const r of rolls) {
    const rollDir = join(OUT_DIR, 'photos', r.roll)
    const filePath = join(rollDir, 'roll.mdx')
    const content = serializeRoll(r)
    writeFile(filePath, content)
    console.log(`  photos/${r.roll}/roll.mdx`)
  }

  const photos = await supaQuery<DbPhoto>(
    'entries',
    'slug,roll,photo_id,caption,share_location,coords,date,place_id,highlight_rank,override_place,worldline_links,body,status',
    'kind=eq.photo&order=roll.asc,photo_id.asc'
  )
  console.log(`  Fetched ${photos.length} photo sidecars`)

  for (const p of photos) {
    const filename = `${p.photo_id}.mdx`
    const filePath = join(OUT_DIR, 'photos', p.roll, filename)
    const content = serializePhotoSidecar(p)
    writeFile(filePath, content)
    console.log(`  photos/${p.roll}/${filename}`)
  }

  return rolls.length + photos.length
}

// ---------------------------------------------------------------------------
// Semantic diff helper (gate verification)
// ---------------------------------------------------------------------------

/**
 * Compare exported files against a reference directory.
 * "Semantically equal" = same frontmatter key set + same body (trimmed).
 * Formatting drift (quoting style, whitespace around colons) is documented below.
 */
function semanticDiff(exportedDir: string, refDir: string): {
  equal: string[]
  diffs: Array<{ file: string; reason: string }>
} {
  const equal: string[] = []
  const diffs: Array<{ file: string; reason: string }> = []

  function collectMdx(dir: string, base: string = ''): string[] {
    const result: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = base ? `${base}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        result.push(...collectMdx(join(dir, entry.name), rel))
      } else if (entry.name.endsWith('.mdx')) {
        result.push(rel)
      }
    }
    return result
  }

  // Parse MDX frontmatter keys from file content
  function parseFrontmatterKeys(content: string): Set<string> {
    const trimmed = content.trimStart()
    if (!trimmed.startsWith('---')) return new Set()
    const endIdx = trimmed.indexOf('\n---', 3)
    if (endIdx === -1) return new Set()
    const yaml = trimmed.slice(4, endIdx)
    const keys = new Set<string>()
    for (const line of yaml.split('\n')) {
      const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/)
      if (m) keys.add(m[1])
    }
    return keys
  }

  function parseBody(content: string): string {
    const trimmed = content.trimStart()
    if (!trimmed.startsWith('---')) return trimmed.trim()
    const endIdx = trimmed.indexOf('\n---', 3)
    if (endIdx === -1) return trimmed.trim()
    return trimmed.slice(endIdx + 4).trim()
  }

  const refFiles = collectMdx(refDir)
  const exportedFiles = new Set(collectMdx(exportedDir))

  for (const rel of refFiles) {
    if (!exportedFiles.has(rel)) {
      diffs.push({ file: rel, reason: 'missing from export' })
      continue
    }

    const refContent = readFileSync(join(refDir, rel), 'utf-8')
    const expContent = readFileSync(join(exportedDir, rel), 'utf-8')

    const refKeys = parseFrontmatterKeys(refContent)
    const expKeys = parseFrontmatterKeys(expContent)

    // Check: reference keys that are in the export (allow extras in export for draft: true)
    const missingKeys: string[] = []
    for (const k of refKeys) {
      if (!expKeys.has(k)) missingKeys.push(k)
    }
    if (missingKeys.length > 0) {
      diffs.push({ file: rel, reason: `missing frontmatter keys: ${missingKeys.join(', ')}` })
      continue
    }

    const refBody = parseBody(refContent)
    const expBody = parseBody(expContent)

    if (refBody !== expBody) {
      diffs.push({ file: rel, reason: `body differs (ref len=${refBody.length}, exp len=${expBody.length})` })
    } else {
      equal.push(rel)
    }
  }

  // Check for exported files not in ref
  for (const rel of exportedFiles) {
    if (!refFiles.includes(rel)) {
      diffs.push({ file: rel, reason: 'extra file in export (not in ref)' })
    }
  }

  return { equal, diffs }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== export-mdx.ts — S7 store → MDX export ===')
  console.log(`Supabase URL: ${SUPABASE_URL}`)
  console.log(`Out dir:      ${OUT_DIR}`)
  console.log(`Dry-run:      ${DRY_RUN}`)
  console.log()

  if (!DRY_RUN) {
    ensureDir(join(OUT_DIR, 'articles'))
    ensureDir(join(OUT_DIR, 'fiction'))
  }

  const articleCount = await exportArticles()
  const fictionCount = await exportFiction()
  const photoCount = await exportPhotos()

  console.log(`\nExported: ${articleCount} articles, ${fictionCount} fiction, ${photoCount} photos/rolls`)
  console.log('\n=== Export complete ===')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
