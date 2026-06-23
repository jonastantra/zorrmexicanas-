import type { SourceId, ValidationIssue, VideoResult } from './types.js'

const SOURCE_HOSTS: Record<SourceId, string[]> = {
  xvideos: ['xvideos.com'],
  pornhub: ['pornhub.com'],
  redtube: ['redtube.com'],
  xhamster: ['xhamster.com'],
  youporn: ['youporn.com'],
}

export function validateVideo(video: VideoResult): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!video || typeof video !== 'object') return [{ field: 'video', message: 'Video inválido' }]
  if (!video.videoId?.trim()) issues.push({ field: 'videoId', message: 'videoId requerido' })
  if (!video.title?.trim()) issues.push({ field: 'title', message: 'Título requerido' })
  if (video.title?.length > 500) issues.push({ field: 'title', message: 'Título demasiado largo' })
  if (!isHttpUrl(video.url)) issues.push({ field: 'url', message: 'URL pública inválida' })
  if (!isHttpUrl(video.embedUrl)) issues.push({ field: 'embedUrl', message: 'URL de embed inválida' })
  if (video.thumbnail && !isHttpUrl(video.thumbnail)) {
    issues.push({ field: 'thumbnail', message: 'URL de miniatura inválida' })
  }
  if (!Number.isFinite(video.duration) || video.duration < 0 || video.duration > 24 * 60) {
    issues.push({ field: 'duration', message: 'Duración fuera de rango' })
  }
  if (!SOURCE_HOSTS[video.sourceId]) {
    issues.push({ field: 'sourceId', message: 'Fuente no soportada' })
  } else if (isHttpUrl(video.embedUrl) && !hostMatches(video.embedUrl, SOURCE_HOSTS[video.sourceId])) {
    issues.push({ field: 'embedUrl', message: 'El host del embed no corresponde a la fuente' })
  }
  return issues
}

export function assertValidVideo(video: VideoResult): void {
  const issues = validateVideo(video)
  if (issues.length) throw new Error(issues.map((issue) => `${issue.field}: ${issue.message}`).join('; '))
}

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
    return url.toString()
  } catch {
    return value.trim()
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function hostMatches(value: string, allowed: string[]): boolean {
  const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '')
  return allowed.some((host) => hostname === host || hostname.endsWith(`.${host}`))
}
