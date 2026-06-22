"""Encola reemplazos cuyo título no confirma contenido mexicano/latino."""
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = ROOT / "_migration_workspace" / "state" / "migration.db"
RELEVANT = re.compile(r"\b(mexican(?:a|as|o|os)?|latina(?:s)?|mexico|cdmx|mex)\b", re.I)

db = sqlite3.connect(DB)
db.execute(
    """CREATE TABLE IF NOT EXISTS quality_repair_queue(
      post_id INTEGER PRIMARY KEY,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      detected_at TEXT,
      repaired_at TEXT
    )"""
)
rows = db.execute(
    """SELECT v.post_id,v.new_title FROM video_replacements v
       JOIN canonical_posts cp ON cp.post_id=v.post_id
       JOIN posts p ON p.id=v.post_id
       WHERE TRIM(COALESCE(p.post_name,''))<>''"""
).fetchall()
queued = 0
for post_id, title in rows:
    if not RELEVANT.search(title or ""):
        db.execute(
            """INSERT INTO quality_repair_queue(post_id,reason,status,detected_at)
               VALUES(?,'replacement title is not explicitly Mexican/Latina','pending',datetime('now'))
               ON CONFLICT(post_id) DO UPDATE SET reason=excluded.reason,
               status='pending',detected_at=datetime('now'),repaired_at=NULL""",
            (post_id,),
        )
        queued += 1
db.commit()
print(f"Reemplazos de baja relevancia enviados a revisión: {queued:,}")
