'use client'
import { useState, useCallback } from 'react'
import type { SourceId, VideoResult } from '../types.js'

interface ImportedVideo {
  postId: number
  slug: string
  title: string
  status: 'created' | 'duplicate'
  thumbnailDownloaded?: boolean
}

interface ImportBatchResult {
  imported: ImportedVideo[]
  errors: { videoId: string; title: string; error: string }[]
}

interface ImportOptions {
  categorySlug?: string
  postStatus?: 'publish' | 'draft'
  downloadThumbnail?: boolean
  aiRewrite?: boolean
  aiModel?: string
}

interface Props {
  apiBase?: string
}

export function VideoImporter({ apiBase = '/api/admin/importer' }: Props) {
  const [sourceId, setSourceId] = useState<SourceId | 'all'>('all')
  const [keywords, setKeywords] = useState('')
  const [urls, setUrls] = useState('')
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(3)
  const [maxResults, setMaxResults] = useState(120)
  const [minDuration, setMinDuration] = useState(0)
  const [videos, setVideos] = useState<VideoResult[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportBatchResult | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'publish' | 'draft'>('publish')
  const [category, setCategory] = useState('amateur-casero-mexicana')
  const [downloadThumb, setDownloadThumb] = useState(true)
  const [aiRewrite, setAiRewrite] = useState(false)
  const [aiModel, setAiModel] = useState('qwen/qwen-2.5-7b-instruct')
  const [sourceReport, setSourceReport] = useState<Array<{ id: string; name: string; count: number; error?: string }>>([])

  const sources: { id: SourceId | 'all'; name: string }[] = [
    { id: 'all', name: 'Todas las fuentes' },
    { id: 'xvideos', name: 'XVideos' },
    { id: 'pornhub', name: 'PornHub' },
    { id: 'redtube', name: 'RedTube' },
    { id: 'xhamster', name: 'xHamster' },
    { id: 'youporn', name: 'YouPorn' },
  ]

  const search = useCallback(async () => {
    const urlList = urls.split(/\r?\n/).map(url => url.trim()).filter(Boolean)
    if (!keywords.trim() && urlList.length === 0) {
      setError('Ingresa palabras clave o pega enlaces directos')
      return
    }
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const res = await fetch(`${apiBase}?action=search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, keywords: keywords.trim() || undefined, urls: urlList, page, pageCount, maxResults, minDuration }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error en búsqueda')
      setVideos(data.videos || [])
      setSourceReport(data.sources || [])
      setSelected(new Set((data.videos || [])
        .map((video: VideoResult, i: number) => video.isDuplicate ? -1 : i)
        .filter((i: number) => i >= 0)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setVideos([])
      setSourceReport([])
    } finally {
      setLoading(false)
    }
  }, [apiBase, sourceId, keywords, urls, page, pageCount, maxResults, minDuration])

  const importSelected = useCallback(async () => {
    const toImport = videos.filter((_, i) => selected.has(i))
    if (toImport.length === 0) {
      setError('Selecciona al menos un video')
      return
    }
    setImporting(true)
    setError('')
    setResults(null)
    try {
      const options: ImportOptions = {
        postStatus: status,
        categorySlug: category.trim() || undefined,
        downloadThumbnail: downloadThumb,
        aiRewrite,
        aiModel: aiModel.trim() || undefined,
      }
      const res = await fetch(`${apiBase}?action=import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: toImport, options }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al importar')
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }, [apiBase, videos, selected, status, category, downloadThumb, aiRewrite, aiModel])

  const toggle = (i: number) => {
    const next = new Set(selected)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setSelected(next)
  }

  const toggleAll = () => {
    const selectable = videos.filter(video => !video.isDuplicate)
    if (selected.size === selectable.length) setSelected(new Set())
    else setSelected(new Set(videos.map((video, i) => video.isDuplicate ? -1 : i).filter(i => i >= 0)))
  }

  return (
    <div className="video-importer">
      <h1>Importador de Videos</h1>

      <section className="search-panel">
        <h2>Buscar videos</h2>
        <div className="form-row">
          <label>
            Fuente:
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value as SourceId | 'all')}>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>
            Palabras clave:
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="mexicana, casero, amateur..."
              onKeyDown={(e) => e.key === 'Enter' && search()}
            />
          </label>
          <label className="url-input">
            Enlaces directos (uno por línea):
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://www.xvideos.com/video..."
              rows={3}
            />
          </label>
          <label>
            Página:
            <input type="number" min={1} value={page} onChange={(e) => setPage(Math.max(1, +e.target.value))} />
          </label>
          <label>
            Páginas a traer:
            <input type="number" min={1} max={10} value={pageCount} onChange={(e) => setPageCount(Math.min(10, Math.max(1, +e.target.value)))} />
          </label>
          <label>
            Límite resultados:
            <input type="number" min={10} max={300} value={maxResults} onChange={(e) => setMaxResults(Math.min(300, Math.max(10, +e.target.value)))} />
          </label>
          <label>
            Duración mín (min):
            <input type="number" min={0} value={minDuration} onChange={(e) => setMinDuration(Math.max(0, +e.target.value))} />
          </label>
          <button onClick={search} disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      {sourceReport.length > 0 && (
        <div className="source-report">
          {sourceReport.map((source) => (
            <span key={source.id} className={source.error ? 'source-error' : ''}>
              {source.name}: {source.error ? source.error : `${source.count} resultados`}
            </span>
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <section className="results-panel">
          <div className="results-header">
            <h2>
              {videos.length} videos encontrados ({selected.size} nuevos seleccionados)
              {' '}
              <small>{videos.filter(v => v.isDuplicate).length} duplicados omitidos</small>
            </h2>
            <div className="import-options">
              <label>
                Estado:
                <select value={status} onChange={(e) => setStatus(e.target.value as 'publish' | 'draft')}>
                  <option value="draft">Borrador</option>
                  <option value="publish">Publicado</option>
                </select>
              </label>
              <label>
                Categoría (slug):
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="amateur-mexicano" />
              </label>
              <label>
                <input type="checkbox" checked={downloadThumb} onChange={(e) => setDownloadThumb(e.target.checked)} />
                Descargar miniatura
              </label>
              <label>
                <input type="checkbox" checked={aiRewrite} onChange={(e) => setAiRewrite(e.target.checked)} />
                Reescribir con IA
              </label>
              {aiRewrite && (
                <label>
                  Modelo OpenRouter:
                  <input type="text" value={aiModel} onChange={(e) => setAiModel(e.target.value)} placeholder="qwen/..." />
                </label>
              )}
              <button onClick={importSelected} disabled={importing}>
                {importing ? 'Importando...' : `Importar ${selected.size}`}
              </button>
            </div>
          </div>

          <table className="results-table">
            <thead>
              <tr>
	                <th><input type="checkbox" checked={videos.some(v => !v.isDuplicate) && selected.size === videos.filter(v => !v.isDuplicate).length} onChange={toggleAll} /></th>
                <th>Miniatura</th>
                <th>Título</th>
                <th>Duración</th>
                <th>Fuente</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v, i) => (
	                <tr key={`${v.sourceId}-${v.videoId}-${i}`} className={`${selected.has(i) ? 'selected' : ''} ${v.isDuplicate ? 'duplicate' : ''}`}>
	                  <td>
	                    <input type="checkbox" checked={selected.has(i)} disabled={v.isDuplicate} onChange={() => toggle(i)} />
                  </td>
                  <td>
                    {v.thumbnail ? (
                      <img src={v.thumbnail} alt={v.title} width="120" loading="lazy" />
                    ) : (
                      <span className="no-thumb">Sin miniatura</span>
                    )}
                  </td>
	                  <td className="title-cell">
	                    <a href={v.url} target="_blank" rel="noopener noreferrer">{v.title}</a>
	                    {v.isDuplicate && (
	                      <div className="duplicate-note">
	                        Ya existe: #{v.existingPostId} {v.existingSlug ? <a href={`/${v.existingSlug}`} target="_blank" rel="noopener noreferrer">/{v.existingSlug}</a> : ''}
	                      </div>
	                    )}
	                    <div className="tags">{v.tags.slice(0, 6).join(', ')}</div>
                  </td>
                  <td>{v.duration ? `${v.duration} min` : '-'}</td>
                  <td className="source-badge">{v.sourceId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {results && (
        <section className="import-results">
          <h2>Resultados de importación</h2>
          <p className="summary">
            Importados: {results.imported.length} |
            Errores: {results.errors.length}
          </p>
          {results.imported.length > 0 && (
            <table className="results-table">
              <thead>
                <tr><th>ID</th><th>Título</th><th>Slug</th><th>Estado</th><th>Miniatura</th></tr>
              </thead>
              <tbody>
                {results.imported.map((r) => (
                  <tr key={r.postId} className={r.status}>
                    <td>{r.postId}</td>
                    <td>{r.title}</td>
                    <td><code>/{r.slug}</code></td>
                    <td>
                      {r.status === 'duplicate' ? '⚠ Duplicado' : '✓ Creado'}
                      {r.thumbnailDownloaded && ' 📷'}
                    </td>
                    <td>
                      {r.status === 'created' ? (
                        <a href={`/${r.slug}`} target="_blank" rel="noopener noreferrer">Ver</a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {results.errors.length > 0 && (
            <div className="errors">
              <h3>Errores</h3>
              <ul>
                {results.errors.map((e, i) => (
                  <li key={i}><strong>{e.title}</strong> ({e.videoId}): {e.error}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default VideoImporter
