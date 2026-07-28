"""Backend stub — contrat stable sans modèle GPU."""

from __future__ import annotations

from pathlib import Path

from app.schemas import OcrBlock, OcrDocumentRequest, OcrMeta, OcrNormalizedResponse, OcrPageRequest


def _stub_line(label: str, source: str) -> str:
    return f"[stub-ocr] {label}: {source}\n(Remplacez OCR_BACKEND=transformers pour Unlimited-OCR réel.)"


def run_page(req: OcrPageRequest) -> OcrNormalizedResponse:
    source = req.imagePath or req.imageUrl or "unknown"
    name = Path(str(source)).name if source else "image"
    text = _stub_line("page", name)
    return OcrNormalizedResponse(
        ok=True,
        mode="page",
        backend="stub",
        pages=1,
        text=text.strip(),
        markdown=text.strip(),
        blocks=[OcrBlock(page=1, type="text", content=text.strip())],
        meta=OcrMeta(prompt=req.prompt, imageMode=req.mode, stub=True),
    )


def run_document(req: OcrDocumentRequest) -> OcrNormalizedResponse:
    if req.pdfPath:
        source = req.pdfPath
        label = Path(source).name
    else:
        label = f"{len(req.imageFiles or [])} images"
        source = ",".join(req.imageFiles or [])
    text = _stub_line("document", label)
    pages = min(req.maxPages, max(1, len(req.imageFiles or [])) or 1)
    blocks = [
        OcrBlock(page=i, type="text", content=f"{text.strip()} (page {i})")
        for i in range(1, pages + 1)
    ]
    return OcrNormalizedResponse(
        ok=True,
        mode="document",
        backend="stub",
        pages=pages,
        text="\n\n".join(b.content for b in blocks),
        markdown="\n\n".join(b.content for b in blocks),
        blocks=blocks,
        meta=OcrMeta(prompt=req.prompt, imageMode=req.mode, stub=True),
    )
