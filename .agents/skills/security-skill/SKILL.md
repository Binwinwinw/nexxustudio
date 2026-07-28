# /security-audit-skill

---

name: security-audit-skill
description: >-
Audit automatisé de la sécurité du code, de la configuration et des endpoints MonCoachScolaire. Détecte failles XSS/SQLi, fichiers sensibles exposés, droits admin, endpoints non sécurisés, dépendances vulnérables. Génère un rapport détaillé et propose des correctifs.
license: MIT
metadata:
author: MonCoachScolaire Team
version: 1.0.0
compatibility: >-
Fonctionne sur toutes plateformes supportant Agent Skills Open Standard (SKILL.md): Copilot, Claude, Cursor, Windsurf, etc.

---

## Trigger

/security-audit-skill Lance un audit complet
/security-audit-skill Vérifie les droits admin
/security-audit-skill Scan les endpoints API
/security-audit-skill Génère un rapport sécurité

## Description

Ce skill regroupe tous les scripts critiques pour l’audit sécurité :

- Scan code PHP (patterns dangereux, XSS, SQLi)
- Vérification fichiers sensibles exposés (.env, .sql, logs)
- Audit droits admin et accès API
- Scan dépendances (composer/npm audit)
- Génération de rapport détaillé avec score et recommandations

Pour chaque workflow, voir README.md et scripts/.

---

Pour toute question, consulter [dev/tools/README.md](../README.md) ou la documentation principale.
