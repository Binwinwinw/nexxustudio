# ADR-20260601 : Suite Design Nexxus (Design / Impeccable / Extract)

## Statut
**Validé (spec + contrats)** — 01/06/2026

## Contexte

La Citadelle avait `skill-ui-forge` (prompt-only, fourre-tout « design »). Les besoins réels couvrent **trois moments distincts** d'un cycle design :

1. **Création** — direction artistique, design system, composants
2. **Critique** — audit qualité, polish, pre-merge
3. **Rétro-ingénierie** — ADN visuel d'un site existant

Mélanger ces rôles dans un skill unique dégrade la gouvernance (1–2 experts max) et la traçabilité.

## Décision

Trois skills Tier 3 lazy-loaded, **un seul actif par tour** (enchaînements séquentiels autorisés).

| Skill | Intent | Mission | Mode réponse |
|-------|--------|---------|--------------|
| `skill-nexxus-design` | `DESIGN_CREATE` | Concevoir DA, UI, tokens, blueprint | `OPEN_PROPOSITION` |
| `skill-impeccable` | `DESIGN_AUDIT` | Auditer cohérence, a11y, polish | `CRITICAL` |
| `skill-design-extract` | `DESIGN_EXTRACT` | Extraire ADN site (palette, patterns) | `DOCUMENT` |

### Pipeline type

```
Design Extract → Nexxus Design → Impeccable
     (ADN)         (proposition)    (pre-merge)
```

### Règles gouvernance

- Max **1 skill design principal** par tour synchrone
- Nexxus Design **n'auto-audite pas** → Impeccable
- Design Extract **n'invente pas** → fail-closed si crawl insuffisant
- `skill-ui-forge` **deprecated** → `skill-nexxus-design`

### Contrats runtime

| Module | Exports |
|--------|---------|
| `nexxusDesignContract.js` | `validateDesignCreateInput`, `buildDesignCreateEnvelope` |
| `impeccableContract.js` | `validateDesignAuditInput`, `buildImpeccableAuditEnvelope` |
| `designExtractContract.js` | `validateDesignExtractInput`, `buildDesignExtractEnvelope` |

## Non-objectifs v1

- ~~Crawl DOM / getComputedStyle implémenté~~ → spec v2 : [[Design-Extract-Worker]]
- Génération assets raster
- Les trois skills simultanés sur un même tour chat

## État d'implémentation (27/05/2026)

| Composant | Statut |
|-----------|--------|
| Contrats + intents + guards | ✅ |
| Worker v1 (HTML statique + jobs async) | ✅ |
| API `/api/design/extract/*` | ✅ |
| Tests unitaires (7/7) | ✅ |
| Crawl rendered + clustering v2 | ✅ Phase B (envelope 2.0.0, quality_gate) |
| Golden tests fixtures | partiel (2 fixtures, fail-closed) |

## Prochaines étapes

1. Implémenter clustering + envelope v2.0.0 (cf. [[Design-Extract-Worker]])
2. Brancher browser harness local-only pour `getComputedStyle`
3. Golden tests sans LLM live
4. Branchement Forge sur `buildDesignCreateEnvelope`
5. Cockpit — artefacts audit Impeccable

## Liens

- [[skill-nexxus-design]]
- [[skill-impeccable]]
- [[skill-design-extract]]
- [[ADR-20260527-Intent-Contract-Registry]]
