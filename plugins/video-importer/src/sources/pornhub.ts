import type { SearchParams, VideoResult } from '../types.js'
import { fetchHtml, extractBetween, unescapeHtml, stripTags } from '../utils/fetcher.js'
import { parseDuration } from '../utils/duration.js'
import { titleToTags } from '../utils/slugify.js'
import { buildSearchUrl, filterByDuration } from './base.js'

export async function searchPornhub(params: SearchParams): Promise<VideoResult[]> {
  const html = await fetchHtml({ url: buildSearchUrl(params), referer: 'https://www.pornhub.com/' })
  return filterByDuration(parseListing(html), params.minDuration)
}

function parseListing(html: string): VideoResult[] {
  const blocks = html.split('class="videoblock').slice(1)
  const out: VideoResult[] = []
  for (const b of blocks) {
    const videoid = extractBetween(b, 'id="v', '"')
    if (!videoid) continue
    const title = unescapeHtml(extractBetween(b, 'title="', '"') ?? '')
    if (!title) continue
    const vlink = `https://www.pornhub.com${extractBetween(b, 'href="', '"') ?? ''}`
    const thumb = extractBetween(b, 'data-mediumthumb="', '"')
    const vkey = extractBetween(b, '_vkey="', '"') ?? videoid
    const durRaw = extractBetween(b, 'class="duration"', '</var>') ?? ''
    const duration = parseDuration(stripTags(durRaw))
    const embedUrl = `https://www.pornhub.com/embed/${vkey}`
    out.push({
      sourceId: 'pornhub',
      videoId: videoid,
      url: vlink,
      title,
      duration,
      thumbnail: thumb ?? '',
      embedUrl,
      tags: titleToTags(title),
    })
  }
  return out
}
