"""Chargement paresseux Unlimited-OCR (Transformers + CUDA)."""

from __future__ import annotations

import os
import threading
from typing import Any

from app.constants import DEFAULT_MODEL_ID

_lock = threading.Lock()
_cache: dict[str, Any] = {}


def _model_id() -> str:
    return os.environ.get("OCR_MODEL_ID", DEFAULT_MODEL_ID).strip() or DEFAULT_MODEL_ID


def cuda_available() -> bool:
    try:
        import torch

        return torch.cuda.is_available()
    except ImportError:
        return False


def get_runtime_error() -> str | None:
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
    except ImportError as err:
        return f"missing_dependency:{err.name}"

    if not cuda_available():
        return "cuda_unavailable: Unlimited-OCR Transformers requires NVIDIA CUDA in P0"

    return None


def get_model_and_tokenizer():
    err = get_runtime_error()
    if err:
        raise RuntimeError(err)

    import torch
    from transformers import AutoModel, AutoTokenizer

    model_id = _model_id()
    with _lock:
        if _cache.get("model_id") == model_id and "model" in _cache:
            return _cache["tokenizer"], _cache["model"]

        tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
        model = AutoModel.from_pretrained(
            model_id,
            trust_remote_code=True,
            use_safetensors=True,
            torch_dtype=torch.bfloat16,
        )
        model = model.eval().cuda()

        _cache.clear()
        _cache["model_id"] = model_id
        _cache["tokenizer"] = tokenizer
        _cache["model"] = model
        return tokenizer, model
