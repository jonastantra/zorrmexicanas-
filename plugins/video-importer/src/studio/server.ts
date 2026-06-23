import http from 'node:http'
import { URL } from 'node:url'
import { searchVideos } from '../sources/index.js'
import { ProfileStore } from '../profiles.js'
import { createSitePublisher } from '../adapters.js'
import { csvTemplate, mergeCsvRows, parseCsv } from '../csv.js'
import type { PublishItem, SiteProfile, SourceId, VideoResult } from '../types.js'
import { STUDIO_HTML } from './ui.js'

const port = Number(process.env.VIDEO_IMPORTER_PORT || 4317)
const host = process.env.VIDEO_IMPORTER_HOST || '0.0.0.0'
const profiles = new ProfileStore(process.env.VIDEO_IMPORTER_PROFILES)

export function startStudio(): http.Server {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`)
      if (url.pathname === '/health') return json(response, 200, { ok: true })
      if (!authorized(request)) {
        response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Video Importer Studio"' })
        return response.end('Autenticación requerida')
      }
      if (request.method === 'GET' && url.pathname === '/') return html(response, STUDIO_HTML)
      if (request.method === 'GET' && url.pathname === '/api/profiles') return json(response, 200, profiles.list().map(maskProfile))
      if (request.method === 'GET' && url.pathname === '/api/csv-template') return text(response, 200, csvTemplate(), 'text/csv; charset=utf-8')

      if (request.method === 'POST' && url.pathname === '/api/profiles') {
        const incoming = await body<SiteProfile>(request)
        const existing = incoming.id ? profiles.get(incoming.id) : undefined
        const profile = validateProfile({
          ...incoming,
          applicationPassword: incoming.applicationPassword || existing?.applicationPassword,
        })
        profiles.save(profile)
        return json(response, 200, profiles.list().map(maskProfile))
      }
      if (request.method === 'DELETE' && url.pathname.startsWith('/api/profiles/')) {
        return json(response, 200, profiles.remove(decodeURIComponent(url.pathname.split('/').pop() || '')).map(maskProfile))
      }
      if (request.method === 'POST' && url.pathname === '/api/search') {
        const input = await body<{ sourceId: SourceId; keywords: string; page?: number; minDuration?: number }>(request)
        const videos = await searchVideos(input)
        return json(response, 200, { videos, count: videos.length })
      }
      if (request.method === 'POST' && url.pathname === '/api/csv-preview') {
        const input = await body<{ csv: string; videos?: VideoResult[] }>(request)
        const rows = parseCsv(input.csv)
        return json(response, 200, { rows: rows.length, items: mergeCsvRows(input.videos || [], rows) })
      }
      if (request.method === 'POST' && url.pathname === '/api/publish') {
        const input = await body<{ profileId: string; items: PublishItem[] }>(request)
        const profile = profiles.get(input.profileId)
        if (!profile) return json(response, 404, { error: 'Perfil no encontrado' })
        const publisher = createSitePublisher(profile)
        try {
          return json(response, 200, await publisher.publish(input.items))
        } finally {
          publisher.close?.()
        }
      }
      return json(response, 404, { error: 'Ruta no encontrada' })
    } catch (error) {
      return json(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  })
  server.listen(port, host, () => console.log(`Video Importer Studio: http://${host}:${port}`))
  return server
}

function authorized(request: http.IncomingMessage): boolean {
  const username = process.env.VIDEO_IMPORTER_USER
  const password = process.env.VIDEO_IMPORTER_PASSWORD
  if (!username || !password) return true
  const expected = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
  return request.headers.authorization === expected
}

function validateProfile(profile: SiteProfile): SiteProfile {
  if (!profile.name?.trim()) throw new Error('El perfil necesita nombre')
  if (!profile.adapter) throw new Error('Selecciona un adaptador')
  return { ...profile, id: profile.id?.trim() || profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
}

function maskProfile(profile: SiteProfile): SiteProfile {
  return { ...profile, applicationPassword: profile.applicationPassword ? '••••••••' : undefined }
}

async function body<T>(request: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) throw new Error('Cuerpo vacío')
  return JSON.parse(raw) as T
}

function json(response: http.ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(value))
}
function html(response: http.ServerResponse, value: string): void { text(response, 200, value, 'text/html; charset=utf-8') }
function text(response: http.ServerResponse, status: number, value: string, type: string): void {
  response.writeHead(status, { 'Content-Type': type })
  response.end(value)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) startStudio()
