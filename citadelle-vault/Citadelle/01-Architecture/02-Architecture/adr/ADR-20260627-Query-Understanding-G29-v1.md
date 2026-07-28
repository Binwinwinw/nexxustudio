# ADR-20260627 : Query Understanding G29 v1

## Statut

**Accepté** (27/06/2026)

## Contexte

Avant G29, Nexxus routait par **premier pattern fort** : un couloir P2 gagnait, les intentions secondaires étaient parfois droppées silencieusement. G28 (math composite) a prouvé qu'une lecture multi-segment fonctionne — G29 généralise ce principe à tous les domaines.

La chaîne amont existante (IntentFrame, JustIntent, clarification gate, short-circuit) manquait d'un objet unique **`understandQuery()`** produisant domaine, plan et stratégie **avant** le routage P2.

## Décision

Introduire **Query Understanding** comme couche transversale amont dans `conversationQueryUnderstanding.js` :

```
Requête → segmenter → qualifier (registre domaines) → planifier → responseStrategy + executionPlan
```

### Doctrine étendue

> **G29 ajoute** : avant le mouvement et avant la famille, Nexxus **lit la requête**.

| Avant | Après |
|-------|-------|
| Pattern = primitive | Pattern = signal parmi d'autres |
| Premier couloir fort gagné | Plan d'exécution gouverné |
| Drop silencieux possible | `droppedSegmentCount` + plan visible |

### Sortie `understandQuery(query, history, { attachments })`

| Champ | Rôle |
|-------|------|
| `intentMode` | `single_intent` \| `multi_intent` |
| `primaryDomain` | Domaine du premier sous-but métier |
| `domains[]` | Domaines uniques détectés |
| `intents[]` | Sous-buts qualifiés par segment |
| `responseStrategy` | Stratégie globale dérivée |
| `unqualifiedSegmentCount` | Segments sans intention reconnue |

### Registre de domaines

`queryUnderstandingDomainRegistry.js` — détecteurs par segment, priorité numérique, **pas de logique parallèle** aux policies existantes.

Domaines v1 étendus (juin 2026) : `governance`, `document_analysis`, `document_synthesis`, `compare_choose`.

### Extensions livrées (juin 2026)

| Lot | Périmètre |
|-----|-----------|
| G29.1 | `governance_explain` — doctrine inline + math |
| G29.2 | `document_datetime_hybrid` — analyse fichier + datetime |
| G30 | Matrice couverture `queryUnderstandingCoverageMatrix.js` |
| G30.1 | `document_synthesis` dans registre |
| G31 | Intent family reco produit — voir [[ADR-20260627-Guided-Product-Recommendation-G31-v1]] |
| G32 | Intent family synthèse document — voir [[ADR-20260627-Guided-Document-Synthesis-G32-v1]] |

### Priorité P2

`resolveQueryCompositeShortCircuit()` **avant** les couloirs mono-intent dans `intentShortCircuit.js`.

## Conséquences

### Positives

- Requêtes multi-actions traitées comme **plan gouverné**, pas comme un seul pattern
- Composites math, document+datetime, governance+math stables
- Base pour intent families instrumentées (G31/G32)

### Compromis

- Double lecture amont : G29 + ConversationMove — convergence progressive
- Gaps documentés : dissertation (G30.2), scoping agent (G30.3), composites G30.5/G30.6

## Validation

```bash
cd server && node --test tests/query-understanding-g30-coverage.test.js
cd server && node --test tests/conversation-query-understanding.test.js
```

Spec opérationnelle : `docs/agents/query-understanding-g29-spec.md`  
Matrice : `docs/agents/query-understanding-g30-coverage-spec.md`  
Module Vault : [[../modules/Query-Understanding-G29|Query Understanding G29]]

## Liens

- [[ADR-20260707-Conversation-Move-Governance-v1|Conversation Move Governance]]
- [[ADR-20260527-Intent-Contract-Registry|Intent Contract Registry]]
- [[ADR-20260627-Guided-Product-Recommendation-G31-v1|G31 — Reco produit]]
- [[ADR-20260627-Guided-Document-Synthesis-G32-v1|G32 — Synthèse document]]
- `server/src/agent/policies/conversationQueryUnderstanding.js`
