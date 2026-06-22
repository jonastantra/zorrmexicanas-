import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = process.env.MIGRATION_DB_PATH ||
  'C:/Users/retro/OneDrive/Documentos/zorritasmexicanas/_migration_workspace/state/migration.db'

export function openCatalogAdmin() {
  const db = new Database(path.resolve(DB_PATH))
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 10000')
  return db
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
