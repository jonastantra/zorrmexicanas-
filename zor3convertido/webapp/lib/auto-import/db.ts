// Esquema y accesores de la cola editorial automática.
// Vive en site-runtime.db (estado operativo), separado de migration.db (contenido publicado).
import type Database from 'better-sqlite3'
import { getRuntimeDb } from '@/lib/runtime-db'

export const DEFAULT_PROMPT = `Actúa como editor SEO humano para un sitio adulto mexicano. Reescribe el título y la descripción en español natural de México, con intención de búsqueda clara y estilo atractivo, no robótico.

Corrige errores de acentos, mojibake, saltos de línea, caracteres raros, HTML entities, mayúsculas excesivas, palabras cortadas y traducciones malas.

No copies el título original: úsalo solo como referencia para entender la escena. Crea un título NUEVO de 45 a 90 caracteres, con voz humana mexicana, como si lo escribiera un editor con calle y no una plantilla.

Métele salsa: arranca por lo más llamativo de la escena (qué pasa, dónde, con quién, la reacción) y usa un tono coloquial, caliente y con gancho, sin sonar a robot. VARÍA la estructura entre un título y otro: no empieces todos igual ni repitas las mismas palabras. Juega con recursos como una pausa con coma o dos puntos, una mini-frase de gancho al final, o un detalle concreto (el lugar, la situación, lo que se le antoja, que casi los cachan, etc.).

Usa español mexicano natural; puedes meter expresiones como "bien rico", "a escondidas", "sin que la cachen", "se le antojó", "no aguantó" cuando encajen, sin abusar de los modismos.

Incluye de forma natural y SOLO si encaja algún término como mexicana, amateur, casero, latina, pareja, motel o colegiala. Nunca metas la lista completa ni fuerces palabras de relleno.

Evita títulos planos y clonados como:
- Video amateur mexicano
- Mexicana caliente
- Latina en video casero
- Porno casero
Cada título debe sentirse distinto y específico de ESA escena, como un buen titular hecho a mano.

La descripción debe tener entre 230 y 320 caracteres. Debe sonar natural, descriptiva y útil para SEO. Resume la escena sin exagerar, sin repetir el título y sin parecer spam. Usa español mexicano claro.

Todo el contenido es entre adultos. NUNCA menciones ni insinúes menores de edad, edades de menores, coerción, violencia sexual, violación ni abuso. Si el título original sugiere algo de eso, conviértelo en una versión legal y genérica entre adultos. La temática de roles (madrastra, padrastro, etc.) sí está permitida siempre que sean claramente adultos.

No uses emojis, hashtags, comillas, clickbait extremo ni frases artificiales.

Devuelve SOLO JSON válido con estas claves exactas:
{"title":"...","description":"..."}`

export const DEFAULT_SETTINGS: Record<string, string> = {
  enabled: 'true',
  daily_limit: '20',
  max_daily_limit: '50',
  max_per_run: '3',
  schedule_start_hour: '8',
  schedule_end_hour: '24',
  tz_offset_minutes: '-360', // CDMX (UTC-6)
  default_category: 'amateur-casero-mexicana',
  keywords: 'mexicana amateur,porno mexicano,casero mexicano,latina amateur,amateur casero mexicana',
  source_id: 'xvideos',
  page_count: '3',
  max_candidates_per_run: '120',
  rewrite_batch: '40',
  ai_enabled: 'true',
  ai_model: 'qwen/qwen-2.5-72b-instruct',
  ai_prompt: DEFAULT_PROMPT,
  publish_status: 'publish',
  auto_scheduler: 'true', // scheduler interno: ciclo diario + publicar vencidos
  auto_improve: 'true', // mejora masiva diaria de posts canónicos viejos, automática
  improve_daily_batch: '150', // cuántos posts viejos mejora por día el scheduler
  fix_retries: '2', // reintentos en que la IA corrige su propio texto antes de ir a revisión
}

export type QueueStatus =
  | 'candidate' | 'rewritten' | 'scheduled' | 'published'
  | 'failed' | 'skipped' | 'needs_review'

