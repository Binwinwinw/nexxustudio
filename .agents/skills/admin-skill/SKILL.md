---
name: Admin Skill
---

# Skill — Admin

## Objectif

Centraliser les outils, scripts et bonnes pratiques pour la gestion, la maintenance et l’audit des opérations d’administration du site MonCoachScolaire.

## Fonctions principales

- Gestion des comptes administrateurs (création, modification, suppression)
- Suivi des logs d’administration (`adminlogs`)
- Scripts de maintenance (nettoyage, migration, backup)
- Sécurité : vérification des accès, audit des permissions
- Monitoring des actions critiques (suppression, import/export, changements de droits)

## Checklist obligatoire

- Toute action critique doit être loggée
- Scripts d’admin à exécuter uniquement depuis un compte autorisé
- Vérification des permissions avant toute opération sensible

## Bonnes pratiques

- Utiliser les scripts versionnés dans `scripts/`
- Documenter chaque opération d’admin dans `references/`
- Toujours tester sur un environnement de préproduction avant production

## Liens utiles

- [adminlogs](../../../../db/adminlogs)
- [scripts d’admin](./scripts/)
- [références admin](./references/)
