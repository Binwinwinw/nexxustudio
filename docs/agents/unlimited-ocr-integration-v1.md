# Unlimited-OCR — intégration La Citadelle (v1)

**État** : P0.1 (2026-07-27) — OpenAPI figé, Docker stub/GPU, Transformers minimal sur `/ocr/page`.  
**Principe** : micro-service OCR dédié, **jamais** dans l’orchestrateur ; activation par intent/PJ comme Graphify.

**Contrat machine** : [`ocr-service/openapi.yaml`](../../ocr-service/openapi.yaml)

### P0.1 — OpenAPI + Docker + Transformers page

- [`ocr-service/openapi.yaml`](../../ocr-service/openapi.yaml), Docker stub/GPU
- Transformers : **`POST /ocr/page`** uniquement ; recette centralisée [`app/infer_recipe.py`](../../ocr-service/app/infer_recipe.py)
- Fixture métier : `fixtures/sample-invoice-page.png` ; smoke `scripts/smoke_ocr_transformers.py` (skip CUDA-aware)

## Phases

| Phase | Choix | But |
|-------|--------|-----|
| P0 | FastAPI + stub + capability `tool.ocr` | Contrat + garde-fous Citadelle |
| P0.1 | OpenAPI + Dockerfile + Transformers `/ocr/page` | Smoke GPU une page PNG |
| P1 | `infer_multi` PDF / pages | Document réel Transformers |
| P2 | SGLang derrière le même contrat HTTP | Throughput prod |
| P3 | Ingestion RAG (chunks / index markdown) | Exploiter sorties normalisées |

## Architecture

```
Citadelle (Node)                    ocr-service (Python)
─────────────────                   ────────────────────
composeCapabilityContext            POST /ocr/page
  tool.ocr match                    POST /ocr/document
ocrClient.js (timeout, validate)    GET  /health
toolExecutor ocr_*                  GET  /capabilities
```

Backends internes au service : `stub` (défaut dev/CI) → `transformers` (P0 GPU local) → `sglang` (P2 prod).

## Contrat HTTP

### POST /ocr/page

Requête :

```json
{
  "imagePath": "/data/uploads/scan.png",
  "imageUrl": null,
  "mode": "gundam",
  "prompt": "<image>document parsing."
}
```

Au moins un de `imagePath` ou `imageUrl` (chemins **locaux au service** ou URL `file://` côté service).

> **P0.1** : le service **écrase** `prompt` et `mode` (`gundam` imposé). Le client peut les omettre.

### POST /ocr/document

Requête :

```json
{
  "pdfPath": "/data/docs/contract.pdf",
  "imageFiles": null,
  "mode": "base",
  "prompt": "<image>Multi page parsing.",
  "maxPages": 40
}
```

Ou liste `imageFiles` pour pages pré-rasterisées.

### Réponse normalisée (produit)

```json
{
  "ok": true,
  "mode": "document",
  "backend": "transformers",
  "pages": 12,
  "text": "...",
  "markdown": "...",
  "blocks": [
    { "page": 1, "type": "text", "content": "..." },
    { "page": 3, "type": "table", "content": "| col1 | col2 |" }
  ],
  "meta": {
    "prompt": "<image>Multi page parsing.",
    "imageMode": "base"
  }
}
```

Erreur :

```json
{
  "ok": false,
  "error": "unsupported_type",
  "message": "..."
}
```

### GET /health

```json
{
  "ok": true,
  "backend": "stub",
  "model": "baidu/Unlimited-OCR"
}
```

### GET /capabilities

```json
{
  "singleImage": true,
  "multiPage": true,
  "pdf": true,
  "backend": "stub",
  "maxContext": 32768
}
```

## Variables Citadelle

| Variable | Description |
|----------|-------------|
| `OCR_SERVICE_URL` | Base URL (ex. `http://127.0.0.1:8765`) — sans URL, pack inactif |
| `OCR_SERVICE_TIMEOUT_MS` | Timeout HTTP (défaut 120000) |
| `OCR_SERVICE_ASSUME_READY` | `1` — skip health check (tests locaux) |
| `OCR_MAX_PAGES_DEFAULT` | Plafond pages document (défaut 40) |

## Règles d’activation `tool.ocr`

**ON** : contrats document (`DOCUMENT_ATTACHED`, `DOCUMENT_ANALYSIS`, `GUIDED_DOCUMENT_SYNTHESIS`), PJ PDF/image + verbes extract/OCR/index, tâches pièce jointe document.

**OFF** : pédagogie/support/social, chat sans signal document, PJ absente ou type non supporté, « décris cette photo » sans besoin OCR long (vision simple).

## Outils agentiques

- `ocr_page({ imagePath, purpose? })` — image / capture / scan unique (`mode=gundam`).
- `ocr_document({ pdfPath, maxPages?, purpose? })` — PDF multi-pages (`mode=base`).

## Déploiement

- **Option A** : conteneur `ocr-service` + GPU attachée au service uniquement.
- **Option B** : service mutualisé atelier + Citadelle + batch ingestion.

Lancer le service :

```bash
cd ocr-service
pip install -r requirements.txt
OCR_BACKEND=stub uvicorn app.main:app --host 127.0.0.1 --port 8765
```

## Références

- Unlimited-OCR (Transformers / SGLang) — voir doc upstream DeepWiki / GitHub `baidu/Unlimited-OCR`.
- Capability packs : [capability-packs-v1.md](./capability-packs-v1.md).
