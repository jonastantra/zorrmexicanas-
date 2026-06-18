from __future__ import annotations

import argparse
import json
import sys

from .config import load_config
from .core import archive_list, audit, ensure_workspace, extract_theme, inventory, sample, status
from .state import State


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Auditor reanudable de migración WordPress")
    root.add_argument("--config")
    root.add_argument("--dry-run", action="store_true")
    root.add_argument("--batch-size", type=int)
    root.add_argument("--workers", type=int)
    commands = root.add_subparsers(dest="command", required=True)
    commands.add_parser("inventory")
    sample_cmd = commands.add_parser("sample")
    sample_cmd.add_argument("--limit", type=int, default=1000)
    sample_cmd.add_argument("--resume", action="store_true")
    archive = commands.add_parser("archive-list")
    archive.add_argument("--limit", type=int)
    archive.add_argument("--resume", action="store_true")
    audit_cmd = commands.add_parser("audit")
    audit_cmd.add_argument("--limit", type=int)
    audit_cmd.add_argument("--resume", action="store_true")
    commands.add_parser("extract-theme")
    commands.add_parser("status")
    for name in (
        "import-wordpress", "scan-media", "detect-post-duplicates",
        "detect-media-duplicates", "repair-thumbnails", "validate-embeds",
        "export-clean-data", "generate-reports", "validate-migration",
    ):
        commands.add_parser(name)
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    cfg = load_config(args.config)
    if args.batch_size:
        object.__setattr__(cfg, "batch_size", args.batch_size)
    if args.workers:
        object.__setattr__(cfg, "workers", args.workers)
    ensure_workspace(cfg, args.dry_run)
    state = State(cfg.state_db)
    try:
        if args.command == "inventory":
            result = inventory(cfg, state, args.dry_run)
        elif args.command == "sample":
            result = sample(cfg, state, args.limit, args.resume, args.dry_run)
        elif args.command == "archive-list":
            result = archive_list(cfg, state, args.limit, args.resume, args.dry_run)
        elif args.command == "audit":
            result = audit(cfg, state, args.resume, args.limit, args.dry_run)
        elif args.command == "extract-theme":
            result = extract_theme(cfg, args.dry_run)
        elif args.command == "status":
            result = status(state)
        else:
            result = {"command": args.command, "status": "planned", "implemented": False}
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    except Exception as exc:
        state.error(args.command, "", exc)
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1
    finally:
        state.close()


if __name__ == "__main__":
    raise SystemExit(main())

