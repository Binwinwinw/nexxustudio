# G30 — Batterie de couverture intentionnelle

> Doctrine : tester **domaine, plan, stratégie, absence de drop** — pas la qualité littéraire.

Référence noyau : [query-understanding-g29-spec.md](./query-understanding-g29-spec.md)

**Vault** : [ADR G29](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260627-Query-Understanding-G29-v1.md) · [Module](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/modules/Query-Understanding-G29.md) · [Index ADR](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/Index-ADR.md)

**État juin 2026** : **16 cas verts** + **4 gaps** documentés (G30.2, G30.3, G30.5, G30.6). Extensions G31 (3 cas) et G32 (2 cas) intégrées à la même matrice.

---

## Objectif

Savoir si Nexxus traitera un type de requête **sans essai à l'impression** : chaque scénario a des attentes explicites sur `understandQuery()` et `buildExecutionPlan()`.

---

## Grille de validation (7 colonnes)

| Vérification | Question |
|--------------|----------|
| **Domaine** | Le bon `primaryDomain` / `domains[]` ? |
| **Plan** | `executionPlan` cohérent, steps non vides si multi-intent ? |
| **Couloir** | `responseStrategy` / `path` logiques ? |
| **Couverture** | Toutes les sous-demandes reconnues (`unqualifiedSegmentCount === 0`) ? |
| **Observabilité** | Logs / `pipelinePath` / `intentContractId` reflètent le plan ? |
| **Surface** | La réponse finale correspond (hors scope G30 L1) ? |
| **Échec honnête** | Limite nommée, pas de fausse confiance ? |

---

## 4 niveaux de test

### L1 — Intention

Vérifier domaine, `intentMode`, `responseStrategy`, `pipelinePath` cible.

### L2 — Variantes de formulation

Même besoin, surfaces différentes. Si une seule formule marche → pattern fragile.

### L3 — Composites cross-domain

`multi_intent`, `executionPlan` non vide, stratégie hybride/composite, **aucun drop silencieux**.

### L4 — Échecs honnêtes

Demande vague, source absente, segment non qualifié → `partial_clarify` ou `unqualifiedSegmentCount` explicite.

---

## Cas canoniques C1–C6

| ID | Requête (résumé) | Attendu cible | Statut |
|----|------------------|---------------|--------|
| **G30-C1** | Résume ce texte sur la Seconde Guerre mondiale | `document_synthesis`, single | **green** → G30.1 |
| **G30-C2** | Fais une dissertation sur la Seconde Guerre mondiale | `pedagogical` / `llm_explain` | **gap** → G30.2 |
| **G30-C3** | Créer un agent IA mobile + sous-agents | `webapp` / clarify ou direct | **gap** → G30.3 |
| **G30-C4** | Résume texte WWII + date du jour | `document_synthesis` + `datetime`, hybrid | **green** → G30.1 |
| **G30-C5** | Dissertation WWII + traduire conclusion | `pedagogical` + `translation`, partial | **gap** → G30.5 |
| **G30-C6** | Créer agent mobile + expliquer architecture | `webapp` + `training`, partial | **gap** → G30.6 |

**Référence verte** : `G30-REF-G29.2` (document joint + datetime) — déjà couvert par G29.2.

---

## Variantes L2 (synthèse document)

| ID | Formulation | Même attendu que |
|----|-------------|------------------|
| G30-V1 | résume ce document | C1 |
| G30-V2 | fais un résumé | C1 (+ missing_source si pas de texte) |
| G30-V3 | peux-tu synthétiser le texte | C1 |
| G30-V4 | donne-moi les idées principales | C1 |

---

## Échecs honnêtes L4

| ID | Requête | Attendu |
|----|---------|---------|
| G30-E1 | Résume ce texte | `document_synthesis` + `partial_clarify` (source manquante) |
| G30-E2 | aide-moi | `unknown`, `unqualifiedSegmentCount=1`, pas de faux domaine |

