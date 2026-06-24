'use client'

import { useCallback, useEffect, useState } from 'react'

interface QueueRow {
  id: number
  source_id: string
  source_video_id: string
  source_url: string
  embed_url: string
  thumbnail_url: string | null
  original_title: string
  ai_title: string | null
  ai_description: string | null
  category_slug: string | null
  duration: number
  status: string
  scheduled_at: string | null
  published_at: string | null
  created_post_id: number | null
  error_message: string | null
}

interface Dashboard {
  settings: Record<string, string>
  rows: QueueRow[]
  total: number
  counts: Record<string, number>
  runs: Array<Record<string, unknown>>
}

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'candidate', label: 'Candidatos' },
  { key: 'rewritten', label: 'Reescritos' },
  { key: 'scheduled', label: 'Programados' },
  { key: 'published', label: 'Publicados' },
  { key: 'failed', label: 'Fallidos' },
  { key: 'needs_review', label: 'Revisión' },
  { key: 'skipped', label: 'Saltados' },
]

const SETTING_FIELDS: Array<{ key: string; label: string; type?: string }> = [
  { key: 'enabled', label: 'Activar automático (true/false)' },
  { key: 'ai_enabled', label: 'IA activada (true/false)' },
  { key: 'source_id', label: 'Fuente' },
  { key: 'keywords', label: 'Keywords (coma)' },
  { key: 'page_count', label: 'Páginas por búsqueda', type: 'number' },
  { key: 'max_candidates_per_run', label: 'Máx candidatos por corrida', type: 'number' },
  { key: 'daily_limit', label: 'Publicaciones por día', type: 'number' },
  { key: 'max_per_run', label: 'Máx por corrida (publish)', type: 'number' },
  { key: 'schedule_start_hour', label: 'Hora inicio (0-24)', type: 'number' },
  { key: 'schedule_end_hour', label: 'Hora fin (0-24)', type: 'number' },
  { key: 'tz_offset_minutes', label: 'Offset zona horaria (min)', type: 'number' },
  { key: 'default_category', label: 'Categoría default' },
  { key: 'ai_model', label: 'Modelo OpenRouter' },
  { key: 'publish_status', label: 'Estado al publicar (publish/draft)' },
]

