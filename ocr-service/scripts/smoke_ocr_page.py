#!/usr/bin/env python3
"""Smoke test stub : POST /ocr/page sur fixtures/test-page.png."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "fixtures" / "test-page.png"
BASE = os.environ.get("OCR_SERVICE_URL", "http://127.0.0.1:8765").rstrip("/")


def main() -> int:
    if not FIXTURE.is_file():
        print(f"Missing fixture: {FIXTURE}", file=sys.stderr)
        return 1

    body = json.dumps({"imagePath": str(FIXTURE.resolve())}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/ocr/page",
        data=body,
        headers={"content-type": "application/json", "accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        print(err.read().decode("utf-8", errors="replace"), file=sys.stderr)
        return 1

    if not payload.get("ok"):
        print(payload, file=sys.stderr)
        return 1
    print(json.dumps({"ok": True, "backend": payload.get("backend"), "pages": payload.get("pages")}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
