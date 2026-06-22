"""Reconstruye en SQLite el mapa post_id -> archivo de miniatura real."""
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = ROOT / "_migration_workspace" / "state" / "migration.db"
OUTPUT = ROOT / "zor3convertido" / "webapp" / "public" / "media" / "thumbs"
RASTER = {".jpg", ".jpeg", ".png", ".webp", ".avif"}

db = sqlite3.connect(DB)
db.execute(
    """CREATE TABLE IF NOT EXISTS local_thumbnails(
         post_id INTEGER PRIMARY KEY,
         file_name TEXT NOT NULL,
         source TEXT,
         status TEXT NOT NULL DEFAULT 'downloaded',
         updated_at TEXT
       )"""
)
rows = []
for file in OUTPUT.iterdir():
    if file.is_file() and file.suffix.lower() in RASTER and file.stem.isdigit():
        rows.append((int(file.stem), file.name, "local-scan"))
db.executemany(
    """INSERT INTO local_thumbnails(post_id,file_name,source,status,updated_at)
       VALUES(?,?,?,'downloaded',datetime('now'))
       ON CONFLICT(post_id) DO UPDATE SET
         file_name=excluded.file_name, source=excluded.source,
         status=excluded.status, updated_at=excluded.updated_at""",
    rows,
)
db.commit()
print(f"Miniaturas reales enlazadas en SQLite: {len(rows):,}")
