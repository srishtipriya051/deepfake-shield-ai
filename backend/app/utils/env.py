from __future__ import annotations

import os
from pathlib import Path


def load_env_file(filename: str = ".env") -> None:
    root = Path(__file__).resolve().parents[3]
    env_path = root / filename
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value
