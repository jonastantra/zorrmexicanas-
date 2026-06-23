import { queryAll } from '@/lib/sqlite'
import { SITE_CONFIG } from '@/lib/site'

export const dynamic = 'force-dynamic'

let cachedXml: { body: string; expiresAt: number } | null = null

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  })[char] || char)
}

export async function GET() {
  if (cachedXml && cachedXml.expiresAt > Date.now()) {
    return new Response(cachedXml.body, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  }

  const base = SITE_CONFIG.baseUrl.replace(/\/$/, '')
  const now = new Date().toISOString().split('T')[0]

  const urls: { loc: string; lastmod?: string; changefreq?: string; priority?: string }[] = []

  // Home
  urls.push({ loc: '/', changefreq: 'hourly', priority: '1.0' })

  // Categories
  const cats = queryAll<{ slug: string }>(
    `SELECT t.slug FROM terms t JOIN term_taxonomy tt ON tt.term_id = t.id
     WHERE tt.taxonomy='category' AND tt.count > 0`
  )
  for (const c of cats) {
    urls.push({ loc: `/categoria/${c.slug}`, changefreq: 'daily', priority: '0.8' })
  }

  // Tags (only the popular ones, ≥50 posts)
  const tags = queryAll<{ slug: string }>(
    `SELECT t.slug FROM terms t JOIN term_taxonomy tt ON tt.term_id = t.id
     WHERE tt.taxonomy='post_tag' AND tt.count >= 50`
  )
  for (const t of tags) {
    urls.push({ loc: `/etiqueta/${t.slug}`, changefreq: 'weekly', priority: '0.5' })
  }

  // Latest 30k CANONICAL posts (avoid sitemap explosion; duplicates are
  // excluded via redirect to canonicals already).
  const posts = queryAll<{ slug: string; post_modified: string }>(
    `SELECT p.post_name as slug, p.post_modified FROM posts p
     JOIN canonical_posts cp ON cp.post_id = p.id
     WHERE p.post_status='publish' AND p.post_type='post'
       AND TRIM(COALESCE(p.post_name,''))<>''
       AND NOT EXISTS (
         SELECT 1 FROM embeds e WHERE e.post_id = p.id AND e.status = 'dead'
           AND NOT EXISTS (SELECT 1 FROM embeds e2 WHERE e2.post_id = p.id AND e2.status != 'dead')
       )
     ORDER BY p.post_date DESC`
  )
  for (const p of posts) {
    const lastmod = p.post_modified ? p.post_modified.split(' ')[0] : now
    urls.push({ loc: `/${p.slug}`, lastmod, changefreq: 'monthly', priority: '0.7' })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${escapeXml(`${base}${u.loc}`)}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    ${u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : ''}
    ${u.priority ? `<priority>${u.priority}</priority>` : ''}
  </url>`).join('\n')}
</urlset>`
  cachedXml = { body: xml, expiresAt: Date.now() + 60 * 60 * 1000 }

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
