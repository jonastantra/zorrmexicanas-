import type { SearchParams, VideoResult } from '../types.js'

export function buildSearchUrl(params: SearchParams): string {
  const kw = encodeURIComponent((params.keywords ?? '').trim())
  const page = Math.max(1, params.page ?? 1)
  switch (params.sourceId) {
    case 'xvideos':
      return page > 1
        ? `https://www.xvideos.com/?k=${kw}&p=${page - 1}`
        : `https://www.xvideos.com/?k=${kw}`
    case 'pornhub':
      return `https://www.pornhub.com/video/search?search=${kw}&page=${page}`
    case 'redtube':
      return `https://www.redtube.com/?search=${kw}&page=${page}`
    case 'xhamster':
      return `https://xhamster.com/search/${kw}`
    case 'youporn':
      return `https://www.youporn.com/search/?query=${kw}&page=${page}`
    default:
      throw new Error(`Source desconocida: ${params.sourceId}`)
  }
}

export function filterByDuration(videos: VideoResult[], min: number | undefined): VideoResult[] {
  if (!min || min <= 0) return videos
  return videos.filter((v) => v.duration >= min)
}
