# /migration-skill

---

name: migration-skill
description: >-
Automatise la migration, la synchronisation et la gestion des schémas de base de données et d’exercices pour MonCoachScolaire. Activez ce skill pour exécuter des migrations SQL/PHP, synchroniser les environnements, générer la documentation de migration et valider la cohérence des données. Sécurité intégrée, logs détaillés, rollback simple.
license: MIT
metadata:
author: MonCoachScolaire Team
version: 1.0.0
compatibility: >-
Fonctionne sur toutes plateformes supportant Agent Skills Open Standard (SKILL.md): Copilot, Claude, Cursor, Windsurf, etc.

---

## Trigger

/migration-skill Applique la migration de schéma exercices
/migration-skill Synchronise la base de production
/migration-skill Génère la documentation de migration
/migration-skill Valide la cohérence post-migration

## Description

Ce skill regroupe tous les scripts critiques pour la migration et la synchronisation :

- Application de migrations SQL/PHP
- Synchronisation entre environnements (dev/prod)
- Génération de documentation de migration
- Validation de cohérence post-migration
- Rollback et logs détaillés

Pour chaque workflow, voir README.md et scripts/.

---

Pour toute question, consulter [dev/tools/README.md](../README.md) ou la documentation principale.
