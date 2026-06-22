"""Descarga y enlaza miniaturas reales sin repetir trabajo al reiniciar."""
from __future__ import annotations

import argparse
import concurrent.futures
import os
import sqlite3
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = ROOT / "_migration_workspace" / "state" / "migration.db"
OUTPUT = ROOT / "zor3convertido" / "webapp" / "public" / "media" / "thumbs"
REPORT = ROOT / "_migration_workspace" / "reports" / "real-thumbnail-download.tsv"
LOCK_FILE = ROOT / "_migration_workspace" / "real-thumbnail-download.lock"
RASTER = (".jpg", ".jpeg", ".webp", ".avif", ".png")
db_lock = threading.Lock()
lock_handle = None


def acquire_single_instance() -> None:
    global lock_handle
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    lock_handle = LOCK_FILE.open("a+b")
    lock_handle.seek(0)
    if lock_handle.read(1) == b"":
        lock_handle.seek(0)
        lock_handle.write(b"0")
        lock_handle.flush()
    try:
        if os.name == "nt":
            import msvcrt
            lock_handle.seek(0)
            msvcrt.locking(lock_handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        raise SystemExit("Ya hay otra instancia del descargador en ejecución.")


def open_db() -> sqlite3.Connection:
    db = sqlite3.connect(DB, timeout=30)
    db.execute("PRAGMA busy_timeout=30000")
    return db


def ensure_schema(db: sqlite3.Connection) -> None:
    db.executescript(
        """
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
        """
    )
    db.commit()


def real_image(post_id: int) -> Path | None:
    for ext in RASTER:
        path = OUTPUT / f"{post_id}{ext}"
        if path.exists() and path.stat().st_size > 1000:
            return path
    return None


def register_success(post_id: int, image: Path) -> None:
    with db_lock:
        db = open_db()
        ensure_schema(db)
        db.execute(
            """INSERT INTO local_thumbnails(post_id,file_name,source,status,updated_at)
               VALUES(?,?,?,'downloaded',datetime('now'))
               ON CONFLICT(post_id) DO UPDATE SET
                 file_name=excluded.file_name, source=excluded.source,
                 status='downloaded', updated_at=datetime('now')""",
            (post_id, image.name, "yt-dlp"),
        )
        db.execute(
            """INSERT INTO thumbnail_download_status(post_id,status,attempts,last_error,updated_at)
               VALUES(?,'downloaded',1,NULL,datetime('now'))
               ON CONFLICT(post_id) DO UPDATE SET
                 status='downloaded', last_error=NULL, updated_at=datetime('now')""",
            (post_id,),
        )
        db.commit()
        db.close()


def register_failure(post_id: int, detail: str) -> None:
    with db_lock:
        db = open_db()
        ensure_schema(db)
        db.execute(
            """INSERT INTO thumbnail_download_status(post_id,status,attempts,last_error,updated_at)
               VALUES(?,'failed',1,?,datetime('now'))
               ON CONFLICT(post_id) DO UPDATE SET
                 status='failed', attempts=attempts+1,
                 last_error=excluded.last_error, updated_at=datetime('now')""",
            (post_id, detail[-1000:]),
        )
        db.commit()
        db.close()


def import_historical_failures(db: sqlite3.Connection) -> int:
    if not REPORT.exists():
        return 0
    failures: dict[int, str] = {}
    for line in REPORT.read_text(encoding="utf-8", errors="replace").splitlines():
        parts = line.split("\t", 2)
        if len(parts) != 3 or not parts[0].isdigit():
            continue
        post_id, status, detail = int(parts[0]), parts[1], parts[2]
        if status == "failed" and real_image(post_id) is None:
            failures[post_id] = detail
        elif status in {"downloaded", "skipped"}:
            failures.pop(post_id, None)
    db.executemany(
        """INSERT INTO thumbnail_download_status(post_id,status,attempts,last_error,updated_at)
           VALUES(?,'failed',1,?,datetime('now'))
           ON CONFLICT(post_id) DO NOTHING""",
        failures.items(),
    )
    db.commit()
    return len(failures)


def download(item: tuple[int, str], timeout: int) -> tuple[int, str, str]:
    post_id, page_url = item
    existing = real_image(post_id)
    if existing:
        register_success(post_id, existing)
        return post_id, "skipped", existing.name

    command = [
        sys.executable, "-m", "yt_dlp",
        "--no-update", "--skip-download", "--write-thumbnail",
        "--no-playlist", "--no-warnings",
        "--socket-timeout", str(timeout), "--retries", "2",
        "-o", str(OUTPUT / f"{post_id}.%(ext)s"),
        page_url,
    ]
    creationflags = (
        getattr(subprocess, "BELOW_NORMAL_PRIORITY_CLASS", 0)
        if os.name == "nt" else 0
    )
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=max(45, timeout * 3),
            encoding="utf-8",
            errors="replace",
            creationflags=creationflags,
        )
    except subprocess.TimeoutExpired:
        register_failure(post_id, "timeout")
        return post_id, "failed", "timeout"

    image = real_image(post_id)
    if result.returncode == 0 and image:
        (OUTPUT / f"{post_id}.svg").unlink(missing_ok=True)
        register_success(post_id, image)
        return post_id, "downloaded", image.name

    message = (result.stderr or result.stdout).strip().replace("\t", " ").replace("\n", " ")
    detail = message[-500:] or f"yt-dlp code {result.returncode}"
    register_failure(post_id, detail)
    return post_id, "failed", detail