export default function AutoImportPanel({ apiBase }: { apiBase: string }) {
  const [data, setData] = useState<Dashboard | null>(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [draftSettings, setDraftSettings] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<QueueRow | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status: filter })
    if (search) params.set('search', search)
    const res = await fetch(`${apiBase}?${params}`, { cache: 'no-store' })
    const json = (await res.json()) as Dashboard
    setData(json)
    setDraftSettings(json.settings)
  }, [apiBase, filter, search])

  useEffect(() => { load() }, [load])
  // Al cambiar de filtro/búsqueda se limpia la selección para no operar sobre
  // filas que ya no están a la vista.
  useEffect(() => { setSelected(new Set()) }, [filter, search])

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const toggleRow = (id: number) => setSelected(s => {
    const next = new Set(s)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const call = async (action: string, payload: Record<string, unknown> = {}) => {
    setBusy(action + (payload.id ? `:${payload.id}` : ''))
    try {
      const res = await fetch(`${apiBase}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        notify(`Error: ${json.error || res.status}`)
      } else if (typeof json.message === 'string') {
        notify(json.message)
      } else {
        const parts = ['ok', 'queued', 'rewritten', 'scheduled', 'published', 'failed', 'removed', 'restored', 'repaired', 'promoted']
          .filter(k => typeof json[k] === 'number')
          .map(k => `${k}: ${json[k]}`)
        notify(parts.length ? parts.join(' · ') : 'Listo')
      }
      await load()
      return json
    } finally {
      setBusy(null)
    }
  }

  // Acción masiva sobre las filas seleccionadas; limpia la selección al terminar.
  const bulk = async (op: string, extra: Record<string, unknown> = {}) => {
    const ids = [...selected]
    if (ids.length === 0) { notify('No hay filas seleccionadas'); return }
    await call('bulk', { ids, op, ...extra })
    setSelected(new Set())
  }

  if (!data) return <div className="ai-wrap"><p>Cargando…</p></div>

  const c = data.counts || {}
  const allShownSelected = data.rows.length > 0 && data.rows.every(r => selected.has(r.id))
  const toggleAllShown = () => setSelected(s => {
    if (data.rows.every(r => s.has(r.id))) {
      const next = new Set(s)
      data.rows.forEach(r => next.delete(r.id))
      return next
    }
    return new Set([...s, ...data.rows.map(r => r.id)])
  })

  return (
    <div className="ai-wrap">
      <header className="ai-head">
        <h1>Importador automático</h1>
        <div className="ai-summary">
          <span>Programados: <b>{c.scheduled || 0}</b></span>
          <span>Reescritos: <b>{c.rewritten || 0}</b></span>
          <span>Candidatos: <b>{c.candidate || 0}</b></span>
          <span>Publicados: <b>{c.published || 0}</b></span>
          <span className="warn">Revisión: <b>{c.needs_review || 0}</b></span>
          <span className="bad">Fallidos: <b>{c.failed || 0}</b></span>
        </div>
      </header>

      <section className="ai-bulk">
        <button disabled={!!busy} onClick={() => call('discover')}>🔎 Buscar candidatos</button>
        <button disabled={!!busy} onClick={() => call('rewrite')}>✍️ Reescribir con IA</button>
        <button disabled={!!busy} onClick={() => call('schedule', { limit: 20 })}>🗓️ Programar 20</button>
        <button disabled={!!busy} onClick={() => call('schedule', { limit: 50 })}>🗓️ Programar 50</button>
        <button disabled={!!busy} onClick={() => call('publish-due')}>🚀 Publicar vencidos</button>
        <button disabled={!!busy} className="accent" onClick={() => call('full-cycle')}>♻️ Ciclo completo</button>
        <button disabled={!!busy} onClick={() => call('revalidate')}>✅ Revalidar revisión</button>
        <button disabled={!!busy} onClick={() => call('retry-failed')}>↻ Reintentar fallidos</button>
        <button disabled={!!busy} onClick={() => { if (confirm('¿Eliminar fallidos y saltados?')) call('clear-failed') }}>🧹 Limpiar fallidos</button>
        <button disabled={!!busy} onClick={() => { if (confirm('Reescribe títulos/descripciones de posts viejos con la IA. ¿Continuar?')) call('repair', { limit: 20 }) }}>🛠️ Reparar posts viejos</button>
        <button onClick={() => setShowSettings(s => !s)}>⚙️ Configuración</button>
        {busy && <span className="ai-busy">⏳ {busy}…</span>}
      </section>

      {showSettings && (
        <section className="ai-settings">
          <div className="ai-grid">
            {SETTING_FIELDS.map(f => (
              <label key={f.key}>
                <span>{f.label}</span>
                <input
                  type={f.type || 'text'}
                  value={draftSettings[f.key] ?? ''}
                  onChange={e => setDraftSettings(s => ({ ...s, [f.key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <label className="ai-prompt">
            <span>Prompt OpenRouter</span>
            <textarea
              rows={8}
              value={draftSettings.ai_prompt ?? ''}
              onChange={e => setDraftSettings(s => ({ ...s, ai_prompt: e.target.value }))}
            />
          </label>
          <div className="ai-settings-acts">
            <button className="accent" disabled={!!busy} onClick={() => call('save-settings', { settings: draftSettings }).then(() => setShowSettings(false))}>
              Guardar configuración
            </button>
            <button disabled={!!busy} title="Vuelve al prompt por defecto (el nuevo con más salsa)"
              onClick={() => { if (confirm('¿Restablecer el prompt al de fábrica (con más salsa)? Se pierde tu prompt actual.')) call('reset-prompt') }}>
              ↩️ Restablecer prompt con salsa
            </button>
          </div>
        </section>
      )}

      <section className="ai-filters">
        {FILTERS.map(f => (
          <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
            {f.label}{typeof c[f.key] === 'number' ? ` (${c[f.key]})` : ''}
          </button>
        ))}
        <input className="ai-search" placeholder="Buscar título…" value={search}
          onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load() }} />
      </section>

      {selected.size > 0 && (
        <section className="ai-bulkbar">
          <span><b>{selected.size}</b> seleccionados</span>
          <button disabled={!!busy} onClick={() => bulk('regenerate')}>✍️ Regenerar IA</button>
          <button disabled={!!busy} onClick={() => { if (confirm(`¿Publicar ahora ${selected.size}?`)) bulk('publish') }}>🚀 Publicar</button>
          <button disabled={!!busy} onClick={() => bulk('resume')}>▶️ A reescritos</button>
          <button disabled={!!busy} onClick={() => bulk('pause')}>⏸️ A revisión</button>
          <button disabled={!!busy} onClick={() => bulk('skip')}>⤼ Saltar</button>
          <button disabled={!!busy} onClick={() => {
            const cat = prompt('Nueva categoría (slug) para los seleccionados:')
            if (cat) bulk('set-category', { fields: { category_slug: cat } })
          }}>🏷️ Categoría</button>
          <button disabled={!!busy} className="bad" onClick={() => { if (confirm(`¿Eliminar ${selected.size} de la cola?`)) bulk('delete') }}>🗑️ Eliminar</button>
          <button onClick={() => setSelected(new Set())}>✖ Limpiar selección</button>
        </section>
      )}

      <div className="ai-table-scroll">
        <table className="ai-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} title="Seleccionar todo lo visible" /></th>
              <th>ID</th><th>Estado</th><th>Miniatura</th><th>Título original</th>
              <th>Título IA</th><th>Descripción IA</th><th>Cat</th><th>Dur</th>
              <th>Programado</th><th>Publicado</th><th>Post</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map(r => (
              <tr key={r.id} className={`st-${r.status}${selected.has(r.id) ? ' sel' : ''}`}>
                <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} /></td>
                <td>{r.id}</td>
                <td><span className={`badge ${r.status}`}>{r.status}</span>
                  {r.error_message && <div className="err" title={r.error_message}>⚠ {r.error_message.slice(0, 60)}</div>}
                </td>
                <td>{r.thumbnail_url ? <img src={r.thumbnail_url} alt="" loading="lazy" /> : '—'}</td>
                <td className="orig">{r.original_title}</td>
                <td className="ai-t">{r.ai_title || <em>—</em>}</td>
                <td className="ai-d">{r.ai_description ? `${r.ai_description.slice(0, 120)}${r.ai_description.length > 120 ? '…' : ''}` : <em>—</em>}</td>
                <td>{r.category_slug}</td>
                <td>{r.duration}m</td>
                <td>{fmt(r.scheduled_at)}</td>
                <td>{fmt(r.published_at)}</td>
                <td>{r.created_post_id ? <a href={`/admin/videos/${r.created_post_id}`} target="_blank" rel="noreferrer">{r.created_post_id}</a> : '—'}</td>
                <td className="acts">
                  <a href={r.embed_url} target="_blank" rel="noreferrer" title="Ver iframe">▶</a>
                  <a href={r.source_url} target="_blank" rel="noreferrer" title="Ver fuente">🔗</a>
                  <button title="Regenerar IA" disabled={!!busy} onClick={() => call('regenerate', { id: r.id })}>✍️</button>
                  <button title="Editar" disabled={!!busy} onClick={() => setEditing(r)}>✏️</button>
                  <button title="Publicar ahora" disabled={!!busy} onClick={() => { if (confirm('¿Publicar ahora?')) call('publish-now', { id: r.id }) }}>🚀</button>
                  {r.status === 'scheduled'
                    ? <button title="Pausar" disabled={!!busy} onClick={() => call('pause', { id: r.id })}>⏸️</button>
                    : <button title="Reanudar" disabled={!!busy} onClick={() => call('resume', { id: r.id })}>▶️</button>}
                  <button title="Saltar" disabled={!!busy} onClick={() => call('skip', { id: r.id })}>⤼</button>
                  <button title="Eliminar" disabled={!!busy} onClick={() => { if (confirm('¿Eliminar de la cola?')) call('delete', { id: r.id }) }}>🗑️</button>
                </td>
              </tr>
            ))}
            {data.rows.length === 0 && <tr><td colSpan={13} className="empty">Sin elementos en este filtro.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="ai-total">{data.rows.length} de {data.total} en la cola</p>

      {editing && (
        <EditModal
          row={editing}
          busy={!!busy}
          onClose={() => setEditing(null)}
          onSave={async (fields) => { await call('edit', { id: editing.id, fields }); setEditing(null) }}
        />
      )}

      {toast && <div className="ai-toast">{toast}</div>}
    </div>
  )
}

function EditModal({ row, busy, onClose, onSave }: {
  row: QueueRow; busy: boolean; onClose: () => void
  onSave: (fields: { ai_title: string; ai_description: string; category_slug: string }) => void
}) {
  const [title, setTitle] = useState(row.ai_title || '')
  const [desc, setDesc] = useState(row.ai_description || '')
  const [cat, setCat] = useState(row.category_slug || '')
  return (
    <div className="ai-modal-bg" onClick={onClose}>
      <div className="ai-modal" onClick={e => e.stopPropagation()}>
        <h3>Editar #{row.id}</h3>
        <p className="orig-ref">Original: {row.original_title}</p>
        <label><span>Título IA ({[...title].length})</span>
          <input value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label><span>Descripción IA ({[...desc].length})</span>
          <textarea rows={5} value={desc} onChange={e => setDesc(e.target.value)} /></label>
        <label><span>Categoría</span>
          <input value={cat} onChange={e => setCat(e.target.value)} /></label>
        <div className="ai-modal-acts">
          <button onClick={onClose}>Cancelar</button>
          <button className="accent" disabled={busy} onClick={() => onSave({ ai_title: title, ai_description: desc, category_slug: cat })}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

function fmt(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return value
  return d.toLocaleString('es-MX', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
