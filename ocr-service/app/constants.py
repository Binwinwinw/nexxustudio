"""Prompts et modes imposés côté service (recette Unlimited-OCR)."""

PAGE_PROMPT = "<image>document parsing."
DOCUMENT_PROMPT = "<image>Multi page parsing."

PAGE_IMAGE_MODE = "gundam"
DOCUMENT_IMAGE_MODE = "base"

# Gundam (single page)
GUNDAM_BASE_SIZE = 1024
GUNDAM_IMAGE_SIZE = 640
GUNDAM_CROP_MODE = True

# Base (multi-page — pass suivante)
BASE_BASE_SIZE = 1024
BASE_IMAGE_SIZE = 1024
BASE_CROP_MODE = False

DEFAULT_MAX_LENGTH = 32768
PAGE_NO_REPEAT_NGRAM_SIZE = 35
PAGE_NGRAM_WINDOW = 128

DEFAULT_MODEL_ID = "baidu/Unlimited-OCR"

ALLOWED_PAGE_EXTENSIONS = frozenset({".png", ".jpg", ".jpeg"})
