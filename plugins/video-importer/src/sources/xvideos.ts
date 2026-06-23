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
  const blocks = html.split('class="thumb-block').slice(1)
  const out: VideoResult[] = []
  for (const b of blocks) {
    const id = extractBetween(b, 'id="video', '"')
    if (!id) continue
    const title = unescapeHtml(extractBetween(b, 'title="', '"') ?? '')
    if (!title) continue
    const vlink = `https://www.xvideos.com${extractBetween(b, 'href="', '"') ?? ''}`
    let thumb = extractBetween(b, 'data-src="', '"')
    if (!thumb) thumb = extractBetween(b, 'src="', '"')
    if (thumb) {
      thumb = thumb.replace('thumbs169ll', 'thumbsl').replace('THUMBNUM', String(Math.floor(Math.random() * 28) + 2))
    }
    const durRaw = extractBetween(b, 'class="duration"', '</span>') ?? ''
    const duration = parseDuration(stripTags(durRaw))
    const embedUrl = `https://flashservice.xvideos.com/embedframe/${id}`
    out.push({
      sourceId: 'xvideos',
      videoId: id,
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
