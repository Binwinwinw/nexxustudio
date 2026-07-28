# ADR-20260601 : Micro-automatisations de délestage conversationnel (P1)

## Statut
**Validé** (01/06/2026)

## Contexte

La Citadelle a stabilisé le boot réactif, le warm-up multi-modèle, le Cockpit et l'Intent Contract Registry v1.2. Malgré ces garde-fous, des requêtes **humaines fréquentes** (identité, idéation, familiarité, salutations) continuaient à :

- tomber en **SIMPLE_FAST** ou orchestrateur lourd ;
- produire des **refus épistémiques** inappropriés ;
- consommer du **temps LLM** pour du « quotidien banal ».

Les correctifs ponctuels (`identityIntentGuards`, `ideationIntentGuards`, `familiarityIntentGuards`) ont prouvé leur efficacité, mais restaient **dispersés** dans `agentPipeline.js` et `agent.js`.

## Décision

Introduire une **couche micro P1** — synchrones, déterministes, testables — qui **délesté la cognition LLM** avant le pipeline complet.

### Doctrine

> Complexifier un peu le code pour simplifier fortement la cognition.

Le LLM n'intervient plus pour « comprendre le quotidien banal » : reconnaissance, classification, normalisation et réponse courte sont assurées par des **micro-outils**.

### Architecture (3 packs)

```
server/src/agent/micro/
├── normalization/     querySanitizer, surfaceFormNormalizer
├── classifiers/       subjectClassifier, entitySubtypeClassifier, intentShortCircuit
└── replies/           identity, ideation, familiarity, clarification builders
```

### Point d'entrée unique

`runConversationShortCircuit(query, options)` dans `intentShortCircuit.js` — appelé **avant** SIMPLE_FAST dans `agentPipeline.js`.

Ordre de délestage :

1. **Social + identité** (callback `getDeterministicSocialResponse` / `identityIntentGuards`)
2. **Continuité P2** + **Interprète P4** (clarification / confirmation)
3. **Architecture design** (`ARCHITECTURE_OPTIONS` → 3 approches + cadrage) — voir [[ADR-20260601-Architecture-Design-Options]]
4. **Idéation ouverte** (`IDEATION_OPEN` → 3 pistes ou 1 question de cadrage)
5. **Familiarité** (reconnaissance sujet + registre sémantique par catégorie)

Chemins télémétrie : `social_deterministic`, `conversation_continuity_deterministic`, `request_interpreter_clarify`, `request_interpreter_confirm`, `architecture_design_deterministic`, `ideation_deterministic`, `familiarity_deterministic`.

### Contrats conversationnels verrouillés

| Intent | Module guard | Réponse attendue |
|--------|--------------|------------------|
| Identité | `identityIntentGuards.js` | NEXXUS, instantané |
| Idéation | `ideationIntentGuards.js` | 3 pistes OU cadrage |
| Familiarité | `familiarityIntentGuards.js` | Registre par `subjectCategory` + `placeSubtype` |

#### Familiarité — double étage sémantique

**Catégories** : `tool_platform`, `concept_method`, `place_institution`, `person_entity`, `unknown_subject`.

**Sous-types lieu** : `country_region`, `city_place`, `institution_museum`, `landmark_site`.

**Forme de surface** : `surfaceFormNormalizer` reconstruit `l'Italie`, `le musée du Louvre` (évite « L Italie »).

### Relation avec Intent Contract Registry

- Le **registry** décide bypass SIMPLE_FAST et mode réponse amont.
- La **couche micro** exécute le délestage **sans LLM** quand la détection est suffisante.
- Les deux sont **complémentaires** : registry = contrat ; micro = exécution déterministe.

## Conséquences

### Positives

- TTFT < 100 ms sur identité / idéation / familiarité reconnues
- Composants **auditables, remplaçables, testables** (49+ tests dédiés)
- Base pour P2 (document/RAG) et P3 (ops/gouvernance)

### Compromis

- Lexique sujets à enrichir (pays, villes, outils)
- Double couche transitoire : guards legacy + micro wrappers — migration progressive vers `micro/` comme API publique

## Validation

```bash
cd server && node --test tests/micro-conversation-shortcircuit.test.js
cd server && node --test tests/agent-social-identity.test.js
cd server && node --test tests/agent-ideation-contract.test.js
cd server && node --test tests/agent-familiarity-contract.test.js
```

Requêtes terrain :

| Requête | Chemin attendu |
|---------|----------------|
| Comment t'appelles-tu ? | social / identité |
| Quel projet IA lancer ? | ideation_deterministic |
| Tu connais l'Italie ? | familiarity_deterministic, « l'Italie » |

## Plan d'extension

| Phase | Scope |
|-------|-------|
| **P1** ✅ | Conversation : micro + short-circuit |
| **P2** | Document : prep RAG, fallback briefing |
| **P3** | Ops : telemetry hints, health gates |

## Gouvernance — ancrage minimum

Tout nouveau micro-outil P1/P2/P3 doit respecter [[Regle-Ancrage-Micro-Outils]] :

1. Pack micro  
2. Point d'entrée pipeline  
3. Tests dédiés  
4. Doc module Vault  
5. Playbook ops (+ skill runtime si P1)

Template : `_templates/micro-tool-anchoring.md`

## Liens

- [[ADR-20260527-Stack-Familiarite-Trois-Temps|Stack familiarité trois temps]]
- [[ADR-20260601-Architecture-Design-Options|Doctrine « comment créer X »]]
- [[ADR-20260527-Intent-Contract-Registry|Intent Contract Registry]]
- [[Micro-Conversation-Delestage|Module Micro Conversation]]
- [[skill-micro-delestage|Skill micro-délestage]]
- [[Playbook-Micro-Delestage-Conversationnel|Playbook ops]]
- [[Regle-Ancrage-Micro-Outils|Règle d'ancrage micro-outils]]
