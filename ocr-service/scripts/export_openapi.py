#!/usr/bin/env python3
"""Exporte openapi.json depuis l'app FastAPI (à committer après changement de contrat)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402


def main() -> None:
    spec = app.openapi()
    out_json = ROOT / "openapi.json"
    out_yaml = ROOT / "openapi.yaml"
    out_json.write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    try:
        import yaml  # type: ignore

        out_yaml.write_text(
            yaml.safe_dump(spec, sort_keys=False, allow_unicode=True),
            encoding="utf-8",
        )
    except ImportError:
        print("PyYAML absent — openapi.json écrit seulement.", file=sys.stderr)
    print(f"Wrote {out_json}")


if __name__ == "__main__":
    main()
