import { sitemapBase, countCanonicalPosts, pageCount, buildIndex, xmlResponse } from '@/lib/sitemap'

export const dynamic = 'force-dynamic'

let cached: { body: string; expiresAt: number } | null = null

// Índice de sitemaps: páginas (home/categorías/etiquetas), posts paginados y
// el sitemap de video. Pequeño y estable; Google entra aquí y va a cada parte.
export function GET() {
  if (cached && cached.expiresAt > Date.now()) return xmlResponse(cached.body)

  const base = sitemapBase()
  const now = new Date().toISOString().split('T')[0]
  const postPages = pageCount(countCanonicalPosts())

  const sitemaps: Array<{ loc: string; lastmod?: string }> = [
    { loc: `${base}/sitemap-pages.xml`, lastmod: now },
  ]
  for (let i = 1; i <= postPages; i++) {
    sitemaps.push({ loc: `${base}/sitemap-posts/${i}.xml`, lastmod: now })
  }
  // El video-sitemap.xml NO se incluye aquí: es a su vez un índice y un
  // sitemapindex no puede listar otro índice. Google lo descubre por robots.txt.

  const xml = buildIndex(sitemaps)
  cached = { body: xml, expiresAt: Date.now() + 60 * 60 * 1000 }
  return xmlResponse(xml)
}
