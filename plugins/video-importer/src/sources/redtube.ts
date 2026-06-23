import type { SearchParams, VideoResult } from '../types.js'
import { fetchHtml, extractBetween, unescapeHtml, stripTags } from '../utils/fetcher.js'
import { parseDuration } from '../utils/duration.js'
import { titleToTags } from '../utils/slugify.js'
import { buildSearchUrl, filterByDuration } from './base.js'

export async function searchRedtube(params: SearchParams): Promise<VideoResult[]> {
  const html = await fetchHtml({ url: buildSearchUrl(params), referer: 'https://www.redtube.com/' })
  return filterByDuration(parseListing(html), params.minDuration)
}

function parseListing(html: string): VideoResult[] {
  const blocks = html.split('class="video_block').slice(1)
  const altBlocks = html.split('id="result_video_').slice(1)
  const out: VideoResult[] = []

  for (const b of blocks) {
    const videoid = extractBetween(b, 'id="result_video_', '"')
    if (!videoid) continue
    pushFromBlock(b, videoid, out)
  }
  if (out.length === 0) {
    for (const b of altBlocks) {
      const videoid = b.split('"')[0]
      if (!videoid) continue
      pushFromBlock(b, videoid, out)
    }
  }
  return out
}

function pushFromBlock(b: string, videoid: string, out: VideoResult[]): void {
  const title = unescapeHtml(extractBetween(b, 'title="', '"') ?? '')
  if (!title) return
  const vlink = `https://www.redtube.com${extractBetween(b, 'href="', '"') ?? ''}`
  const thumb = extractBetween(b, 'data-o_thumb="', '"') ?? extractBetween(b, 'data-mediumthumb="', '"')
  const durRaw = extractBetween(b, 'class="duration"', '</span>') ?? ''
  const duration = parseDuration(stripTags(durRaw))
  const embedUrl = `https://embed.redtube.com/?id=${videoid}`
  out.push({
    sourceId: 'redtube',
    videoId: videoid,
    url: vlink,
    title,
    duration,
    thumbnail: thumb ?? '',
    embedUrl,
    tags: titleToTags(title),
  })
}
