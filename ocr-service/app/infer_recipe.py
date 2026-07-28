"""
Recette d'inférence Unlimited-OCR — page unique (gundam).
Centralisée pour smoke tests et protection contre dérive de paramètres.
"""

from __future__ import annotations

from app.constants import (
    DEFAULT_MAX_LENGTH,
    GUNDAM_BASE_SIZE,
    GUNDAM_CROP_MODE,
    GUNDAM_IMAGE_SIZE,
    PAGE_NGRAM_WINDOW,
    PAGE_NO_REPEAT_NGRAM_SIZE,
    PAGE_PROMPT,
)


def assert_page_prompt_valid(prompt: str = PAGE_PROMPT) -> None:
    if not str(prompt).startswith("<image>"):
        raise ValueError("Unlimited-OCR page prompt must start with literal <image>")


def build_page_infer_kwargs(
    *,
    image_file: str,
    output_path: str,
    prompt: str = PAGE_PROMPT,
) -> dict:
    assert_page_prompt_valid(prompt)
    return {
        "prompt": prompt,
        "image_file": image_file,
        "output_path": output_path,
        "base_size": GUNDAM_BASE_SIZE,
        "image_size": GUNDAM_IMAGE_SIZE,
        "crop_mode": GUNDAM_CROP_MODE,
        "max_length": DEFAULT_MAX_LENGTH,
        "no_repeat_ngram_size": PAGE_NO_REPEAT_NGRAM_SIZE,
        "ngram_window": PAGE_NGRAM_WINDOW,
        "save_results": True,
    }


def official_page_recipe_snapshot() -> dict:
    """Snapshot testé — aligné README baidu/Unlimited-OCR (single image gundam)."""
    assert_page_prompt_valid()
    return {
        "prompt_prefix": "<image>",
        "prompt": PAGE_PROMPT,
        "base_size": GUNDAM_BASE_SIZE,
        "image_size": GUNDAM_IMAGE_SIZE,
        "crop_mode": GUNDAM_CROP_MODE,
        "max_length": DEFAULT_MAX_LENGTH,
        "no_repeat_ngram_size": PAGE_NO_REPEAT_NGRAM_SIZE,
        "ngram_window": PAGE_NGRAM_WINDOW,
        "save_results": True,
    }
