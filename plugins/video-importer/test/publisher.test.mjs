import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { Publisher } from '../dist/index.js'

function createDatabase(file) {
  const db = new Database(file)
  db.exec(`
    CREATE TABLE posts(id INTEGER PRIMARY KEY, post_author INTEGER, post_date TEXT, post_date_gmt TEXT,
      post_content TEXT, post_title TEXT, post_excerpt TEXT, post_status TEXT, comment_status TEXT,
      ping_status TEXT, post_name TEXT, post_modified TEXT, post_modified_gmt TEXT, post_parent INTEGER,
      guid TEXT, menu_order INTEGER, post_type TEXT, post_mime_type TEXT, comment_count INTEGER);
    CREATE TABLE post_metadata(id INTEGER PRIMARY KEY, post_id INTEGER, meta_key TEXT, meta_value TEXT);
    CREATE TABLE embeds(id INTEGER PRIMARY KEY, post_id INTEGER, source_field TEXT, raw_value TEXT,
      normalized_url TEXT, domain TEXT, external_id TEXT, iframe_html TEXT, status TEXT);
    CREATE TABLE canonical_posts(post_id INTEGER PRIMARY KEY);
    CREATE TABLE terms(id INTEGER PRIMARY KEY, name TEXT, slug TEXT UNIQUE, term_group INTEGER);
    CREATE TABLE term_taxonomy(tt_id INTEGER PRIMARY KEY, term_id INTEGER, taxonomy TEXT,
      description TEXT, parent INTEGER, count INTEGER);
    CREATE TABLE term_relationships(object_id INTEGER, term_taxonomy_id INTEGER, term_order INTEGER,
      UNIQUE(object_id, term_taxonomy_id));
    CREATE TABLE local_thumbnails(post_id INTEGER PRIMARY KEY, file_name TEXT, source TEXT,
      status TEXT, updated_at TEXT);
  `)
  db.close()
}

const video = {
  sourceId: 'xvideos',
  videoId: '123',
  title: 'Video de prueba',
  url: 'https://www.xvideos.com/video.123/demo',
  duration: 8,
  thumbnail: 'https://cdn.example.com/thumb.jpg',
  embedUrl: 'https://flashservice.xvideos.com/embedframe/123',
  tags: ['prueba'],
}

test('publica y detecta el duplicado sin duplicar filas', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-importer-'))
  const file = path.join(dir, 'catalog.db')
  createDatabase(file)
  const publisher = new Publisher({ dbPath: file })
  const first = await publisher.importVideo(video, { postStatus: 'draft' })
  const second = await publisher.importVideo(video, { postStatus: 'draft' })
  publisher.close()

  assert.equal(first.status, 'created')
  assert.equal(second.status, 'duplicate')
  const db = new Database(file, { readonly: true })
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM posts').get().total, 1)
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM canonical_posts').get().total, 0)
  assert.equal(db.prepare("SELECT meta_value FROM post_metadata WHERE meta_key='video_source'").get().meta_value, 'xvideos')
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
