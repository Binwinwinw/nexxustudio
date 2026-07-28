"""
Backend Transformers — POST /ocr/page réel (gundam), document réservé pass suivante.
"""

from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

from app.backends import model_loader
from app.constants import (
    DOCUMENT_IMAGE_MODE,
    DOCUMENT_PROMPT,
    PAGE_IMAGE_MODE,
    PAGE_PROMPT,
)
from app.infer_recipe import build_page_infer_kwargs
from app.schemas import OcrBlock, OcrDocumentRequest, OcrMeta, OcrNormalizedResponse, OcrPageRequest
from app.validation import ValidationError, resolve_local_image_path, validate_page_image_file


def _read_infer_output(output_dir: Path) -> str:
    for path in sorted(output_dir.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() in {".md", ".txt", ".json"}:
            text = path.read_text(encoding="utf-8", errors="replace").strip()
            if text:
                return text
    merged = output_dir / "result.txt"
    if merged.is_file():
        return merged.read_text(encoding="utf-8", errors="replace").strip()
    return ""


def run_page(req: OcrPageRequest) -> OcrNormalizedResponse:
    runtime_err = model_loader.get_runtime_error()
    if runtime_err:
        return OcrNormalizedResponse(
            ok=False,
            mode="page",
            backend="transformers",
            error="runtime_unavailable",
            message=runtime_err,
        )

    resolved = resolve_local_image_path(req.imagePath, req.imageUrl)
    if isinstance(resolved, ValidationError):
        return OcrNormalizedResponse(
            ok=False,
            mode="page",
            backend="transformers",
            error=resolved.code,
            message=resolved.message,
        )

    path: Path = resolved
    validation = validate_page_image_file(path)
    if validation:
        return OcrNormalizedResponse(
            ok=False,
            mode="page",
            backend="transformers",
            error=validation.code,
            message=validation.message,
        )

    prompt = PAGE_PROMPT
    out_dir = tempfile.mkdtemp(prefix="citadelle-ocr-")
    try:
        tokenizer, model = model_loader.get_model_and_tokenizer()
        infer_kw = build_page_infer_kwargs(image_file=str(path), output_path=out_dir, prompt=prompt)
        raw = model.infer(tokenizer, **infer_kw)
        text = raw.strip() if isinstance(raw, str) and raw.strip() else _read_infer_output(Path(out_dir))

        if not text:
            return OcrNormalizedResponse(
                ok=False,
                mode="page",
                backend="transformers",
                error="empty_model_output",
                message="infer() returned no text; check GPU memory and image content",
            )

        model_id = os.environ.get("OCR_MODEL_ID", "baidu/Unlimited-OCR")
        return OcrNormalizedResponse(
            ok=True,
            mode="page",
            backend="transformers",
            pages=1,
            text=text,
            markdown=text,
            blocks=[OcrBlock(page=1, type="text", content=text)],
            meta=OcrMeta(
                prompt=prompt,
                imageMode=PAGE_IMAGE_MODE,
                stub=False,
                extra={"source": str(path), "model_id": model_id},
            ),
        )
    except Exception as err:  # noqa: BLE001
        return OcrNormalizedResponse(
            ok=False,
            mode="page",
            backend="transformers",
            error="infer_failed",
            message=str(err),
        )
    finally:
        shutil.rmtree(out_dir, ignore_errors=True)


def run_document(_req: OcrDocumentRequest) -> OcrNormalizedResponse:
    return OcrNormalizedResponse(
        ok=False,
        mode="document",
        backend="transformers",
        error="not_implemented",
        message=(
            "PDF / multi-page Transformers pass P1 — use OCR_BACKEND=stub for contract tests "
            f"or wait for infer_multi ({DOCUMENT_IMAGE_MODE}, prompt forced server-side)."
        ),
        meta=OcrMeta(prompt=DOCUMENT_PROMPT, imageMode=DOCUMENT_IMAGE_MODE, stub=False),
    )
