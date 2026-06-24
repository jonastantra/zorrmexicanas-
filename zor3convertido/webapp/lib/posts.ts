import { queryAll, queryOne, queryValue } from './sqlite'
import { SITE_CONFIG, Post, PostListItem } from './site'
import { cache } from 'react'

// ===== Posts =====

const POST_BASE_SELECT = `
  SELECT
    p.id, p.post_title as title, p.post_name as slug, p.post_excerpt as excerpt,
    p.post_date as date, p.post_content as content, p.post_status as status,
    (SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='thumb' LIMIT 1) as thumb,
    (SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='duration' LIMIT 1) as duration,
    (SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='post_views_count' LIMIT 1) as views,
    (SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='embed' LIMIT 1) as embed,
    (SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='link' LIMIT 1) as link,
    (SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='videoid' LIMIT 1) as videoId,
    (SELECT file_name FROM local_thumbnails WHERE post_id=p.id LIMIT 1) as localThumb,
    COALESCE((
      SELECT json_group_array(json_object('slug', slug, 'name', name))
      FROM (
        SELECT t.slug slug, t.name name
        FROM term_relationships tr
        JOIN term_taxonomy tt ON tt.tt_id=tr.term_taxonomy_id
        JOIN terms t ON t.id=tt.term_id
        WHERE tr.object_id=p.id AND tt.taxonomy='category'
        ORDER BY t.name
      )
    ), '[]') as categoriesJson
  FROM posts p
  JOIN canonical_posts cp ON cp.post_id = p.id
`

// Posts whose only embed is dead. Used to filter listings.
const ALIVE_EMBED_SUBQUERY = `
  NOT EXISTS (
    SELECT 1 FROM embeds e
    WHERE e.post_id = p.id
      AND e.status = 'dead'
      AND NOT EXISTS (
        SELECT 1 FROM embeds e2
        WHERE e2.post_id = p.id AND e2.status != 'dead'
      )
  )
`

const POST_META_SELECT = `
  SELECT meta_key, meta_value FROM post_metadata WHERE post_id = ?
`

function getMetaMap(postId: number): Record<string, string> {
  const rows = queryAll<{ meta_key: string; meta_value: string }>(
    `SELECT meta_key, meta_value FROM post_metadata WHERE post_id = ?`,
    [postId]
  )
  const map: Record<string, string> = {}
  for (const r of rows) map[r.meta_key] = r.meta_value || ''
  return map
}

function getCategories(postId: number): { slug: string; name: string }[] {
  return queryAll<{ slug: string; name: string }>(
    `SELECT t.slug as slug, t.name as name
     FROM term_relationships tr
     JOIN term_taxonomy tt ON tt.tt_id = tr.term_taxonomy_id
     JOIN terms t ON t.id = tt.term_id
     WHERE tr.object_id = ? AND tt.taxonomy = 'category'
     ORDER BY t.name`,
    [postId]
  )
}

function getTags(postId: number): { slug: string; name: string }[] {
  return queryAll<{ slug: string; name: string }>(
    `SELECT t.slug as slug, t.name as name
     FROM term_relationships tr
     JOIN term_taxonomy tt ON tt.tt_id = tr.term_taxonomy_id
     JOIN terms t ON t.id = tt.term_id
     WHERE tr.object_id = ? AND tt.taxonomy = 'post_tag'
     ORDER BY t.name
     LIMIT 30`,
    [postId]
  )
}

function rowToListItem(row: any): PostListItem {
  // Every canonical post has a local SVG placeholder. Prefer a downloaded
  // raster when available, but never fall back to a remote CDN thumbnail:
  // those hosts commonly reject hotlinking and leave the card blank.
  const localThumb = row.localThumb
    ? `/media/thumbs/${row.localThumb}`
    : `/media/thumbs/${row.id}.svg`
  let categories: { slug: string; name: string }[] = []
  try { categories = JSON.parse(row.categoriesJson || '[]') } catch {}
  return {
    id: row.id,
    slug: row.slug,
    title: (row.title || '').replace(/\n\s*/g, ' ').trim(),
    excerpt: row.excerpt || '',
    date: row.date,
    thumb: localThumb,
    duration: row.duration || null,
    views: parseInt(row.views || '0', 10) || 0,
    categories,
  }
}


function rowToPost(row: any): Post {
  return {
    ...rowToListItem(row),
    content: row.content || '',
    embed: row.embed || null,
    link: row.link || null,
    videoId: row.videoId || null,
    tags: getTags(row.id),
  }
}

const termCache = new Map<string, TermInfo[]>()

