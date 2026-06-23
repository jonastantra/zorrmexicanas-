#!/usr/bin/env node
// Poda de posts no-canónicos en migration.db, preservando el SEO.
//
// Qué hace:
//   1. Crea un backup <db>.backup-<timestamp> antes de tocar nada.
//   2. Rellena la tabla `redirects` con los 301 (slug duplicado -> canónico)
//      que aún no estuvieran, leyéndolos de post_duplicate_groups.
//   3. Borra todos los posts no-canónicos y sus filas hijas
//      (post_metadata, term_relationships, embeds, post_duplicate_groups).
//   4. VACUUM para compactar el archivo.
//
// Requisito previo: desplegar el código que resuelve getCanonicalForSlug desde
// la tabla `redirects` (ya incluido). Sin eso, los 301 dejarían de funcionar.
//
// Uso:
//   node scripts/prune-noncanonical.mjs /data/migration.db
//   node scripts/prune-noncanonical.mjs /data/migration.db --dry-run
import Database from 'better-sqlite3'
import fs from 'fs'

const dbPath = process.argv[2] || process.env.MIGRATION_DB_PATH
const dryRun = process.argv.includes('--dry-run')
if (!dbPath) {
  console.error('Falta la ruta de la DB. Uso: node prune-noncanonical.mjs <db> [--dry-run]')
  process.exit(1)
}
const sizeMB = (p) => (fs.statSync(p).size / 1048576).toFixed(0)

console.log(`DB: ${dbPath}  (${sizeMB(dbPath)} MB)`)
if (!dryRun) {
  const backup = `${dbPath}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`
  fs.copyFileSync(dbPath, backup)
  console.log(`Backup creado: ${backup}`)
}

const db = new Database(dbPath)
db.pragma('foreign_keys = OFF')
db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 60000')
const n = (s) => db.prepare(s).get().n

// 1. Backfill de redirects
const rows = db.prepare(`
  SELECT dup.post_name AS src, can.id AS can_id, can.post_name AS tgt, can.post_date AS can_date
  FROM posts dup
  JOIN post_duplicate_groups d0 ON d0.post_id=dup.id AND d0.is_canonical=0
  JOIN post_duplicate_groups d1 ON d1.group_id=d0.group_id AND d1.is_canonical=1
  JOIN canonical_posts cp ON cp.post_id=d1.post_id
  JOIN posts can ON can.id=d1.post_id
  WHERE dup.post_status='publish' AND dup.post_type='post'
`).all()
const best = new Map()
for (const r of rows) {
  if (!r.src || !r.tgt || r.src === r.tgt) continue
  const cur = best.get(r.src)
  if (!cur || r.can_date < cur.can_date || (r.can_date === cur.can_date && r.can_id < cur.can_id))
    best.set(r.src, { tgt: r.tgt, can_date: r.can_date, can_id: r.can_id })
}
const ins = db.prepare(`
  INSERT INTO redirects(source_url, target_url, status_code, reason, created_at)
  SELECT ?, ?, 301, 'prune_backfill', datetime('now')
  WHERE NOT EXISTS (SELECT 1 FROM redirects WHERE source_url=?)`)
let added = 0
db.transaction(() => {
  for (const [src, { tgt }] of best) added += ins.run('/' + src, '/' + tgt, '/' + src).changes
})()
console.log(`Redirects: ${best.size} mapeos reales, ${added} nuevos insertados, total ${n('SELECT COUNT(*) n FROM redirects')}`)

if (dryRun) {
  console.log('\n[DRY-RUN] No se borró nada. Filas que se eliminarían:')
  console.log('  posts no-canónicos:', n(`SELECT COUNT(*) n FROM posts WHERE NOT EXISTS (SELECT 1 FROM canonical_posts cp WHERE cp.post_id=posts.id)`))
  db.close()
  process.exit(0)
}

// 2. Prune
console.log('Podando...')
db.transaction(() => {
  db.prepare(`DELETE FROM post_metadata WHERE NOT EXISTS (SELECT 1 FROM canonical_posts cp WHERE cp.post_id=post_metadata.post_id)`).run()
  db.prepare(`DELETE FROM term_relationships WHERE NOT EXISTS (SELECT 1 FROM canonical_posts cp WHERE cp.post_id=term_relationships.object_id)`).run()
  db.prepare(`DELETE FROM embeds WHERE NOT EXISTS (SELECT 1 FROM canonical_posts cp WHERE cp.post_id=embeds.post_id)`).run()
  db.prepare(`DELETE FROM post_duplicate_groups`).run()
  db.prepare(`DELETE FROM posts WHERE NOT EXISTS (SELECT 1 FROM canonical_posts cp WHERE cp.post_id=posts.id)`).run()
})()
console.log('Checkpoint + VACUUM...')
db.pragma('wal_checkpoint(TRUNCATE)')
db.exec('VACUUM')

console.log(`\nListo. canónicos=${n('SELECT COUNT(*) n FROM canonical_posts')}, posts=${n('SELECT COUNT(*) n FROM posts')}, redirects=${n('SELECT COUNT(*) n FROM redirects')}`)
db.close()
console.log(`Tamaño final: ${sizeMB(dbPath)} MB`)
