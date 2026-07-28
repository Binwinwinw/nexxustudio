# Skill: quiz-generator-skill

Ce skill automatise tous les workflows critiques liés aux quiz diagnostiques MonCoachScolaire : génération, enrichissement, validation, harmonisation, rollback. Il regroupe et documente les scripts existants pour une utilisation unifiée, reproductible et sécurisée.

## Installation

### Copilot, Claude, Cursor, Windsurf, Gemini, etc.

```bash
git clone <repo> && cp -R dev/tools/quiz-generator-skill ~/.agents/skills/quiz-generator-skill
```

### Utilisation

Ouvrez une session compatible et tapez :

```
/quiz-generator-skill Génère un quiz 1ère
/quiz-generator-skill Valide la banque quiz
/quiz-generator-skill Enrichit les quiz prioritaires
```

## Structure

- `SKILL.md` : Déclencheur et description
- `scripts/` : Scripts Python/Node/PHP (voir ci-dessous)
- `references/` : Documentation détaillée
- `assets/` : Schémas, templates, exemples

## Scripts inclus

- generate_0template.py, generate_quiz_bank.py, enrich_batch_auto.py, validate_quiz_bank.py, validate_quiz_quality.py, etc.

## Documentation

- [dev/tools/README.md](../README.md)
- [DOCUMENTATION.md](../../../DOCUMENTATION.md)
- [CONTEXT_INDEX.md](../../../CONTEXT_INDEX.md)

## Support

Pour toute question, ouvrez une issue ou contactez l'équipe MonCoachScolaire.
