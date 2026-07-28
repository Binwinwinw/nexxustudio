# Skill : Nexxus Video (v1.0)

## Mission

Capacité d'**intelligence vidéo multimodale** de La Citadelle — pas un wrapper fournisseur. Nexxus Video structure d'abord le média (probe, scènes, keyframes, transcript, OCR), puis raisonne sur un **evidence pack** gouverné.

## Positionnement

| Aspect | Choix |
|--------|-------|
| Nom produit | Nexxus Video |
| Backend | Abstrait — évolutif sans renommage skill |
| Doctrine | Local-first, fail-closed, 1–2 experts max |
| Exécution | **Job asynchrone** — jamais le chat synchrone quotidien |

## Pipeline (deux étages)

### Étape 1 — Prétraitement (déterministe, local)

1. `video.probe` — ffprobe (métadonnées, durée, audio)
2. `video.scene_detect` — découpage scènes + keyframe par scène
3. `video.transcribe` — transcription horodatée
4. `video.ocr` — texte à l'écran sur frames utiles
5. `video.pack_build` — evidence pack JSON

### Étape 2 — Analyse Nexxus (orchestrée)

6. `video.analyze` — résumé, timeline, Q/R, audit sur le pack structuré

## Entrées v1

- Vidéo **MP4 locale**
- Objectif : `summary` | `timeline` | `qa` | `audit` | `extraction` | `rag_prep`
- Profondeur : `fast` | `full`
- Egress : `local-only` (défaut) | `hybrid-controlled`

## Sorties v1

- Résumé horodaté
- Scènes clés + score de confiance
- Texte dit / texte affiché
- Incertitudes explicites
- Artefacts `evidence-pack.json`, `analysis-result.json`, `report.md`

## Limites MVP

- MP4 uniquement
- Max **10 minutes**
- Pas de génération, montage, biométrie, batch multi-vidéos, live stream

## Règles gouvernance

- **Fail-closed** : durée, format, probe, scènes ou audio insuffisants → refus explicite
- Budget temps par vidéo (`budgetSeconds`)
- Hash SHA-256 source traçable
- Spans `video.*` corrélés au `trace_id` job

## Modules code

- `server/src/services/nexxus-video/videoRouterContract.js`
- `server/src/services/nexxus-video/videoPreprocessor.js`
- `server/src/services/nexxus-video/videoEvidencePack.js`
- `server/src/services/nexxus-video/videoArtifactsService.js`
- `server/src/services/nexxus-video/nexxusVideoPipeline.js`

## Intent

- `VIDEO_ANALYSIS` — routage lazy, `asyncJob: true`, skill `skill-nexxus-video`

## Interdictions

- Analyser une vidéo « à l'aveugle » sans evidence pack
- Répondre en streaming chat pour une analyse lourde
- Inventer transcript/OCR absent du pack
- Exposer un nom de fournisseur comme identité du skill

## UX cible

Upload → objectif → job background → timeline étapes Cockpit → artefacts finaux.

### API v1 (MVP)

| Route | Rôle |
|-------|------|
| `POST /api/video/jobs` | Upload MP4 sécurisé + lancement job |
| `GET /api/video/stream/:jobId` | SSE timeline pipeline |
| `GET /api/video/jobs/:jobId` | Statut job |
| `DELETE /api/video/jobs/:jobId` | Abandon job |

Upload : allowlist `video/mp4`, magic bytes `ftyp`, nom UUID, stockage `server/data/video-uploads/` (hors web root). Rejet avec `trace_id`.

## Liens

- [[ADR-20260601-Nexxus-Video|ADR Nexxus Video]]
- [[skill-document-analysis]] — fallback texte / documents
