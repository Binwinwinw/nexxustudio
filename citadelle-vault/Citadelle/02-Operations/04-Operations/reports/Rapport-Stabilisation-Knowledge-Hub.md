# Rapport de Stabilisation : Knowledge Hub (Phase 1)

**Date** : 2026-05-03  
**Statut** : 🔐 Scellé  
**Expert** : Nexxus (Architecte-Mentor)

## 1. Contexte et Objectifs
Ce rapport clôture la phase initiale de déploiement de la mémoire vectorielle souveraine de La Citadelle. L'objectif était d'établir une infrastructure RAG (Retrieval-Augmented Generation) sécurisée, performante et auto-documentée avant toute expansion vers des projets tiers massifs.

## 2. Réalisations Techniques

### A. Infrastructure & Sécurité (Zero-Trust)
- **Isolation** : ChromaDB restreint à l'interface loopback (`127.0.0.1:8008`).
- **Authentification** : Protection de l'indexation par `INTERNAL_API_TOKEN`.
- **Gating Session** : Analyse visuelle soumise à un contrôle de session (`requireSessionAccess`).
- **CORS** : Hardening strict sur les origines autorisées.

### B. Stratégie de Chunking Adaptatif
- **Markdown/ADR** : Chunks larges (2000 chars) avec overlap (400 chars) et **propagation injective des titres** (H1 > H2 > H3) dans le texte de l'embedding.
- **Configurations (YAML)** : Fragmentation structure-aware (par service/clé racine) avec conservation du contexte parent.
- **Algorithme** : Implémentation du "Soft-Split" pour maintenir la cohérence sémantique des petites sections.

### C. Gouvernance (ADR-003 & ADR-004)
- Normalisation du schéma de métadonnées V3.1.
- Ingestion prioritaire du patrimoine interne (Citadelle Core).

## 3. État du Benchmark RAG (Baseline)
- **Score Global** : 4/7 (Succès sur l'identité, l'architecture et la sécurité).
- **Qualité Qualitative** : 
    - Le rappel sémantique sur l'identité de Nexxus et ses conseils stratégiques est désormais à **100% de fiabilité**.
    - **Points de vigilance** : Concurrence sémantique entre les ADR (narratifs) et les Manifestes d'experts (structurés) sur des requêtes transversales (ex: métadonnées).

## 4. Limites Connues & Risques Résiduels
- **Compétition Sémantique** : Certains documents "politiques" peuvent masquer des fichiers de configuration bruts si les requêtes ne sont pas assez spécifiques.
- **Fragmentation des Listes** : Les listes techniques exhaustives restent sensibles au découpage si elles dépassent le seuil de 2000 caractères.

## 5. Critères de Passage (Go/No-Go) : MonCoachScolaire
L'ingestion massive de `MonCoachScolaire` est suspendue jusqu'à satisfaction des critères suivants :
1. **Indexation Pilote** : Validation du comportement du RAG sur un sous-ensemble (ex: 1 module technique) sans dégrader le score Citadelle.
2. **Isolation des Collections** : Évaluation de la nécessité de créer une collection Chroma séparée pour éviter la dilution sémantique.
3. **Mise à jour du Router** : Adaptation de la sélection d'experts pour intégrer la dimension "Projet Externe".

## Conclusion
La Citadelle dispose désormais d'un **socle de mémoire robuste et sécurisé**. La phase 1 est validée. Le système est stabilisé et prêt pour une expansion progressive et contrôlée.
