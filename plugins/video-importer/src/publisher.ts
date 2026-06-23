import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { ImportBatchResult, ImportOptions, ImportResult, VideoResult } from './types.js'
import { slugify, uniqueSlug } from './utils/slugify.js'
import { buildIframeHtml } from './utils/fetcher.js'
import { formatDuration } from './utils/duration.js'
import { assertValidVideo, normalizeUrl } from './validation.js'

export interface PublisherConfig {
  dbPath: string
  thumbsDir?: string
  siteBaseUrl?: string
}

const DEFAULTS: Required<Omit<PublisherConfig, 'dbPath'>> = {
  thumbsDir: path.join(process.cwd(), 'public', 'media', 'thumbs'),
  siteBaseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
}

export class Publisher {
  private db: Database.Database
  private thumbsDir: string
  private siteBaseUrl: string

  constructor(config: PublisherConfig) {
    this.db = new Database(path.resolve(config.dbPath))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('busy_timeout = 15000')
    this.thumbsDir = config.thumbsDir ?? DEFAULTS.thumbsDir
    this.siteBaseUrl = config.siteBaseUrl ?? DEFAULTS.siteBaseUrl
  }

  close(): void {
    this.db.close()
  }

  findExisting(video: VideoResult): number | null {
    const row = this.db.prepare(
      `SELECT source.post_id
       FROM post_metadata source
       JOIN post_metadata video ON video.post_id=source.post_id
       WHERE source.meta_key='video_source' AND source.meta_value=?
         AND video.meta_key='videoid' AND video.meta_value=?
       LIMIT 1`
    ).get(video.sourceId, video.videoId) as { post_id: number } | undefined
    if (row) return row.post_id

    const normalizedEmbed = normalizeUrl(video.embedUrl)
    const embed = this.db.prepare(
      `SELECT post_id FROM embeds
       WHERE normalized_url=? OR (domain=? AND external_id=?)
       LIMIT 1`
    ).get(normalizedEmbed, extractDomain(video.embedUrl), video.videoId) as { post_id: number } | undefined
    if (embed) return embed.post_id

    const legacy = this.db.prepare(
      `SELECT post_id FROM post_metadata
       WHERE meta_key='link' AND meta_value IN (?, ?) LIMIT 1`
    ).get(video.url, normalizeUrl(video.url)) as { post_id: number } | undefined
    return legacy?.post_id ?? null
  }

  slugExists(slug: string): boolean {
    const row = this.db.prepare(`SELECT 1 FROM posts WHERE post_name=? LIMIT 1`).get(slug)
    return !!row
  }

  findOrCreateTerm(name: string, slug: string, taxonomy: 'category' | 'post_tag'): number {
    const term = this.db.prepare(`SELECT id FROM terms WHERE slug=? LIMIT 1`).get(slug) as { id: number } | undefined
    let termId: number
    if (term) {
      termId = term.id
    } else {
      const info = this.db.prepare(
        `INSERT INTO terms(name, slug, term_group) VALUES(?,?,0)`
      ).run(name, slug)
      termId = Number(info.lastInsertRowid)
    }
    const tt = this.db.prepare(
      `SELECT tt_id FROM term_taxonomy WHERE term_id=? AND taxonomy=? LIMIT 1`
    ).get(termId, taxonomy) as { tt_id: number } | undefined
    if (tt) return tt.tt_id
    const ttInfo = this.db.prepare(
      `INSERT INTO term_taxonomy(term_id, taxonomy, description, parent, count) VALUES(?,?, '', 0, 0)`
    ).run(termId, taxonomy)
    return Number(ttInfo.lastInsertRowid)
  }

  setMeta(postId: number, key: string, value: string): void {
    const existing = this.db.prepare(
      `SELECT id FROM post_metadata WHERE post_id=? AND meta_key=? ORDER BY id LIMIT 1`
    ).get(postId, key) as { id: number } | undefined
    if (existing) {
      this.db.prepare(`UPDATE post_metadata SET meta_value=? WHERE id=?`).run(value, existing.id)
      this.db.prepare(`DELETE FROM post_metadata WHERE post_id=? AND meta_key=? AND id<>?`).run(postId, key, existing.id)
    } else {
      this.db.prepare(
        `INSERT INTO post_metadata(post_id, meta_key, meta_value) VALUES(?,?,?)`
      ).run(postId, key, value)
    }
  }

