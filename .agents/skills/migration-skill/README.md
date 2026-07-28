# Skill: migration-skill

Ce skill automatise tous les workflows critiques de migration et synchronisation pour MonCoachScolaire : application de migrations SQL/PHP, synchronisation dev/prod, documentation, validation, rollback. Il regroupe et documente les scripts existants pour une utilisation unifiée, reproductible et sécurisée.

## Installation

### Copilot, Claude, Cursor, Windsurf, Gemini, etc.

```bash
git clone <repo> && cp -R dev/tools/migration-skill ~/.agents/skills/migration-skill
```

### Utilisation

Ouvrez une session compatible et tapez :

```
/migration-skill Applique la migration exercices
/migration-skill Synchronise la base prod
/migration-skill Génère la doc migration
```

## Structure

- `SKILL.md` : Déclencheur et description
- `scripts/` : Scripts PHP/SQL/PowerShell (voir ci-dessous)
- `references/` : Documentation détaillée
- `assets/` : Schémas, templates, exemples

## Scripts inclus

- apply_migration.php, migrate_to_production.php, generate_sync_sql.php, run_tips_migration.php, etc.

## Documentation

- [dev/tools/README.md](../README.md)
- [DOCUMENTATION.md](../../../DOCUMENTATION.md)
- [CONTEXT_INDEX.md](../../../CONTEXT_INDEX.md)

## Support

Pour toute question, ouvrez une issue ou contactez l'équipe MonCoachScolaire.
