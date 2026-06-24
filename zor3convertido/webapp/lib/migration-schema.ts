// Esquema (sin datos) de migration.db, extraído de la base original.
// Se usa para que un sitio NUEVO (p.ej. LobasMexicanas) cree su base vacía sola
// en el primer arranque. Todos los CREATE son idempotentes (IF NOT EXISTS).
export const MIGRATION_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS scan_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    config_json TEXT,
    script_version TEXT,
    started_at TEXT,
    finished_at TEXT,
    last_item_id INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    items_ok INTEGER DEFAULT 0,
    items_error INTEGER DEFAULT 0,
    error_message TEXT
);
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY,
    post_author INTEGER,
    post_date TEXT,
    post_date_gmt TEXT,
    post_content TEXT,
    post_title TEXT,
    post_excerpt TEXT,
    post_status TEXT,
    comment_status TEXT,
    ping_status TEXT,
    post_name TEXT,
    post_modified TEXT,
    post_modified_gmt TEXT,
    post_parent INTEGER,
    guid TEXT,
    menu_order INTEGER,
    post_type TEXT,
    post_mime_type TEXT,
    comment_count INTEGER
);
CREATE TABLE IF NOT EXISTS post_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    meta_key TEXT NOT NULL,
    meta_value TEXT,
    FOREIGN KEY (post_id) REFERENCES posts(id)
);
CREATE TABLE IF NOT EXISTS terms (
    id INTEGER PRIMARY KEY,
    name TEXT,
    slug TEXT,
    term_group INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS term_taxonomy (
    tt_id INTEGER PRIMARY KEY AUTOINCREMENT,
    term_id INTEGER NOT NULL,
    taxonomy TEXT NOT NULL,
    description TEXT,
    parent INTEGER DEFAULT 0,
    count INTEGER DEFAULT 0,
    FOREIGN KEY (term_id) REFERENCES terms(id)
);
CREATE TABLE IF NOT EXISTS term_relationships (
    object_id INTEGER NOT NULL,
    term_taxonomy_id INTEGER NOT NULL,
    term_order INTEGER DEFAULT 0,
    PRIMARY KEY (object_id, term_taxonomy_id)
);
CREATE TABLE IF NOT EXISTS media_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attachment_id INTEGER,
    file_path TEXT,
    url TEXT,
    width INTEGER,
    height INTEGER,
    size_bytes INTEGER,
    mime_type TEXT,
    checksum TEXT,
    file_exists INTEGER DEFAULT 0,
    status TEXT DEFAULT 'unknown'
);
CREATE TABLE IF NOT EXISTS media_duplicate_groups (
    group_id INTEGER NOT NULL,
    media_id INTEGER NOT NULL,
    is_canonical INTEGER DEFAULT 0,
    reason TEXT,
    PRIMARY KEY (group_id, media_id)
);
CREATE TABLE IF NOT EXISTS post_media (
    post_id INTEGER NOT NULL,
    media_id INTEGER NOT NULL,
    relationship_type TEXT DEFAULT 'thumbnail',
    confidence REAL DEFAULT 1.0,
    PRIMARY KEY (post_id, media_id, relationship_type),
    FOREIGN KEY (post_id) REFERENCES posts(id)
);
CREATE TABLE IF NOT EXISTS post_duplicate_groups (
    group_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    is_canonical INTEGER DEFAULT 0,
    duplicate_type TEXT,
    confidence REAL DEFAULT 1.0,
    reason TEXT,
    PRIMARY KEY (group_id, post_id)
);
CREATE TABLE IF NOT EXISTS embeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    source_field TEXT,
    raw_value TEXT,
    normalized_url TEXT,
    domain TEXT,
    external_id TEXT,
    iframe_html TEXT,
    status TEXT DEFAULT 'unchecked',
    http_status INTEGER,
    check_date TEXT,
    error_message TEXT,
    FOREIGN KEY (post_id) REFERENCES posts(id)
);
CREATE TABLE IF NOT EXISTS embed_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    embed_id INTEGER NOT NULL,
    checked_at TEXT,
    http_status INTEGER,
    error_message TEXT,
    response_time_ms INTEGER,
    FOREIGN KEY (embed_id) REFERENCES embeds(id)
);
CREATE TABLE IF NOT EXISTS thumbnail_candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    media_id INTEGER,
    candidate_type TEXT,
    confidence REAL DEFAULT 0.0,
    reason TEXT,
    approved INTEGER DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES posts(id)
);
CREATE TABLE IF NOT EXISTS errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phase TEXT,
    table_name TEXT,
    item_id INTEGER,
    error_type TEXT,
    error_message TEXT,
    raw_data TEXT,
    occurred_at TEXT
);
CREATE TABLE IF NOT EXISTS checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_name TEXT NOT NULL,
    phase TEXT NOT NULL,
    last_processed_id INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    checkpoint_at TEXT,
    config_hash TEXT
);
CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    decision_type TEXT,
    item_id INTEGER,
    decision TEXT,
    reason TEXT,
    decided_at TEXT
);
CREATE TABLE IF NOT EXISTS redirects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_url TEXT NOT NULL,
    target_url TEXT NOT NULL,
    status_code INTEGER DEFAULT 301,
    reason TEXT,
    duplicate_post_id INTEGER,
    canonical_post_id INTEGER,
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS media_canonical_map (
            duplicate_media_id INTEGER PRIMARY KEY,
            canonical_media_id INTEGER NOT NULL,
            content_hash TEXT,
            attachment_count INTEGER,
            created_at TEXT
        );
