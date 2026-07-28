from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlparse

from app.constants import ALLOWED_PAGE_EXTENSIONS

DEFAULT_MAX_IMAGE_BYTES = int(os.environ.get("OCR_MAX_IMAGE_BYTES", str(20 * 1024 * 1024)))


@dataclass(frozen=True)
class ValidationError:
    code: str
    message: str


def _max_bytes() -> int:
    raw = os.environ.get("OCR_MAX_IMAGE_BYTES", "")
    if raw.strip().isdigit():
        return int(raw.strip())
    return DEFAULT_MAX_IMAGE_BYTES


def resolve_local_image_path(image_path: str | None, image_url: str | None) -> Path | ValidationError:
    if image_path:
        p = Path(image_path).expanduser()
        if not p.is_absolute():
            p = Path.cwd() / p
        return p.resolve()

    if image_url:
        parsed = urlparse(image_url.strip())
        if parsed.scheme == "file":
            raw = unquote(parsed.path)
            if os.name == "nt" and raw.startswith("/") and len(raw) > 2 and raw[2] == ":":
                raw = raw.lstrip("/")
            return Path(raw).resolve()
        return ValidationError("unsupported_url_scheme", "Only file:// imageUrl is supported in P0")

    return ValidationError("missing_image_source", "imagePath or imageUrl required")


def validate_page_image_file(path: Path) -> ValidationError | None:
    if not path.exists():
        return ValidationError("file_not_found", f"Image not found: {path}")
    if not path.is_file():
        return ValidationError("not_a_file", f"Not a file: {path}")

    ext = path.suffix.lower()
    if ext not in ALLOWED_PAGE_EXTENSIONS:
        return ValidationError(
            "unsupported_extension",
            f"Allowed extensions: {', '.join(sorted(ALLOWED_PAGE_EXTENSIONS))}",
        )

    size = path.stat().st_size
    max_b = _max_bytes()
    if size > max_b:
        return ValidationError(
            "file_too_large",
            f"Image size {size} exceeds OCR_MAX_IMAGE_BYTES ({max_b})",
        )

    try:
        with path.open("rb") as fh:
            header = fh.read(12)
    except OSError as err:
        return ValidationError("file_unreadable", str(err))

    if not _looks_like_image(header):
        return ValidationError("invalid_image_mime", "File header is not PNG or JPEG")

    return None


def _looks_like_image(header: bytes) -> bool:
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    if header[:3] == b"\xff\xd8\xff":
        return True
    return False
