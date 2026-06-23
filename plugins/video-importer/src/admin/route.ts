import { NextResponse } from 'next/server'
import {
  searchVideos,
  Publisher,
  listSources,
  type ImportOptions,
  type SourceId,
  type VideoResult,
} from '../index.js'

export const dynamic = 'force-dynamic'

const SEARCH_TIMEOUT_MS = 18000

interface SearchBody {
  sourceId: SourceId | 'all'
  keywords?: string
  urls?: string[]
  page?: number
  pageCount?: number
  maxResults?: number
  minDuration?: number
}

interface ImportBody {
  sourceId: SourceId
  keywords?: string
  urls?: string[]
  page?: number
  pageCount?: number
  maxResults?: number
  minDuration?: number
  videos?: Array<{
    videoId: string
    title: string
    url: string
    duration: number
    thumbnail: string
    embedUrl: string
    tags: string[]
    sourceId: SourceId
  }>
  options?: ImportOptions
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  let parsedBody: unknown
  try {
    parsedBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const action = url.searchParams.get('action') || getBodyAction(parsedBody)

  if (action === 'sources') {
    return NextResponse.json({ sources: listSources() })
  }

  if (action === 'search') {
    let body: SearchBody
    try {
      body = parsedBody as SearchBody
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }
    if (!body.sourceId) {
      return NextResponse.json({ error: 'sourceId requerido' }, { status: 400 })
    }
    if (!body.keywords && !body.urls?.length) {
      return NextResponse.json({ error: 'keywords o urls requeridos' }, { status: 400 })
    }
    try {
      if (body.sourceId === 'all' && body.urls?.length) {
        return NextResponse.json(
          { error: 'Para enlaces directos selecciona la fuente correspondiente' },
          { status: 400 }
        )
      }
      if (body.sourceId === 'all') {
        const availableSources = listSources()
        const settled = await Promise.allSettled(
          availableSources.map(source => withTimeout(searchVideos({
            sourceId: source.id,
            keywords: body.keywords,
            urls: body.urls,
            page: body.page,
            pageCount: body.pageCount,
            maxResults: body.maxResults,
            minDuration: body.minDuration,
          }), SEARCH_TIMEOUT_MS, `${source.name} tardó demasiado`).then(videos => ({ source, videos })))
        )
        const videos = annotateDuplicates(deduplicateVideos(settled.flatMap(result =>
          result.status === 'fulfilled' ? result.value.videos : []
        )))
        const sources = settled.map((result, index) => ({
          ...availableSources[index],
          count: result.status === 'fulfilled' ? result.value.videos.length : 0,
          error: result.status === 'rejected'
            ? (result.reason instanceof Error ? result.reason.message : String(result.reason))
            : undefined,
        }))
        return NextResponse.json({ count: videos.length, videos, sources })
      }
      const videos = await withTimeout(searchVideos({
          sourceId: body.sourceId,
          keywords: body.keywords,
          urls: body.urls,
          page: body.page,
          pageCount: body.pageCount,
          maxResults: body.maxResults,
          minDuration: body.minDuration,
        }), SEARCH_TIMEOUT_MS, 'La búsqueda tardó demasiado')
      const annotated = annotateDuplicates(videos)
      return NextResponse.json({
        count: annotated.length,
        videos: annotated,
        sources: [{ id: body.sourceId, name: listSources().find(source => source.id === body.sourceId)?.name ?? body.sourceId, count: annotated.length }],
      })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      )
    }
  }

  if (action === 'import') {
    let body: ImportBody
    try {
      body = parsedBody as ImportBody
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }
    const dbPath = process.env.MIGRATION_DB_PATH
    if (!dbPath) {
      return NextResponse.json({ error: 'MIGRATION_DB_PATH no configurado' }, { status: 500 })
    }
    let videos = body.videos ?? []
    if (videos.length === 0 && (body.keywords || body.urls?.length)) {
      try {
        videos = await searchVideos({
          sourceId: body.sourceId,
          keywords: body.keywords,
          urls: body.urls,
          page: body.page,
          pageCount: body.pageCount,
          maxResults: body.maxResults,
          minDuration: body.minDuration,
        })
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : String(err) },
          { status: 500 }
        )
      }
    }
    if (videos.length === 0) {
      return NextResponse.json({ error: 'No hay videos para importar' }, { status: 400 })
    }
    const publisher = new Publisher({ dbPath })
    try {
      const result = await publisher.importBatch(videos, body.options ?? {})
      return NextResponse.json(result)
    } finally {
      publisher.close()
    }
  }

  return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 })
}

export async function GET() {
  return NextResponse.json({ sources: listSources() })
}

function getBodyAction(body: unknown): string {
  if (body && typeof body === 'object' && 'action' in body) {
    return String((body as { action: unknown }).action)
  }
  return 'search'
}

function annotateDuplicates(videos: VideoResult[]): VideoResult[] {
  const dbPath = process.env.MIGRATION_DB_PATH
  if (!dbPath) return videos
  const publisher = new Publisher({ dbPath })
  try {
    return publisher.annotateExisting(videos)
  } finally {
    publisher.close()
  }
}

function deduplicateVideos(videos: VideoResult[]): VideoResult[] {
  const seen = new Set<string>()
  return videos.filter(video => {
    const key = `${video.sourceId}:${video.videoId || video.embedUrl || video.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      value => {
        clearTimeout(timeout)
        resolve(value)
      },
      error => {
        clearTimeout(timeout)
        reject(error)
      }
    )
  })
}
