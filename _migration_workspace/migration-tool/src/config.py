from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Config:
    tool_root: Path
    workspace_root: Path
    source_root: Path
    workers: int
    heavy_workers: int
    batch_size: int
    memory_target_bytes: int
    disk_safety_ratio: float
    sources: dict[str, Path]

    @property
    def reports(self) -> Path:
        return self.workspace_root / "reports"

    @property
    def state_db(self) -> Path:
        return self.workspace_root / "state" / "migration.sqlite3"


def load_config(path: str | None = None) -> Config:
    tool_root = Path(__file__).resolve().parents[1]
    config_path = Path(path).resolve() if path else tool_root / "config.toml"
    if not config_path.exists():
        config_path = tool_root / "config.example.toml"
    with config_path.open("rb") as handle:
        raw = tomllib.load(handle)
    workspace_root = (tool_root / raw["workspace_root"]).resolve()
    source_root = (tool_root / raw["source_root"]).resolve()
    sources = {
        key: (source_root / value).resolve()
        for key, value in raw["sources"].items()
    }
    return Config(
        tool_root=tool_root,
        workspace_root=workspace_root,
        source_root=source_root,
        workers=int(raw["workers"]),
        heavy_workers=int(raw["heavy_workers"]),
        batch_size=int(raw["batch_size"]),
        memory_target_bytes=int(raw["memory_target_bytes"]),
        disk_safety_ratio=float(raw["disk_safety_ratio"]),
        sources=sources,
    )