export const getPostBySlug = cache((slug: string): Post | null => {
  // PERF: la migration.db no tiene estadísticas (sqlite_stat1), así que el
  // planificador elegía idx_posts_type_status_date y escaneaba ~283k filas
  // (~1s por página). Forzamos idx_posts_name (equality en el slug) → <1ms.
  // Además, ante colisión de slug, preferimos el post canónico (no un duplicado).
  let id: number | undefined
  try {
    id = queryValue<number>(
      `SELECT id FROM posts INDEXED BY idx_posts_name
         WHERE post_name = ? AND post_status='publish' AND post_type='post'
         ORDER BY (CASE WHEN EXISTS(SELECT 1 FROM canonical_posts cp WHERE cp.post_id = posts.id) THEN 0 ELSE 1 END), id DESC
         LIMIT 1`,
      [slug]
    ) ?? undefined
  } catch {
    // Si el índice no existe en alguna variante de la DB, plan B sin hint.
    id = queryValue<number>(
      `SELECT id FROM posts WHERE post_name = ? AND post_status='publish' AND post_type='post' LIMIT 1`,
      [slug]
    ) ?? undefined
  }
  if (!id) return null
  return getPostById(id)
})

/**
 * Returns the canonical post for a slug, if any. Used to resolve a duplicate's
 * old URL into the canonical one. Returns null if not a duplicate.
 */
