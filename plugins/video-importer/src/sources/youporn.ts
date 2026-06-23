import type { SearchParams, VideoResult } from '../types.js'
import { fetchHtml, extractBetween, unescapeHtml, stripTags } from '../utils/fetcher.js'
import { parseDuration } from '../utils/duration.js'
import { titleToTags } from '../utils/slugify.js'
import { buildSearchUrl, filterByDuration } from './base.js'

export async function searchYouporn(params: SearchParams): Promise<VideoResult[]> {
  const html = await fetchHtml({ url: buildSearchUrl(params), referer: 'https://www.youporn.com/' })
  return filterByDuration(parseListing(html), params.minDuration)
}

function parseListing(html: string): VideoResult[] {
  const blocks = html.split('class="video-box').slice(1)
  const out: VideoResult[] = []
  for (const b of blocks) {
    const videoid = extractBetween(b, 'data-video-id="', '"')
    if (!videoid) continue
    const title = stripTags(extractBetween(b, 'class="video-box-title"', '</a>') ?? '')
    if (!title.trim()) continue
    const href = extractBetween(b, 'href="', '"') ?? ''
    const vlink = href.startsWith('http') ? href : `https://www.youporn.com${href}`
    const thumb = extractBetween(b, 'data-thumbnail="', '"') ?? extractBetween(b, 'data-src="', '"')
    const durRaw = extractBetween(b, 'class="video-duration"', '</div>') ?? ''
    const duration = parseDuration(stripTags(durRaw))
    const watchId = href.replace('/watch/', '').replace(/^\//, '')
    const embedUrl = `https://www.youporn.com/embed/${watchId}`
    out.push({
      sourceId: 'youporn',
      videoId: videoid,
      url: vlink,
      title: title.trim(),
      duration,
      thumbnail: thumb ?? '',
      embedUrl,
      tags: titleToTags(title),
    })
  }
  return out
}
