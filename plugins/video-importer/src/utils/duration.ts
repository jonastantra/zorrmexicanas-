export function parseDuration(raw: string): number {
  if (!raw) return 0
  const clean = String(raw).replace(/<[^>]*>/g, '').trim().toLowerCase()
  const m = clean.match(/(\d+)\s*min/)
  if (m) return parseInt(m[1], 10)
  const parts = clean.split(':').map((p) => parseInt(p, 10))
  if (parts.length === 3 && !parts.some(isNaN)) {
    return parts[0] * 60 + parts[1]
  }
  if (parts.length === 2 && !parts.some(isNaN)) {
    return parts[0]
  }
  const secs = clean.match(/(\d+)\s*(?:sec|seg)/)
  if (secs) return Math.max(1, Math.floor(parseInt(secs[1], 10) / 60))
  const hrs = clean.match(/(\d+)\s*(?:hr|hour|h)/)
  if (hrs) return parseInt(hrs[1], 10) * 60
  const justNum = clean.match(/^(\d+)$/)
  if (justNum) return parseInt(justNum[1], 10)
  return 0
}

export function formatDuration(minutes: number): string {
  if (!minutes) return ''
  return `${minutes} min`
}
