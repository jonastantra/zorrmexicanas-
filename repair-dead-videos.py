"""Reemplaza videos muertos por videos vigentes relacionados con mexicanas.

Por defecto solo muestra el plan. Use --apply para modificar la base.
Cada reemplazo actualiza metadatos, embed y miniatura local como una unidad.
"""
from __future__ import annotations

import argparse
import html
import re
import sqlite3
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = ROOT / "_migration_workspace" / "state" / "migration.db"
OUTPUT = ROOT / "zor3convertido" / "webapp" / "public" / "media" / "thumbs"
BACKUPS = ROOT / "_migration_workspace" / "backups"
REPORT = ROOT / "_migration_workspace" / "reports" / "video-replacements.tsv"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137 Safari/537.36"
DEFAULT_QUERIES = (
    "mexicanas amateur",
    "mexicana casera",
    "porno mexicano",
    "mexicanas",
    "latina mexicana",
)
BLOCK_RE = re.compile(
    r'<div[^>]+data-id="(?P<id>\d+)"[^>]*class="[^"]*thumb-block[^"]*"[^>]*>'
    r'.*?<a href="(?P<href>/video\.[^"]+)"[^>]*>\s*<img[^>]+'
    r'(?:data-src|src)="(?P<thumb>https://[^"]+)"[^>]*>'
    r'.*?<p class="title"><a[^>]+title="(?P<title>[^"]+)"',
    re.I | re.S,
)
DURATION_RE = re.compile(r'<span class="duration">([^<]+)</span>', re.I)
RELEVANT_RE = re.compile(
    r"\b(mexican(?:a|as|o|os)?|latina(?:s)?|mexico|cdmx|mex)\b",
    re.I,
)

# Windows PowerShell often uses cp1252. Search titles may contain combining
# Unicode characters; replacing only unprintable console glyphs must never
# abort a committed repair batch.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass


def fetch_search(query: str, page: int, timeout: int) -> list[dict]:
    params = urllib.parse.urlencode({"k": query, "p": page})
    url = f"https://www.xvideos.com/?{params}"
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    text = urllib.request.urlopen(request, timeout=timeout).read().decode("utf-8", "ignore")
    results = []
    for match in BLOCK_RE.finditer(text):
        tail = text[match.end():match.end() + 1500]
        duration = DURATION_RE.search(tail)
        title = html.unescape(match["title"]).strip()
        # Search pages occasionally inject unrelated generic results. For this
        # migration only accept candidates whose own title confirms Mexican or
        # Latina relevance; the query string alone is not sufficient evidence.
        if not RELEVANT_RE.search(title):
            continue
        results.append(
            {
                "video_id": match["id"],
                "url": "https://www.xvideos.com" + html.unescape(match["href"]),
                "thumbnail": html.unescape(match["thumb"]),
                "title": title,
                "duration": duration.group(1).strip() if duration else "",
                "query": query,
            }
        )
    return results


def download_image(url: str, target: Path, timeout: int) -> bool:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Referer": "https://www.xvideos.com/",
            "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            if not response.headers.get("Content-Type", "").lower().startswith("image/"):
                return False
            data = response.read()
        if len(data) < 1000:
            return False
        temp = target.with_suffix(".tmp")
        temp.write_bytes(data)
        temp.replace(target)
        return True
    except Exception:
        return False


def set_meta(db: sqlite3.Connection, post_id: int, key: str, value: str) -> None:
    row = db.execute(
        "SELECT id FROM post_metadata WHERE post_id=? AND meta_key=? ORDER BY id LIMIT 1",
        (post_id, key),
    ).fetchone()
    if row:
        db.execute("UPDATE post_metadata SET meta_value=? WHERE id=?", (value, row[0]))
        db.execute(
            "DELETE FROM post_metadata WHERE post_id=? AND meta_key=? AND id<>?",
            (post_id, key, row[0]),
        )
    else:
        db.execute(
            "INSERT INTO post_metadata(post_id,meta_key,meta_value) VALUES(?,?,?)",
            (post_id, key, value),
        )


