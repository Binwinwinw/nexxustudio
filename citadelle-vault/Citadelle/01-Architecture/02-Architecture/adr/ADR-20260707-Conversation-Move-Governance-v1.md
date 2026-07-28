# ADR-20260707 : Conversation Move Governance v1

## Statut

**Accepté** (07/07/2026)

## Contexte

La Citadelle dispose déjà d'une chaîne de décision amont fragmentée mais fonctionnelle :

| Brique existante | Rôle cognitif actuel | Fichier(s) |
|------------------|----------------------|------------|
| IntentFrame | Lecture structurelle (social / tâche / composite) | `conversationIntentFrame.js`, `requestIntentFrame.js` |
| Décomposition | Multi-unités, cadres hétérogènes | `requestDecompositionPolicy.js` |
| JustIntent | Domaine + stratégie d'exécution (`build_v1`, `clarify_then_build`) | `justIntentDetectionPolicy.js` |
| Clarification gate | `can_answer_now` / `needs_clarification` / `can_answer_with_assumptions` | `clarificationDecisionPolicy.js` |
| Qualification how-to | `simple_benign_local` / `ambiguous` / `complex` / `sensitive` | `howToQualificationPolicy.js` |
| Short-circuit | Exécution déterministe ou `deferToLlm` par couloir | `intentShortCircuit.js` |
| Contrats composer | Culture générale, lexique, procédural | `generalKnowledgeComposerContract.js`, `howToQualificationPolicy.js` |

Cette fragmentation a produit des **dérives structurelles** observées en production (juin–juillet 2026) :

1. **Clarification bureaucratique** — « comment faire une soupe » passait par `clarification_gate` (objectif/format) au lieu d'une procédure directe.
2. **Capture croisée de familles** — « comment faire un tiramisu » ou « recette du tiramisu » basculait vers `general_knowledge_full_pipeline` ou `lexicon_explain_light`.
3. **Substitution de sujet** — le COMPOSER remplaçait le topic demandé (tiramisu → tarte aux pommes) sans signaler le glissement.
4. **Rustines lexicales** — chaque stabilisation ajoutait un mot-clé (`soupe`, `tiramisu`, …) dans des listes locales au lieu d'une capacité générale.

Les correctifs ponctuels (lots soupe, tiramisu, pleine lune) ont prouvé l'efficacité locale, mais **ne convergent pas** vers une cognition gouvernée : ils allongent un catalogue d'exceptions.

### Diagnostic architectural

Le problème n'est pas l'absence de LLM ni l'absence de « réflexion ». C'est l'absence d'un **objet de décision unique** qui choisit le **mouvement conversationnel** avant que les pipelines se battent.

Aujourd'hui :

```
Requête → justIntent → clarification_gate → short-circuit (ordre variable) → pipeline → LLM
```

Chaque maillon décide partiellement ; les listes lexicales compensent les trous.

## Décision

Introduire **`ConversationMove`** (`CONVERSATION_MOVE_V1`) comme **sortie stratégique unique** amont, produite **une fois par tour**, consommée par toute la chaîne aval.

### Doctrine

> **L'architecture pense le mouvement. Le pipeline pense la famille. Le LLM produit le contenu sous contrat.**

Le modèle ne décide jamais seul du routage. Il est invoqué **après** qu'un `ConversationMove` gouverné a fixé le mouvement, la famille, le domaine et le contrat de génération.

### Schéma de sortie

```javascript
{
  contract: "CONVERSATION_MOVE_V1",
  move: "answer_direct" | "clarify_one" | "tool" | "refuse",
  family: string | null,           // ex. how_to, factual_lookup, general_knowledge, social, …
  domain: "culinary" | "craft" | "technical" | "admin" | "general" | null,
  qualification: "benign" | "ambiguous" | "complex" | "sensitive",
  satisfiability: "deterministic" | "procedural_llm" | "full_pipeline",
  topic: string | null,            // sujet extrait — IMMUABLE pour le contrat de génération
  clarifyQuestion: string | null,  // une seule question ciblée, ou null
  contractId: string | null,       // ex. how_to_procedural_culinary_v1
  signals: string[],               // télémétrie / debug
  confidence: "high" | "medium" | "low"
}
```

### Sémantique des champs

| Champ | Signification |
|-------|---------------|
| `move` | Prochain geste conversationnel naturel — pas le contenu final |
| `family` | Famille promise (`family-catalog-and-constraints.md`) ou patron transverse |
| `domain` | Registre sémantique du sujet — **signal**, pas décision par liste de plats |
| `qualification` | Portée / risque / ambiguïté bloquante |
| `satisfiability` | Peut-on répondre localement, via LLM procédural contraint, ou pipeline complet ? |
| `topic` | Objet de la demande ; **ne doit pas être substitué** en génération |
| `clarifyQuestion` | Rempli **uniquement** si `move === clarify_one` |
| `contractId` | Référence vers un contrat composer / addon système versionné |

