import type { PublishItem, SourceId, VideoResult } from './types.js'

export interface CsvRow {
  [key: string]: string
}

export function parseCsv(input: string): CsvRow[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  if (rows.length < 2) return []
  const headers = rows[0].map((header) => header.trim().toLowerCase())
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])))
}

export function mergeCsvRows(videos: VideoResult[], rows: CsvRow[]): PublishItem[] {
  const byId = new Map(videos.map((video) => [`${video.sourceId}:${video.videoId}`, video]))
  const byUrl = new Map(videos.map((video) => [video.url, video]))
  return rows.map((row) => {
    const sourceId = row.source_id as SourceId
    const video = byId.get(`${sourceId}:${row.video_id}`) ?? byUrl.get(row.source_url) ?? fromCsvRow(row)
    return {
      video,
      title: row.title || video.title,
      description: row.description || video.description,
      category: row.category || undefined,
      tags: splitTags(row.tags) || video.tags,
      status: row.status === 'publish' ? 'publish' : 'draft',
    }
  })
}

export function csvTemplate(): string {
  return 'source_id,video_id,source_url,title,description,category,tags,status\nxvideos,123,https://www.xvideos.com/video.123/demo,Título,Descripción,categoria,"tag1,tag2",draft\n'
}

function fromCsvRow(row: CsvRow): VideoResult {
  return {
    sourceId: row.source_id as SourceId,
    videoId: row.video_id,
    url: row.source_url,
    title: row.title,
    description: row.description,
    duration: Number(row.duration || 0),
    thumbnail: row.thumbnail || '',
    embedUrl: row.embed_url,
    tags: splitTags(row.tags) ?? [],
  }
}

function splitTags(value: string): string[] | undefined {
  if (!value?.trim()) return undefined
  return value.split(/[|,]/).map((tag) => tag.trim()).filter(Boolean)
}
