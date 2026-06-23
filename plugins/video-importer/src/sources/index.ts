import type { SearchParams, SourceAdapter, SourceId, VideoResult } from '../types.js'
import { searchXvideos } from './xvideos.js'
import { searchPornhub } from './pornhub.js'
import { searchRedtube } from './redtube.js'
import { searchXhamster } from './xhamster.js'
import { searchYouporn } from './youporn.js'
import { inspectVideoUrls } from './direct.js'

const adapters: Record<SourceId, (p: SearchParams) => Promise<VideoResult[]>> = {
  xvideos: searchXvideos,
  pornhub: searchPornhub,
  redtube: searchRedtube,
  xhamster: searchXhamster,
  youporn: searchYouporn,
}

export const SOURCE_NAMES: Record<SourceId, string> = {
  xvideos: 'XVideos',
  pornhub: 'PornHub',
  redtube: 'RedTube',
  xhamster: 'xHamster',
  youporn: 'YouPorn',
}

export const SOURCE_IDS = Object.keys(adapters) as SourceId[]

export function getSourceAdapter(id: SourceId): SourceAdapter {
  const fn = adapters[id]
  if (!fn) throw new Error(`Source no soportada: ${id}`)
  return {
    id,
    name: SOURCE_NAMES[id],
    async search(params: SearchParams): Promise<VideoResult[]> {
      return fn({ ...params, sourceId: id })
    },
  }
}

export function listSources(): { id: SourceId; name: string }[] {
  return SOURCE_IDS.map((id) => ({ id, name: SOURCE_NAMES[id] }))
}

export async function searchVideos(params: SearchParams): Promise<VideoResult[]> {
  if (params.urls?.length) {
    return inspectVideoUrls(params.sourceId, params.urls)
  }
  const adapter = getSourceAdapter(params.sourceId)
  return adapter.search(params)
}
