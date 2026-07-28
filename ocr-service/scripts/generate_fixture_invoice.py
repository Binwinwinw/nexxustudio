#!/usr/bin/env python3
"""Génère fixtures/sample-invoice-page.png — scan facture simple (texte lisible)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "fixtures" / "sample-invoice-page.png"

LINES = [
    "FACTURE N 2026-042",
    "La Citadelle / Nexxus Studio",
    "Date: 27/07/2026",
    "",
    "Prestation support technique    100,00 EUR",
    "TVA 20%                          20,00 EUR",
    "Total TTC                       120,00 EUR",
    "",
    "Merci pour votre confiance.",
]


def main() -> int:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("Install pillow: pip install pillow", file=sys.stderr)
        return 1

    w, h = 900, 620
    img = Image.new("RGB", (w, h), color=(252, 252, 250))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 28)
        font_sm = ImageFont.truetype("arial.ttf", 22)
    except OSError:
        font = ImageFont.load_default()
        font_sm = font

    y = 40
    for i, line in enumerate(LINES):
        f = font if i < 3 else font_sm
        draw.text((48, y), line, fill=(20, 20, 24), font=f)
        y += 42 if line else 20

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, format="PNG", optimize=True)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