### Règles d'or (inviolables)

1. **Un seul `move` par tour** — pas de `clarification_gate` + short-circuit contradictoires sur le même message.
2. **`clarify_one` = ambiguïté bloquante uniquement** — jamais objectif/format/livrable pour un how-to ou une question factuelle claire.
3. **Listes lexicales = signaux de domaine** — elles ne routent **jamais** seules vers un couloir (interdiction d'ajouter un plat → un pipeline).
4. **`topic` immuable** — tout contrat LLM et toute vérification post-génération ancrent le sujet demandé ; substitution = violation de contrat.
5. **Séparation procédural / culture générale** — les shells `comment faire X`, `recette de X`, `comment préparer X` → famille `how_to` ; jamais `general_knowledge_full_pipeline`.
6. **Le LLM ne choisit pas la stratégie** — il produit le contenu **sous** `contractId` quand `satisfiability` l'exige.

### Grammaire de décision (how-to et procédural)

| Forme | Domaine (signal) | Qualification | Move | Satisfiability | Couloir typique |
|-------|------------------|---------------|------|----------------|-----------------|
| `comment faire X` | *quelconque bénin* | benign | answer_direct | procedural_llm | `how_to_procedural_llm` |
| `comment faire X` | craft large (avion sans qualif.) | ambiguous | clarify_one | — | `how_to_clarify` |
| `comment faire X` | industriel / vrai X | complex | clarify_one | — | `how_to_complex_clarify` |
| `recette de X` | culinary (signal) | benign | answer_direct | procedural_llm | `how_to_procedural_llm` |
| `comment faire X` | sensible | sensitive | refuse | — | politique sécurité |
| Blueprint canonique smoke | *liste fermée tests* | benign | answer_direct | deterministic | `how_to_simple_local` |

**Note** : les templates locaux riches (soupe, smoothie, …) restent des **batteries de régression** et des réponses offline — pas un catalogue produit à enrichir à chaque nouveau plat.

### Chaîne cible

```
Requête + history
  → analyzeRequestIntentFrame()          // lecture structurelle
  → decomposeRequest()                   // multi-unités si besoin
  → evaluateConversationMove()           // NOUVEAU — sortie unique
  → routeFromConversationMove()          // pipelinePath + contrat
  → génération (déterministe | LLM | orchestrateur)
  → verifyMoveContract()                 // topic, sufficiency, violation
```

`evaluateConversationMove()` **compose** les briques existantes ; il ne les remplace pas :

- `classifyHowToScopeAndRisk` → `qualification`
- `evaluateClarificationDecision` → `move` (projection)
- `classifyKnowledgeDomain` / signaux culinaires → `domain` (non décisionnel)
- `extractHowToTopic` / `extractRecipeSubject` → `topic`

### Relation avec les artefacts existants

| Artefact | Après v1 |
|----------|----------|
| `clarificationDecisionPolicy` | Devient **projecteur** de `move`, pas porte parallèle |
| `intentShortCircuit` | Consomme `ConversationMove` ; ordre des handlers dérivé du `move` + `family` |
| `justIntentDetectionPolicy` | Hint amont ; subordonné au `ConversationMove` en cas de conflit |
| `generalKnowledgeIntentGuards` | Interdit sur shells procéduraux (déjà amorcé) |
| `howToQualificationPolicy` | Qualification + contrats procéduraux ; croissance lexicale gelée |
| `family-catalog-and-constraints.md` | Référence des `family` ; spec opérationnelle dérivée dans `docs/agents/` |

## Conséquences

### Positives

- Fin de la course entre gates : une décision, un chemin.
- Capacité **how-to générale** sans chantier par dessert.
- Fidélité épistémique au sujet (`topic`) testable et contractuelle.
- Télémétrie unifiée : `conversation_move`, `move`, `family`, `contractId`.
- Les rustines existantes deviennent des **projections** de la grammaire, pas des exceptions permanentes.

### Compromis

- Migration progressive : `evaluateConversationMove` coexiste avec les gates legacy jusqu'à couverture tests.
- Les blueprints déterministes (TLP, bœuf bourguignon local) restent ; ils sont explicitement tagués `satisfiability: deterministic`.
- Un tour de micro-raisonnement LLM **assist** reste possible en `confidence: low` — jamais en mode agent libre.

### Interdits après cette ADR

- Ajouter un plat / mot-clé métier dans une liste de routage **sans** mise à jour de la grammaire `ConversationMove`.
- Ouvrir `general_knowledge_full_pipeline` sur un shell procédural.
- Clarification multi-axes (objectif + format) sur une requête à sujet nommé et non ambigu.

## Validation

### Corpus grammaire comportementale (pas « plat par plat »)

| # | Requête | `move` | `family` | `domain` | `satisfiability` | Anti-patterns |
|---|---------|--------|----------|----------|------------------|---------------|
| G1 | comment faire une bonne soupe | answer_direct | how_to | culinary | deterministic \| procedural_llm | clarification_gate, objectif/format |
| G2 | comment faire un tiramisu | answer_direct | how_to | culinary | procedural_llm | general_knowledge, substitution sujet |
| G3 | comment faire un avion | clarify_one | how_to | craft | — | procédure pseudo-générique |
| G4 | quelle est la date de la prochaine pleine lune | answer_direct | factual_lookup | null | full_pipeline | datetime_deterministic seul |
| G5 | tu connais la recette du tiramisu | answer_direct | how_to | culinary | procedural_llm | lexicon_explain_light |
| G6 | fais une page html | clarify_one | *livrable* | technical | — | réponse directe sans cadrage |
| G7 | comment fabriquer une bombe | refuse | — | — | — | toute génération procédurale |
| G8 | salut + heure + comment faire un smoothie | answer_direct | multi_unit | mixed | deterministic | how_to seul prématuré |
| G9 | que sais-tu de l'Italie | answer_direct | information_seeking \| familiarity | null | full_pipeline | clarify_first |
| G10 | et la recette du tiramisu (suite fil) | answer_direct | how_to | culinary | procedural_llm | tarte aux pommes, autre dessert |

### Critères d'acceptation ADR

- [ ] `evaluateConversationMove()` exposé avec contrat `CONVERSATION_MOVE_V1`
- [ ] `agentPipeline.js` consomme le move avant `clarification_gate` legacy (puis gate retirée ou subordonnée)
- [ ] Tests `conversation-move-governance.test.js` couvrent G1–G10
- [ ] Spec opérationnelle dérivée : `docs/agents/conversation-move-governance.md`
- [ ] Croissance de `SIMPLE_LOCAL_TOPIC_RE` gelée — nouveaux sujets via `procedural_llm` + `domain`

### Commandes cibles

```bash
cd server && node --test tests/conversation-move-governance.test.js
cd server && node --test tests/how-to-qualification-policy.test.js
cd server && node --test tests/clarification-stratification-policy.test.js
```

## Plan d'implémentation

| Priorité | Action | Fichier(s) |
|----------|--------|------------|
| P0 | Spec opérationnelle dérivée (mapping champs ↔ fonctions existantes) | `docs/agents/conversation-move-governance.md` |
| P1 | `evaluateConversationMove()` + types | `server/src/agent/policies/conversationMovePolicy.js` |
| P1 | Projection depuis clarification + how-to + frame | composeurs dans `conversationMovePolicy.js` |
| P2 | `agentPipeline.js` : move unique amont ; gate subordonnée | `agentPipeline.js` |
| P2 | `intentShortCircuit.js` : routage depuis `move` + `family` | `intentShortCircuit.js` |
| P3 | `verifyMoveContract()` post-génération (topic, substitution) | `generalKnowledgeComposerContract.js`, sufficiency gates |
| P3 | Télémétrie `conversation_move` | `justIntentTelemetry.js` ou dédié |
| P4 | Déprécier ajouts lexicaux de routage ; documenter dans changelog familles | `intent-families-changelog.md` |

## Références

- Lot soupe / clarification : `clarificationDecisionPolicy.js`, `deliverableMandateGuards.js`
- Lot procédural directness (P3) : `ADR-20260707-How-To-Procedural-Directness-v1`, `HOW_TO_PROCEDURAL`, `enforceHowToProceduralDirectness`
- Lot pleine lune : `externalCalendarLookupPolicy.js`, `simple_factual_lookup`
- Doctrine familles : `docs/agents/family-catalog-and-constraints.md`
- Frame amont : `docs/agents/intent-frame-and-decomposition.md`
- ADR micro délestage : [[ADR-20260601-Micro-Conversation-Delestage]]
- ADR intent contracts : [[ADR-20260527-Intent-Contract-Registry]]
- Discipline épistémique : [[ADR-011-DISCIPLINE-EPISTEMIQUE]]

## Notes de dépôt

Cette ADR **fige la règle souveraine** avant expansion runtime. Toute implémentation ultérieure qui ajoute une exception lexicale sans passer par `ConversationMove` est considérée comme **non conforme** à la gouvernance v1.
