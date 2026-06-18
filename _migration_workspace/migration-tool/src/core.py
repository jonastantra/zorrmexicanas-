from __future__ import annotations

import csv
import hashlib
import json
import mimetypes
import os
import platform
import re
import shutil
import tarfile
import time
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

from .config import Config
from .state import State


SOURCE_ROLES = {
    "sql": "wordpress_database",
    "wxr": "wordpress_wxr",
    "theme_archive": "wordpress_theme",
    "uploads_archive": "wordpress_media",
}


def ensure_workspace(cfg: Config, dry_run: bool = False) -> None:
    names = [
        "extracted", "database", "cache", "state", "reports", "logs", "exports",
        "canonical-media", "quarantine", "webapp", "migration-tool", "backups",
    ]
    if not dry_run:
        for name in names:
            (cfg.workspace_root / name).mkdir(parents=True, exist_ok=True)


def sha256(path: Path, block: int = 4 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(block):
            digest.update(chunk)
    return digest.hexdigest().upper()


def inventory(cfg: Config, state: State, dry_run: bool = False) -> dict:
    ensure_workspace(cfg, dry_run)
    job = "inventory"
    state.start_job(job, {"dry_run": dry_run})
    usage = shutil.disk_usage(cfg.source_root)
    system = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "os": platform.platform(),
        "python": platform.python_version(),
        "logical_cores": os.cpu_count(),
        "ram_bytes": _windows_ram(),
        "disk_total_bytes": usage.total,
        "disk_free_bytes": usage.free,
        "workers": cfg.workers,
        "heavy_workers": cfg.heavy_workers,
        "batch_size": cfg.batch_size,
        "memory_target_bytes": cfg.memory_target_bytes,
        "disk_safety_ratio": cfg.disk_safety_ratio,
        "docker_available": shutil.which("docker") is not None,
        "podman_available": shutil.which("podman") is not None,
    }
    rows = []
    for key, path in cfg.sources.items():
        stat = path.stat()
        row = {
            "path": str(path),
            "name": path.name,
            "bytes": stat.st_size,
            "modified_utc": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
            "extension": "".join(path.suffixes).lower(),
            "mime": mimetypes.guess_type(path.name)[0] or "application/octet-stream",
            "role": SOURCE_ROLES[key],
            "sha256": sha256(path),
        }
        rows.append(row)
        state.conn.execute(
            """INSERT INTO files(path,bytes,modified_utc,extension,sha256,role)
               VALUES(?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET
               bytes=excluded.bytes, modified_utc=excluded.modified_utc,
               extension=excluded.extension, sha256=excluded.sha256, role=excluded.role""",
            (row["path"], row["bytes"], row["modified_utc"], row["extension"], row["sha256"], row["role"]),
        )
    state.conn.commit()
    if not dry_run:
        cfg.reports.mkdir(parents=True, exist_ok=True)
        (cfg.reports / "system-inventory.json").write_text(
            json.dumps(system, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        _write_csv(cfg.reports / "input-inventory.csv", rows)
    state.checkpoint(job, str(len(rows)), len(rows))
    state.finish_job(job)
    return {"system": system, "files": rows}


def archive_list(cfg: Config, state: State, limit: int | dict[str, int] | None = None, resume: bool = False,
                 dry_run: bool = False) -> dict:
    summaries = {}
    for source_key in ("theme_archive", "uploads_archive"):
        archive = cfg.sources[source_key]
        effective_limit = limit.get(source_key) if isinstance(limit, dict) else limit
        job = f"archive-list:{archive.name}"
        start_index = int(state.cursor(job) or -1) + 1 if resume else 0
        state.start_job(job, {"limit": effective_limit, "resume": resume, "dry_run": dry_run})
        counts = Counter()
        total_bytes = 0
        max_member = ("", 0)
        processed = 0
        with tarfile.open(archive, "r:gz") as tf:
            for index, member in enumerate(tf):
                if index < start_index:
                    continue
                if effective_limit is not None and processed >= effective_limit:
                    break
                kind = "dir" if member.isdir() else "file" if member.isfile() else "other"
                suffix = Path(member.name).suffix.lower() or "[none]"
                suspicious = int(_unsafe_member(member.name))
                counts[kind] += 1
                counts[f"ext:{suffix}"] += 1
                total_bytes += member.size
                if member.size > max_member[1]:
                    max_member = (member.name, member.size)
                if not dry_run:
                    state.conn.execute(
                        """INSERT OR IGNORE INTO archive_members
                           (archive,member_index,path,bytes,modified_utc,kind,suspicious)
                           VALUES(?,?,?,?,?,?,?)""",
                        (archive.name, index, member.name, member.size,
                         datetime.fromtimestamp(member.mtime, timezone.utc).isoformat(),
                         kind, suspicious),
                    )
                processed += 1
                if processed % cfg.batch_size == 0:
                    state.conn.commit()
                    state.checkpoint(job, str(index), cfg.batch_size)
            state.conn.commit()
            if processed:
                state.checkpoint(job, str(index), processed % cfg.batch_size)
        complete = effective_limit is None
        state.finish_job(job, "completed" if complete else "partial")
        summaries[archive.name] = {
            "members_processed_this_run": processed,
            "uncompressed_bytes_this_run": total_bytes,
            "largest_member": {"path": max_member[0], "bytes": max_member[1]},
            "counts": dict(counts),
            "complete": complete,
        }
    if not dry_run:
        _export_archive_inventory(cfg, state)
        (cfg.reports / "archive-summary.json").write_text(
            json.dumps(summaries, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    return summaries


def sample(cfg: Config, state: State, limit: int = 1000, resume: bool = False,
           dry_run: bool = False) -> dict:
    started = time.perf_counter()
    sql_lines = 0
    with cfg.sources["sql"].open("rb") as handle:
        for _ in range(80):
            if not handle.readline():
                break
            sql_lines += 1
    wxr_items = _count_wxr(cfg.sources["wxr"], max_items=100)
    archive_summary = archive_list(
        cfg,
        state,
        limit=None if limit < 0 else {"theme_archive": min(100, limit), "uploads_archive": limit},
                                   resume=resume, dry_run=dry_run)
    result = {
        "sql_header_lines": sql_lines,
        "wxr_items": wxr_items,
        "archives": archive_summary,
        "elapsed_seconds": round(time.perf_counter() - started, 3),
    }
    if not dry_run:
        (cfg.reports / "sample-result.json").write_text(
            json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    return result


CREATE_RE = re.compile(
    r"^CREATE TABLE `([^`]+)` \(", re.IGNORECASE
)
ENGINE_RE = re.compile(
    r"\)\s+ENGINE=([^\s]+).*?(?:DEFAULT CHARSET=([^\s;]+))?(?:\s+COLLATE=([^\s;]+))?",
    re.IGNORECASE,
)
INSERT_RE = re.compile(r"^INSERT INTO `([^`]+)`", re.IGNORECASE)


def audit(cfg: Config, state: State, resume: bool = False, limit: int | None = None,
          dry_run: bool = False) -> dict:
    job = "audit-sql"
    start_offset = int(state.cursor(job) or 0) if resume else 0
    state.start_job(job, {"resume": resume, "limit": limit, "dry_run": dry_run})
    tables: dict[str, dict] = {}
    post_types = Counter()
    post_statuses = Counter()
    meta_keys = Counter()
    shortcodes = Counter()
    embed_locations = Counter()
    current_create = None
    current_insert = None
    create_tail = []
    lines = 0
    with cfg.sources["sql"].open("rb") as raw:
        raw.seek(start_offset)
        for binary in raw:
            lines += 1
            line = binary.decode("utf-8", errors="replace").rstrip()
            match = CREATE_RE.match(line)
            if match:
                current_create = match.group(1)
                tables.setdefault(current_create, {"insert_statements": 0, "estimated_rows": 0})
                create_tail = []
            if current_create:
                create_tail.append(line)
                if line.endswith(";"):
                    engine = ENGINE_RE.search(" ".join(create_tail))
                    if engine:
                        tables[current_create].update(
                            engine=engine.group(1),
                            charset=engine.group(2),
                            collation=engine.group(3),
                        )
                    current_create = None
            insert = INSERT_RE.match(line)
            if insert:
                table = insert.group(1)
                current_insert = table
                entry = tables.setdefault(table, {"insert_statements": 0, "estimated_rows": 0})
                entry["insert_statements"] += 1
                entry["estimated_rows"] += _estimate_insert_rows(line)
            if current_insert:
                table = current_insert
                entry = tables.setdefault(table, {"insert_statements": 0, "estimated_rows": 0})
                stripped = line.lstrip()
                if stripped.startswith("(") and not insert:
                    entry["estimated_rows"] += 1
                if table.endswith("_posts"):
                    _sample_posts_insert(line, post_types, post_statuses, shortcodes, embed_locations)
                elif table.endswith("_postmeta"):
                    _sample_meta_insert(line, meta_keys, embed_locations)
                if line.endswith(";"):
                    current_insert = None
            if lines % cfg.batch_size == 0:
                state.checkpoint(job, str(raw.tell()), cfg.batch_size)
            if limit is not None and lines >= limit:
                break
        state.checkpoint(job, str(raw.tell()), lines % cfg.batch_size)
    if not dry_run:
        for name, data in tables.items():
            state.conn.execute(
                """INSERT INTO sql_tables(name,engine,charset,collation,insert_statements,estimated_rows)
                   VALUES(?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET
                   engine=excluded.engine, charset=excluded.charset, collation=excluded.collation,
                   insert_statements=MAX(sql_tables.insert_statements,excluded.insert_statements),
                   estimated_rows=MAX(sql_tables.estimated_rows,excluded.estimated_rows)""",
                (name, data.get("engine"), data.get("charset"), data.get("collation"),
                 data["insert_statements"], data["estimated_rows"]),
            )
        state.conn.commit()
    wxr = _count_wxr(cfg.sources["wxr"])
    prefix_counts = Counter(name.split("_", 1)[0] + "_" for name in tables if "_" in name)
    prefix = prefix_counts.most_common(1)[0][0] if prefix_counts else None
    summary = {
        "sql": {
            "lines_processed": lines,
            "tables_detected_this_run": len(tables),
            "probable_prefix": prefix,
            "prefix_candidates": dict(prefix_counts),
            "post_types_sampled": dict(post_types),
            "post_statuses_sampled": dict(post_statuses),
        },
        "wxr": wxr,
        "meta_keys_sampled": dict(meta_keys.most_common(500)),
        "shortcodes_sampled": dict(shortcodes.most_common(100)),
        "embed_storage_locations": dict(embed_locations),
        "note": "Row counts are streaming estimates based on SQL tuple boundaries.",
    }
    if not dry_run:
        _write_audit_reports(cfg, state, summary)
    state.finish_job(job, "completed" if limit is None else "partial")
    return summary


def extract_theme(cfg: Config, dry_run: bool = False) -> dict:
    archive = cfg.sources["theme_archive"]
    destination = cfg.workspace_root / "extracted" / "theme"
    extracted = skipped = 0
    with tarfile.open(archive, "r:gz") as tf:
        for member in tf:
            if _unsafe_member(member.name):
                raise ValueError(f"Ruta insegura en archivo: {member.name}")
            if not member.isfile():
                continue
            target = destination.joinpath(*PurePosixPath(member.name).parts)
            if target.exists():
                with tf.extractfile(member) as source:
                    incoming = hashlib.sha256(source.read()).hexdigest()
                if sha256(target).lower() != incoming:
                    raise FileExistsError(f"No se sobrescribirá un archivo distinto: {target}")
                skipped += 1
                continue
            if not dry_run:
                target.parent.mkdir(parents=True, exist_ok=True)
                with tf.extractfile(member) as source, target.open("xb") as output:
                    shutil.copyfileobj(source, output)
            extracted += 1
    return {"extracted": extracted, "already_identical": skipped, "destination": str(destination)}


def status(state: State) -> list[dict]:
    columns = ["name", "status", "started_at", "finished_at", "processed", "errors"]
    return [
        dict(zip(columns, row))
        for row in state.conn.execute(
            "SELECT name,status,started_at,finished_at,processed,errors FROM scan_jobs ORDER BY name"
        )
    ]


def _windows_ram() -> int | None:
    try:
        import ctypes
        class MemoryStatus(ctypes.Structure):
            _fields_ = [
                ("length", ctypes.c_ulong), ("memory_load", ctypes.c_ulong),
                ("total_phys", ctypes.c_ulonglong), ("avail_phys", ctypes.c_ulonglong),
                ("total_page", ctypes.c_ulonglong), ("avail_page", ctypes.c_ulonglong),
                ("total_virtual", ctypes.c_ulonglong), ("avail_virtual", ctypes.c_ulonglong),
                ("avail_extended_virtual", ctypes.c_ulonglong),
            ]
        status = MemoryStatus()
        status.length = ctypes.sizeof(status)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status))
        return status.total_phys
    except Exception:
        return None


def _unsafe_member(name: str) -> bool:
    path = PurePosixPath(name)
    return path.is_absolute() or ".." in path.parts


def _write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def _export_archive_inventory(cfg: Config, state: State) -> None:
    path = cfg.reports / "archive-inventory.csv"
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(["archive", "member_index", "path", "bytes", "modified_utc", "kind", "suspicious"])
        for row in state.conn.execute(
            "SELECT archive,member_index,path,bytes,modified_utc,kind,suspicious FROM archive_members ORDER BY archive,member_index"
        ):
            writer.writerow(row)


def _count_wxr(path: Path, max_items: int | None = None) -> dict:
    counts = Counter()
    items = 0
    try:
        for event, element in ET.iterparse(path, events=("end",)):
            local = element.tag.rsplit("}", 1)[-1]
            if local in {"item", "category", "tag", "term", "author"}:
                counts[local] += 1
            if local == "item":
                items += 1
                if max_items is not None and items >= max_items:
                    break
            element.clear()
    except ET.ParseError as exc:
        counts.clear()
        tokens = {
            "item": b"</item>",
            "category": b"</wp:category>",
            "tag": b"</wp:tag>",
            "term": b"</wp:term>",
            "author": b"</wp:author>",
        }
        overlap = b""
        with path.open("rb") as handle:
            while chunk := handle.read(4 * 1024 * 1024):
                data = overlap + chunk
                for name, token in tokens.items():
                    counts[name] += data.count(token)
                if max_items is not None and counts["item"] >= max_items:
                    counts["item"] = max_items
                    break
                overlap = data[-32:]
        counts["_parse_error"] = str(exc)
        counts["_count_method"] = "binary_tag_scan"
    return dict(counts)


def _estimate_insert_rows(line: str) -> int:
    marker = " VALUES"
    pos = line.upper().find(marker)
    if pos < 0:
        return 0
    payload = line[pos + len(marker):]
    depth = 0
    quoted = False
    escaped = False
    rows = 0
    for char in payload:
        if escaped:
            escaped = False
            continue
        if char == "\\" and quoted:
            escaped = True
        elif char == "'":
            quoted = not quoted
        elif not quoted:
            if char == "(":
                if depth == 0:
                    rows += 1
                depth += 1
            elif char == ")":
                depth = max(0, depth - 1)
    return rows


def _sample_posts_insert(line: str, post_types: Counter, post_statuses: Counter,
                         shortcodes: Counter, embeds: Counter) -> None:
    for match in re.finditer(r"'(publish|draft|trash|inherit|pending|private|future)'", line):
        post_statuses[match.group(1)] += 1
    for match in re.finditer(r"'(post|page|attachment|revision|nav_menu_item|wp_block)'", line):
        post_types[match.group(1)] += 1
    for match in re.finditer(r"\[([a-zA-Z][\w-]{1,50})\b", line):
        shortcodes[match.group(1).lower()] += 1
    if "<iframe" in line.lower():
        embeds["post_content_iframe"] += line.lower().count("<iframe")


def _sample_meta_insert(line: str, meta_keys: Counter, embeds: Counter) -> None:
    for key in re.findall(r",\s*'(_?[A-Za-z][A-Za-z0-9_-]{1,100})'\s*,", line):
        meta_keys[key] += 1
    lower = line.lower()
    if "<iframe" in lower:
        embeds["postmeta_iframe"] += lower.count("<iframe")


def _write_audit_reports(cfg: Config, state: State, summary: dict) -> None:
    cfg.reports.mkdir(parents=True, exist_ok=True)
    (cfg.reports / "database-summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    table_rows = [
        dict(zip(["table", "engine", "charset", "collation", "insert_statements", "estimated_rows"], row))
        for row in state.conn.execute(
            "SELECT name,engine,charset,collation,insert_statements,estimated_rows FROM sql_tables ORDER BY name"
        )
    ]
    _write_csv(cfg.reports / "table-sizes.csv", table_rows)
    _counter_csv(cfg.reports / "post-types.csv", summary["sql"]["post_types_sampled"])
    _counter_csv(cfg.reports / "post-statuses.csv", summary["sql"]["post_statuses_sampled"])
    _counter_csv(cfg.reports / "meta-keys.csv", summary["meta_keys_sampled"])
    _counter_csv(cfg.reports / "shortcodes.csv", summary["shortcodes_sampled"])
    _counter_csv(cfg.reports / "embed-storage-locations.csv", summary["embed_storage_locations"])
    core_suffixes = {
        "commentmeta", "comments", "links", "options", "postmeta", "posts",
        "term_relationships", "term_taxonomy", "termmeta", "terms", "usermeta", "users",
    }
    plugin_rows = []
    for row in table_rows:
        suffix = row["table"].removeprefix(summary["sql"]["probable_prefix"] or "")
        if suffix not in core_suffixes:
            plugin_rows.append(row)
    _write_csv(cfg.reports / "plugin-tables.csv", plugin_rows)
    for name in ("taxonomies.csv", "autoload-options.csv"):
        target = cfg.reports / name
        if not target.exists():
            target.write_text("name,count\n", encoding="utf-8")


def _counter_csv(path: Path, values: dict) -> None:
    _write_csv(path, [{"name": key, "count": value} for key, value in values.items()])