---

## Extensions G31 — compare_choose / reco produit

| ID | Requête (résumé) | Attendu | Statut |
|----|------------------|---------|--------|
| **G31-C1** | Smartphone achat — `conseilles-tu` sans slots | `compare_choose`, `partial_clarify` | **green** |
| **G31-C2** | Smartphone budget 500€ + usage photo | `guided_recommendation` | **green** |
| **G31-C3** | Idem C2 + contrat orchestrateur | `GUIDED_PRODUCT_RECOMMENDATION` | **green** |

**Tests dédiés** : `compare-choose-g31-policy.test.js`, `guided-product-recommendation-g31-policy.test.js`

---

## Extensions G32 — document_synthesis guidée

| ID | Requête (résumé) | Attendu | Statut |
|----|------------------|---------|--------|
| **G32-C1** | Résume document joint (avec `attachments`) | `guided_synthesis`, contrat `GUIDED_DOCUMENT_SYNTHESIS` | **green** |
| **G32-C2** | Résume ce texte (sans source) | `partial_clarify` | **green** |

**Tests dédiés** : `guided-document-synthesis-g32-policy.test.js`, `document-synthesis-g30-policy.test.js`

**Note** : G32-C1 requiert `attachments` dans `understandQuery(query, history, { attachments })` — la matrice les injecte via `testCase.attachments`.

---

## Implémentation

| Fichier | Rôle |
|---------|------|
| `server/src/agent/policies/queryUnderstandingCoverageMatrix.js` | Matrice + `evaluateUnderstandingExpectations()` + `runG30CoverageCase()` |
| `server/tests/query-understanding-g30-coverage.test.js` | Cas verts actifs, gaps en `it.skip` |
| `server/tests/compare-choose-g31-policy.test.js` | G31.1/2 unitaires + gate |
| `server/tests/guided-product-recommendation-g31-policy.test.js` | G31.3/4 contrat + validator |
| `server/tests/guided-document-synthesis-g32-policy.test.js` | G32 slots + contrat + validator |

### Lancer

```bash
# Matrice complète (16 verts + 4 skip)
cd server && node --test tests/query-understanding-g30-coverage.test.js

# Batterie G30–G32
cd server && node --test \
  tests/query-understanding-g30-coverage.test.js \
  tests/compare-choose-g31-policy.test.js \
  tests/guided-product-recommendation-g31-policy.test.js \
  tests/guided-document-synthesis-g32-policy.test.js \
  tests/document-synthesis-g30-policy.test.js
```

### Promouvoir un gap en vert

1. Implémenter le détecteur registre G29 (playbook G29.2)
2. Passer `status: "green"` sur le cas dans la matrice
3. Retirer le `it.skip` correspondant (automatique via statut)

---

## Lots cibles (backlog)

| Ticket | Périmètre | Statut |
|--------|-----------|--------|
| **G30.1** | Domaine `document_synthesis` dans registre G29 + variantes L2 + hybrid datetime | **livré** |
| **G30.2** | Domaine rédaction longue / dissertation | **gap** |
| **G30.3** | `architecture_design` / agent building dans registre | **gap** |
| **G30.4** | Composite `document_synthesis` + `datetime` (hybrid) | **livré** (via G30.1 + G29.2) |
| **G30.5** | Composite dissertation + translation | **gap** |
| **G30.6** | Composite webapp/architecture + explain | **gap** |
| **G31** | Reco produit instrumentée (slots, contrat, validator) | **livré** |
| **G32** | Synthèse document instrumentée (groundedness) | **livré** |
| **G33** | Dissertation guidée (extension G32) | planifié |

---

## Résumé en une phrase

G30 transforme la question « Nexxus saura-t-il ? » en **suite de scénarios avec attentes explicites** : domaine reconnu, plan produit, stratégie correcte, aucune sous-demande perdue — les gaps restent visibles jusqu'à promotion en vert.
