# Skill : Request Interpreter (v0.1 — candidat)

> **Statut** : `enabled: false` — capacité **interne P4** branchée au runtime via `intentShortCircuit`. Promotion skill après observation terrain.

## Mission

Interpréter les requêtes **bancales, elliptiques ou incomplètes** avant les micro-outils de réponse :

- normaliser et reformuler implicitement si fragile mais compréhensible ;
- hypothétiser intent + sujet + confiance ;
- détecter ambiguïtés (sujet manquant, « ça », signal faible) ;
- décider : **répondre**, **confirmer**, **clarifier**, ou **router**.

**Doctrine** : `REQUEST_INTERPRETER_RULE = fragile_reformulate_ambiguous_clarify`

> Nexxus ne corrige pas l'utilisateur ; il stabilise la compréhension sans sur-affirmer.

## Quand activer (futur)

- Requête avec fillers (« et pour », « ou pas », « je sais pas comment dire »)
- Référence vague sans contexte (« et pour ça tu peux me dire ? »)
- Description indirecte (« le truc avec les boules »)
- Chemin télémétrie `request_interpreter_clarify` ou `request_interpreter_confirm`

## Point d'entrée (aujourd'hui)

```javascript
import { interpretRequest, INTERPRETER_ACTIONS } from "server/src/agent/micro/index.js";
```

Appelé depuis `runConversationShortCircuit` — **pas encore** une skill runtime activée.

## Packs

| Pack | Modules |
|------|---------|
| Normalization | `requestNormalizer` |
| Hypothesis | `intentHypothesisBuilder` |
| Ambiguity | `ambiguityDetector` |
| Policy | `clarificationPolicy` |
| Orchestrator | `requestInterpreter` |

## Matrice d'actions

| Confiance | Action | Exemple |
|-----------|--------|---------|
| ≥ 0.78 | `respond` | « et pour noel tu connais ou pas ? » |
| 0.55–0.77 | `confirm` | « truc avec les boules » → pétanque ? |
| bloquant | `clarify` | « et pour ça tu peux me dire ? » |

## Relation avec skill-micro-delestage

- **micro-delestage** : orchestration short-circuit (social, continuité, idéation, familiarité)
- **request-interpreter** : couche amont spécialisée compréhension requête fragile

Parent : [[skill-micro-delestage]]. Complète [[skill-intent-routing]] (contrat amont) et [[skill-epistemic-refusal]] (fail-closed).

## Séquence de promotion

1. ✅ Micro-couche P4 interne + tests
2. ✅ Doctrine Vault v1.4 + playbook
3. ⏳ Observation terrain (clarify vs confirm vs respond)
4. ⏳ Activer `enabled: true` dans `meta.json` si critères remplis

Critères : voir `meta.json` → `promotionCriteria`.

## Interdictions

- Ne pas remplacer subject understanding ou familiarité par un prompt LLM large.
- Ne pas skilliser avant stabilité terrain (éviter skill mouvante).
- Ne pas clarifier si la requête est déjà canonique et parseable sans ambiguïté.

## Vault

- Module : [[Micro-Conversation-Delestage]] (§ P4)
- Playbook : [[Playbook-Micro-Delestage-Conversationnel]]

## Tests

```bash
cd server && node --test tests/request-interpreter-p4.test.js
```

Variable env : `REQUEST_INTERPRETER=0` désactive la couche.
