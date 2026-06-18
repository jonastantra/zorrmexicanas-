from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


SCHEMA = """
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS scan_jobs (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
  started_at TEXT, finished_at TEXT, processed INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0, config_json TEXT, version TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS checkpoints (
  job_name TEXT PRIMARY KEY, cursor TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS errors (
  id INTEGER PRIMARY KEY, job_name TEXT, item TEXT, error TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY, bytes INTEGER, modified_utc TEXT, extension TEXT,
  sha256 TEXT, role TEXT, source_readonly INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS archive_members (
  archive TEXT NOT NULL, member_index INTEGER NOT NULL, path TEXT NOT NULL,
  bytes INTEGER, modified_utc TEXT, kind TEXT, suspicious INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (archive, member_index)
);
CREATE TABLE IF NOT EXISTS sql_tables (
  name TEXT PRIMARY KEY, engine TEXT, charset TEXT, collation TEXT,
  insert_statements INTEGER NOT NULL DEFAULT 0, estimated_rows INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS wxr_counts (
  element TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS decisions (
  key TEXT PRIMARY KEY, value TEXT, reason TEXT, created_at TEXT NOT NULL
);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class State:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    @contextmanager
    def transaction(self):
        try:
            yield self.conn
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise

    def start_job(self, name: str, config: dict) -> None:
        self.conn.execute(
            """INSERT INTO scan_jobs(name,status,started_at,config_json,version)
               VALUES(?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET
               status='running', started_at=COALESCE(scan_jobs.started_at, excluded.started_at),
               finished_at=NULL, config_json=excluded.config_json""",
            (name, "running", now(), json.dumps(config, sort_keys=True), "0.1.0"),
        )
        self.conn.commit()

    def finish_job(self, name: str, status: str = "completed") -> None:
        self.conn.execute(
            "UPDATE scan_jobs SET status=?, finished_at=? WHERE name=?",
            (status, now(), name),
        )
        self.conn.commit()

    def checkpoint(self, name: str, cursor: str, processed_delta: int = 0) -> None:
        self.conn.execute(
            """INSERT INTO checkpoints(job_name,cursor,updated_at) VALUES(?,?,?)
               ON CONFLICT(job_name) DO UPDATE SET cursor=excluded.cursor, updated_at=excluded.updated_at""",
            (name, cursor, now()),
        )
        self.conn.execute(
            "UPDATE scan_jobs SET processed=processed+? WHERE name=?",
            (processed_delta, name),
        )
        self.conn.commit()

    def cursor(self, name: str) -> str | None:
        row = self.conn.execute(
            "SELECT cursor FROM checkpoints WHERE job_name=?", (name,)
        ).fetchone()
        return row[0] if row else None

    def error(self, job: str, item: str, error: Exception | str) -> None:
        self.conn.execute(
            "INSERT INTO errors(job_name,item,error,created_at) VALUES(?,?,?,?)",
            (job, item, str(error), now()),
        )
        self.conn.execute(
            "UPDATE scan_jobs SET errors=errors+1 WHERE name=?", (job,)
        )
        self.conn.commit()