export interface QueueRow {
  id: number
  source_id: string
  source_video_id: string
  source_url: string
  embed_url: string
  thumbnail_url: string | null
  local_thumbnail: string | null
  original_title: string
  ai_title: string | null
  ai_description: string | null
  category_slug: string | null
  tags_json: string | null
  duration: number
  status: QueueStatus
  quality_score: number
  scheduled_at: string | null
  published_at: string | null
  created_post_id: number | null
  error_message: string | null
  ai_model: string | null
  ai_prompt_version: string | null
  created_at: string
  updated_at: string
}

let schemaReady = false

export function ensureAutoImportSchema(db: Database.Database): void {
  if (schemaReady) return
  db.exec(`
    CREATE TABLE IF NOT EXISTS auto_import_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      source_video_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      embed_url TEXT NOT NULL,
      thumbnail_url TEXT,
      local_thumbnail TEXT,
      original_title TEXT NOT NULL,
      ai_title TEXT,
      ai_description TEXT,
      category_slug TEXT,
      tags_json TEXT,
      duration INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'candidate',
      quality_score INTEGER DEFAULT 0,
      scheduled_at TEXT,
      published_at TEXT,
      created_post_id INTEGER,
      error_message TEXT,
      ai_model TEXT,
      ai_prompt_version TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_id, source_video_id),
      UNIQUE(embed_url)
    );
    CREATE INDEX IF NOT EXISTS idx_aiq_status ON auto_import_queue(status);
    CREATE INDEX IF NOT EXISTS idx_aiq_scheduled ON auto_import_queue(scheduled_at);

    CREATE TABLE IF NOT EXISTS auto_import_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auto_import_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_type TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT,
      candidates_found INTEGER DEFAULT 0,
      queued INTEGER DEFAULT 0,
      rewritten INTEGER DEFAULT 0,
      scheduled INTEGER DEFAULT 0,
      published INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      log TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_rewrite_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER,
      old_title TEXT,
      new_title TEXT,
      old_description TEXT,
      new_description TEXT,
      model TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `)
  schemaReady = true
}

export function db(): Database.Database {
  const conn = getRuntimeDb()
  ensureAutoImportSchema(conn)
  return conn
}

// ---- Settings -------------------------------------------------------------

export function getSettings(): Record<string, string> {
  const rows = db().prepare(`SELECT key, value FROM auto_import_settings`).all() as
    Array<{ key: string; value: string }>
  const stored: Record<string, string> = {}
  for (const r of rows) stored[r.key] = r.value
  return { ...DEFAULT_SETTINGS, ...stored }
}

export function getSetting(key: string): string {
  return getSettings()[key] ?? ''
}

export function setSettings(values: Record<string, string>): void {
  const stmt = db().prepare(`
    INSERT INTO auto_import_settings(key, value, updated_at)
    VALUES(?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
  `)
  const tx = db().transaction((entries: Array<[string, string]>) => {
    for (const [k, v] of entries) stmt.run(k, v)
  })
  tx(Object.entries(values))
}

export function settingInt(key: string, fallback: number): number {
  const n = parseInt(getSetting(key), 10)
  return Number.isFinite(n) ? n : fallback
}

export function settingBool(key: string): boolean {
  return getSetting(key) === 'true'
}

// ---- Runs -----------------------------------------------------------------

export function startRun(runType: string): number {
  const info = db().prepare(
    `INSERT INTO auto_import_runs(run_type, status) VALUES(?, 'running')`
  ).run(runType)
  return Number(info.lastInsertRowid)
}

export function finishRun(
  id: number,
  status: 'ok' | 'error',
  stats: Partial<Pick<QueueRow, never>> & {
    candidates_found?: number; queued?: number; rewritten?: number
    scheduled?: number; published?: number; failed?: number; log?: string
  }
): void {
  db().prepare(`
    UPDATE auto_import_runs SET
      status=?, finished_at=datetime('now'),
      candidates_found=?, queued=?, rewritten=?, scheduled=?, published=?, failed=?, log=?
    WHERE id=?
  `).run(
    status,
    stats.candidates_found ?? 0, stats.queued ?? 0, stats.rewritten ?? 0,
    stats.scheduled ?? 0, stats.published ?? 0, stats.failed ?? 0,
    stats.log ?? '', id
  )
}

export function listRuns(limit = 20) {
  return db().prepare(
    `SELECT * FROM auto_import_runs ORDER BY id DESC LIMIT ?`
  ).all(limit)
}
