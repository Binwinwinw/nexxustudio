---
name: doc-generator-skill
description: Générateur de documentation centralisée (README, QUICK_START, API, onboarding). Utiliser pour automatiser la création et la mise à jour de la documentation projet.
argument-hint: [type de doc] [cible]
---

# Skill — Documentation Generator

## Objectif
- Générer et maintenir la documentation essentielle du projet (README, QUICK_START, API, guides onboarding).
- Centraliser les templates et automatiser la mise à jour.

## Structure
- Scripts dans `dev/tools/doc_generator/`
- Templates Markdown pour chaque type de doc
- Génération automatique à partir des sources (scripts, schémas, API)

## Commandes
- Générer README : `python generate_readme.py`
- Générer QUICK_START : `python generate_quickstart.py`
- Générer doc API : `php generate_api_doc.php`

## Checklist
1. Documentation à jour
2. Templates versionnés
3. Génération automatisée
4. Liens essentiels présents
5. Rapport de génération
