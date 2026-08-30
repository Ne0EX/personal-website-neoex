import type {
  NetraLanguage,
  NetraPageContext,
  NetraResourcePageContext,
  NetraUnknownPageContext,
} from '@/lib/netra/contracts'

export const NETRA_MAX_PATHNAME_LENGTH = 512

const ARTICLE_FILE_NUM_PATTERN = /^\d{3}$/
const FICTION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PHOTO_ROLL_PATTERN = /^\d{4}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/
const PHOTO_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/
const PRIVATE_ROOT_SEGMENTS = new Set(['api', 'console', '_next'])

function unknown(
  lang: NetraLanguage,
  reason: NetraUnknownPageContext['reason'],
): NetraUnknownPageContext {
  return { kind: 'unknown', lang, pathname: null, reason }
}

function stripQueryAndHash(value: string): string {
  const queryIndex = value.indexOf('?')
  const hashIndex = value.indexOf('#')
  const indexes = [queryIndex, hashIndex].filter((index) => index >= 0)
  return indexes.length === 0 ? value : value.slice(0, Math.min(...indexes))
}

function normalizePathname(value: string): string | null {
  if (
    value.length === 0
    || value.length > NETRA_MAX_PATHNAME_LENGTH
    || value !== value.trim()
  ) {
    return null
  }

  const pathname = stripQueryAndHash(value)
  if (
    !pathname.startsWith('/')
    || pathname.includes('\\')
    || pathname.includes('%')
    || pathname.includes('//')
    || /[\u0000-\u001f\u007f]/.test(pathname)
  ) {
    return null
  }

  if (pathname === '/') return pathname
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

/**
 * Resolves an untrusted browser pathname into the finite public route model.
 * Unknown and private hints retain no raw pathname, so they cannot become
 * prompt text or storage selectors.
 */
export function resolveNetraPageContext(
  pathnameHint: string,
  fallbackLang: NetraLanguage,
): NetraPageContext {
  const fallback = fallbackLang === 'th' ? 'th' : 'en'
  const pathname = normalizePathname(pathnameHint)
  if (!pathname) return unknown(fallback, 'invalid')

  const segments = pathname === '/' ? [] : pathname.slice(1).split('/')
  let lang: NetraLanguage = fallback
  let routeSegments = segments

  if (segments[0] === 'en' || segments[0] === 'th') {
    lang = segments[0]
    routeSegments = segments.slice(1)
  }

  const [root, second, third, ...rest] = routeSegments
  if (root && PRIVATE_ROOT_SEGMENTS.has(root)) return unknown(lang, 'private')
  if (rest.length > 0) return unknown(lang, 'unrecognized')

  if (!root) return { kind: 'home', lang, pathname }
  if (root === 'archive' && second === undefined) {
    return { kind: 'archive', lang, pathname }
  }
  if (root === 'articles' && second && third === undefined) {
    return ARTICLE_FILE_NUM_PATTERN.test(second)
      ? { kind: 'article', lang, pathname, fileNum: second }
      : unknown(lang, 'invalid')
  }
  if (root === 'fiction' && second && third === undefined) {
    return FICTION_SLUG_PATTERN.test(second)
      ? { kind: 'fiction', lang, pathname, slug: second }
      : unknown(lang, 'invalid')
  }
  if (root === 'photos' && second === undefined) {
    return { kind: 'photos-index', lang, pathname }
  }
  if (root === 'photos' && second && third === undefined) {
    return PHOTO_ROLL_PATTERN.test(second)
      ? { kind: 'photo-roll', lang, pathname, roll: second }
      : unknown(lang, 'invalid')
  }
  if (root === 'photos' && second && third) {
    return PHOTO_ROLL_PATTERN.test(second) && PHOTO_ID_PATTERN.test(third)
      ? { kind: 'photo-entry', lang, pathname, roll: second, id: third }
      : unknown(lang, 'invalid')
  }

  return unknown(lang, 'unrecognized')
}

export function isNetraResourcePage(
  page: NetraPageContext,
): page is NetraResourcePageContext {
  return page.kind === 'article'
    || page.kind === 'fiction'
    || page.kind === 'photo-roll'
    || page.kind === 'photo-entry'
}
