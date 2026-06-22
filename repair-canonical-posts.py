"""Elimina duplicados exactos que aún quedaron dentro de canonical_posts."""
from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = ROOT / "_migration_workspace" / "state" / "migration.db"
BACKUPS = ROOT / "_migration_workspace" / "backups"
REPORT = ROOT / "_migration_workspace" / "reports" / "canonical-exact-dedup.txt"


def main() -> None:
    BACKUPS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = BACKUPS / f"migration-before-canonical-dedup-{stamp}.db"
    shutil.copy2(DB, backup)

    db = sqlite3.connect(DB)
    db.execute("PRAGMA journal_mode=WAL")
    before = db.execute("SELECT COUNT(*) FROM canonical_posts").fetchone()[0]
    removed: dict[int, tuple[int, str]] = {}

    # Señales exactas, en orden de fuerza. En cada grupo se conserva la primera
    # publicación y, en empate, el ID menor.
    for meta_key in ("videoid", "embed", "thumb"):
        groups = db.execute(
            """
            SELECT m.meta_value
            FROM canonical_posts cp
            JOIN post_metadata m ON m.post_id=cp.post_id AND m.meta_key=?
            WHERE TRIM(m.meta_value)<>''
            GROUP BY m.meta_value HAVING COUNT(*)>1
            """,
            (meta_key,),
        ).fetchall()
        for (value,) in groups:
            rows = db.execute(
                """
                SELECT p.id
                FROM canonical_posts cp
                JOIN posts p ON p.id=cp.post_id
                JOIN post_metadata m ON m.post_id=p.id AND m.meta_key=?
                WHERE m.meta_value=?
                ORDER BY p.post_date, p.id
                """,
                (meta_key, value),
            ).fetchall()
            if len(rows) < 2:
                continue
            keeper = rows[0][0]
            for (duplicate,) in rows[1:]:
                removed.setdefault(duplicate, (keeper, meta_key))
                db.execute("DELETE FROM canonical_posts WHERE post_id=?", (duplicate,))

    db.commit()
    after = db.execute("SELECT COUNT(*) FROM canonical_posts").fetchone()[0]
    REPORT.write_text(
        "\n".join(
            [
                f"Antes: {before}",
                f"Después: {after}",
                f"Eliminados exactos: {before-after}",
                f"Backup: {backup}",
                "",
                *[
                    f"{dup} -> {keeper} ({reason})"
                    for dup, (keeper, reason) in sorted(removed.items())
                ],
            ]
        ),
        encoding="utf-8",
    )
    print(f"Canónicos: {before:,} -> {after:,}; eliminados: {before-after:,}")
    print(f"Backup: {backup}")
    print(f"Reporte: {REPORT}")


if __name__ == "__main__":
    main()
