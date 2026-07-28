# ADR-20260627 : Guided Product Recommendation G31 v1

## Statut

**Accepté** (27/06/2026)

## Contexte

Requêtes du type « je veux acheter un smartphone, que me conseilles-tu » tombaient dans une cascade dégradée :

1. Patterns trop étroits (`conseillerais-tu` seul) → `compare_choose` non déclenché
2. Slots budget/usage ignorés
3. Bypass `DIRECT_EXPLANATION` + web search coûteux sans contrôle

Le système **mentait sur ce qu'il exécutait** : stratégie déclarée ≠ stratégie effective.

## Décision

Instrumenter `compare_choose` comme **première intent family complète** (playbook G29) :

```
intent → slots → stratégie → contrat → web borné → validator
```

### G31.1 — Détection

`compareChooseCompositePolicy.js` — domaine `compare_choose`, patterns élargis (`conseilles-tu`, `me conseilles`, `tu recommandes`).

### G31.2 — Slots

| Slot | Obligatoire (produit) |
|------|----------------------|
| `budget` | oui |
| `usage` | oui |

- Incomplet → `partial_clarify`, gate `compare_choose_missing_slots`
- Complet → `guided_recommendation`

### G31.3 — Contrat orchestrateur

`GUIDED_PRODUCT_RECOMMENDATION` (priority 715) :

| Contrainte | Valeur |
|------------|--------|
| Web search max sources | 3 |
| Timeout web | 8 s |
| Garde | `isGuidedProductRecommendationRequest` |

Slots propagés : `packet.meta.product_reco_slots`

### G31.4 — Validator

`productRecoValidator.js` :

- Filtrage sources obsolètes (iPhone 15, S23…)
- Cohérence budget ≤700 vs flagship
- Sanitization reply post-Composer

### Observabilité

Triplet `strategy_declared` / `strategy_effective` / `strategy_override_reason` (`strategyExecutionTelemetry.js`).

Télémétrie : `required_slots`, `missing_slots`, `policy_match_reason`, `domain_confidence`.

## Conséquences

- Reco produit **inspectable** — alignement logs/comportement
- Pattern réutilisable pour autres domaines métier (→ G32)
- Risque résiduel : qualité perçue dépend du validator post-search, pas seulement du search

## Validation

```bash
cd server && node --test tests/compare-choose-g31-policy.test.js
cd server && node --test tests/guided-product-recommendation-g31-policy.test.js
```

Cas matrice : G31-C1, G31-C2, G31-C3

## Liens

- [[ADR-20260627-Query-Understanding-G29-v1|Query Understanding G29]]
- [[ADR-20260527-Intent-Contract-Registry|Intent Contract Registry]]
- `server/src/agent/policies/compareChooseCompositePolicy.js`
- `server/src/agent/policies/guidedProductRecommendationPolicy.js`
- `server/src/agent/policies/productRecoValidator.js`
