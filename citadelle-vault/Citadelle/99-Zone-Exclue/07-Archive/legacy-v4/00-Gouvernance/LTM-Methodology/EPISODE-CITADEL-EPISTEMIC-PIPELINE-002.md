---
title: "EPISODE 002 - Epistemic Pipeline Phase 1"
date: "2026-05-17"
status: "COMPLETED"
tags: ["epistemic-pipeline", "hardening", "fail-closed", "audit"]
---

## EPISODE 002: Hardening the Epistemic Pipeline (Phase 1)

## Contexte

L'objectif était d'industrialiser la Nexxus Citadel en implémentant des communications inter-agents robustes, en durcissant le système contre les hallucinations de modèles (JSON parsing fails, hallucinations de contenu) et en forçant une intégrité architecturale orientée "fail-closed".

## Réalisations

- **Routing Gouverné** : Séparation stricte des intentions avec un modèle rapide (`qwen3.5:4b`).
- **Retrieval Hybride** : Récupération et normalisation des documents via `EvidenceRecord`.
- **Extraction Atomique** : `FactExtractorAgent` réduit les informations en `FactRecord` et `HypothesisRecord`, sans dériver.
- **Synthèse Contrainte** : Le `SynthesisAgent` est bridé pour rédiger exclusivement à partir des claims extraits (pas de code ou logs bruts).
- **Critic Veto** : Le `CriticAgent` applique une revue claim-par-claim stricte et refuse les informations non sourcées.
- **Fail-Closed JSON** : Un système robuste de nettoyage (regex) et de gestion d'erreur de parsing garantit qu'aucune erreur de schéma ne contamine le frontend. En cas de défaut de validation, le pipeline bascule en _fallback_ ou retourne un `rejected_precheck`.
- **Async Job API** : Le pipeline est déporté sur une route `POST /api/pipeline/submit` et une route `GET /api/pipeline/:job_id` pour gérer les timeouts et suivre la trace via le `debug_trace`.

## Bilan

**Phase 1 of Nexxus Citadel : boucle de vérité bouclée, fail-closed, auditée.**
Le pipeline refuse de répondre plutôt que d'halluciner.

## Prochaines Étapes

- Phase de calibration de la sévérité du CriticAgent avec une batterie de tests pièges.
- Intégration côté frontend avec une UI asynchrone (Spinner + Polling).
- Dashboard d'audit pour visualiser la répartition des décisions.
