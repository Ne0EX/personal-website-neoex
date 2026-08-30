export type NetraLanguage = 'en' | 'th'

export type NetraMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type NetraTurnInput = {
  messages: NetraMessage[]
  servedLang: NetraLanguage
  page: { pathname: string }
  abortSignal?: AbortSignal
}

type NetraPageBase<KIND extends string> = {
  kind: KIND
  lang: NetraLanguage
  pathname: string
}

export type NetraHomePageContext = NetraPageBase<'home'>
export type NetraArchivePageContext = NetraPageBase<'archive'>
export type NetraPhotosIndexPageContext = NetraPageBase<'photos-index'>

export type NetraArticlePageContext = NetraPageBase<'article'> & {
  fileNum: string
}

export type NetraFictionPageContext = NetraPageBase<'fiction'> & {
  slug: string
}

export type NetraPhotoRollPageContext = NetraPageBase<'photo-roll'> & {
  roll: string
}

export type NetraPhotoEntryPageContext = NetraPageBase<'photo-entry'> & {
  roll: string
  id: string
}

export type NetraResourcePageContext =
  | NetraArticlePageContext
  | NetraFictionPageContext
  | NetraPhotoRollPageContext
  | NetraPhotoEntryPageContext

export type NetraKnownPageContext =
  | NetraHomePageContext
  | NetraArchivePageContext
  | NetraPhotosIndexPageContext
  | NetraResourcePageContext

export type NetraUnknownPageContext = {
  kind: 'unknown'
  lang: NetraLanguage
  pathname: null
  reason: 'invalid' | 'private' | 'unrecognized'
}

export type NetraPageContext = NetraKnownPageContext | NetraUnknownPageContext

export type NetraArchiveFilter = 'articles' | 'photos' | 'fiction' | 'all'

/** Public-safe archive trace. Adapters must never add body, auth, or location fields. */
export type NetraTrace = {
  title: string
  slug: string
  lang: NetraLanguage
  summary: string
  excerpt: string
  permalink: string
}

export type NetraPatchTrace = NetraTrace & {
  patch: {
    n: number
    date: string
    note: string
  }
}

export type NetraSearchInput = {
  query: string
  filter: NetraArchiveFilter
  limit: number
}

export type NetraGetEntryInput = {
  slugOrFileNum: string
  lang: NetraLanguage
}

export type NetraRecentPatchesInput = {
  days: number
}

export type NetraPhotoSearchInput = {
  query: string
  limit: number
}

/**
 * Request-scoped read port used by NETRA tools.
 *
 * Implementations own authorization and storage details. The core owns tool
 * selection and projects every returned value back to the public trace shape.
 */
export interface NetraKnowledge {
  searchEntries(input: NetraSearchInput): Promise<readonly NetraTrace[]>
  getEntry(input: NetraGetEntryInput): Promise<NetraTrace | null>
  listRecentPatches(input: NetraRecentPatchesInput): Promise<readonly NetraPatchTrace[]>
  searchPhotos(input: NetraPhotoSearchInput): Promise<readonly NetraTrace[]>
  listFiction(): Promise<readonly NetraTrace[]>
  getCurrentPage(page: NetraResourcePageContext): Promise<NetraTrace | null>
}
