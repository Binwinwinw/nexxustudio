---
name: frontend-accessibility-skill
description: Audit et guidelines accessibilité front (WCAG, ARIA, contrastes, navigation clavier). Utiliser pour valider ou corriger l’accessibilité des pages et composants JS/CSS/HTML.
argument-hint: [page ou composant] [niveau]
---

# Skill — Frontend Accessibility

## Objectif
- Auditer et corriger l’accessibilité des interfaces (pages, composants, formulaires).
- Vérifier conformité WCAG, ARIA, contrastes, navigation clavier.
- Générer un rapport d’accessibilité et des recommandations.

## Structure
- Scripts/tests dans `dev/tools/accessibility/`
- Checklist WCAG, ARIA, contrastes, navigation
- Rapport exportable (Markdown/HTML)

## Checklist
1. Contrastes suffisants
2. Navigation clavier complète
3. Labels ARIA présents
4. Focus visible
5. Tests automatisés (axe, Playwright)
6. Rapport d’accessibilité généré
