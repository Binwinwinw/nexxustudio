# Skill: security-audit-skill

Ce skill automatise l’audit sécurité du code, de la config et des endpoints MonCoachScolaire : scan XSS/SQLi, fichiers sensibles, droits admin, endpoints API, dépendances. Il regroupe et documente les scripts existants pour une utilisation unifiée, reproductible et sécurisée.

## Installation

### Copilot, Claude, Cursor, Windsurf, Gemini, etc.

```bash
git clone <repo> && cp -R dev/tools/security-skill ~/.agents/skills/security-skill
```

### Utilisation

Ouvrez une session compatible et tapez :

```
/security-audit-skill Lance un audit complet
/security-audit-skill Scan les endpoints API
```

## Structure

- `SKILL.md` : Déclencheur et description
- `scripts/` : Scripts PHP/JS/Shell (voir ci-dessous)
- `references/` : Documentation détaillée
- `assets/` : Modèles de rapport, regex, configs sûres

## Scripts inclus

- scan_php_vuln.php, scan_env_exposure.sh, scan_admin_rights.php, scan_api_security.js, scan_dependencies.sh, generate_security_report.php
- scan_php_security.py (analyse statique PHP & JS, voir [scan_php_security.md](scripts/scan_php_security.md))

## Documentation

- [dev/tools/README.md](../README.md)
- [DOCUMENTATION.md](../../../DOCUMENTATION.md)
- [CONTEXT_INDEX.md](../../../CONTEXT_INDEX.md)

## Support

Pour toute question, ouvrez une issue ou contactez l'équipe MonCoachScolaire.
