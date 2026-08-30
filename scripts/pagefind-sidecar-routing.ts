export type SidecarLanguage = 'en' | 'th'

export function sidecarLanguage(value: unknown): SidecarLanguage {
  return value === 'th' ? 'th' : 'en'
}

export function localizedSidecarKey(
  lang: SidecarLanguage,
  ...segments: string[]
): string {
  return [lang, ...segments].join('/')
}

export function localizedSidecarRows<T extends { lang: SidecarLanguage }>(
  rows: readonly T[],
  lang: SidecarLanguage,
): T[] {
  return rows.filter((row) => row.lang === lang)
}

export function splitLocalizedHtmlPath(relPath: string): {
  lang: SidecarLanguage
  routeParts: string[]
} {
  const parts = relPath.replace(/\\/g, '/').split('/')
  const hasLocalePrefix = parts[0] === 'en' || parts[0] === 'th'

  return {
    lang: hasLocalePrefix ? sidecarLanguage(parts[0]) : 'en',
    routeParts: hasLocalePrefix ? parts.slice(1) : parts,
  }
}
