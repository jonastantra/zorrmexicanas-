import type { SearchParams, VideoResult } from '../types.js'
import { fetchHtml, extractBetween, unescapeHtml } from '../utils/fetcher.js'
import { parseDuration } from '../utils/duration.js'
import { titleToTags } from '../utils/slugify.js'
import { buildSearchUrl, filterByDuration } from './base.js'

export async function searchXhamster(params: SearchParams): Promise<VideoResult[]> {
  const html = await fetchHtml({ url: buildSearchUrl(params), referer: 'https://xhamster.com/' })
  return filterByDuration(parseListing(html), params.minDuration)
}

function parseListing(html: string): VideoResult[] {
  const out: VideoResult[] = []
  const blocks = html.split('class="video-thumb').slice(1)
  for (const b of blocks) {
    const href = extractBetween(b, 'href="', '"') ?? ''
    if (!href) continue
    const videoid = href.split('-').pop() ?? ''
    if (!videoid) continue
    const title = unescapeHtml(extractBetween(b, 'title="', '"') ?? '')
    if (!title) continue
    const vlink = href.startsWith('http') ? href : `https://xhamster.com${href}`
    const thumb = extractBetween(b, 'src="', '"') ?? extractBetween(b, 'data-src="', '"')
    const durRaw = extractBetween(b, 'thumb-image-container__duration', '</div>') ?? ''
    const duration = parseDuration(durRaw.replace(/<[^>]*>/g, ''))
    const embedUrl = `https://xhamster.com/xembed.php?video=${videoid}`
    out.push({
      sourceId: 'xhamster',
      videoId: videoid,
      url: vlink,
      title,
      duration,
      thumbnail: thumb ?? '',
      embedUrl,
      tags: titleToTags(title),
    })
  }
  if (out.length === 0) {
    const clips = html.split('"clipId":').slice(1)
    for (const c of clips) {
      const videoid = c.split('"')[1] ?? ''
      if (!videoid) continue
      const title = unescapeHtml(extractBetween(c, '"title":"', '"') ?? '')
      if (!title) continue
      const thumb = extractBetween(c, '"thumb":"', '"') ?? extractBetween(c, '"thumbnail":"', '"')
      const embedUrl = `https://xhamster.com/xembed.php?video=${videoid}`
      out.push({
        sourceId: 'xhamster',
        videoId: videoid,
        url: `https://xhamster.com/videos/${videoid}`,
        title,
        duration: 0,
        thumbnail: thumb ?? '',
        embedUrl,
        tags: titleToTags(title),
      })
    }
  }
  return out
}
