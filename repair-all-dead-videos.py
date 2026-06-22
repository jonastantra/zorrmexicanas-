"""Reemplaza todos los videos muertos en lotes reanudables.

Guarda el avance en SQLite. Puede cerrarse y ejecutarse de nuevo sin repetir
posts ni videos sustitutos ya usados.
"""
from __future__ import annotations

import argparse
import shutil
import sqlite3
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = ROOT / "_migration_workspace" / "state" / "migration.db"
REPAIR = ROOT / "repair-dead-videos.py"
AUDIT = ROOT / "audit-video-health.py"
BACKUPS = ROOT / "_migration_workspace" / "backups"
LOCK = ROOT / "_migration_workspace" / "repair-all-dead-videos.lock"
QUERIES = (
    "mexicana amateur",
    "mexicanas amateur",
    "mexicana casera",
    "porno mexicano amateur",
    "mexican amateur",
    "latina mexicana amateur",
    "mexicanas caseras",
    "mexicana madura",
    "mexicana joven amateur",
    "pareja mexicana amateur",
    "amateur casero mexicana",
    "sexo casero mexicano",
    "mexicana cdmx amateur",
    "mexicanas cdmx",
    "mexicana df amateur",
    "mexicanas distrito federal",
    "mexicana monterrey amateur",
    "mexicana guadalajara amateur",
    "mexicana estado de mexico",
    "pareja mexicana casero",
    "esposa mexicana amateur",
    "novia mexicana casero",
    "mexicana webcam amateur",
    "mexicana culona amateur",
    "mujer mexicana casero",
)


def lock_instance():
    handle = LOCK.open("a+")
    try:
        import msvcrt
        msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
    except (ImportError, OSError):
        print("Ya existe otro reparador masivo ejecutándose.", flush=True)
        raise SystemExit(2)
    return handle


def ensure_state(db: sqlite3.Connection) -> None:
    db.execute(
        """CREATE TABLE IF NOT EXISTS quality_repair_queue(
          post_id INTEGER PRIMARY KEY,
          reason TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          detected_at TEXT,
          repaired_at TEXT
        )"""
    )
    db.execute(
        """CREATE TABLE IF NOT EXISTS mass_repair_state(
          id INTEGER PRIMARY KEY CHECK(id=1),
          query_index INTEGER NOT NULL DEFAULT 0,
          start_page INTEGER NOT NULL DEFAULT 0,
          batches INTEGER NOT NULL DEFAULT 0,
          replacements INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT
        )"""
    )
    db.execute(
        """INSERT OR IGNORE INTO mass_repair_state(
          id,query_index,start_page,batches,replacements,updated_at)
          VALUES(1,0,0,0,0,datetime('now'))"""
    )
    db.commit()


def pending(db: sqlite3.Connection) -> int:
    return db.execute(
        """SELECT COUNT(*) FROM canonical_posts cp JOIN posts p ON p.id=cp.post_id
        WHERE p.post_status='publish' AND p.post_type='post'
          AND TRIM(COALESCE(p.post_name,''))<>''
          AND (
            p.id NOT IN (SELECT post_id FROM video_replacements)
            OR p.id IN (SELECT post_id FROM duplicate_video_queue WHERE status='pending')
            OR p.id IN (SELECT post_id FROM quality_repair_queue WHERE status='pending')
          )
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
          )"""
    ).fetchone()[0]


def replacement_count(db: sqlite3.Connection) -> int:
    return db.execute("SELECT COUNT(*) FROM video_replacements").fetchone()[0]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--pages-per-query", type=int, default=5)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--pause", type=float, default=2.0)
    parser.add_argument("--max-batches", type=int, default=0, help="0 procesa hasta terminar")
    args = parser.parse_args()
    lock = lock_instance()

    db = sqlite3.connect(DB, timeout=30)
    ensure_state(db)
    state = db.execute(
        "SELECT query_index,start_page,batches,replacements FROM mass_repair_state WHERE id=1"
    ).fetchone()
    before = replacement_count(db)
    remaining = pending(db)
    print(f"Pendientes al iniciar: {remaining:,} | reemplazos previos: {before:,}", flush=True)
    if not remaining:
        return 0

    if state[2] == 0:
        BACKUPS.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = BACKUPS / f"migration-before-mass-repair-{stamp}.db"
        backup_db = sqlite3.connect(backup)
        db.backup(backup_db)
        backup_db.close()
        print(f"Backup inicial: {backup}", flush=True)

    query_index, start_page, batches, recorded = state
    session_batches = 0
    empty_rounds = 0
    while remaining > 0 and (args.max_batches == 0 or session_batches < args.max_batches):
        query = QUERIES[query_index % len(QUERIES)]
        command = [
            sys.executable, str(REPAIR), "--apply", "--no-backup",
            "--limit", str(min(args.batch_size, remaining)),
            "--pages", str(args.pages_per_query),
            "--start-page", str(start_page),
            "--timeout", str(args.timeout),
            "--query", query,
        ]
        print(
            f"\nLote {batches + 1} | búsqueda={query!r} | "
            f"páginas={start_page}-{start_page + args.pages_per_query - 1}",
            flush=True,
        )
        count_before = replacement_count(db)
        result = subprocess.run(command, cwd=ROOT)
        count_after = replacement_count(db)
        added = count_after - count_before
        if result.returncode != 0:
            print(f"El lote terminó con código {result.returncode}; se puede reanudar.", flush=True)
            return result.returncode

        batches += 1
        session_batches += 1
        recorded += added
        start_page += args.pages_per_query
        if start_page >= 250:
            query_index = (query_index + 1) % len(QUERIES)
            start_page = 0
        empty_rounds = empty_rounds + 1 if added == 0 else 0
        remaining = pending(db)
        db.execute(
            """UPDATE mass_repair_state SET query_index=?,start_page=?,batches=?,
               replacements=?,updated_at=datetime('now') WHERE id=1""",
            (query_index, start_page, batches, recorded),
        )
        db.commit()
        print(f"Lote aplicado: {added} | todavía pendientes: {remaining:,}", flush=True)
        if empty_rounds >= len(QUERIES) * 25:
            print("Todas las búsquedas y páginas disponibles dieron lotes vacíos.", flush=True)
            break
        time.sleep(max(0, args.pause))

    subprocess.run([sys.executable, str(AUDIT)], cwd=ROOT)
    print(
        f"Sesión terminada. Nuevos reemplazos: {replacement_count(db) - before:,}; "
        f"pendientes: {pending(db):,}",
        flush=True,
    )
    db.close()
    lock.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
