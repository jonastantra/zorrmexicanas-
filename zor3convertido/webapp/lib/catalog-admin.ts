import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { MIGRATION_SCHEMA_SQL } from './migration-schema'

const DB_PATH = process.env.MIGRATION_DB_PATH ||
  'C:/Users/retro/OneDrive/Documentos/zorritasmexicanas/_migration_workspace/state/migration.db'

export function openCatalogAdmin() {
  fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true })
  const db = new Database(path.resolve(DB_PATH))
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 10000')
  return db
}

// Crea el esquema vacío si la base es nueva (no existe la tabla `posts`). Esto
// permite que un sitio nuevo (LobasMexicanas) arranque con una base vacía y el
// publicador automático la vaya llenando. En un sitio existente no hace nada.
let schemaEnsured = false
export function ensureCatalogSchema(): void {
  if (schemaEnsured) return
  schemaEnsured = true
  const db = openCatalogAdmin()
  try {
    const hasPosts = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='posts'"
    ).get()
    if (!hasPosts) {
      console.log('[catalog] base nueva: creando esquema vacío…')
      db.exec(MIGRATION_SCHEMA_SQL)
      console.log('[catalog] esquema creado')
    }
  } catch (err) {
    console.error('[catalog] no se pudo crear el esquema:', err instanceof Error ? err.message : err)
  } finally {
    db.close()
  }
}

// La migration.db importada no trae estadísticas (sqlite_stat1), así que el
// planificador de SQLite elige índices a ciegas y puede escanear cientos de
// miles de filas. Correr ANALYZE una vez crea esas estadísticas (persisten en
// el archivo, en /data) y arregla la elección de índices para todas las
// consultas. Idempotente: si ya existen estadísticas, no hace nada.
let statsEnsured = false
export function ensureCatalogStats(): void {
  if (statsEnsured) return
  statsEnsured = true
  const db = openCatalogAdmin()
  try {
    const has = db.prepare("SELECT 1 FROM sqlite_master WHERE name='sqlite_stat1'").get()
    if (!has) {
      console.log('[catalog] ANALYZE inicial (una sola vez)…')
      const t = Date.now()
      db.exec('ANALYZE')
      console.log(`[catalog] ANALYZE completado en ${Date.now() - t}ms`)
    }
  } catch (err) {
    console.error('[catalog] ANALYZE falló:', err instanceof Error ? err.message : err)
  } finally {
    db.close()
  }
}

export function setPostMeta(db: Database.Database, postId: number, key: string, value: string) {
  const row = db.prepare(`
    SELECT id FROM post_metadata WHERE post_id=? AND meta_key=? ORDER BY id LIMIT 1
  `).get(postId, key) as { id: number } | undefined
  if (row) {
    db.prepare(`UPDATE post_metadata SET meta_value=? WHERE id=?`).run(value, row.id)
    db.prepare(`DELETE FROM post_metadata WHERE post_id=? AND meta_key=? AND id<>?`).run(postId, key, row.id)
  } else {
    db.prepare(`INSERT INTO post_metadata(post_id,meta_key,meta_value) VALUES(?,?,?)`).run(postId, key, value)
  }
}
