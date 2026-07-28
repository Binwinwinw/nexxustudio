from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class OcrBlock(BaseModel):
    page: int = Field(ge=1)
    type: Literal["text", "table", "heading", "other"] = "text"
    content: str = ""


class OcrMeta(BaseModel):
    prompt: str | None = None
    imageMode: str | None = None
    stub: bool | None = None
    extra: dict[str, Any] | None = None


class OcrNormalizedResponse(BaseModel):
    ok: bool
    mode: Literal["page", "document"] = "page"
    backend: str = "stub"
    pages: int = 0
    text: str = ""
    markdown: str = ""
    blocks: list[OcrBlock] = Field(default_factory=list)
    meta: OcrMeta = Field(default_factory=OcrMeta)
    error: str | None = None
    message: str | None = None


class OcrPageRequest(BaseModel):
    imagePath: str | None = None
    imageUrl: str | None = None
    mode: Literal["gundam", "base"] = "gundam"
    prompt: str = "<image>document parsing."

    @model_validator(mode="after")
    def require_source(self) -> "OcrPageRequest":
        if not self.imagePath and not self.imageUrl:
            raise ValueError("imagePath or imageUrl required")
        return self


class OcrDocumentRequest(BaseModel):
    pdfPath: str | None = None
    imageFiles: list[str] | None = None
    mode: Literal["gundam", "base"] = "base"
    prompt: str = "<image>Multi page parsing."
    maxPages: int = Field(default=40, ge=1, le=200)

    @model_validator(mode="after")
    def require_source(self) -> "OcrDocumentRequest":
        if not self.pdfPath and not self.imageFiles:
            raise ValueError("pdfPath or imageFiles required")
        return self


class HealthResponse(BaseModel):
    ok: bool
    backend: str
    model: str = "baidu/Unlimited-OCR"


class CapabilitiesResponse(BaseModel):
    singleImage: bool = True
    multiPage: bool = True
    pdf: bool = True
    backend: str
    maxContext: int = 32768
