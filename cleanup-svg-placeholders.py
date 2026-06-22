"""Mueve placeholders SVG no utilizados a cuarentena de forma reversible."""
from __future__ import annotations

import csv
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
THUMBS = ROOT / "zor3convertido" / "webapp" / "public" / "media" / "thumbs"
DB = ROOT / "_migration_workspace" / "state" / "migration.db"
stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
QUARANTINE = ROOT / "_migration_workspace" / "quarantine" / f"svg-placeholders-{stamp}"
REPORT = ROOT / "_migration_workspace" / "reports" / f"svg-cleanup-{stamp}.csv"

db = sqlite3.connect(DB)
needed = {
    str(row[0])
    for row in db.execute(
        """SELECT cp.post_id FROM canonical_posts cp
           LEFT JOIN local_thumbnails lt ON lt.post_id=cp.post_id
           WHERE lt.post_id IS NULL"""
    )
}
db.close()

raster_stems = {
    file.stem
    for pattern in ("*.jpg", "*.jpeg", "*.png", "*.webp", "*.avif")
    for file in THUMBS.glob(pattern)
}

# Ensure every still-needed post has a visible local fallback.
for post_id in needed:
    target = THUMBS / f"{post_id}.svg"
    if target.exists() or post_id in raster_stems:
        continue
    target.write_text(
        f"""<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
<rect width="640" height="360" fill="#15151d"/>
<circle cx="320" cy="166" r="48" fill="#ff2e63"/>
<path d="M306 139l42 27-42 27z" fill="#fff"/>
<text x="320" y="250" text-anchor="middle" fill="#ddd" font-family="Arial,sans-serif" font-size="20">Video en revisión</text>
</svg>""",
        encoding="utf-8",
    )

move = []
for file in THUMBS.glob("*.svg"):
    if file.stem in needed:
        continue
    reason = "raster-equivalent" if file.stem in raster_stems else "non-indexable-orphan"
    move.append((file, reason))

QUARANTINE.mkdir(parents=True, exist_ok=True)
REPORT.parent.mkdir(parents=True, exist_ok=True)
with REPORT.open("w", newline="", encoding="utf-8") as handle:
    writer = csv.writer(handle)
    writer.writerow(("file", "reason", "bytes", "quarantine"))
    for file, reason in move:
        destination = QUARANTINE / file.name
        writer.writerow((file.name, reason, file.stat().st_size, str(destination)))
        shutil.move(str(file), str(destination))

print(f"SVG movidos a cuarentena: {len(move):,}")
print(f"SVG necesarios conservados: {len(list(THUMBS.glob('*.svg'))):,}")
print(f"Cuarentena: {QUARANTINE}")
print(f"Reporte: {REPORT}")
