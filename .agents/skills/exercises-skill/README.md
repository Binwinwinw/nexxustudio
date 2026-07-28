# Skill: exercises-skill

Ce skill automatise tous les workflows critiques liés aux exercices MonCoachScolaire : analyse, migration, enrichissement, validation, rollback. Il regroupe et documente les scripts existants pour une utilisation unifiée, reproductible et sécurisée.

## Installation

### Copilot, Claude, Cursor, Windsurf, Gemini, etc.

```bash
git clone <repo> && cp -R dev/tools/exercises-skill ~/.agents/skills/exercises-skill
```

### Utilisation

Ouvrez une session compatible et tapez :

```
/exercises-skill Analyse tous les exercices
/exercises-skill Migre la base exercices
/exercises-skill Valide la qualité des imports
```

## Structure

- `SKILL.md` : Déclencheur et description
- `scripts/` : Scripts Python/PHP/Node (voir ci-dessous)
- `references/` : Documentation détaillée
- `assets/` : Schémas, templates, données d'exemple

## Scripts inclus

- analyse_exercises.php, deduplicate_exercises_v4.php, enrich_exercises_with_ai.php, import_cleaned_exercises.php, validate_complex_exercises.php, etc.

## Documentation

- [dev/tools/README.md](../README.md)
- [DOCUMENTATION.md](../../../DOCUMENTATION.md)
- [CONTEXT_INDEX.md](../../../CONTEXT_INDEX.md)

## Support

Pour toute question, ouvrez une issue ou contactez l'équipe MonCoachScolaire.
