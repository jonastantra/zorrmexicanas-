// Motor del publicador automático: descubrir → reescribir → programar → publicar.
// Reutiliza la API pública del plugin @zorritas/video-importer (Publisher, searchVideos).
import { searchVideos, Publisher } from '@zorritas/video-importer'
import type { VideoResult, SourceId } from '@zorritas/video-importer'
import { openCatalogAdmin } from '@/lib/catalog-admin'
import {
  db, getSettings, settingInt, settingBool, getSetting,
  startRun, finishRun, type QueueRow,
} from './db'
import { rewriteEditorial, OpenRouterError, PROMPT_VERSION } from './ai'
import { checkTitle, checkDescription, cleanText, deShout } from './sanitize'

export interface CycleStats {
  candidates_found: number
  queued: number
  rewritten: number
  scheduled: number
  published: number
  failed: number
  log: string
}

function emptyStats(): CycleStats {
  return { candidates_found: 0, queued: 0, rewritten: 0, scheduled: 0, published: 0, failed: 0, log: '' }
}

function migrationDbPath(): string {
  const p = process.env.MIGRATION_DB_PATH
  if (!p) throw new Error('MIGRATION_DB_PATH no configurado')
  return p
}

// El Publisher instalado escribe el título en post_excerpt; forzamos la descripción IA.
function patchExcerpt(postId: number, description: string): void {
  const cdb = openCatalogAdmin()
  try {
    cdb.prepare(`UPDATE posts SET post_excerpt=? WHERE id=?`).run(description, postId)
  } finally {
    cdb.close()
  }
}

// ---- Descubrimiento --------------------------------------------------------

