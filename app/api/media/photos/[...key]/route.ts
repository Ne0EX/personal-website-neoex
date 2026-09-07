// contract:
// GET/HEAD /api/media/photos/<roll>/<photoId>/<size>-<hash>.<format>
// Request: three validated path segments; query parameters grant no access.
// Response: exact registered JPEG/WebP/AVIF bytes (HEAD has no body), or a generic
// 404 { error: { code: 'NOT_FOUND', message: 'Image not found.' } }.
// Published variants are guest-readable; drafts require assertOwner. No signed
// URLs, redirects, originals or arbitrary upstream URLs. Every response is no-store.
// Rate limit: platform request limits; no per-visitor application image quota.
// Idempotency: read-only. Pattern: existing auth route contract + scoped SSR client.

import { readPhotoMedia } from '@/lib/server/photo-media'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

type MediaContext = { params: Promise<{ key: string[] }> }

export async function GET(_request: Request, { params }: MediaContext) {
  return readPhotoMedia((await params).key)
}

export async function HEAD(request: Request, context: MediaContext) {
  const response = await GET(request, context)
  return new Response(null, { status: response.status, headers: response.headers })
}
