# ocr-service — Unlimited-OCR wrapper (La Citadelle)

Service HTTP interne. Le runtime Nexxus appelle ce service via `server/src/agent/capabilities/ocr/ocrClient.js`.

## Contrat API

- **OpenAPI** : [`openapi.yaml`](openapi.yaml) (source) + [`openapi.json`](openapi.json)
- Regénérer après changement de schéma : `python scripts/export_openapi.py`

## Démarrage rapide (stub)

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
set OCR_BACKEND=stub
uvicorn app.main:app --host 127.0.0.1 --port 8765
```

Smoke test :

```bash
python scripts/smoke_ocr_page.py          # stub HTTP
python scripts/smoke_ocr_transformers.py  # Transformers ; skip si pas CUDA
```

Fixture document métier : `fixtures/sample-invoice-page.png` (regénérer avec `python scripts/generate_fixture_invoice.py`).

Debug dernier smoke GPU : `out/smoke-transformers-debug.json` (gitignored).

Puis dans `server/.env` :

```
OCR_SERVICE_URL=http://127.0.0.1:8765
```

## Docker (stub par défaut)

```bash
docker build -t citadelle-ocr:stub .
docker run --rm -p 8765:8765 citadelle-ocr:stub
```

## Transformers minimal (POST /ocr/page, GPU)

1. Installer deps GPU : `pip install -r requirements-transformers.txt` (index PyTorch CUDA adapté).
2. `set OCR_BACKEND=transformers`
3. Une image **PNG/JPG** locale via `imagePath` — prompt **`gundam`** imposé côté service.
4. `/ocr/document` renvoie `501 not_implemented` en mode Transformers (PDF = pass P1).

Image GPU :

```bash
docker build -f Dockerfile.gpu -t citadelle-ocr:transformers .
docker run --rm --gpus all -p 8765:8765 citadelle-ocr:transformers
```

## Backends

| `OCR_BACKEND` | Usage |
|---------------|--------|
| `stub` | CI, contrat API, tests d’intégration sans GPU |
| `transformers` | P0.1 — **une page** PNG/JPG via `model.infer()` (CUDA) |
| `sglang` | P2 prod — même contrat HTTP (à venir) |

## Garde-fous service

- Prompt forcé : `/ocr/page` → `<image>document parsing.` + mode **gundam**
- `/ocr/document` → `<image>Multi page parsing.` + mode **base** (stub seulement pour l’instant)
- Validation : extension PNG/JPG/JPEG, taille max `OCR_MAX_IMAGE_BYTES` (défaut 20 Mo), en-tête fichier

Contrat détaillé : `docs/agents/unlimited-ocr-integration-v1.md`.
