import { NextResponse } from 'next/server'
import {
  searchVideos,
  Publisher,
  listSources,
  type ImportOptions,
  type SourceId,
} from '../index.js'

export const dynamic = 'force-dynamic'

interface SearchBody {
  sourceId: SourceId
  keywords?: string
  urls?: string[]
  page?: number
  minDuration?: number
}

interface ImportBody {
  sourceId: SourceId
  keywords?: string
  urls?: string[]
  page?: number
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
      const videos = await searchVideos({
        sourceId: body.sourceId,
        keywords: body.keywords,
        urls: body.urls,
        page: body.page,
        minDuration: body.minDuration,
      })
      return NextResponse.json({ count: videos.length, videos })
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
