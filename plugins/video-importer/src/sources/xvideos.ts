import type { SearchParams, VideoResult } from '../types.js'
import { fetchHtml, extractBetween, unescapeHtml, stripTags } from '../utils/fetcher.js'
import { parseDuration } from '../utils/duration.js'
import { titleToTags } from '../utils/slugify.js'
import { buildSearchUrl, filterByDuration } from './base.js'

export async function searchXvideos(params: SearchParams): Promise<VideoResult[]> {
  const html = await fetchHtml({ url: buildSearchUrl(params), referer: 'https://www.xvideos.com/' })
  return filterByDuration(parseListing(html), params.minDuration)
}

function parseListing(html: string): VideoResult[] {
  const blocks = html.split(/class="[^"]*\bthumb-block\b[^"]*"/).slice(1)
  const out: VideoResult[] = []
  for (const block of blocks) {
    const id =
      extractBetween(block, 'data-videoid="', '"') ??
      extractBetween(block, 'data-id="', '"') ??
      extractBetween(block, 'id="video_', '"')
    if (!id) continue

    const titleBlock = extractBetween(block, '<p class="title">', '</p>') ?? block
    const title = unescapeHtml(extractBetween(titleBlock, 'title="', '"') ?? '').trim()
    if (!title) continue

    const href =
      extractBetween(titleBlock, 'href="', '"') ??
      extractBetween(block, '<div class="thumb"><a href="', '"') ??
      ''
    if (!href) continue

    const thumbnail = (
      extractBetween(block, 'data-src="', '"') ??
      extractBetween(block, 'data-sfwthumb="', '"') ??
      extractBetween(block, 'src="', '"') ??
      ''
    ).replace(/&amp;/g, '&')
    const durationText =
      extractBetween(titleBlock, '<span class="duration">', '</span>') ??
      extractBetween(block, '<span class="duration">', '</span>') ??
      ''

    out.push({
      sourceId: 'xvideos',
      videoId: id,
      url: href.startsWith('http') ? href : `https://www.xvideos.com${href}`,
      title,
      duration: parseDuration(stripTags(durationText)),
      thumbnail,
      embedUrl: `https://www.xvideos.com/embedframe/${id}`,
      tags: titleToTags(title),
    })
  }
  return deduplicate(out)
}

function deduplicate(videos: VideoResult[]): VideoResult[] {
  const seen = new Set<string>()
  return videos.filter(video => {
    const key = `${video.sourceId}:${video.videoId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
