import type { SourceId, VideoResult } from '../types.js'
import { fetchHtml, unescapeHtml } from '../utils/fetcher.js'
import { parseDuration } from '../utils/duration.js'
import { titleToTags } from '../utils/slugify.js'

export async function inspectVideoUrls(sourceId: SourceId, urls: string[]): Promise<VideoResult[]> {
  const settled = await Promise.allSettled(
    urls.filter(Boolean).map(url => inspectVideoUrl(sourceId, url.trim()))
  )
  return settled.flatMap(result =>
    result.status === 'fulfilled' && result.value ? [result.value] : []
  )
}

async function inspectVideoUrl(sourceId: SourceId, url: string): Promise<VideoResult | null> {
  const html = await fetchHtml({ url, referer: sourceHome(sourceId) })
  const title = meta(html, 'og:title') || meta(html, 'twitter:title') || pageTitle(html)
  const thumbnail =
    meta(html, 'og:image') ||
    meta(html, 'twitter:image') ||
    jsonValue(html, 'thumbnailUrl') ||
    ''
  const description = meta(html, 'og:description') || meta(html, 'description') || ''
  const videoId = extractVideoId(sourceId, url, html)
  if (!title || !videoId) return null
  const durationSeconds = Number(meta(html, 'og:duration') || 0)
  return {
    sourceId,
    videoId,
    url,
    title,
    duration: durationSeconds > 0
      ? Math.max(1, Math.floor(durationSeconds / 60))
      : parseDuration(meta(html, 'video:duration') || jsonValue(html, 'duration') || ''),
    thumbnail,
    embedUrl: embedUrl(sourceId, videoId, url, html),
    tags: titleToTags(title),
    description,
  }
}

function meta(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return unescapeHtml(match[1])
  }
  return ''
}

function jsonValue(html: string, key: string): string {
  const match = html.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i'))
  return match?.[1] ? unescapeHtml(match[1].replace(/\\\//g, '/')) : ''
}

function pageTitle(html: string): string {
  return unescapeHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? '').trim()
}

function extractVideoId(source: SourceId, url: string, html: string): string {
  if (source === 'xvideos') {
    return html.match(/data-videoid=["'](\d+)/i)?.[1] ??
      html.match(/video_id\s*[:=]\s*["']?(\d+)/i)?.[1] ??
      html.match(/\/embedframe\/([a-zA-Z0-9]+)/i)?.[1] ??
      url.match(/\/video\.([a-zA-Z0-9]+)/i)?.[1] ?? ''
  }
  if (source === 'pornhub') {
    return new URL(url).searchParams.get('viewkey') ??
      html.match(/\/embed\/([a-zA-Z0-9]+)/)?.[1] ?? ''
  }
  if (source === 'redtube') return url.match(/\/(\d+)(?:\/|$|\?)/)?.[1] ?? ''
  if (source === 'xhamster') return url.match(/-(\d+)(?:$|\?)/)?.[1] ?? ''
  return url.match(/\/watch\/(\d+)/)?.[1] ?? url.match(/\/(\d+)(?:\/|$|\?)/)?.[1] ?? ''
}

function embedUrl(source: SourceId, id: string, url: string, html: string): string {
  const ogVideo = meta(html, 'og:video:url') || meta(html, 'og:video')
  if (ogVideo) return ogVideo
  if (source === 'xvideos') return `https://www.xvideos.com/embedframe/${id}`
  if (source === 'pornhub') return `https://www.pornhub.com/embed/${id}`
  if (source === 'redtube') return `https://embed.redtube.com/?id=${id}`
  if (source === 'xhamster') return `https://xhamster.com/xembed.php?video=${id}`
  return `https://www.youporn.com/embed/${id}`
}

function sourceHome(source: SourceId): string {
  if (source === 'xhamster') return 'https://xhamster.com/'
  return `https://www.${source}.com/`
}
