"""Construye y actualiza el registro maestro de salud de videos y miniaturas."""
from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = ROOT / "_migration_workspace" / "state" / "migration.db"
THUMBS = ROOT / "zor3convertido" / "webapp" / "public" / "media" / "thumbs"


def ensure_schema(db: sqlite3.Connection) -> None:
    db.executescript(
        """
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
        CREATE INDEX IF NOT EXISTS idx_video_health_status
          ON video_health(video_status, thumbnail_status);
        """
    )


def raster_exists(post_id: int, file_name: str | None) -> bool:
    if not file_name:
        return False
    path = THUMBS / file_name
    return path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".avif"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="0 procesa todos")
    args = parser.parse_args()

    db = sqlite3.connect(DB, timeout=30)
    db.row_factory = sqlite3.Row
    ensure_schema(db)
    sql = """
      SELECT p.id, p.post_name slug, p.post_title title,
        (SELECT meta_value FROM post_metadata
          WHERE post_id=p.id AND meta_key='link' LIMIT 1) source_url,
        (SELECT meta_value FROM post_metadata
          WHERE post_id=p.id AND meta_key='embed' LIMIT 1) embed_url,
        (SELECT meta_value FROM post_metadata
          WHERE post_id=p.id AND meta_key='videoid' LIMIT 1) provider_video_id,
        (SELECT status FROM embeds WHERE post_id=p.id
          ORDER BY CASE status WHEN 'ok' THEN 0 WHEN 'dead' THEN 2 ELSE 1 END, id DESC LIMIT 1) embed_status,
        (SELECT http_status FROM embeds WHERE post_id=p.id ORDER BY id DESC LIMIT 1) http_status,
        (SELECT error_message FROM embeds WHERE post_id=p.id ORDER BY id DESC LIMIT 1) embed_error,
        (SELECT status FROM thumbnail_download_status WHERE post_id=p.id LIMIT 1) download_status,
        (SELECT last_error FROM thumbnail_download_status WHERE post_id=p.id LIMIT 1) download_error,
        (SELECT file_name FROM local_thumbnails WHERE post_id=p.id LIMIT 1) file_name,
        (SELECT replaced_at FROM video_replacements WHERE post_id=p.id LIMIT 1) replaced_at
      FROM canonical_posts cp
      JOIN posts p ON p.id=cp.post_id
      WHERE p.post_status='publish' AND p.post_type='post'
      ORDER BY p.id
    """
    rows = db.execute(sql).fetchall()
    if args.limit:
        rows = rows[: args.limit]

    counts = {"ok": 0, "dead": 0, "unknown": 0, "real": 0, "placeholder": 0}
    for row in rows:
        error = row["download_error"] or row["embed_error"]
        dead_by_download = bool(
            error and ("404" in error or "No video formats" in error)
        )
        if row["embed_status"] == "dead" or dead_by_download:
            video_status = "dead"
        elif row["embed_status"] == "ok" or row["replaced_at"]:
            video_status = "ok"
        else:
            video_status = "unknown"

        thumbnail_status = "real" if raster_exists(row["id"], row["file_name"]) else "placeholder"
        counts[video_status] += 1
        counts[thumbnail_status] += 1
        db.execute(
            """
            INSERT INTO video_health(
              post_id,slug,title,video_status,thumbnail_status,source_url,
              embed_url,provider_video_id,http_status,last_error,checked_at,replaced_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,datetime('now'),?)
            ON CONFLICT(post_id) DO UPDATE SET
              slug=excluded.slug,title=excluded.title,
              video_status=excluded.video_status,
              thumbnail_status=excluded.thumbnail_status,
              source_url=excluded.source_url,embed_url=excluded.embed_url,
              provider_video_id=excluded.provider_video_id,
              http_status=excluded.http_status,last_error=excluded.last_error,
              checked_at=datetime('now'),replaced_at=excluded.replaced_at
            """,
            (
                row["id"], row["slug"], row["title"], video_status,
                thumbnail_status, row["source_url"], row["embed_url"],
                row["provider_video_id"], row["http_status"], error,
                row["replaced_at"],
            ),
        )
    db.commit()
    db.close()
    print(
        f"Registrados: {len(rows):,} | videos ok: {counts['ok']:,} | "
        f"muertos: {counts['dead']:,} | por revisar: {counts['unknown']:,} | "
        f"miniaturas reales: {counts['real']:,} | placeholder: {counts['placeholder']:,}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
