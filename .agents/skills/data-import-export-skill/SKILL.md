---
name: Data Import/Export Skill
---

# Skill — Data Import/Export (Quiz & Exercices)

## Objectif

Automatiser l’import/export d’exercices et de quiz (JSON, SQL, CSV), avec validation de schéma, logs détaillés et rollback sécurisé.

## Fonctions principales

- **Import** : lecture de fichiers (JSON, CSV, SQL), validation du schéma, insertion en base avec logs et rapport d’erreurs.
- **Export** : extraction filtrée (par niveau, matière, date), génération de fichiers (JSON, CSV, SQL), logs d’export et horodatage.
- **Validation** : contrôle de conformité (schéma, unicité, doublons, champs obligatoires), rapport détaillé.
- **Rollback** : possibilité d’annuler un import en cas d’erreur (backup avant import, logs de restauration).
- **Logs** : chaque opération (import/export) doit générer un log détaillé (date, utilisateur, type, statut, erreurs).

## Checklist obligatoire

- Validation schéma JSON/CSV (voir [dev/docs/DOCUMENTATION_MIGRATION_EXERCISES.md](../../dev/docs/DOCUMENTATION_MIGRATION_EXERCISES.md))
- Log d’opération dans `adminlogs` ou fichier dédié
- Rollback possible pour tout import destructif
- Rapport d’erreurs lisible et exportable

## Bonnes pratiques

- Toujours tester l’import sur une base de test avant production
- Utiliser des scripts versionnés dans `dev/tools/import_export/`
- Documenter chaque format supporté (exemple JSON, CSV, SQL)

## Liens utiles

- [DOCUMENTATION_MIGRATION_EXERCISES.md](../../dev/docs/DOCUMENTATION_MIGRATION_EXERCISES.md)
- [migration_exercices_complet.md](../../dev/docs/migration_exercices_complet.md)
- [dev/tools/import_export/](../../dev/tools/import_export/)
