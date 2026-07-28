# ADR-20260601 : Nexxus Video — intelligence vidéo multimodale

## Statut
**Validé (spec + scaffold)** — 01/06/2026  
Implémentation pipeline : MVP v1 ; skill `enabled: false` jusqu'à branchement upload.

## Contexte

La Citadelle dispose d'analyse documentaire (`skill-document-analysis`) et vision image (`VISION_ATTACHED`), mais pas de capacité vidéo structurée. Les pipelines vidéo robustes séparent **extraction de signal** (scènes, keyframes, transcript, OCR) et **interprétation** (résumé, Q/R, audit).

Nom retenu : **Nexxus Video** — capacité métier de l'écosystème, sans exposer un fournisseur backend.

## Décision

### Architecture deux étages

| Étage | Rôle | Nature |
|-------|------|--------|
| Prétraitement | probe, scènes, keyframes, audio, OCR, transcript | Déterministe, local |
| Analyse Nexxus | résumé, QA, audit, timeline, RAG prep | Orchestrée, gouvernée |

Nexxus Video **ne regarde pas** la vidéo brute en inférence directe : il raisonne sur un **evidence pack** JSON.

### Skill runtime

- ID : `skill-nexxus-video`
- Intent : `VIDEO_ANALYSIS`
- Exécution : **job asynchrone** (`routing.asyncJob: true`) — hors chat synchrone
- Lazy-loaded ; max 1 expert actif
- Spans traces : `video.probe`, `video.scene_detect`, `video.transcribe`, `video.ocr`, `video.pack_build`, `video.analyze`

### MVP v1

| Inclus | Exclu |
|--------|-------|
| MP4 local, ≤ 10 min | Génération / montage |
| 1 keyframe / scène | Biométrie |
| Transcription horodatée (stub → whisper) | Batch multi-vidéos |
| OCR frames (stub) | Live stream |
| Résumé + timeline + artefacts JSON/MD | Ingestion RAG auto |

### Gouvernance fail-closed

Refus explicites : format, durée, taille, probe, audio absent si requis, scènes non fiables, objectif au-delà du signal.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `server/data/skills/skill-nexxus-video/` | meta, SKILL, checklist |
| `server/src/services/nexxus-video/videoRouterContract.js` | Limites, objectifs, validation |
| `server/src/services/nexxus-video/videoPreprocessor.js` | ffprobe / scènes / stubs |
| `server/src/services/nexxus-video/videoEvidencePack.js` | Evidence pack |
| `server/src/services/nexxus-video/videoArtifactsService.js` | Persistance artefacts |
| `server/src/services/nexxus-video/nexxusVideoPipeline.js` | Orchestrateur job |

## Prochaines étapes

1. ~~Upload MP4~~ ✅ `POST /api/video/jobs` (magic bytes, UUID, hors web root)
2. ~~Job queue~~ ✅ `VideoJobManager` + SSE `/api/video/stream/:jobId`
3. Whisper local + OCR frame
4. UI Cockpit — timeline `video.*` + artefacts
5. Activer `enabled: true` après E2E transcript réel + Cockpit

## Liens

- [[skill-nexxus-video|Skill Nexxus Video]]
- [[ADR-20260527-Intent-Contract-Registry|Intent Contract Registry]]
- [[ADR-002-Sovereign-Multimodal-Vision|Vision multimodale]]