def ensure_schema(db: sqlite3.Connection) -> None:
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS video_replacements(
          post_id INTEGER PRIMARY KEY,
          old_video_id TEXT,
          new_video_id TEXT NOT NULL UNIQUE,
          new_url TEXT NOT NULL,
          new_title TEXT NOT NULL,
          query TEXT,
          replaced_at TEXT
        );
        CREATE TABLE IF NOT EXISTS local_thumbnails(
          post_id INTEGER PRIMARY KEY,
          file_name TEXT NOT NULL,
          source TEXT,
          status TEXT NOT NULL DEFAULT 'downloaded',
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS quality_repair_queue(
          post_id INTEGER PRIMARY KEY,
          reason TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          detected_at TEXT,
          repaired_at TEXT
        );
        """
    )
    db.commit()


def dead_posts(db: sqlite3.Connection, limit: int, post_id: int | None = None) -> list[sqlite3.Row]:
    db.row_factory = sqlite3.Row
    query = """
      SELECT p.id, p.post_name, p.post_title,
        COALESCE((SELECT meta_value FROM post_metadata
                  WHERE post_id=p.id AND meta_key='videoid' LIMIT 1), '') old_video_id
      FROM canonical_posts cp
      JOIN posts p ON p.id=cp.post_id
      WHERE p.post_status='publish' AND p.post_type='post'
        AND TRIM(COALESCE(p.post_name,''))<>''
        AND (
          p.id NOT IN (SELECT post_id FROM video_replacements)
          OR p.id IN (SELECT post_id FROM duplicate_video_queue WHERE status='pending')
          OR p.id IN (SELECT post_id FROM quality_repair_queue WHERE status='pending')
        )
        AND (? IS NULL OR p.id=?)
        AND (
          EXISTS (SELECT 1 FROM duplicate_video_queue q WHERE q.post_id=p.id AND q.status='pending')
          OR EXISTS (SELECT 1 FROM quality_repair_queue q WHERE q.post_id=p.id AND q.status='pending')
          OR
          EXISTS (SELECT 1 FROM embeds e WHERE e.post_id=p.id AND e.status='dead')
          OR EXISTS (
            SELECT 1 FROM thumbnail_download_status t
            WHERE t.post_id=p.id AND t.status='failed'
              AND (t.last_error LIKE '%404%' OR t.last_error LIKE '%No video formats%')
          )
        )
      ORDER BY p.post_date ASC, p.id ASC
      LIMIT ?
    """
    return db.execute(query, (post_id, post_id, limit)).fetchall()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--pages", type=int, default=3)
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--query", action="append")
    parser.add_argument("--post-id", type=int)
    parser.add_argument("--no-backup", action="store_true")
    args = parser.parse_args()

    db = sqlite3.connect(DB)
    ensure_schema(db)
    targets = dead_posts(db, args.limit, args.post_id)
    # Reserve every provider ID already present in the catalog, not only IDs
    # previously chosen by this script. This guarantees that a replacement
    # cannot duplicate an original live post either.
    used = {
        str(row[0]).strip().lower()
        for row in db.execute(
            """SELECT meta_value FROM post_metadata
               WHERE meta_key='videoid' AND COALESCE(meta_value,'')<>''
               UNION
               SELECT external_id FROM embeds
               WHERE COALESCE(external_id,'')<>''"""
        )
        if row[0]
    }
    candidates: list[dict] = []
    seen = set(used)
    for query in args.query or DEFAULT_QUERIES:
        for page in range(args.start_page, args.start_page + args.pages):
            for candidate in fetch_search(query, page, args.timeout):
                candidate["video_id"] = str(candidate["video_id"]).strip().lower()
                if candidate["video_id"] not in seen:
                    candidates.append(candidate)
                    seen.add(candidate["video_id"])
            if len(candidates) >= len(targets) * 2:
                break
        if len(candidates) >= len(targets) * 2:
            break

    print(f"Videos muertos seleccionados: {len(targets)}")
    print(f"Reemplazos vigentes encontrados: {len(candidates)}")
    if not targets or not candidates:
        return 0

    if args.apply and not args.no_backup:
        BACKUPS.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = BACKUPS / f"migration-before-video-repair-{stamp}.db"
        backup_db = sqlite3.connect(backup)
        db.backup(backup_db)
        backup_db.close()
        db.close()
        print(f"Backup: {backup}")
        db = sqlite3.connect(DB)
        ensure_schema(db)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    completed = 0
    with REPORT.open("a", encoding="utf-8") as report:
        for post, candidate in zip(targets, candidates):
            print(
                f"{post['id']} {post['post_name']} -> "
                f"{candidate['video_id']} {candidate['title']}"
            )
            if not args.apply:
                continue

            image = OUTPUT / f"{post['id']}.jpg"
            if not download_image(candidate["thumbnail"], image, args.timeout):
                print(f"  OMITIDO: no se pudo descargar miniatura real")
                continue

            embed_url = f"https://www.xvideos.com/embedframe/{candidate['video_id']}"
            iframe = (
                f'<iframe src="{embed_url}" width="750" height="500" '
                'frameborder="0" scrolling="no" allowfullscreen></iframe>'
            )
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            description = f"Video de mexicanas: {candidate['title']}"
            db.execute(
                """UPDATE posts SET post_title=?, post_excerpt=?, post_content=?,
                   post_modified=?, post_modified_gmt=? WHERE id=?""",
                (candidate["title"], description, description, now, now, post["id"]),
            )
            set_meta(db, post["id"], "videoid", candidate["video_id"])
            set_meta(db, post["id"], "link", candidate["url"])
            set_meta(db, post["id"], "thumb", candidate["thumbnail"])
            set_meta(db, post["id"], "embed", iframe)
            set_meta(db, post["id"], "duration", candidate["duration"])
            db.execute("DELETE FROM embeds WHERE post_id=?", (post["id"],))
            db.execute(
                """INSERT INTO embeds(
                   post_id,source_field,raw_value,normalized_url,domain,
                   external_id,iframe_html,status,http_status,check_date)
                   VALUES(?,'replacement',? ,?,'www.xvideos.com',?,?, 'ok',200,datetime('now'))""",
                (post["id"], iframe, embed_url, candidate["video_id"], iframe),
            )
            db.execute(
                """INSERT INTO local_thumbnails(post_id,file_name,source,status,updated_at)
                   VALUES(?,?,'video-replacement','downloaded',datetime('now'))
                   ON CONFLICT(post_id) DO UPDATE SET
                     file_name=excluded.file_name, source=excluded.source,
                     status='downloaded', updated_at=datetime('now')""",
                (post["id"], image.name),
            )
            db.execute(
                """INSERT INTO video_replacements(
                   post_id,old_video_id,new_video_id,new_url,new_title,query,replaced_at)
                   VALUES(?,?,?,?,?,?,datetime('now'))
                   ON CONFLICT(post_id) DO UPDATE SET
                     old_video_id=excluded.old_video_id,
                     new_video_id=excluded.new_video_id,
                     new_url=excluded.new_url,
                     new_title=excluded.new_title,
                     query=excluded.query,
                     replaced_at=datetime('now')""",
                (
                    post["id"], post["old_video_id"], candidate["video_id"],
                    candidate["url"], candidate["title"], candidate["query"],
                ),
            )
            db.execute(
                """UPDATE duplicate_video_queue SET status='repaired',
                   repaired_at=datetime('now') WHERE post_id=?""",
                (post["id"],),
            )
            db.execute(
                """UPDATE quality_repair_queue SET status='repaired',
                   repaired_at=datetime('now') WHERE post_id=?""",
                (post["id"],),
            )
            db.execute(
                """INSERT INTO thumbnail_download_status(
                   post_id,status,attempts,last_error,updated_at)
                   VALUES(?,'downloaded',1,NULL,datetime('now'))
                   ON CONFLICT(post_id) DO UPDATE SET
                     status='downloaded',last_error=NULL,updated_at=datetime('now')""",
                (post["id"],),
            )
            db.commit()
            report.write(
                f"{post['id']}\t{post['old_video_id']}\t{candidate['video_id']}\t"
                f"{candidate['url']}\t{candidate['title']}\n"
            )
            report.flush()
            completed += 1

    print(f"Reemplazos aplicados: {completed}" if args.apply else "Modo prueba: no se modificó la base.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
