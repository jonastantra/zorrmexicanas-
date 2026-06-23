const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

export interface FetchOptions {
  url: string
  timeoutMs?: number
  referer?: string
}

export async function fetchHtml(opts: FetchOptions): Promise<string> {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000)
  try {
    const res = await fetch(opts.url, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.8,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        ...(opts.referer ? { 'Referer': opts.referer } : {}),
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} para ${opts.url}`)
    return await res.text()
  } finally {
    clearTimeout(timeout)
  }
}

export function extractBetween(haystack: string, start: string, end: string): string | null {
  const i = haystack.indexOf(start)
  if (i === -1) return null
  const j = haystack.indexOf(end, i + start.length)
  if (j === -1) return null
  return haystack.slice(i + start.length, j)
}

export function extractAllBetween(haystack: string, start: string, end: string): string[] {
  const out: string[] = []
  let i = 0
  while (true) {
    const a = haystack.indexOf(start, i)
    if (a === -1) break
    const b = haystack.indexOf(end, a + start.length)
    if (b === -1) break
    out.push(haystack.slice(a + start.length, b))
    i = b + end.length
  }
  return out
}

export function unescapeHtml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
}

export function stripTags(s: string): string {
  return unescapeHtml(s.replace(/<[^>]*>/g, ''))
}

export function decodeAttr(s: string): string {
  return unescapeHtml(s.replace(/\\"/g, '"').replace(/\\'/g, "'"))
}

export function buildIframeHtml(embedUrl: string, width = 745, height = 500): string {
  return `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0" scrolling="no" allowfullscreen loading="lazy"></iframe>`
}
