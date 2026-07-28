# Skill : Impeccable (v1.0)

## Mission

**Critique qualité design et UX** — évaluer cohérence, hiérarchie, rythme, lisibilité, accessibilité, affordance et finition. N'invente pas ; audite.

## Quand l'utiliser

- « Est-ce que ce design est propre ? »
- « Qu'est-ce qui manque pour faire premium ? »
- « Audite cette page »
- « Liste les incohérences UI »
- « Prépare une checklist pre-merge design »

## Sorties (contrat v1)

```json
{
  "score_global": 0-100,
  "issues": [{ "severity": "blocker|major|minor|nit", "dimension": "...", "message": "..." }],
  "quick_wins": [],
  "blockers": [],
  "checklist_pre_merge": []
}
```

## Dimensions auditées

Cohérence, hiérarchie, rythme, lisibilité, accessibilité, affordance, densité, contraste, continuité.

## Non-objectifs

- Création / refonte complète → `skill-nexxus-design`
- Extraction ADN site → `skill-design-extract`

## Intent

`DESIGN_AUDIT`

## Liens

- [[skill-nexxus-design]]
- [[skill-quality-gate]] — gate technique complémentaire
