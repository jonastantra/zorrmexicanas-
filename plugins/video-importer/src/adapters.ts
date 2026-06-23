import fs from 'node:fs'
import path from 'node:path'
import type { ImportBatchResult, ImportOptions, PublishItem, SiteProfile, SitePublisher } from './types.js'
import { Publisher } from './publisher.js'

export function createSitePublisher(profile: SiteProfile): SitePublisher {
  if (profile.adapter === 'zorritas-sqlite') return new SqliteSitePublisher(profile)
  if (profile.adapter === 'wordpress-rest') return new WordPressSitePublisher(profile)
  return new JsonSitePublisher(profile)
}

class SqliteSitePublisher implements SitePublisher {
  private publisher: Publisher
  constructor(private profile: SiteProfile) {
    if (!profile.databasePath) throw new Error('El perfil necesita databasePath')
    this.publisher = new Publisher({
      dbPath: profile.databasePath,
      siteBaseUrl: profile.baseUrl,
    })
  }
  async publish(items: PublishItem[]): Promise<ImportBatchResult> {
    const imported: ImportBatchResult['imported'] = []
    const errors: ImportBatchResult['errors'] = []
    for (const item of items) {
      try {
        const video = { ...item.video, title: item.title || item.video.title, description: item.description }
        const options: ImportOptions = {
          postStatus: item.status ?? this.profile.defaultStatus ?? 'draft',
          categorySlug: item.category ?? this.profile.defaultCategory,
          tagSlugs: item.tags,
          downloadThumbnail: this.profile.downloadThumbnail,
          titleTemplate: this.profile.titleTemplate,
          contentTemplate: this.profile.contentTemplate ?? '{embed_code}\n\n{description}',
        }
        imported.push(await this.publisher.importVideo(video, options))
      } catch (error) {
        errors.push({ videoId: item.video.videoId, title: item.title || item.video.title, error: error instanceof Error ? error.message : String(error) })
      }
    }
    return { imported, errors }
  }
  close(): void { this.publisher.close() }
}

class WordPressSitePublisher implements SitePublisher {
  constructor(private profile: SiteProfile) {
    if (!profile.baseUrl || !profile.username || !profile.applicationPassword) {
      throw new Error('WordPress necesita baseUrl, username y applicationPassword')
    }
  }
  async publish(items: PublishItem[]): Promise<ImportBatchResult> {
    const imported: ImportBatchResult['imported'] = []
    const errors: ImportBatchResult['errors'] = []
    const auth = Buffer.from(`${this.profile.username}:${this.profile.applicationPassword}`).toString('base64')
    for (const item of items) {
      try {
        const content = applyTemplate(this.profile.contentTemplate ?? '{embed_code}\n\n{description}', item)
        const response = await fetch(`${this.profile.baseUrl!.replace(/\/$/, '')}/wp-json/wp/v2/posts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
          body: JSON.stringify({
            title: applyTemplate(this.profile.titleTemplate ?? '{title}', item),
            content,
            excerpt: item.description || '',
            status: item.status ?? this.profile.defaultStatus ?? 'draft',
            meta: {
              embed: iframe(item.video.embedUrl),
              link: item.video.url,
              duration: item.video.duration ? `${item.video.duration} min` : '',
              videoid: item.video.videoId,
              video_source: item.video.sourceId,
              thumb: item.video.thumbnail,
            },
          }),
        })
        const data = await response.json() as { id?: number; slug?: string; message?: string }
        if (!response.ok || !data.id) throw new Error(data.message || `WordPress HTTP ${response.status}`)
        imported.push({ postId: data.id, slug: data.slug ?? '', title: item.title || item.video.title, status: 'created' })
      } catch (error) {
        errors.push({ videoId: item.video.videoId, title: item.title || item.video.title, error: error instanceof Error ? error.message : String(error) })
      }
    }
    return { imported, errors }
  }
}

class JsonSitePublisher implements SitePublisher {
  constructor(private profile: SiteProfile) {}
  async publish(items: PublishItem[]): Promise<ImportBatchResult> {
    const directory = path.resolve(this.profile.outputDirectory || path.join(process.cwd(), 'exports'))
    fs.mkdirSync(directory, { recursive: true })
    const file = path.join(directory, `video-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(file, JSON.stringify(items, null, 2))
    return {
      imported: items.map((item, index) => ({ postId: index + 1, slug: path.basename(file), title: item.title || item.video.title, status: 'created' })),
      errors: [],
    }
  }
}

function applyTemplate(template: string, item: PublishItem): string {
  return template
    .replace(/\{title\}/g, item.title || item.video.title)
    .replace(/\{description\}/g, item.description || item.video.description || '')
    .replace(/\{embed_code\}/g, iframe(item.video.embedUrl))
    .replace(/\{source_url\}/g, item.video.url)
    .replace(/\{duration\}/g, item.video.duration ? `${item.video.duration} min` : '')
}

function iframe(url: string): string {
  return `<iframe src="${url}" width="745" height="500" frameborder="0" allowfullscreen loading="lazy"></iframe>`
}
