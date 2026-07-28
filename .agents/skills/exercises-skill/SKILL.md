# /exercises-skill

---

name: exercises-skill
description: >-
Automatise l'analyse, la migration, l'enrichissement et la validation des exercices MonCoachScolaire. Activez ce skill pour lancer des workflows complets sur les exercices (import, export, déduplication, audit, normalisation, validation qualité). Compatible CLI cross-plateforme, sécurité intégrée, logs détaillés, rollback simple.
license: MIT
metadata:
author: MonCoachScolaire Team
version: 1.0.0
compatibility: >-
Fonctionne sur toutes plateformes supportant Agent Skills Open Standard (SKILL.md): Copilot, Claude, Cursor, Windsurf, etc.

---

## Trigger

/skills-exercises Analyse tous les exercices et génère un rapport
/skills-exercises Migre les exercices vers le nouveau schéma
/skills-exercises Déduplique et normalise la base d'exercices
/skills-exercises Valide la qualité des exercices importés

## Description

Ce skill regroupe tous les scripts critiques pour la gestion des exercices :

- Analyse de la base (doublons, complexité, réponses nulles)
- Migration de schéma et import/export
- Enrichissement automatique (AI, normalisation)
- Validation qualité (structure, conformité, logs)
- Rollback et logs détaillés

Pour chaque workflow, voir README.md et scripts/.

---

Pour toute question, consulter [dev/tools/README.md](../README.md) ou la documentation principale.
