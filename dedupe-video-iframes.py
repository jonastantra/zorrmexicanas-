"""Detecta videos/iframes repetidos y manda las copias a reparación.

Por defecto solo genera el reporte. Con --apply conserva la entrada más antigua
de cada video y marca las demás para recibir sustitutos únicos.
"""
from __future__ import annotations

import argparse
import re
import sqlite3
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DB = ROOT / "_migration_workspace" / "state" / "migration.db"
REPORT = ROOT / "_migration_workspace" / "reports" / "duplicate-video-iframes.tsv"
BACKUPS = ROOT / "_migration_workspace" / "backups"
SRC_RE = re.compile(r"""src\s*=\s*["']([^"']+)""", re.I)


def normalized_key(value: str, provider_id: str = "") -> str:
    if provider_id.strip():
        return f"provider:{provider_id.strip().lower()}"
    match = SRC_RE.search(value or "")
    raw = match.group(1) if match else (value or "")
    raw = raw.replace("&amp;", "&").strip()
    if not raw:
        return ""
    if raw.startswith("//"):
        raw = "https:" + raw
    parsed = urlparse(raw)
    host = parsed.netloc.lower().removeprefix("www.")
    path = re.sub(r"/+", "/", parsed.path).rstrip("/").lower()
    query = parse_qs(parsed.query)
    # Provider IDs in common embed URL shapes.
    patterns = (
        r"(?:embedframe|embed|video|videos)/([a-z0-9_-]+)",
        r"(?:video=|id=)([a-z0-9_-]+)",
    )
    joined = path + "?" + parsed.query.lower()
    for pattern in patterns:
        found = re.search(pattern, joined, re.I)
        if found:
            return f"{host}:{found.group(1).lower()}"
    stable_query = "&".join(
        f"{key}={','.join(sorted(values))}"
        for key, values in sorted(query.items())
        if key.lower() in {"id", "video", "viewkey"}
    )
    return f"url:{host}{path}{'?' + stable_query if stable_query else ''}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="0 marca todos los duplicados")
    args = parser.parse_args()
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS duplicate_video_queue(
          post_id INTEGER PRIMARY KEY,
          duplicate_key TEXT NOT NULL,
          canonical_post_id INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          detected_at TEXT,
          repaired_at TEXT
        );
        """
    )
    rows = db.execute(
        """
        SELECT p.id,p.post_name,p.post_date,
          COALESCE((SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='videoid' LIMIT 1),'') video_id,
          COALESCE((SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='embed' LIMIT 1),'') embed,
          COALESCE((SELECT meta_value FROM post_metadata WHERE post_id=p.id AND meta_key='link' LIMIT 1),'') link
        FROM canonical_posts cp JOIN posts p ON p.id=cp.post_id
        WHERE p.post_status='publish' AND p.post_type='post'
        ORDER BY p.post_date,p.id
        """
    ).fetchall()
    groups: dict[str, list[sqlite3.Row]] = defaultdict(list)
    for row in rows:
        key = normalized_key(row["embed"] or row["link"], row["video_id"])
        if key:
            groups[key].append(row)
    duplicates = [(key, members) for key, members in groups.items() if len(members) > 1]
    duplicate_posts = sum(len(members) - 1 for _, members in duplicates)
    print(f"Grupos repetidos: {len(duplicates):,} | entradas que deben reemplazarse: {duplicate_posts:,}")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    marked = 0
    if args.apply:
        BACKUPS.mkdir(parents=True, exist_ok=True)
        backup = BACKUPS / f"migration-before-iframe-dedupe-{datetime.now():%Y%m%d-%H%M%S}.db"
        target = sqlite3.connect(backup)
        db.backup(target)
        target.close()
        print(f"Backup: {backup}")
    with REPORT.open("w", encoding="utf-8") as report:
        report.write("duplicate_key\tcanonical_post_id\tduplicate_post_id\tslug\n")
        for key, members in duplicates:
            canonical = members[0]
            for duplicate in members[1:]:
                report.write(f"{key}\t{canonical['id']}\t{duplicate['id']}\t{duplicate['post_name']}\n")
                if args.apply and (not args.limit or marked < args.limit):
                    db.execute(
                        """INSERT INTO duplicate_video_queue(
                           post_id,duplicate_key,canonical_post_id,status,detected_at)
                           VALUES(?,?,?,'pending',datetime('now'))
                           ON CONFLICT(post_id) DO UPDATE SET duplicate_key=excluded.duplicate_key,
                           canonical_post_id=excluded.canonical_post_id,status='pending',
                           detected_at=datetime('now'),repaired_at=NULL""",
                        (duplicate["id"], key, canonical["id"]),
                    )
                    db.execute(
                        "UPDATE embeds SET status='duplicate',error_message='Duplicate external video' WHERE post_id=?",
                        (duplicate["id"],),
                    )
                    marked += 1
    db.commit()
    db.close()
    print(f"Reporte: {REPORT}")
    if args.apply:
        print(f"Enviados a reparación: {marked:,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
