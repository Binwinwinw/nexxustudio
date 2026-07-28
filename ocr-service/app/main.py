from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException

from app.backends import stub, transformers_backend
from app.constants import DOCUMENT_IMAGE_MODE, DOCUMENT_PROMPT, PAGE_IMAGE_MODE, PAGE_PROMPT
from app.schemas import (
    CapabilitiesResponse,
    HealthResponse,
    OcrDocumentRequest,
    OcrNormalizedResponse,
    OcrPageRequest,
)
from app.validation import ValidationError, resolve_local_image_path, validate_page_image_file

BACKEND = os.environ.get("OCR_BACKEND", "stub").strip().lower()
MODEL_ID = os.environ.get("OCR_MODEL_ID", "baidu/Unlimited-OCR")

app = FastAPI(
    title="La Citadelle OCR Service",
    version="0.2.0",
    description="Micro-service Unlimited-OCR — contrat HTTP interne La Citadelle / Nexxus.",
)


def _backend_module():
    if BACKEND == "transformers":
        return transformers_backend
    return stub


def _capabilities_for_backend() -> CapabilitiesResponse:
    if BACKEND == "transformers":
        return CapabilitiesResponse(
            singleImage=True,
            multiPage=False,
            pdf=False,
            backend=BACKEND,
            maxContext=32768,
        )
    return CapabilitiesResponse(
        singleImage=True,
        multiPage=True,
        pdf=True,
        backend=BACKEND,
        maxContext=32768,
    )


def _normalize_page_request(body: OcrPageRequest) -> OcrPageRequest:
    """Prompt et mode imposés — ignore les valeurs client."""
    return body.model_copy(
        update={
            "mode": PAGE_IMAGE_MODE,
            "prompt": PAGE_PROMPT,
        },
    )


def _normalize_document_request(body: OcrDocumentRequest) -> OcrDocumentRequest:
    return body.model_copy(
        update={
            "mode": DOCUMENT_IMAGE_MODE,
            "prompt": DOCUMENT_PROMPT,
        },
    )


def _validate_page_or_raise(body: OcrPageRequest) -> None:
    resolved = resolve_local_image_path(body.imagePath, body.imageUrl)
    if isinstance(resolved, ValidationError):
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": resolved.code, "message": resolved.message},
        )
    err = validate_page_image_file(resolved)
    if err:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": err.code, "message": err.message},
        )


@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health() -> HealthResponse:
    return HealthResponse(ok=True, backend=BACKEND, model=MODEL_ID)


@app.get("/capabilities", response_model=CapabilitiesResponse, tags=["meta"])
def capabilities() -> CapabilitiesResponse:
    return _capabilities_for_backend()


@app.post("/ocr/page", response_model=OcrNormalizedResponse, tags=["ocr"])
def ocr_page(body: OcrPageRequest) -> OcrNormalizedResponse:
    normalized = _normalize_page_request(body)
    _validate_page_or_raise(normalized)
    mod = _backend_module()
    result = mod.run_page(normalized)
    if not result.ok:
        status = 503 if result.error in {"runtime_unavailable", "infer_failed", "empty_model_output"} else 400
        raise HTTPException(status_code=status, detail=result.model_dump())
    return result


@app.post("/ocr/document", response_model=OcrNormalizedResponse, tags=["ocr"])
def ocr_document(body: OcrDocumentRequest) -> OcrNormalizedResponse:
    normalized = _normalize_document_request(body)
    mod = _backend_module()
    result = mod.run_document(normalized)
    if not result.ok:
        status = 501 if result.error == "not_implemented" else 503
        raise HTTPException(status_code=status, detail=result.model_dump())
    return result
