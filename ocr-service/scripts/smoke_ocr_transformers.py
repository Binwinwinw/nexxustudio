#!/usr/bin/env python3
"""
Smoke Transformers — POST /ocr/page sur sample-invoice-page.png.
Skip propre (exit 0) si CUDA / deps absents ; sinon inférence réelle + JSON debug.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "fixtures" / "sample-invoice-page.png"
DEBUG_OUT = ROOT / "out" / "smoke-transformers-debug.json"
BASE = os.environ.get("OCR_SERVICE_URL", "http://127.0.0.1:8765").rstrip("/")
SKIP_CUDA = os.environ.get("OCR_SMOKE_SKIP_IF_NO_CUDA", "1").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _cuda_available() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except ImportError:
        return False


def _runtime_blockers() -> list[str]:
    blockers: list[str] = []
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
    except ImportError as err:
        blockers.append(f"missing_dependency:{getattr(err, 'name', err)}")
        return blockers
    if not _cuda_available():
        blockers.append("cuda_unavailable")
    return blockers


def _write_debug(payload: dict) -> None:
    DEBUG_OUT.parent.mkdir(parents=True, exist_ok=True)
    DEBUG_OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Debug JSON: {DEBUG_OUT}")


def _assert_response_contract(payload: dict) -> None:
    meta = payload.get("meta") or {}
    prompt = meta.get("prompt") or payload.get("meta", {}).get("prompt")
    if not str(prompt).startswith("<image>"):
        raise AssertionError(f"Effective prompt must start with <image>, got: {prompt!r}")
    if payload.get("backend") != "transformers":
        raise AssertionError(f"Expected backend transformers, got {payload.get('backend')!r}")
    if not payload.get("ok"):
        raise AssertionError(f"OCR failed: {payload}")


def main() -> int:
    if not FIXTURE.is_file():
        print(f"Missing {FIXTURE} — run: python scripts/generate_fixture_invoice.py", file=sys.stderr)
        return 1

    blockers = _runtime_blockers()
    if blockers and SKIP_CUDA:
        debug = {
            "skipped": True,
            "reason": blockers,
            "fixture": str(FIXTURE.resolve()),
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        _write_debug(debug)
        print(json.dumps({"ok": True, "skipped": True, "reason": blockers}))
        return 0

    if blockers:
        print(json.dumps({"ok": False, "reason": blockers}), file=sys.stderr)
        return 1

    body = json.dumps({"imagePath": str(FIXTURE.resolve())}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/ocr/page",
        data=body,
        headers={"content-type": "application/json", "accept": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        _write_debug(
            {
                "ok": False,
                "http_status": err.code,
                "detail": detail,
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "ts": datetime.now(timezone.utc).isoformat(),
            },
        )
        print(detail, file=sys.stderr)
        return 1

    duration_ms = int((time.perf_counter() - started) * 1000)
    try:
        _assert_response_contract(payload)
    except AssertionError as err:
        _write_debug({"ok": False, "assertion": str(err), "payload": payload, "duration_ms": duration_ms})
        print(str(err), file=sys.stderr)
        return 1

    text_preview = (payload.get("text") or "")[:500]
    debug = {
        "ok": True,
        "skipped": False,
        "backend": payload.get("backend"),
        "pages": payload.get("pages"),
        "prompt_effective": (payload.get("meta") or {}).get("prompt"),
        "image_mode": (payload.get("meta") or {}).get("imageMode"),
        "text_chars": len(payload.get("text") or ""),
        "text_preview": text_preview,
        "duration_ms": duration_ms,
        "fixture": str(FIXTURE.resolve()),
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    _write_debug(debug)
    print(
        json.dumps(
            {
                "ok": True,
                "backend": payload.get("backend"),
                "text_chars": debug["text_chars"],
                "duration_ms": duration_ms,
            },
        ),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
