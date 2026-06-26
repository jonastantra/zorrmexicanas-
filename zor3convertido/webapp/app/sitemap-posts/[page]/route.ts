import { sitemapBase, escapeXml, xmlResponse, canonicalPostsPage, parsePage } from '@/lib/sitemap'

export const dynamic = 'force-dynamic'

const cache = new Map<number, { body: string; expiresAt: number }>()

// Un trozo del sitemap de posts (5,000 URLs). URL: /sitemap-posts/1.xml
export async function GET(_req: Request, { params }: { params: Promise<{ page: string }> }) {
  const page = parsePage((await params).page)
  const hit = cache.get(page)
  if (hit && hit.expiresAt > Date.now()) return xmlResponse(hit.body)

  const base = sitemapBase()
  const now = new Date().toISOString().split('T')[0]
  const rows = canonicalPostsPage(page)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.map(p => {
    const lastmod = p.post_modified ? p.post_modified.split(' ')[0] : now
    return `  <url>
    <loc>${escapeXml(`${base}/${p.slug}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
  }).join('\n')}
</urlset>`
  cache.set(page, { body: xml, expiresAt: Date.now() + 60 * 60 * 1000 })
  return xmlResponse(xml)
}
