import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const RUNTIME_DB_PATH = process.env.RUNTIME_DB_PATH ||
  path.join(process.cwd(), 'data', 'site-runtime.db')

let runtimeDb: Database.Database | null = null

export function getRuntimeDb() {
  if (runtimeDb) return runtimeDb
  fs.mkdirSync(path.dirname(RUNTIME_DB_PATH), { recursive: true })
  runtimeDb = new Database(RUNTIME_DB_PATH)
  runtimeDb.pragma('journal_mode = WAL')
  runtimeDb.pragma('busy_timeout = 5000')
  runtimeDb.exec(`
    CREATE TABLE IF NOT EXISTS post_metrics(
      post_id INTEGER PRIMARY KEY,
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      dislikes INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS visitor_actions(
      action_key TEXT PRIMARY KEY,
      post_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS site_settings(
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ad_slots(
      slot_key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      html TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS homepage_blocks(
      block_key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      block_type TEXT NOT NULL,
      category_slug TEXT,
      item_limit INTEGER NOT NULL DEFAULT 8,
      position INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO ad_slots(slot_key,label) VALUES
      ('header','Cabecera'),
      ('below_player','Debajo del reproductor'),
      ('sidebar_top','Barra lateral superior'),
      ('sidebar_bottom','Barra lateral inferior'),
      ('between_related','Entre videos relacionados'),
      ('footer','Pie de página');
    INSERT OR IGNORE INTO homepage_blocks(block_key,title,block_type,item_limit,position) VALUES
      ('trending','Tendencias','trending',8,10),
      ('latest','Recién agregados','latest',24,20),
      ('popular','Más vistos','popular',8,30),
      ('random','Descubre más','random',8,40);
  `)
  return runtimeDb
}

export function getPostMetrics(postId: number) {
  return getRuntimeDb().prepare(`
    SELECT views, likes, dislikes, shares FROM post_metrics WHERE post_id=?
  `).get(postId) as { views: number; likes: number; dislikes: number; shares: number } | undefined
}

export function getAdSlot(slot: string) {
  return getRuntimeDb().prepare(`
    SELECT slot_key, label, html, enabled FROM ad_slots WHERE slot_key=?
  `).get(slot) as { slot_key: string; label: string; html: string; enabled: number } | undefined
}
