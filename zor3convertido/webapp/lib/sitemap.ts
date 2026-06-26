// Utilidades compartidas para los sitemaps. El catálogo es grande y crece solo,
// así que /sitemap.xml y /video-sitemap.xml son ÍNDICES que apuntan a archivos
// paginados (chicos) — más fácil y rápido de procesar para Google.
import { queryAll, queryValue } from '@/lib/sqlite'
import { SITE_CONFIG } from '@/lib/site'

export const SITEMAP_PAGE_SIZE = 5000

export function sitemapBase(): string {
  return SITE_CONFIG.baseUrl.replace(/\/$/, '')
}

export function escapeXml(value: string): string {
  return (value || '').replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c] || c))
}

export function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}

// Posts canónicos publicados con al menos un embed vivo (los que se sirven).
const ALIVE_EMBED =
  `NOT EXISTS (SELECT 1 FROM embeds e WHERE e.post_id=p.id AND e.status='dead'
     AND NOT EXISTS (SELECT 1 FROM embeds e2 WHERE e2.post_id=p.id AND e2.status!='dead'))`
const HAS_EMBED = `EXISTS (SELECT 1 FROM embeds e WHERE e.post_id=p.id AND e.status!='dead')`
const CANON_FROM =
  `FROM posts p JOIN canonical_posts cp ON cp.post_id=p.id
   WHERE p.post_status='publish' AND p.post_type='post' AND TRIM(COALESCE(p.post_name,''))<>''`

export function countCanonicalPosts(): number {
  return queryValue<number>(`SELECT COUNT(*) ${CANON_FROM} AND ${ALIVE_EMBED}`) || 0
}

export function canonicalPostsPage(page: number): Array<{ slug: string; post_modified: string }> {
  const offset = (page - 1) * SITEMAP_PAGE_SIZE
  return queryAll<{ slug: string; post_modified: string }>(
    `SELECT p.post_name slug, p.post_modified ${CANON_FROM} AND ${ALIVE_EMBED}
     ORDER BY p.post_date DESC LIMIT ? OFFSET ?`,
    [SITEMAP_PAGE_SIZE, offset]
  )
}

export function countVideoPosts(): number {
  return queryValue<number>(`SELECT COUNT(*) ${CANON_FROM} AND ${HAS_EMBED}`) || 0
}

export interface VideoRow {
  slug: string; title: string; excerpt: string; post_date: string
  thumb: string; local_thumb: string; embed: string; duration: string
}

export function videoPostsPage(page: number): VideoRow[] {
  const offset = (page - 1) * SITEMAP_PAGE_SIZE
  return queryAll<VideoRow>(
    `SELECT p.post_name slug, p.post_title title, p.post_excerpt excerpt, p.post_date,
       COALESCE((SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='thumb' LIMIT 1), '') thumb,
       COALESCE((SELECT file_name FROM local_thumbnails WHERE post_id=p.id LIMIT 1), '') local_thumb,
       COALESCE((SELECT normalized_url FROM embeds WHERE post_id=p.id AND status!='dead' LIMIT 1), '') embed,
       COALESCE((SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='duration' LIMIT 1), '') duration
     ${CANON_FROM} AND ${HAS_EMBED}
     ORDER BY p.post_date DESC LIMIT ? OFFSET ?`,
    [SITEMAP_PAGE_SIZE, offset]
  )
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE))
}

/** Parsea el segmento "[page]" tipo "1.xml" o "1" a un entero >= 1. */
export function parsePage(raw: string): number {
  const n = parseInt(String(raw).replace(/\.xml$/i, ''), 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

export function buildIndex(locs: Array<{ loc: string; lastmod?: string }>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map(s => `  <sitemap>
    <loc>${escapeXml(s.loc)}</loc>${s.lastmod ? `\n    <lastmod>${s.lastmod}</lastmod>` : ''}
  </sitemap>`).join('\n')}
</sitemapindex>`
}