  async importVideo(video: VideoResult, opts: ImportOptions = {}): Promise<ImportResult> {
    assertValidVideo(video)
    const existing = this.findExisting(video)
    if (existing) {
      const row = this.db.prepare(`SELECT post_title, post_name FROM posts WHERE id=?`).get(existing) as
        | { post_title: string; post_name: string } | undefined
      return {
        postId: existing,
        slug: row?.post_name ?? '',
        title: row?.post_title ?? video.title,
        status: 'duplicate',
      }
    }

    const status = opts.postStatus ?? 'publish'
    const titleTpl = opts.titleTemplate ?? '{title}'
    const contentTpl = opts.contentTemplate ?? '{embed_code}\n\n{title} - {duration}'

    const title = applyTemplate(titleTpl, video)
    const baseSlug = slugify(video.title)
    const slug = uniqueSlug(baseSlug, (s) => this.slugExists(s))
    const now = new Date()
    const dateStr = now.toISOString().replace('T', ' ').slice(0, 19)
    const embedHtml = buildIframeHtml(video.embedUrl)

    const content = applyTemplate(contentTpl, video, { embed_code: embedHtml })

    let postId: number
    this.db.transaction(() => {
      const info = this.db.prepare(
        `INSERT INTO posts(
          post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
          post_status, comment_status, ping_status, post_name, post_modified, post_modified_gmt,
          post_parent, guid, menu_order, post_type, post_mime_type, comment_count
        ) VALUES (1, ?, ?, ?, ?, ?, ?, 'open', 'open', ?, ?, ?, 0, ?, 0, 'post', '', 0)`
      ).run(
        dateStr, now.toISOString(), content, title, video.title, status,
        slug, dateStr, now.toISOString(),
        `${this.siteBaseUrl}/${slug}`
      )
      postId = Number(info.lastInsertRowid)

      this.setMeta(postId, 'embed', embedHtml)
      this.setMeta(postId, 'link', video.url)
      this.setMeta(postId, 'duration', formatDuration(video.duration))
      this.setMeta(postId, 'videoid', video.videoId)
      this.setMeta(postId, 'video_source', video.sourceId)
      this.setMeta(postId, 'thumb', video.thumbnail)

      const domain = extractDomain(video.embedUrl)
      this.db.prepare(
        `INSERT INTO embeds(post_id, source_field, raw_value, normalized_url, domain, external_id, iframe_html, status)
         VALUES(?, 'embed', ?, ?, ?, ?, ?, 'unchecked')`
      ).run(postId, embedHtml, normalizeUrl(video.embedUrl), domain, video.videoId, embedHtml)

      if (opts.addToCanonical ?? status === 'publish') {
        this.db.prepare(`INSERT OR IGNORE INTO canonical_posts(post_id) VALUES(?)`).run(postId)
      }

      if (opts.categorySlug) {
        const ttId = this.findOrCreateTerm(
          opts.categorySlug.replace(/-/g, ' '),
          opts.categorySlug,
          'category'
        )
        this.db.prepare(
          `INSERT OR IGNORE INTO term_relationships(object_id, term_taxonomy_id, term_order) VALUES(?, ?, 0)`
        ).run(postId, ttId)
        this.db.prepare(
          `UPDATE term_taxonomy SET count = count + 1 WHERE tt_id=?`
        ).run(ttId)
      }

      const tagSlugs = opts.tagSlugs ?? video.tags
      for (const ts of tagSlugs) {
        if (!ts.trim()) continue
        const ttId = this.findOrCreateTerm(ts.replace(/-/g, ' '), ts, 'post_tag')
        this.db.prepare(
          `INSERT OR IGNORE INTO term_relationships(object_id, term_taxonomy_id, term_order) VALUES(?, ?, 0)`
        ).run(postId, ttId)
        this.db.prepare(
          `UPDATE term_taxonomy SET count = count + 1 WHERE tt_id=?`
        ).run(ttId)
      }
    })()

    let thumbnailDownloaded = false
    if (opts.downloadThumbnail && video.thumbnail) {
      thumbnailDownloaded = await this.downloadThumbnail(postId!, video.thumbnail)
    }

    return {
      postId: postId!,
      slug,
      title,
      status: 'created',
      thumbnailDownloaded,
    }
  }

  async importBatch(videos: VideoResult[], opts: ImportOptions = {}): Promise<ImportBatchResult> {
    const imported: ImportResult[] = []
    const errors: { videoId: string; title: string; error: string }[] = []
    for (const v of videos) {
      try {
        imported.push(await this.importVideo(v, opts))
      } catch (err) {
        errors.push({
          videoId: v.videoId,
          title: v.title,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    return { imported, errors }
  }

  async downloadThumbnail(postId: number, thumbUrl: string): Promise<boolean> {
    try {
      if (!fs.existsSync(this.thumbsDir)) fs.mkdirSync(this.thumbsDir, { recursive: true })
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const ext = guessExt(thumbUrl)
      const response = await fetch(thumbUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': new URL(thumbUrl).origin },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!response.ok) return false
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType && !contentType.startsWith('image/')) return false
      const buffer = Buffer.from(await response.arrayBuffer())
      if (!buffer.length || buffer.length > 15 * 1024 * 1024) return false
      const fileName = `${postId}.${ext}`
      fs.writeFileSync(path.join(this.thumbsDir, fileName), buffer)
      this.db.prepare(
        `INSERT OR REPLACE INTO local_thumbnails(post_id, file_name, source, status, updated_at)
         VALUES(?, ?, ?, 'downloaded', datetime('now'))`
      ).run(postId, fileName, thumbUrl)
      return true
    } catch {
      return false
    }
  }
}

function applyTemplate(tpl: string, video: VideoResult, extra?: Record<string, string>): string {
  return tpl
    .replace(/\{title\}/g, video.title)
    .replace(/\{duration\}/g, formatDuration(video.duration))
    .replace(/\{link\}/g, video.url)
    .replace(/\{thumb\}/g, video.thumbnail)
    .replace(/\{excerpt\}/g, video.title)
    .replace(/\{description\}/g, video.description ?? '')
    .replace(/\{embed_code\}/g, extra?.embed_code ?? video.embedUrl)
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function guessExt(url: string): string {
  const m = url.match(/\.(jpe?g|png|webp|avif|gif)/i)
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'
}