CREATE TABLE IF NOT EXISTS canonical_posts (
    post_id INTEGER PRIMARY KEY
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS canonical_term_counts (
  tt_id INTEGER PRIMARY KEY,
  count INTEGER NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS local_thumbnails(
         post_id INTEGER PRIMARY KEY,
         file_name TEXT NOT NULL,
         source TEXT,
         status TEXT NOT NULL DEFAULT 'downloaded',
         updated_at TEXT
       );
CREATE TABLE IF NOT EXISTS thumbnail_download_status(
          post_id INTEGER PRIMARY KEY,
          status TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          updated_at TEXT
        );
CREATE TABLE IF NOT EXISTS video_replacements(
          post_id INTEGER PRIMARY KEY,
          old_video_id TEXT,
          new_video_id TEXT NOT NULL UNIQUE,
          new_url TEXT NOT NULL,
          new_title TEXT NOT NULL,
          query TEXT,
          replaced_at TEXT
        );
CREATE TABLE IF NOT EXISTS video_health(
          post_id INTEGER PRIMARY KEY,
          slug TEXT NOT NULL,
          title TEXT NOT NULL,
          video_status TEXT NOT NULL DEFAULT 'unknown',
          thumbnail_status TEXT NOT NULL DEFAULT 'missing',
          source_url TEXT,
          embed_url TEXT,
          provider_video_id TEXT,
          http_status INTEGER,
          last_error TEXT,
          checked_at TEXT,
          replaced_at TEXT
        );
CREATE TABLE IF NOT EXISTS mass_repair_state(
          id INTEGER PRIMARY KEY CHECK(id=1),
          query_index INTEGER NOT NULL DEFAULT 0,
          start_page INTEGER NOT NULL DEFAULT 0,
          batches INTEGER NOT NULL DEFAULT 0,
          replacements INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT
        );
CREATE TABLE IF NOT EXISTS duplicate_video_queue(
          post_id INTEGER PRIMARY KEY,
          duplicate_key TEXT NOT NULL,
          canonical_post_id INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          detected_at TEXT,
          repaired_at TEXT
        );
CREATE TABLE IF NOT EXISTS quality_repair_queue(
      post_id INTEGER PRIMARY KEY,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      detected_at TEXT,
      repaired_at TEXT
    );
CREATE INDEX IF NOT EXISTS idx_postmeta_post ON post_metadata(post_id);
CREATE INDEX IF NOT EXISTS idx_postmeta_key ON post_metadata(meta_key);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(post_type);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(post_status);
CREATE INDEX IF NOT EXISTS idx_posts_name ON posts(post_name);
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(post_parent);
CREATE INDEX IF NOT EXISTS idx_embeds_post ON embeds(post_id);
CREATE INDEX IF NOT EXISTS idx_embeds_domain ON embeds(domain);
CREATE INDEX IF NOT EXISTS idx_errors_phase ON errors(phase);
CREATE INDEX IF NOT EXISTS idx_redirects_source ON redirects(source_url);
CREATE INDEX IF NOT EXISTS idx_redirects_target ON redirects(target_url);
CREATE INDEX IF NOT EXISTS idx_post_media_media ON post_media(media_id);
CREATE INDEX IF NOT EXISTS idx_thumb_candidates_media ON thumbnail_candidates(media_id);
CREATE INDEX IF NOT EXISTS idx_pdg_post_canonical ON post_duplicate_groups(post_id, is_canonical);
CREATE INDEX IF NOT EXISTS idx_embeds_post_status ON embeds(post_id, status);
CREATE INDEX IF NOT EXISTS idx_postmeta_post_key ON post_metadata(post_id, meta_key);
CREATE INDEX IF NOT EXISTS idx_posts_type_status_date ON posts(post_type, post_status, post_date DESC);
CREATE INDEX IF NOT EXISTS idx_terms_taxonomy ON term_taxonomy(taxonomy, tt_id, term_id);
CREATE INDEX IF NOT EXISTS idx_relationships_taxonomy_object ON term_relationships(term_taxonomy_id, object_id);
CREATE INDEX IF NOT EXISTS idx_video_health_status
          ON video_health(video_status, thumbnail_status);
`