def main() -> int:
    acquire_single_instance()
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--retry-failed", action="store_true")
    args = parser.parse_args()
    args.workers = max(1, min(args.workers, 20))

    OUTPUT.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    db = open_db()
    ensure_schema(db)
    imported = import_historical_failures(db)

    rows = db.execute(
        """
        SELECT p.id, m.meta_value
        FROM canonical_posts cp
        JOIN posts p ON p.id=cp.post_id
        JOIN post_metadata m ON m.post_id=p.id AND m.meta_key='link'
        WHERE p.post_status='publish' AND p.post_type='post'
          AND m.meta_value LIKE 'http%'
        ORDER BY p.post_date DESC, p.id DESC
        """
    ).fetchall()
    if args.limit:
        rows = rows[:args.limit]

    remembered = set()
    if not args.retry_failed:
        remembered = {
            row[0] for row in db.execute(
                "SELECT post_id FROM thumbnail_download_status WHERE status='failed'"
            )
        }
    already = sum(real_image(post_id) is not None for post_id, _ in rows)
    pending = [
        row for row in rows
        if real_image(row[0]) is None and row[0] not in remembered
    ]
    failed_count = len(rows) - already - len(pending)
    db.close()

    print(
        f"Canónicos: {len(rows):,} | ya descargadas: {already:,} | "
        f"fallos recordados: {failed_count:,} | pendientes nuevas: {len(pending):,}",
        flush=True,
    )
    if imported:
        print(f"Fallos históricos importados: {imported:,}", flush=True)
    print(f"Trabajadores: {args.workers} (prioridad baja)", flush=True)

    counts = {"downloaded": 0, "skipped": already, "failed": failed_count}
    with REPORT.open("a", encoding="utf-8", newline="") as report:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(download, row, args.timeout) for row in pending]
            for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
                post_id, status, detail = future.result()
                counts[status] += 1
                report.write(f"{post_id}\t{status}\t{detail}\n")
                report.flush()
                if status == "failed":
                    print(f"NO DISPONIBLE post={post_id}: {detail}", flush=True)
                if index % 50 == 0:
                    done = already + failed_count + index
                    print(f"Total resuelto {done:,}/{len(rows):,} {counts}", flush=True)

    print(f"Final: {counts}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