export function getCanonicalForSlug(slug: string): { id: number; slug: string } | null {
  // Las redirecciones 301 (slug viejo/duplicado -> canónico) se sirven desde la
  // tabla ligera `redirects`. Antes esto se resolvía en vivo recorriendo
  // posts + post_duplicate_groups (millones de filas), lo que obligaba a
  // conservar ~500k posts no-canónicos solo para los redirects.
  const row = queryOne<{ target_url: string }>(
    `SELECT target_url FROM redirects WHERE source_url = ? AND status_code = 301 LIMIT 1`,
    ['/' + slug]
  )
  if (!row?.target_url) return null
  const targetSlug = row.target_url.replace(/^\//, '')
  if (!targetSlug || targetSlug === slug) return null
  const canon = queryOne<{ id: number }>(
    `SELECT id FROM posts WHERE post_name = ? AND post_status='publish' AND post_type='post' LIMIT 1`,
    [targetSlug]
  )
  return { id: canon?.id ?? 0, slug: targetSlug }
}

export function getPostById(id: number): Post | null {
  const row = queryOne<any>(
    POST_BASE_SELECT + ` WHERE p.id = ? AND p.post_status = 'publish' AND p.post_type = 'post' LIMIT 1`,
    [id]
  )
  if (!row) return null
  return rowToPost(row)
}

export function listPosts(opts: { page?: number; perPage?: number; categorySlug?: string; tagSlug?: string; search?: string } = {}): { posts: PostListItem[]; total: number; page: number; pages: number } {
  const page = Math.max(1, opts.page || 1)
  const perPage = opts.perPage || SITE_CONFIG.postsPerPage
  const offset = (page - 1) * perPage

  let where = ` WHERE p.post_status='publish' AND p.post_type='post'
                   AND ${ALIVE_EMBED_SUBQUERY} `
  const params: any[] = []

  if (opts.categorySlug) {
    where += ` AND p.id IN (
      SELECT tr.object_id FROM term_relationships tr
      JOIN term_taxonomy tt ON tt.tt_id = tr.term_taxonomy_id
      JOIN terms t ON t.id = tt.term_id
      WHERE tt.taxonomy='category' AND t.slug = ?
    ) `
    params.push(opts.categorySlug)
  }

  if (opts.tagSlug) {
    where += ` AND p.id IN (
      SELECT tr.object_id FROM term_relationships tr
      JOIN term_taxonomy tt ON tt.tt_id = tr.term_taxonomy_id
      JOIN terms t ON t.id = tt.term_id
      WHERE tt.taxonomy='post_tag' AND t.slug = ?
    ) `
    params.push(opts.tagSlug)
  }

  if (opts.search) {
    where += ` AND (p.post_title LIKE ? OR p.post_excerpt LIKE ?) `
    const like = `%${opts.search}%`
    params.push(like, like)
  }

  const total = queryValue<number>(
    `SELECT COUNT(*) FROM posts p JOIN canonical_posts cp ON cp.post_id = p.id ${where}`,
    params
  ) || 0
  const rows = queryAll<any>(
    POST_BASE_SELECT + where + ` ORDER BY p.post_date DESC LIMIT ? OFFSET ?`,
    [...params, perPage, offset]
  )
  return {
    posts: rows.map(rowToListItem),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
  }
}

// ===== Categories / Tags =====

export type TermInfo = { id: number; slug: string; name: string; description: string; count: number }

export const getTermBySlug = cache((slug: string, taxonomy: 'category' | 'post_tag'): TermInfo | null => {
  return queryOne<TermInfo>(
    `SELECT t.id as id, t.slug as slug, t.name as name, tt.description as description,
       (SELECT COUNT(DISTINCT tr.object_id)
        FROM term_relationships tr
        JOIN canonical_posts cp ON cp.post_id = tr.object_id
        WHERE tr.term_taxonomy_id = tt.tt_id) as count
     FROM terms t JOIN term_taxonomy tt ON tt.term_id = t.id
     WHERE t.slug = ? AND tt.taxonomy = ?`,
    [slug, taxonomy]
  )
})

export function listCategories(opts: { minCount?: number; limit?: number } = {}): TermInfo[] {
  const min = opts.minCount ?? 1
  const limit = opts.limit ?? 100
  const key = `categories:${min}:${limit}`
  const cached = termCache.get(key)
  if (cached) return cached
  const result = queryAll<TermInfo>(
    `SELECT t.id as id, t.slug as slug, t.name as name, tt.description as description,
       ctc.count as count
     FROM terms t JOIN term_taxonomy tt ON tt.term_id = t.id
     JOIN canonical_term_counts ctc ON ctc.tt_id=tt.tt_id
     WHERE tt.taxonomy = 'category' AND ctc.count >= ?
     ORDER BY ctc.count DESC LIMIT ?`,
    [min, limit]
  )
  termCache.set(key, result)
  return result
}

export function listTags(opts: { minCount?: number; limit?: number } = {}): TermInfo[] {
  const min = opts.minCount ?? 50
  const limit = opts.limit ?? 200
  const key = `tags:${min}:${limit}`
  const cached = termCache.get(key)
  if (cached) return cached
  const result = queryAll<TermInfo>(
    `SELECT t.id as id, t.slug as slug, t.name as name, tt.description as description,
       ctc.count as count
     FROM terms t JOIN term_taxonomy tt ON tt.term_id = t.id
     JOIN canonical_term_counts ctc ON ctc.tt_id=tt.tt_id
     WHERE tt.taxonomy = 'post_tag' AND ctc.count >= ?
     ORDER BY ctc.count DESC LIMIT ?`,
    [min, limit]
  )
  termCache.set(key, result)
  return result
}

// ===== Stats =====

export function getStats() {
  return {
    posts: queryValue<number>(
      `SELECT COUNT(*) FROM canonical_posts cp
       JOIN posts p ON p.id = cp.post_id
       WHERE p.post_status='publish' AND p.post_type='post'
         AND ${ALIVE_EMBED_SUBQUERY}`
    ) || 0,
    categories: queryValue<number>(`SELECT COUNT(*) FROM term_taxonomy WHERE taxonomy='category' AND count>0`) || 0,
    tags: queryValue<number>(`SELECT COUNT(*) FROM term_taxonomy WHERE taxonomy='post_tag' AND count>=5`) || 0,
  }
}

// ===== Homepage helpers =====

/** Featured video for the hero — picks the most-viewed recent post. */
export function getFeatured(): Post | null {
  const row = queryOne<any>(
    POST_BASE_SELECT + `
    WHERE p.post_status='publish' AND p.post_type='post'
      AND ${ALIVE_EMBED_SUBQUERY}
      AND EXISTS (SELECT 1 FROM post_metadata m WHERE m.post_id=p.id AND m.meta_key='thumb' AND m.meta_value != '')
      AND EXISTS (SELECT 1 FROM post_metadata m WHERE m.post_id=p.id AND m.meta_key='embed' AND m.meta_value != '')
    ORDER BY
      CAST((SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='post_views_count') AS INTEGER) DESC NULLS LAST,
      p.post_date DESC
    LIMIT 1`
  )
  if (!row) return null
  return rowToPost(row)
}

/** Most-viewed in the last 30 days (trending). */
export function listTrending(opts: { limit?: number } = {}): PostListItem[] {
  const limit = opts.limit ?? 12
  const rows = queryAll<any>(
    POST_BASE_SELECT + `
    WHERE p.post_status='publish' AND p.post_type='post'
      AND ${ALIVE_EMBED_SUBQUERY}
      AND p.post_date >= datetime('now', '-30 days')
      AND EXISTS (SELECT 1 FROM post_metadata m WHERE m.post_id=p.id AND m.meta_key='thumb' AND m.meta_value != '')
    ORDER BY
      CAST((SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='post_views_count') AS INTEGER) DESC NULLS LAST,
      p.post_date DESC
    LIMIT ?`,
    [limit]
  )
  return rows.map(rowToListItem)
}

/** Most-viewed of all time. */
export function listPopular(opts: { limit?: number } = {}): PostListItem[] {
  const limit = opts.limit ?? 12
  const rows = queryAll<any>(
    POST_BASE_SELECT + `
    WHERE p.post_status='publish' AND p.post_type='post'
      AND ${ALIVE_EMBED_SUBQUERY}
      AND EXISTS (SELECT 1 FROM post_metadata m WHERE m.post_id=p.id AND m.meta_key='thumb' AND m.meta_value != '')
    ORDER BY
      CAST((SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='post_views_count') AS INTEGER) DESC NULLS LAST
    LIMIT ?`,
    [limit]
  )
  return rows.map(rowToListItem)
}

/** Latest published. */
export function listLatest(opts: { limit?: number } = {}): PostListItem[] {
  const limit = opts.limit ?? 24
  const rows = queryAll<any>(
    POST_BASE_SELECT + `
    WHERE p.post_status='publish' AND p.post_type='post'
      AND ${ALIVE_EMBED_SUBQUERY}
      AND EXISTS (SELECT 1 FROM post_metadata m WHERE m.post_id=p.id AND m.meta_key='thumb' AND m.meta_value != '')
    ORDER BY p.post_date DESC LIMIT ?`,
    [limit]
  )
  return rows.map(rowToListItem)
}

export function listRandom(opts: { limit?: number } = {}): PostListItem[] {
  const limit = opts.limit ?? 8
  const rows = queryAll<any>(
    POST_BASE_SELECT + `
    WHERE p.post_status='publish' AND p.post_type='post'
      AND ${ALIVE_EMBED_SUBQUERY}
    ORDER BY RANDOM() LIMIT ?`,
    [limit],
  )
  return rows.map(rowToListItem)
}

/** Top categories for the cat-grid (with strong counts). */
export function listFeaturedCategories(limit = 12): TermInfo[] {
  return queryAll<TermInfo>(
    `SELECT t.id as id, t.slug as slug, t.name as name, tt.description as description,
       ctc.count as count
     FROM terms t JOIN term_taxonomy tt ON tt.term_id = t.id
     JOIN canonical_term_counts ctc ON ctc.tt_id=tt.tt_id
     WHERE tt.taxonomy = 'category' AND ctc.count >= 100
     ORDER BY ctc.count DESC LIMIT ?`,
    [limit]
  )
}

/** Top tags (heavier threshold than listTags). */
export function listPopularTags(limit = 80): TermInfo[] {
  return queryAll<TermInfo>(
    `SELECT t.id as id, t.slug as slug, t.name as name, tt.description as description,
       ctc.count as count
     FROM terms t JOIN term_taxonomy tt ON tt.term_id = t.id
     JOIN canonical_term_counts ctc ON ctc.tt_id=tt.tt_id
     WHERE tt.taxonomy = 'post_tag' AND ctc.count >= 100
     ORDER BY ctc.count DESC LIMIT ?`,
    [limit]
  )
}

/** Posts related to a given post (by shared category, exclude self). */
export function listRelated(postId: number, slug: string, opts: { limit?: number } = {}): PostListItem[] {
  const limit = opts.limit ?? 12
  const rows = queryAll<any>(
    POST_BASE_SELECT + `
    WHERE p.post_status='publish' AND p.post_type='post'
      AND p.id != ?
      AND ${ALIVE_EMBED_SUBQUERY}
      AND p.id IN (
        SELECT tr.object_id FROM term_relationships tr
        JOIN term_taxonomy tt ON tt.tt_id = tr.term_taxonomy_id
        WHERE tt.taxonomy='category' AND tt.term_id IN (
          SELECT tt2.term_id FROM term_relationships tr2
          JOIN term_taxonomy tt2 ON tt2.tt_id = tr2.term_taxonomy_id
          WHERE tr2.object_id = ? AND tt2.taxonomy='category'
        )
      )
      AND EXISTS (SELECT 1 FROM post_metadata m WHERE m.post_id=p.id AND m.meta_key='thumb' AND m.meta_value != '')
    ORDER BY p.post_date DESC LIMIT ?`,
    [postId, postId, limit]
  )
  return rows.map(rowToListItem)
}
