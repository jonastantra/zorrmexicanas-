import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(
  process.env.MIGRATION_DB_PATH ||
    'C:/Users/retro/OneDrive/Documentos/zorritasmexicanas/_migration_workspace/state/migration.db'
)

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`SQLite DB not found at ${DB_PATH}`)
  }
  _db = new Database(DB_PATH, { readonly: true, fileMustExist: true })
  _db.pragma('journal_mode = WAL')
  _db.pragma('cache_size = -64000') // 64MB cache
  return _db
}

// Convert async query into a sync style used by Next.js
export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const row = getDb().prepare(sql).get(...params)
  return (row as T) ?? null
}

export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  return getDb().prepare(sql).all(...params) as T[]
}

export function queryValue<T = any>(sql: string, params: any[] = []): T | null {
  const row = getDb().prepare(sql).get(...params) as any
  if (!row) return null
  const keys = Object.keys(row)
  return (row[keys[0]] as T) ?? null
}