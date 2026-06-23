export type SourceId = 'xvideos' | 'pornhub' | 'redtube' | 'xhamster' | 'youporn'

export interface VideoResult {
  sourceId: SourceId
  videoId: string
  url: string
  title: string
  duration: number
  thumbnail: string
  embedUrl: string
  tags: string[]
  description?: string
  isDuplicate?: boolean
  existingPostId?: number
  existingSlug?: string
  duplicateReason?: string
}

export interface SearchParams {
  keywords?: string
  urls?: string[]
  page?: number
  pageCount?: number
  maxResults?: number
  minDuration?: number
  sourceId: SourceId
}

export interface SearchResult {
  videos: VideoResult[]
  page: number
  keywords?: string
}

export interface ImportOptions {
  categorySlug?: string
  tagSlugs?: string[]
  postStatus?: 'publish' | 'draft'
  downloadThumbnail?: boolean
  titleTemplate?: string
  contentTemplate?: string
  thumbsDir?: string
  addToCanonical?: boolean
  aiRewrite?: boolean
  aiModel?: string
  aiPrompt?: string
}

export interface ImportResult {
  postId: number
  slug: string
  title: string
  status: 'created' | 'duplicate'
  thumbnailDownloaded?: boolean
}

export type SiteAdapterType = 'zorritas-sqlite' | 'wordpress-rest' | 'json-export'

export interface SiteProfile {
  id: string
  name: string
  adapter: SiteAdapterType
  baseUrl?: string
  databasePath?: string
  outputDirectory?: string
  username?: string
  applicationPassword?: string
  defaultStatus?: 'publish' | 'draft'
  defaultCategory?: string
  downloadThumbnail?: boolean
  titleTemplate?: string
  contentTemplate?: string
}

export interface PublishItem {
  video: VideoResult
  title?: string
  description?: string
  category?: string
  tags?: string[]
  status?: 'publish' | 'draft'
}

export interface SitePublisher {
  publish(items: PublishItem[]): Promise<ImportBatchResult>
  close?(): void
}

export interface ImportBatchResult {
  imported: ImportResult[]
  errors: { videoId: string; title: string; error: string }[]
}

export interface ValidationIssue {
  field: keyof VideoResult | 'video'
  message: string
}

export interface SourceAdapter {
  id: SourceId
  name: string
  search(params: SearchParams): Promise<VideoResult[]>
}

export interface SourceInfo {
  id: SourceId
  name: string
  searchUrl: string
  embedPattern: string
}

export const SOURCE_INFOS: SourceInfo[] = [
  { id: 'xvideos', name: 'XVideos', searchUrl: 'https://www.xvideos.com/?k={kw}&p={page}', embedPattern: 'https://flashservice.xvideos.com/embedframe/{id}' },
  { id: 'pornhub', name: 'PornHub', searchUrl: 'https://www.pornhub.com/video/search?search={kw}&page={page}', embedPattern: 'https://www.pornhub.com/embed/{vkey}' },
  { id: 'redtube', name: 'RedTube', searchUrl: 'https://www.redtube.com/?search={kw}&page={page}', embedPattern: 'https://embed.redtube.com/?id={id}' },
  { id: 'xhamster', name: 'xHamster', searchUrl: 'https://xhamster.com/search/{kw}', embedPattern: 'https://xhamster.com/xembed.php?video={id}' },
  { id: 'youporn', name: 'YouPorn', searchUrl: 'https://www.youporn.com/search/?query={kw}&page={page}', embedPattern: 'https://www.youporn.com/embed/{id}' },
]
