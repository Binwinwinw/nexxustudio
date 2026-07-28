# 🏰 NEXXUS CITADEL : MANUEL TECHNIQUE D'ARCHITECTURE (v3.3.8)

Ce document détaille les principes de fonctionnement du noyau souverain de la Citadelle, après son industrialisation modulaire.

## 1. Philosophie : Souveraineté & Isolation
La Citadelle repose sur trois piliers :
- **Autonomie** : Gestion locale des ressources (VRAM) sans dépendance cloud.
- **Vérifiabilité** : Chaque changement doit passer la suite de certification.
- **Discrétion** : Les protocoles internes sont invisibles pour l'utilisateur final, garantissant une expérience purement métier.

## 2. Le Cœur du Routage : ExpertRouter Hybride
Le routage ne repose plus sur une simple recherche textuelle, mais sur une fusion de classements (**RRF - Reciprocal Rank Fusion**).

### A. ExpertManifestStore
- Centralise la découverte des experts sur le disque.
- Gère l'hydratation paresseuse (**Lazy Loading**) : un expert n'est chargé en mémoire que si son score de pertinence est suffisant.

### B. ExpertScorer (Logique Pure)
- **BM25** : Analyse lexicale précise (mots-clés, termes techniques).
- **Sémantique** : Analyse conceptuelle via embeddings (ChromaDB).
- **RRF** : Fusionne les deux listes. Un expert "moyen" partout sera privilégié par rapport à un expert "excellent" sur un seul critère mais hors-sujet sur l'autre.

### C. ExpertGovernor (Arbitrage Thermique)
Le gouverneur ajuste le score final en fonction de la température du système :
- **CRUISE** : Tout est autorisé.
- **SELECTIVE** : Pénalité légère pour les modèles "froids" (évite les chargements inutiles).
- **RESTRICTED** : Interdiction de charger des modèles P3 s'ils ne sont pas déjà en VRAM.
- **PANIC** : Protection absolue des modèles Tier-1 (Identité). Les autres sont pénalisés à -1.0.

### D. Nexxus Curator (Ouvrier du Savoir)
- **Rôle** : Nettoyage, normalisation et indexation de la documentation.
- **Modèle** : `qwen3.5:4b` (SLM - Small Language Model).
- **Statut** : TIER-3 / LAZY.
- **Mission** : Soulager l'orchestrateur des tâches répétitives de mise en forme Markdown et de synthèse.

## 3. Assemblage des Prompts : SystemPromptBuilder
Le builder a été blindé contre les erreurs de polymorphisme :
- **Normalisation Souveraine** : Accepte des objets experts de formes variées et les unifie.
- **Isolation des Branches** : Sépare strictement le mode **Social** (léger, complice) du mode **Opérationnel** (rigoureux, technique).

## 4. Certification Engine
La suite de certification (`run_all_citadel_tests.js`) est le garde-fou de l'architecture :
- **SMOKE** : L'infrastructure peut-elle démarrer ?
- **CERTIFICATION** : Les contrats mathématiques et logiques sont-ils respectés ?
- **EXTENDED** : Le système survit-il à une saturation de VRAM ?

---
*Note : Pour toute évolution du noyau, la Build de Certification doit afficher un Health Score de 100%.*
