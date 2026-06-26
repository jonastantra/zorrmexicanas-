import { sitemapBase, escapeXml, xmlResponse, videoPostsPage, parsePage } from '@/lib/sitemap'

export const dynamic = 'force-dynamic'

const cache = new Map<number, { body: string; expiresAt: number }>()

// Un trozo del sitemap de video (5,000 entries). URL: /video-sitemap/1.xml
export async function GET(_req: Request, { params }: { params: Promise<{ page: string }> }) {
  const page = parsePage((await params).page)
  const hit = cache.get(page)
  if (hit && hit.expiresAt > Date.now()) return xmlResponse(hit.body)

  const base = sitemapBase()
  const rows = videoPostsPage(page)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${rows.map(post => {
    const thumb = post.local_thumb
      ? `${base}/media/thumbs/${post.local_thumb}`
      : (post.thumb.startsWith('/') ? `${base}${post.thumb}` : post.thumb)
    const description = (post.excerpt || post.title).replace(/\s+/g, ' ').slice(0, 1800)
    return `  <url>
    <loc>${escapeXml(`${base}/${post.slug}`)}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumb)}</video:thumbnail_loc>
      <video:title>${escapeXml(post.title.slice(0, 100))}</video:title>
      <video:description>${escapeXml(description)}</video:description>
      <video:player_loc allow_embed="yes">${escapeXml(post.embed)}</video:player_loc>
      <video:publication_date>${escapeXml(post.post_date.replace(' ', 'T') + 'Z')}</video:publication_date>
      <video:family_friendly>no</video:family_friendly>
    </video:video>
  </url>`
  }).join('\n')}
</urlset>`
  cache.set(page, { body: xml, expiresAt: Date.now() + 60 * 60 * 1000 })
  return xmlResponse(xml)
}
