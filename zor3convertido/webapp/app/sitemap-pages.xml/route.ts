import { queryAll } from '@/lib/sqlite'
import { sitemapBase, escapeXml, xmlResponse } from '@/lib/sitemap'

export const dynamic = 'force-dynamic'

let cached: { body: string; expiresAt: number } | null = null

// Sitemap de páginas fijas: home, categorías y etiquetas populares.
export function GET() {
  if (cached && cached.expiresAt > Date.now()) return xmlResponse(cached.body)

  const base = sitemapBase()
  const urls: Array<{ loc: string; changefreq: string; priority: string }> = [
    { loc: '/', changefreq: 'hourly', priority: '1.0' },
  ]

  for (const c of queryAll<{ slug: string }>(
    `SELECT t.slug FROM terms t JOIN term_taxonomy tt ON tt.term_id = t.id
     WHERE tt.taxonomy='category' AND tt.count > 0`
  )) {
    urls.push({ loc: `/categoria/${c.slug}`, changefreq: 'daily', priority: '0.8' })
  }

  for (const t of queryAll<{ slug: string }>(
    `SELECT t.slug FROM terms t JOIN term_taxonomy tt ON tt.term_id = t.id
     WHERE tt.taxonomy='post_tag' AND tt.count >= 50`
  )) {
    urls.push({ loc: `/etiqueta/${t.slug}`, changefreq: 'weekly', priority: '0.5' })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${escapeXml(`${base}${u.loc}`)}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`
  cached = { body: xml, expiresAt: Date.now() + 60 * 60 * 1000 }
  return xmlResponse(xml)
}
