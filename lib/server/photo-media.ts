import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { assertOwner } from '@/lib/server/auth'
import { createSupabaseServerClient } from '@/lib/store/supabase/server'
import { PhotoIdSchema, RollSlugSchema } from '@/lib/store/schema'
import type { DbVariantKeys } from '@/lib/store/map'

type VariantSize = 'thumb' | 'medium' | 'full'
type VariantFormat = 'jpg' | 'webp' | 'avif'
type MediaFailureStage = 'client' | 'entry_lookup' | 'asset_lookup' | 'storage_download' | 'response'
type MediaFailureCategory = 'upstream_error' | 'unexpected_exception' | 'empty_download'
type PhotoVariant = {
  key: string
  roll: string
  photoId: string
  size: VariantSize
  format: VariantFormat
}

const MEDIA_TYPES: Record<VariantFormat, string> = {
  jpg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
}

function mediaHeaders(): Headers {
  return new Headers({
    'Cache-Control': 'private, no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store',
    'Vary': 'Cookie',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
  })
}

function imageNotFound(): Response {
  return Response.json(
    { error: { code: 'NOT_FOUND', message: 'Image not found.' } },
    { status: 404, headers: mediaHeaders() },
  )
}

function reportMediaFailure(
  stage: MediaFailureStage,
  category: MediaFailureCategory,
): void {
  try {
    console.error(JSON.stringify({ event: 'photo_media_failure', stage, category }))
  } catch {
    // Logging must never change the private media response.
  }
}

function isExpectedStorageDenial(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const failure = error as { statusCode?: unknown; status?: unknown }
  const code = failure.statusCode
  switch (code) {
    case 403:
    case 404:
    case '403':
    case '404':
    case 'NoSuchKey':
    case 'AccessDenied':
    case 'not_found':
    case 'unauthorized':
      return true
    case undefined:
    case null:
    case '': {
      const status = failure.status
      return status === 403 || status === 404
    }
    default:
      return false
  }
}

function parseVariant(segments: unknown): PhotoVariant | null {
  if (!Array.isArray(segments) || segments.length !== 3) return null
  if (!segments.every((segment) => typeof segment === 'string')) return null
  const [roll, photoId, filename] = segments as string[]
  if (roll.length > 256 || !RollSlugSchema.safeParse(roll).success) return null
  if (!PhotoIdSchema.safeParse(photoId).success) return null
  const match = /^(thumb|medium|full)-[a-f0-9]{10}\.(jpg|webp|avif)$/.exec(filename)
  if (!match) return null
  return {
    key: segments.join('/'),
    roll,
    photoId,
    size: match[1] as VariantSize,
    format: match[2] as VariantFormat,
  }
}

function createAnonymousMediaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Media storage is unavailable')
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  })
}

/** Every request resolves current publication and the exact registered variant. */
export async function readPhotoMedia(keySegments: unknown): Promise<Response> {
  const variant = parseVariant(keySegments)
  if (!variant) return imageNotFound()

  let stage: MediaFailureStage = 'client'
  try {
    const owner = await assertOwner()
    // Unverified cookies never participate in guest database or Storage reads.
    const client = owner.ok
      ? await createSupabaseServerClient()
      : createAnonymousMediaClient()
    stage = 'entry_lookup'
    let entryQuery = client.from('entries').select('id,status')
      .eq('kind', 'photo').eq('roll', variant.roll).eq('photo_id', variant.photoId)
    if (!owner.ok) entryQuery = entryQuery.eq('status', 'published')
    const { data: entry, error: entryError } = await entryQuery.maybeSingle()
    if (entryError) {
      reportMediaFailure('entry_lookup', 'upstream_error')
      return imageNotFound()
    }
    if (!entry || typeof entry.id !== 'string') return imageNotFound()
    if (!owner.ok && entry.status !== 'published') return imageNotFound()

    stage = 'asset_lookup'
    const { data: assets, error: assetError } = await client.from('photo_assets')
      .select('variants').eq('entry_id', entry.id).maybeSingle()
    if (assetError) {
      reportMediaFailure('asset_lookup', 'upstream_error')
      return imageNotFound()
    }
    const variants = assets?.variants as DbVariantKeys | undefined
    if (variants?.[variant.size]?.[variant.format] !== variant.key) {
      return imageNotFound()
    }

    // Storage RLS repeats publication + exact-key checks at download time,
    // including when an entry is unpublished after the query above.
    stage = 'storage_download'
    const { data: image, error: downloadError } = await client.storage
      .from('photos').download(variant.key, {}, { cache: 'no-store' })
    if (downloadError) {
      // Denials include unpublish races; the external canary checks availability.
      if (!isExpectedStorageDenial(downloadError)) {
        reportMediaFailure('storage_download', 'upstream_error')
      }
      return imageNotFound()
    }
    if (!image) {
      reportMediaFailure('storage_download', 'empty_download')
      return imageNotFound()
    }
    stage = 'response'
    const headers = mediaHeaders()
    headers.set('Content-Type', MEDIA_TYPES[variant.format])
    headers.set('Content-Length', String(image.size))
    return new Response(image, { headers })
  } catch {
    // Do not reveal whether a private key, entry or storage object exists.
    reportMediaFailure(stage, 'unexpected_exception')
    return imageNotFound()
  }
}
