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
  const posts = queryAll<{
    slug: string
    title: string
    excerpt: string
    post_date: string
    thumb: string
    local_thumb: string
    embed: string
    duration: string
  }>(
    `SELECT p.post_name slug, p.post_title title, p.post_excerpt excerpt, p.post_date,
       COALESCE((SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='thumb' LIMIT 1), '') thumb,
       COALESCE((SELECT file_name FROM local_thumbnails WHERE post_id=p.id LIMIT 1), '') local_thumb,
       COALESCE((SELECT normalized_url FROM embeds WHERE post_id=p.id AND status!='dead' LIMIT 1), '') embed,
       COALESCE((SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='duration' LIMIT 1), '') duration
     FROM canonical_posts cp JOIN posts p ON p.id=cp.post_id
     WHERE p.post_status='publish' AND p.post_type='post'
       AND TRIM(COALESCE(p.post_name,''))<>''
       AND EXISTS (SELECT 1 FROM embeds e WHERE e.post_id=p.id AND e.status!='dead')
     ORDER BY p.post_date DESC`
  )

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${posts.map(post => {
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
  cachedXml = { body: xml, expiresAt: Date.now() + 60 * 60 * 1000 }

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
