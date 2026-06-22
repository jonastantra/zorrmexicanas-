import { SITE_CONFIG } from '@/lib/site'

export const dynamic = 'force-static'

export function GET() {
  const base = SITE_CONFIG.baseUrl.replace(/\/$/, '')
  const body = `User-agent: *
Allow: /
Allow: /categoria/
Allow: /etiqueta/

Disallow: /buscar
Disallow: /api/
Disallow: /admin/

Sitemap: ${base}/sitemap.xml
Sitemap: ${base}/video-sitemap.xml
`
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
