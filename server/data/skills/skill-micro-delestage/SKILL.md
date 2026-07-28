# Skill : Micro-délestage conversationnel (v1.2)

## Mission

Appliquer la **couche micro P1–P4** : délester le LLM des requêtes conversationnelles banales via des outils synchrones, déterministes et testables — le LLM n'intervient en familiarité que pour **densifier les résidus `generic_topic`** (P3 borné).

Complète [[skill-intent-routing]] : le registry définit le **contrat** ; ce skill exécute le **short-circuit sans LLM**.

## Quand activer

- Requête identité, salutation, idéation ouverte, familiarité (« tu connais X ? »)
- TTFT attendu < 100 ms, pas d'appel Tier 1/2
- Éviter refus épistémique sur signal conversationnel faible mais exploitable

## Point d'entrée

```javascript
import { runConversationShortCircuit } from "server/src/agent/micro/index.js";
```

Ordre interne : social → idéation → familiarité.

## Packs

| Pack | Modules |
|------|---------|
| Normalization | `querySanitizer`, `surfaceFormNormalizer` |
| Classifiers | `subjectClassifier`, `entitySubtypeClassifier`, `intentShortCircuit`, `subjectUnderstanding` |
| Lexicon | `lexiconLearningOrchestrator`, `lexiconPromotionGate` |
| Continuity | `conversationContinuityContext` |
| Interpreter | `requestInterpreter` (P4 — voir [[skill-request-interpreter]] candidat) |
| Deepening | `boundedSubjectDeepeningPolicy`, `boundedSubjectDeepeningSynthesizer` |
| Continuity | `conversationContinuityContext` |
| Replies | `identityReplyBuilder`, `ideationReplyBuilder`, `familiarityReplyBuilder`, `clarificationBuilder` |

## Familiarité — stack trois temps

1. **Subject understanding** — intent + sujet + shape sans lexique.
2. **Lexique vivant** — overlay gouverné (`LEXICON_LEARNING=1`), pas obligatoire.
3. **P3 borné** — densification `generic_topic` uniquement (`SUBJECT_DEEPENING_LLM=0` pour désactiver).

Matrice follow-up « oui » : `lexicon` / `inferred` → déterministe ; `generic` → P3 + fallback.

ADR : [[ADR-20260527-Stack-Familiarite-Trois-Temps]].

## P4 — Interprète de requête (interne, skill candidat)

Couche amont : normalise les requêtes fragiles, hypothèse intent/sujet, clarify/confirm/respond.

- Implémenté dans `micro/interpreter/`
- Skill dédiée : [[skill-request-interpreter]] (`enabled: false` jusqu'à observation terrain)
- Doctrine : `REQUEST_INTERPRETER_RULE`

## Familiarité — règles produit

1. **Catégorie** avant réponse (`tool_platform` ≠ `place_institution`).
2. **Sous-type lieu** pour registre naturel (pays vs ville vs musée).
3. **Forme de surface** correcte (`l'Italie`, jamais `L Italie`).
4. Pas de verbes techniques sur lieux culturels (« configurer le Louvre » interdit).

## Doctrine

> Un contrat déterministe doit être sémantiquement juste **et** socialement naturel.

## Interdictions

- Ne pas router identité/idéation/familiarité vers SIMPLE_FAST pur.
- Ne pas compenser un lexique manquant par un prompt LLM plus long (sauf P3 sur `generic_topic`).
- Ne pas dupliquer la logique hors `micro/` + guards sources.

## Vault

- ADR : `citadelle-vault/Citadelle/02-Architecture/adr/ADR-20260601-Micro-Conversation-Delestage.md`
- ADR stack : `citadelle-vault/Citadelle/02-Architecture/adr/ADR-20260527-Stack-Familiarite-Trois-Temps.md`
- Module : [[Micro-Conversation-Delestage]]
- Playbook : [[Playbook-Micro-Delestage-Conversationnel]]

## Tests

```bash
cd server && node --test tests/micro-conversation-shortcircuit.test.js \
  tests/subject-understanding.test.js tests/lexicon-learning.test.js \
  tests/subject-deepening-p3.test.js tests/agent-familiarity-contract.test.js
```
