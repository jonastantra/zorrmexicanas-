import { sitemapBase, countVideoPosts, pageCount, buildIndex, xmlResponse } from '@/lib/sitemap'

export const dynamic = 'force-dynamic'

let cached: { body: string; expiresAt: number } | null = null

// Índice del sitemap de video, paginado en trozos de 5,000 (los entries de
// video son verbosos, así que conviene partirlos).
export function GET() {
  if (cached && cached.expiresAt > Date.now()) return xmlResponse(cached.body)

  const base = sitemapBase()
  const now = new Date().toISOString().split('T')[0]
  const pages = pageCount(countVideoPosts())

  const sitemaps: Array<{ loc: string; lastmod?: string }> = []
  for (let i = 1; i <= pages; i++) {
    sitemaps.push({ loc: `${base}/video-sitemap/${i}.xml`, lastmod: now })
  }

  const xml = buildIndex(sitemaps)
  cached = { body: xml, expiresAt: Date.now() + 60 * 60 * 1000 }
  return xmlResponse(xml)
}
