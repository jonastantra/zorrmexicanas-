"""Retira del conjunto canónico filas sin una URL pública única."""
import sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = ROOT / "_migration_workspace" / "state" / "migration.db"
BACKUPS = ROOT / "_migration_workspace" / "backups"
REPORT = ROOT / "_migration_workspace" / "reports" / "indexable-set-sanitized.tsv"

db = sqlite3.connect(DB)
BACKUPS.mkdir(parents=True, exist_ok=True)
backup = BACKUPS / f"migration-before-indexable-sanitize-{datetime.now():%Y%m%d-%H%M%S}.db"
backup_db = sqlite3.connect(backup)
db.backup(backup_db)
backup_db.close()
bad = db.execute(
    """SELECT cp.post_id,COALESCE(p.post_name,''),p.post_status,p.post_type
       FROM canonical_posts cp JOIN posts p ON p.id=cp.post_id
       WHERE TRIM(COALESCE(p.post_name,''))=''
          OR p.post_status<>'publish' OR p.post_type<>'post'"""
).fetchall()
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(
    "post_id\tslug\tstatus\ttype\treason\n" +
    "\n".join(f"{r[0]}\t{r[1]}\t{r[2]}\t{r[3]}\tno-public-unique-url" for r in bad),
    encoding="utf-8",
)
db.executemany("DELETE FROM canonical_posts WHERE post_id=?", [(r[0],) for r in bad])
db.commit()
remaining = db.execute("SELECT COUNT(*) FROM canonical_posts").fetchone()[0]
db.close()
print(f"Retiradas del conjunto indexable: {len(bad):,}")
print(f"Canónicas públicas restantes: {remaining:,}")
print(f"Backup: {backup}")
print(f"Reporte: {REPORT}")