export async function discover(): Promise<CycleStats> {
  const stats = emptyStats()
  const runId = startRun('discover')
  const logs: string[] = []
  try {
    if (!settingBool('enabled')) {
      logs.push('Automático desactivado (enabled=false)')
      finishRun(runId, 'ok', { ...stats, log: logs.join('\n') })
      return stats
    }
    const sourceId = (getSetting('source_id') || 'xvideos') as SourceId
    const keywords = getSetting('keywords').split(',').map(k => k.trim()).filter(Boolean)
    const pageCount = settingInt('page_count', 3)
    const maxTotal = settingInt('max_candidates_per_run', 120)

    const collected: VideoResult[] = []
    const seen = new Set<string>()
    for (const kw of keywords) {
      if (collected.length >= maxTotal) break
      for (let page = 1; page <= pageCount; page++) {
        if (collected.length >= maxTotal) break
        let found: VideoResult[] = []
        try {
          found = await searchVideos({ sourceId, keywords: kw, page })
        } catch (err) {
          logs.push(`Búsqueda "${kw}" p${page} falló: ${err instanceof Error ? err.message : String(err)}`)
          break
        }
        if (found.length === 0) break
        for (const v of found) {
          const key = `${v.sourceId}:${v.videoId}`
          if (!v.videoId || seen.has(key)) continue
          seen.add(key)
          collected.push(v)
        }
      }
    }
    stats.candidates_found = collected.length

    // Descartar los que ya existen en migration.db (dedup por fuente/embed/link).
    let fresh = collected
    const publisher = new Publisher({ dbPath: migrationDbPath() })
    try {
      fresh = collected.filter(v => publisher.findExisting(v) === null)
    } finally {
      publisher.close()
    }

    const insert = db().prepare(`
      INSERT OR IGNORE INTO auto_import_queue
        (source_id, source_video_id, source_url, embed_url, thumbnail_url,
         original_title, category_slug, tags_json, duration, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate')
    `)
    const defaultCategory = getSetting('default_category')
    const tx = db().transaction((items: VideoResult[]) => {
      for (const v of items) {
        // Validación base: sin embed/thumbnail no entra a la cola.
        if (!v.embedUrl || !/^https?:\/\//.test(v.embedUrl)) continue
        if (!v.thumbnail || !/^https?:\/\//.test(v.thumbnail)) continue
        const info = insert.run(
          v.sourceId, v.videoId, v.url, v.embedUrl, v.thumbnail,
          cleanText(v.title) || v.title, defaultCategory,
          JSON.stringify(v.tags ?? []), Math.round(v.duration || 0)
        )
        if (info.changes > 0) stats.queued++
      }
    })
    tx(fresh)

    logs.push(`Candidatos: ${stats.candidates_found}, nuevos en cola: ${stats.queued}`)
    finishRun(runId, 'ok', { ...stats, log: logs.join('\n') })
    return stats
  } catch (err) {
    logs.push(`ERROR: ${err instanceof Error ? err.message : String(err)}`)
    finishRun(runId, 'error', { ...stats, log: logs.join('\n') })
    throw err
  }
}

// ---- Reescritura con IA ----------------------------------------------------

export async function rewritePending(batch?: number): Promise<CycleStats> {
  const stats = emptyStats()
  const runId = startRun('rewrite')
  const logs: string[] = []
  try {
    if (!settingBool('ai_enabled')) {
      logs.push('IA desactivada (ai_enabled=false)')
      finishRun(runId, 'ok', { ...stats, log: logs.join('\n') })
      return stats
    }
    const limit = batch ?? settingInt('rewrite_batch', 40)
    const model = getSetting('ai_model')
    const prompt = getSetting('ai_prompt')
    const rows = db().prepare(
      `SELECT * FROM auto_import_queue WHERE status='candidate' ORDER BY id ASC LIMIT ?`
    ).all(limit) as QueueRow[]

    const setRewritten = db().prepare(`
      UPDATE auto_import_queue
      SET ai_title=?, ai_description=?, status='rewritten', quality_score=100,
          ai_model=?, ai_prompt_version=?, error_message=NULL, updated_at=datetime('now')
      WHERE id=?
    `)
    const setReview = db().prepare(`
      UPDATE auto_import_queue
      SET status='needs_review', error_message=?, ai_title=?, ai_description=?,
          ai_model=?, ai_prompt_version=?, updated_at=datetime('now')
      WHERE id=?
    `)
    const setError = db().prepare(`
      UPDATE auto_import_queue SET error_message=?, updated_at=datetime('now') WHERE id=?
    `)

    for (const row of rows) {
      try {
        const result = await rewriteEditorial(
          {
            originalTitle: cleanText(row.original_title),
            source: row.source_id,
            tags: JSON.parse(row.tags_json || '[]'),
            durationMinutes: row.duration,
          },
          { model, prompt }
        )
        const tCheck = checkTitle(result.title)
        const dCheck = checkDescription(result.description)
        if (tCheck.ok && dCheck.ok) {
          setRewritten.run(result.title, result.description, result.model, PROMPT_VERSION, row.id)
          stats.rewritten++
        } else {
          const reasons = [...tCheck.reasons, ...dCheck.reasons].join('; ')
          setReview.run(reasons, result.title, result.description, result.model, PROMPT_VERSION, row.id)
          stats.failed++
          logs.push(`#${row.id} needs_review: ${reasons}`)
        }
      } catch (err) {
        const msg = err instanceof OpenRouterError ? err.message : String(err)
        setError.run(msg, row.id)
        stats.failed++
        logs.push(`#${row.id} error IA: ${msg}`)
        // Si la API falla en bloque, abortar para no quemar cuota.
        if (err instanceof OpenRouterError && /HTTP 4|API_KEY|timeout/i.test(msg)) {
          logs.push('Abortando lote por fallo de API')
          break
        }
      }
      await sleep(400)
    }

    finishRun(runId, 'ok', { ...stats, log: logs.join('\n') })
    return stats
  } catch (err) {
    logs.push(`ERROR: ${err instanceof Error ? err.message : String(err)}`)
    finishRun(runId, 'error', { ...stats, log: logs.join('\n') })
    throw err
  }
}

// ---- Programación diaria ---------------------------------------------------

function toSqlUtc(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

function localTodayStartUtcSql(offsetMin: number): string {
  const shifted = new Date(Date.now() + offsetMin * 60000)
  const midUtcMs = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - offsetMin * 60000
  return toSqlUtc(new Date(midUtcMs))
}

/** Genera `count` horarios repartidos entre la hora de inicio y fin (en hora local). */
export function buildSlots(count: number): Date[] {
  const offsetMin = settingInt('tz_offset_minutes', -360)
  const startH = settingInt('schedule_start_hour', 8)
  const endH = settingInt('schedule_end_hour', 24)
  const shifted = new Date(Date.now() + offsetMin * 60000)
  const Y = shifted.getUTCFullYear(), M = shifted.getUTCMonth(), D = shifted.getUTCDate()
  const curMin = shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
  const startMin = Math.max(startH * 60, curMin + 5)
  const endMin = endH * 60
  if (count <= 0 || startMin >= endMin) return []
  const span = endMin - startMin
  const midUtcMs = Date.UTC(Y, M, D) - offsetMin * 60000
  const slots: Date[] = []
  let prev = startMin - 1
  for (let i = 0; i < count; i++) {
    const base = startMin + Math.floor((span * (i + 0.5)) / count)
    const gap = span / count
    const jitter = Math.floor((Math.random() - 0.5) * Math.min(14, gap))
    let mm = Math.min(endMin - 1, Math.max(prev + 1, base + jitter))
    prev = mm
    slots.push(new Date(midUtcMs + mm * 60000))
  }
  return slots
}

export function scheduleDaily(limit?: number): CycleStats {
  const stats = emptyStats()
  const runId = startRun('schedule')
  const logs: string[] = []
  try {
    const offsetMin = settingInt('tz_offset_minutes', -360)
    const dailyLimit = Math.min(
      limit ?? settingInt('daily_limit', 20),
      settingInt('max_daily_limit', 50)
    )
    const todayStart = localTodayStartUtcSql(offsetMin)
    const usedRow = db().prepare(`
      SELECT
        (SELECT COUNT(*) FROM auto_import_queue WHERE status='scheduled') AS scheduled,
        (SELECT COUNT(*) FROM auto_import_queue WHERE status='published' AND published_at >= ?) AS published
    `).get(todayStart) as { scheduled: number; published: number }
    const used = (usedRow.scheduled || 0) + (usedRow.published || 0)
    const remaining = Math.max(0, dailyLimit - used)
    if (remaining === 0) {
      logs.push(`Cupo diario completo (${used}/${dailyLimit})`)
      finishRun(runId, 'ok', { ...stats, log: logs.join('\n') })
      return stats
    }

    const rows = db().prepare(
      `SELECT id FROM auto_import_queue WHERE status='rewritten' ORDER BY id ASC LIMIT ?`
    ).all(remaining) as Array<{ id: number }>
    const slots = buildSlots(rows.length)
    if (slots.length === 0) {
      logs.push('Sin ventana horaria disponible hoy')
      finishRun(runId, 'ok', { ...stats, log: logs.join('\n') })
      return stats
    }

    const update = db().prepare(
      `UPDATE auto_import_queue SET status='scheduled', scheduled_at=?, updated_at=datetime('now') WHERE id=?`
    )
    const tx = db().transaction(() => {
      for (let i = 0; i < slots.length && i < rows.length; i++) {
        update.run(toSqlUtc(slots[i]), rows[i].id)
        stats.scheduled++
      }
    })
    tx()
    logs.push(`Programados ${stats.scheduled} (cupo ${used + stats.scheduled}/${dailyLimit})`)
    finishRun(runId, 'ok', { ...stats, log: logs.join('\n') })
    return stats
  } catch (err) {
    logs.push(`ERROR: ${err instanceof Error ? err.message : String(err)}`)
    finishRun(runId, 'error', { ...stats, log: logs.join('\n') })
    throw err
  }
}

// ---- Publicación de vencidos ----------------------------------------------

export async function publishDue(): Promise<CycleStats> {
  const stats = emptyStats()
  const runId = startRun('publish-due')
  const logs: string[] = []
  const publisher = new Publisher({ dbPath: migrationDbPath() })
  try {
    const maxPerRun = settingInt('max_per_run', 3)
    const status = (getSetting('publish_status') as 'publish' | 'draft') || 'publish'
    const rows = db().prepare(`
      SELECT * FROM auto_import_queue
      WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= datetime('now')
      ORDER BY scheduled_at ASC LIMIT ?
    `).all(maxPerRun) as QueueRow[]

    const setPublished = db().prepare(`
      UPDATE auto_import_queue
      SET status='published', created_post_id=?, published_at=datetime('now'), error_message=NULL, updated_at=datetime('now')
      WHERE id=?
    `)
    const setSkipped = db().prepare(`
      UPDATE auto_import_queue SET status='skipped', created_post_id=?, error_message=?, updated_at=datetime('now') WHERE id=?
    `)
    const setFailed = db().prepare(`
      UPDATE auto_import_queue SET status='failed', error_message=?, updated_at=datetime('now') WHERE id=?
    `)

    for (const row of rows) {
      if (!row.ai_title || !row.ai_description) {
        setFailed.run('Sin título/descripción IA', row.id)
        stats.failed++
        continue
      }
      const video: VideoResult = {
        sourceId: row.source_id as SourceId,
        videoId: row.source_video_id,
        url: row.source_url,
        title: row.ai_title,
        duration: row.duration,
        thumbnail: row.thumbnail_url || '',
        embedUrl: row.embed_url,
        tags: JSON.parse(row.tags_json || '[]'),
        description: row.ai_description,
      }
      try {
        const result = await publisher.importVideo(video, {
          categorySlug: row.category_slug || getSetting('default_category'),
          postStatus: status,
          downloadThumbnail: true,
        })
        if (result.status === 'created') {
          patchExcerpt(result.postId, row.ai_description)
          setPublished.run(result.postId, row.id)
          stats.published++
          logs.push(`#${row.id} → post ${result.postId} (${result.slug})`)
        } else {
          setSkipped.run(result.postId, 'Duplicado en migration.db', row.id)
          logs.push(`#${row.id} duplicado → post ${result.postId}`)
        }
      } catch (err) {
        setFailed.run(err instanceof Error ? err.message : String(err), row.id)
        stats.failed++
        logs.push(`#${row.id} falló: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    finishRun(runId, 'ok', { ...stats, log: logs.join('\n') })
    return stats
  } catch (err) {
    logs.push(`ERROR: ${err instanceof Error ? err.message : String(err)}`)
    finishRun(runId, 'error', { ...stats, log: logs.join('\n') })
    throw err
  } finally {
    publisher.close()
  }
}

// ---- Ciclo completo --------------------------------------------------------

export async function fullCycle(): Promise<CycleStats> {
  const total = emptyStats()
  const d = await discover()
  const r = await rewritePending()
  const s = scheduleDaily()
  for (const part of [d, r, s]) {
    total.candidates_found += part.candidates_found
    total.queued += part.queued
    total.rewritten += part.rewritten
    total.scheduled += part.scheduled
    total.failed += part.failed
  }
  return total
}

// ---- Reparación de posts existentes ---------------------------------------

const BAD_TITLE = /\\n|\\r|\n|\r|Ã|Â|&amp;|&quot;|&#\d+;/

export async function repairExisting(limit = 20): Promise<{ scanned: number; repaired: number; failed: number; log: string[] }> {
  const out = { scanned: 0, repaired: 0, failed: 0, log: [] as string[] }
  const model = getSetting('ai_model')
  const prompt = getSetting('ai_prompt')
  const cdb = openCatalogAdmin()
  try {
    const candidates = cdb.prepare(`
      SELECT id, post_title, post_excerpt
      FROM posts
      WHERE post_type='post' AND post_status='publish'
      ORDER BY id DESC LIMIT 2000
    `).all() as Array<{ id: number; post_title: string; post_excerpt: string }>

    const targets = candidates.filter(p => {
      const t = p.post_title || ''
      const upper = t.replace(/[^A-Za-z]/g, '')
      const shouting = upper.length > 8 && upper === upper.toUpperCase() && /[A-Z]{6,}/.test(t)
      return BAD_TITLE.test(t) || t.length > 120 || shouting
    }).slice(0, limit)

    const history = db().prepare(`
      INSERT INTO ai_rewrite_history(post_id, old_title, new_title, old_description, new_description, model)
      VALUES(?, ?, ?, ?, ?, ?)
    `)
    const updatePost = cdb.prepare(`
      UPDATE posts SET post_title=?, post_excerpt=?, post_modified=datetime('now'), post_modified_gmt=datetime('now') WHERE id=?
    `)

    for (const p of targets) {
      out.scanned++
      try {
        const result = await rewriteEditorial(
          { originalTitle: cleanText(p.post_title), source: 'repair' },
          { model, prompt }
        )
        const tCheck = checkTitle(result.title)
        const dCheck = checkDescription(result.description)
        if (!tCheck.ok || !dCheck.ok) {
          out.failed++
          out.log.push(`#${p.id} omitido: ${[...tCheck.reasons, ...dCheck.reasons].join('; ')}`)
          continue
        }
        updatePost.run(result.title, result.description, p.id)
        history.run(p.id, p.post_title, result.title, p.post_excerpt || '', result.description, result.model)
        out.repaired++
        out.log.push(`#${p.id} reparado`)
      } catch (err) {
        out.failed++
        out.log.push(`#${p.id} error: ${err instanceof Error ? err.message : String(err)}`)
      }
      await sleep(400)
    }
    return out
  } finally {
    cdb.close()
  }
}

// ---- Consultas de cola para el panel --------------------------------------

export interface QueueQuery {
  status?: string
  search?: string
  limit?: number
  offset?: number
}

export function listQueue(q: QueueQuery = {}): { rows: QueueRow[]; total: number; counts: Record<string, number> } {
  const where: string[] = []
  const params: unknown[] = []
  if (q.status && q.status !== 'all') {
    where.push('status=?')
    params.push(q.status)
  }
  if (q.search) {
    where.push('(original_title LIKE ? OR ai_title LIKE ?)')
    params.push(`%${q.search}%`, `%${q.search}%`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const limit = Math.min(q.limit ?? 100, 300)
  const offset = q.offset ?? 0
  const rows = db().prepare(
    `SELECT * FROM auto_import_queue ${whereSql} ORDER BY
       CASE status WHEN 'scheduled' THEN 0 WHEN 'rewritten' THEN 1 WHEN 'candidate' THEN 2 ELSE 3 END,
       COALESCE(scheduled_at, updated_at) DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset) as QueueRow[]
  const total = (db().prepare(`SELECT COUNT(*) AS n FROM auto_import_queue ${whereSql}`).get(...params) as { n: number }).n
  const countRows = db().prepare(`SELECT status, COUNT(*) AS n FROM auto_import_queue GROUP BY status`).all() as Array<{ status: string; n: number }>
  const counts: Record<string, number> = {}
  for (const c of countRows) counts[c.status] = c.n
  return { rows, total, counts }
}

// ---- Acciones por fila -----------------------------------------------------

function getRow(id: number): QueueRow | undefined {
  return db().prepare(`SELECT * FROM auto_import_queue WHERE id=?`).get(id) as QueueRow | undefined
}

export async function regenerateOne(id: number): Promise<{ ok: boolean; message: string }> {
  const row = getRow(id)
  if (!row) return { ok: false, message: 'No existe' }
  const result = await rewriteEditorial(
    {
      originalTitle: cleanText(row.original_title),
      source: row.source_id,
      tags: JSON.parse(row.tags_json || '[]'),
      durationMinutes: row.duration,
    },
    { model: getSetting('ai_model'), prompt: getSetting('ai_prompt') }
  )
  const tCheck = checkTitle(result.title)
  const dCheck = checkDescription(result.description)
  const reasons = [...tCheck.reasons, ...dCheck.reasons]
  db().prepare(`
    UPDATE auto_import_queue
    SET ai_title=?, ai_description=?, ai_model=?, ai_prompt_version=?,
        status=?, error_message=?, quality_score=?, scheduled_at=NULL, updated_at=datetime('now')
    WHERE id=?
  `).run(
    result.title, result.description, result.model, PROMPT_VERSION,
    reasons.length ? 'needs_review' : 'rewritten',
    reasons.join('; ') || null, reasons.length ? 0 : 100, id
  )
  return { ok: reasons.length === 0, message: reasons.length ? reasons.join('; ') : 'Reescrito' }
}

export function editRow(id: number, fields: { ai_title?: string; ai_description?: string; category_slug?: string }): { ok: boolean; message: string } {
  const row = getRow(id)
  if (!row) return { ok: false, message: 'No existe' }
  const title = fields.ai_title !== undefined ? deShout(cleanText(fields.ai_title)) : row.ai_title
  const description = fields.ai_description !== undefined ? cleanText(fields.ai_description) : row.ai_description
  const category = fields.category_slug !== undefined ? fields.category_slug : row.category_slug
  const reasons = [
    ...(title ? checkTitle(title).reasons : ['sin título']),
    ...(description ? checkDescription(description).reasons : ['sin descripción']),
  ]
  db().prepare(`
    UPDATE auto_import_queue
    SET ai_title=?, ai_description=?, category_slug=?, status=?, error_message=?, updated_at=datetime('now')
    WHERE id=?
  `).run(title, description, category, reasons.length ? 'needs_review' : 'rewritten', reasons.join('; ') || null, id)
  return { ok: reasons.length === 0, message: reasons.length ? reasons.join('; ') : 'Guardado' }
}

export function setRowStatus(id: number, status: QueueRow['status']): void {
  db().prepare(`UPDATE auto_import_queue SET status=?, updated_at=datetime('now') WHERE id=?`).run(status, id)
}

export function deleteRow(id: number): void {
  db().prepare(`DELETE FROM auto_import_queue WHERE id=?`).run(id)
}

export function clearFailed(): number {
  const info = db().prepare(`DELETE FROM auto_import_queue WHERE status IN ('failed','skipped')`).run()
  return info.changes
}

/** Re-valida los needs_review con las reglas actuales y promueve los que ya pasan
 *  (sin volver a llamar a la IA: reutiliza el ai_title/ai_description guardado). */
export function revalidateReview(): number {
  const rows = db().prepare(
    `SELECT id, ai_title, ai_description FROM auto_import_queue
     WHERE status='needs_review' AND ai_title IS NOT NULL AND ai_description IS NOT NULL`
  ).all() as Array<{ id: number; ai_title: string; ai_description: string }>
  const upd = db().prepare(`
    UPDATE auto_import_queue SET status='rewritten', error_message=NULL, quality_score=100, updated_at=datetime('now')
    WHERE id=?
  `)
  let promoted = 0
  db().transaction(() => {
    for (const r of rows) {
      if (checkTitle(r.ai_title).ok && checkDescription(r.ai_description).ok) {
        upd.run(r.id)
        promoted++
      }
    }
  })()
  return promoted
}

export function retryFailed(): number {
  const info = db().prepare(`
    UPDATE auto_import_queue SET status='rewritten', error_message=NULL, scheduled_at=NULL, updated_at=datetime('now')
    WHERE status='failed' AND ai_title IS NOT NULL AND ai_description IS NOT NULL
  `).run()
  return info.changes
}

export async function publishOne(id: number): Promise<{ ok: boolean; message: string; postId?: number }> {
  const row = getRow(id)
  if (!row) return { ok: false, message: 'No existe' }
  if (!row.ai_title || !row.ai_description) return { ok: false, message: 'Falta título/descripción IA' }
  const status = (getSetting('publish_status') as 'publish' | 'draft') || 'publish'
  const publisher = new Publisher({ dbPath: migrationDbPath() })
  try {
    const video: VideoResult = {
      sourceId: row.source_id as SourceId,
      videoId: row.source_video_id,
      url: row.source_url,
      title: row.ai_title,
      duration: row.duration,
      thumbnail: row.thumbnail_url || '',
      embedUrl: row.embed_url,
      tags: JSON.parse(row.tags_json || '[]'),
      description: row.ai_description,
    }
    const result = await publisher.importVideo(video, {
      categorySlug: row.category_slug || getSetting('default_category'),
      postStatus: status,
      downloadThumbnail: true,
    })
    if (result.status === 'created') {
      patchExcerpt(result.postId, row.ai_description)
      db().prepare(`
        UPDATE auto_import_queue SET status='published', created_post_id=?, published_at=datetime('now'),
          error_message=NULL, updated_at=datetime('now') WHERE id=?
      `).run(result.postId, id)
      return { ok: true, message: `Publicado (post ${result.postId})`, postId: result.postId }
    }
    db().prepare(`
      UPDATE auto_import_queue SET status='skipped', created_post_id=?, error_message='Duplicado', updated_at=datetime('now') WHERE id=?
    `).run(result.postId, id)
    return { ok: false, message: `Duplicado de post ${result.postId}`, postId: result.postId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    db().prepare(`UPDATE auto_import_queue SET status='failed', error_message=?, updated_at=datetime('now') WHERE id=?`).run(msg, id)
    return { ok: false, message: msg }
  } finally {
    publisher.close()
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getDashboard() {
  return { settings: getSettings(), ...listQueue({ limit: 150 }) }
}
