export type WorldlineStats = {
  surveyed: number
  active: number
}

export function formatWorldlineCount(value: number | null | undefined): string {
  if (!Number.isSafeInteger(value) || (value ?? -1) < 0) return '—'
  return String(value).padStart(3, '0')
}
