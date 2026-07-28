# Conversation Move Governance — spec opérationnelle

Couche de **décision stratégique unique** amont : un `ConversationMove` par tour, avant routage pipeline et génération.

**Autorité** : [ADR-20260707-Conversation-Move-Governance-v1](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260707-Conversation-Move-Governance-v1.md) (Accepté)

**Voir aussi** :
- [IntentFrame et décomposition](intent-frame-and-decomposition.md)
- [Catalogue familles et contraintes](family-catalog-and-constraints.md)
- [Doctrine / charte](intent-families-doctrine.md)
- [ADR P3 How-to Procedural Directness](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260707-How-To-Procedural-Directness-v1.md)

---

## Doctrine (rappel)

> **L'architecture pense le mouvement. Le pipeline pense la famille. Le LLM produit le contenu sous contrat.**

Le LLM **ne choisit pas** la stratégie. Il est invoqué **après** `evaluateConversationMove()`, sous `contractId` quand `satisfiability` l'exige.

---

## Contrat `CONVERSATION_MOVE_V1`

### Schéma

```javascript
{
  contract: "CONVERSATION_MOVE_V1",
  move: "answer_direct" | "clarify_one" | "tool" | "refuse",
  family: string | null,
  domain: "culinary" | "craft" | "technical" | "admin" | "general" | null,
  qualification: "benign" | "ambiguous" | "complex" | "sensitive",
  satisfiability: "deterministic" | "procedural_llm" | "full_pipeline",
  topic: string | null,
  clarifyQuestion: string | null,
  contractId: string | null,
  pipelinePath: string | null,
  signals: string[],
  confidence: "high" | "medium" | "low",
  sources: {
    frame: object | null,
    decomposition: object | null,
    clarificationDecision: object | null,
    justIntent: object | null,
  }
}
```

### Sémantique des champs

| Champ | Rôle | Règle |
|-------|------|-------|
| `move` | **Sortie stratégique unique** par tour | Un seul move ; pas de gate parallèle contradictoire |
| `family` | Famille promise ou patron transverse | Voir [catalogue](family-catalog-and-constraints.md) ; `multi_unit` si décomposition hétérogène |
| `domain` | Signal sémantique du sujet | **Ne route jamais seul** ; dérivé de signaux, pas de listes de plats |
| `qualification` | Portée / risque / ambiguïté | Projection how-to + sécurité |
| `satisfiability` | Mode de satisfaction | `deterministic` < `procedural_llm` < `full_pipeline` |
| `topic` | Sujet extrait | **Immuables** pour contrat génération et vérification post-réponse |
| `clarifyQuestion` | Question unique | Rempli **uniquement** si `move === clarify_one` |
| `contractId` | Addon / contrat composer versionné | Ex. `how_to_procedural_culinary_v1` |
| `pipelinePath` | Couloir court-circuit ou pipeline | Dérivé de `routeFromConversationMove()` |
| `signals` | Télémétrie debug | Chaîne des décisions (ex. `how_to_procedural`, `multi_unit`) |
| `confidence` | Confiance agrégée | `low` si conflit frame vs justIntent non résolu |

### Valeurs `move`

| Move | Signification | Quand |
|------|---------------|-------|
| `answer_direct` | Répondre maintenant (déterministe, LLM contraint, ou orchestrateur) | Sujet clair, pas d'ambiguïté bloquante |
| `clarify_one` | **Une** question ciblée | Ambiguïté qui change matériellement la réponse |
| `tool` | Déclencher outil / web / RAG explicite | Mandat utilisateur explicite (`isExplicitToolOrWebRequest`) — **L1** |
| `refuse` | Refus gouverné | Sujet sensible, policy sécurité |

**Interdit** : `clarify_one` avec formulaire objectif + format sur how-to ou fait nommé.

### Valeurs `satisfiability`

| Valeur | Usage | Couloir typique |
|--------|-------|-----------------|
| `deterministic` | Blueprint local / smoke / offline | `*_determerministic`, `how_to_simple_local` |
| `procedural_llm` | **Voie normale** how-to bénin non blueprinté | `how_to_procedural_llm` + `contractId` |
| `full_pipeline` | Orchestrateur + experts + web si besoin | `*_full_pipeline`, `simple_factual_lookup` + web |

---

## Mapping champ → source existante

`evaluateConversationMove()` **compose** l'existant ; il ne duplique pas la logique métier.

| Champ `ConversationMove` | Source primaire | Fichier | Fonction |
|------------------------|-----------------|---------|----------|
| `sources.frame` | IntentFrame | `requestIntentFrame.js` | `analyzeRequestIntentFrame(query)` |
| `sources.decomposition` | Multi-unités | `requestDecompositionPolicy.js` | `decomposeRequest(query, history)` |
| `sources.justIntent` | Projection intent | `justIntentDetectionPolicy.js` | `evaluateJustIntent(query)` |
| `sources.clarificationDecision` | Gate clarification | `clarificationDecisionPolicy.js` | `evaluateClarificationDecision(query, justIntent, triage, history)` |
| `family` (hint) | Frame | `requestIntentFrame.js` | `frame.familyHint?.id` |
| `family` (how_to) | Shell procédural | `howToRequestIntentGuards.js` | `isHowToRequestShell(query)` |
| `family` (recipe) | Recette procédurale | `recipeKnowledgeIntentGuards.js` | `isRecipeKnowledgeRequest(query)` |
| `family` (multi) | Décomposition | `requestDecompositionPolicy.js` | `isMultiUnitRequest(decomposition)` → `multi_unit` |
| `family` (factual web) | Calendrier externe | `externalCalendarLookupIntentGuards.js` | `shouldBypassLocalDatetimeShortCircuit(query)` |
| `move=tool` | Web/outil explicite | `conversationMovePolicy.js` *(P1)* | `isExplicitToolOrWebRequest(query)` |
| `family` (info seeking) | Cible nommée | `informationSeekingIntentGuards.js` | `isInformationSeekingWithTarget(query)` |
| `qualification` | How-to | `howToQualificationPolicy.js` | `classifyHowToScopeAndRisk(query)` |
| `qualification` (sensitive) | Sécurité | `howToQualificationPolicy.js` | `HOW_TO_QUALIFICATIONS.SENSITIVE_OR_RESTRICTED` |
| `topic` (how-to) | Extraction | `howToQualificationPolicy.js` | `extractHowToTopic(query)` |
| `topic` (recipe) | Extraction | `recipeKnowledgeIntentGuards.js` | `extractRecipeSubject(query)` |
| `topic` (général) | Entité | `generalKnowledgeIntentGuards.js` | `extractGeneralKnowledgeSubject(query)` |
| `domain` | Classification | `queryEntityUnderstanding.js` | `classifyKnowledgeDomain(query, topic)` |
| `domain` (culinary signal) | Signal non décisionnel | `howToQualificationPolicy.js` | `CULINARY_PROCEDURAL_RE` (signal uniquement) |
| `move` (projection) | Clarification | `clarificationDecisionPolicy.js` | voir § Projection `move` |
| `move` (how-to bypass) | Procédural bénin | `howToQualificationPolicy.js` | `isBenignProceduralHowToRequest(query)` |
| `move` (mandat flou) | Livrable | `deliverableMandateGuards.js` | `shouldAllowClarifyThenBuild` + `isBlockingAmbiguityQuery` |
| `satisfiability` (how-to) | Template riche ? | `howToQualificationPolicy.js` | `hasRichHowToLocalTemplate(query)` |
| `satisfiability` (how-to LLM) | Procédural général | `howToQualificationPolicy.js` | `resolveHowToShortCircuit(query)` → `how_to_procedural_llm` |
| `contractId` (culinary) | Addon LLM | `howToQualificationPolicy.js` | `buildHowToProceduralLlmSystemAddon(query)` |
| `clarifyQuestion` (how-to ambigu) | Clarify ciblé | `howToQualificationPolicy.js` | `buildHowToAmbiguousClarifyReply(query)` |
| `pipelinePath` | Routage | `conversationMovePolicy.js` *(P1)* | `routeFromConversationMove(move)` |
| `family` (web project) | Cadrage site/CMS | `webProjectScopingGuards.js` | `classifyWebProjectScopingRequest(query)` |
| Vérification topic | Post-génération | `generalKnowledgeComposerContract.js` | `isGeneralKnowledgeContractViolation(query, text)` |

### Projection `qualification` (how-to → ConversationMove)

| `HOW_TO_QUALIFICATIONS` | `qualification` |
|-------------------------|-----------------|
| `simple_benign_local` | `benign` |
| `ambiguous` | `ambiguous` |
| `complex_but_benign` | `complex` |
| `sensitive_or_restricted` | `sensitive` |

### Projection `move` (clarification → ConversationMove)

| `CLARIFICATION_DECISIONS` | `move` | Condition |
|---------------------------|--------|-----------|
| `CAN_ANSWER_NOW` | `answer_direct` | défaut |
| `CAN_ANSWER_WITH_ASSUMPTIONS` | `answer_direct` | `signals` inclut `smart_defaults` |
| `NEEDS_CLARIFICATION` | `clarify_one` | **uniquement** ambiguïté bloquante |
| *how-to sensitive* | `refuse` | avant projection clarification |
| *how-to benign* | `answer_direct` | `isBenignProceduralHowToRequest` — **prime** sur `clarify_then_build` |

### Exclusions figées (déjà runtime, à préserver)

| Guard | Effet |
|-------|-------|
| `isHowToRequestShell` dans `generalKnowledgeIntentGuards` | `general_knowledge` **exclu** |
| `isRecipeKnowledgeRequest` dans `generalKnowledgeIntentGuards` | idem |
| `isHowToRequestShell` dans `deliverableMandateGuards` | `clarify_then_build` **bloqué** pour procédural |
| `isBenignProceduralHowToRequest` dans `clarificationDecisionPolicy` | bypass gate → `can_answer_now` |
| Recette dans `lexiconExplainLightPolicy` | pas de capture lexique |

---

## Règles d'évaluation ordonnées

`evaluateConversationMove(query, { history, intentTriage, attachedFiles })` applique **cet ordre strict** (étapes 0–10) :

```
Étape 0 — Normalisation
  normalizeQueryForClarificationGate(query)   // clarificationDecisionPolicy

Étape 1 — Lecture structurelle (sources, pas décision finale)
  frame = analyzeRequestIntentFrame(query)
  decomposition = decomposeRequest(query, history)
  justIntent = evaluateJustIntent(query)

Étape 2 — Refus sécurité (fail-closed)
  Si how-to + qualification sensitive → move=refuse, STOP

Étape 3 — Multi-unités (L2 — prime sur how-to standalone)
  Si isMultiUnitRequest(decomposition) ET buildMultiUnitCompositeReply serviable
    → family=multi_unit, move=answer_direct
    → satisfiability=deterministic (ou partial → multi_unit_partial_clarify)
    → pipelinePath multi_unit_*
    → STOP
  // Si multi_unit non serviable (ex. avion ambigu dans composite) → continuer pour l'unité bloquante

Étape 4 — Outil / web explicite (L1 — prime sur GK et clarify_one)
  Si isExplicitToolOrWebRequest(query)   // ex. « utilise ton outil de navigation web », délégation recherche explicite
    → move=tool
    → family=information_seeking | factual_lookup (selon cible)
    → satisfiability=full_pipeline
    → pipelinePath simple_factual_lookup | information_seeking_full_pipeline
    → STOP
  // Distinct de l'étape 6 : ici l'utilisateur **demande l'outil** ; étape 6 = besoin factuel externe implicite

Étape 5 — Famille procédurale (L3 — how-to / recette, requête standalone)
  Si (isHowToRequestShell(query) OU isRecipeKnowledgeRequest(query))
     ET PAS déjà STOP multi_unit (étape 3)
    → family=how_to (jamais general_knowledge)
    → topic = extractHowToTopic | extractRecipeSubject — immuable
    → qualification = classifyHowToScopeAndRisk (recette sans shell → benign via recipe path)
    → domain = signal(classifyKnowledgeDomain, CULINARY_PROCEDURAL_RE)
    Si qualification=sensitive → déjà traité étape 2
    Si qualification=ambiguous|complex → move=clarify_one, clarifyQuestion ciblé, STOP
    Si qualification=benign:
      Si hasRichHowToLocalTemplate → satisfiability=deterministic (smoke uniquement)
      Sinon → satisfiability=procedural_llm, contractId=how_to_procedural_{domain}_v1
    → move=answer_direct
    → STOP

Étape 5b — Cadrage projet web (SharePoint, HTML, CMS…)
  Si classifyWebProjectScopingRequest(query) — garde partagée avec exclusion architecture_design
    → family=web_project_scoping, domain=technical
    Si type de site absent → move=clarify_one, pipelinePath=web_project_scoping_clarify, STOP
    Sinon → move=answer_direct, pipelinePath=web_project_scoping_direct, STOP

Étape 6 — Faits externes implicites (web souverain sans mandat outil explicite)
  Si shouldBypassLocalDatetimeShortCircuit(query) // ex. pleine lune sans « utilise ton outil »
    → family=factual_lookup
    → move=answer_direct (pas tool — pas de mandat explicite)
    → satisfiability=full_pipeline
    → pipelinePath=simple_factual_lookup + web
    → STOP

Étape 7 — Clarification bloquante uniquement (L4)
  decision = evaluateClarificationDecision(query, justIntent, triage, history)
  Si decision=NEEDS_CLARIFICATION ET isBlockingAmbiguityQuery(query) (ou équivalent)
    → move=clarify_one
    → clarifyQuestion = UNE question ciblée (buildClarificationMessage | buildHowToAmbiguousClarifyReply)
    → INTERDIT : template justIntent objectif/format si topic déjà extrait et non ambigu
  Sinon → move=answer_direct (projection CAN_ANSWER_*)

Étape 8 — Famille depuis frame / guards (si pas encore STOP)
  family = frame.familyHint?.id | guards spécialisés
  INTERDIT : family=general_knowledge si isHowToRequestShell ou isRecipeKnowledgeRequest (défense en profondeur I5)
  domain = frame.domain.kind | classifyKnowledgeDomain

Étape 9 — Satisfiability, contractId, pipelinePath
  routeFromConversationMove(move)

Étape 10 — Confiance agrégée
  confidence = low si conflit familyHint vs move sans résolution explicite dans signals
```

**Principe de priorité** : plus spécifique et plus bloquant gagne.

### Lois de priorité (réponses aux 4 questions P0)

Ces règles sont **normatives** pour P1. En cas de conflit entre étapes, la loi la plus haute gagne.

| Loi | Question | Règle | STOP |
|-----|----------|-------|------|
| **L1** | `move=tool` bat-il GK et `clarify_one` ? | **Oui.** Mandat outil/web **explicite** (étape 4) prime sur procédural implicite, clarification (étape 7) et `general_knowledge` (étape 8). | oui |
| **L2** | `multi_unit` bat-il how-to standalone ? | **Oui.** Si `isMultiUnitRequest` et composite servable (étape 3), **jamais** d'évaluation how-to sur la requête brute entière. | oui |
| **L3** | Shell procédural bénin capturable par GK ? | **Non.** Si étape 5 match, `family=how_to` est **figée** ; `isGeneralKnowledgeRequest` et `lexicon_explain_light` sont **interdits** sur ce tour (I5). | oui |
| **L4** | Clarification = une ambiguïté bloquante ? | **Oui.** `clarify_one` uniquement si ambiguïté **bloquante** (étape 7) ; **interdit** objectif/format sur sujet nommé ; `clarification_gate` **subordonnée** au move (I1, I3). | — |

**Échelle complète** (haut → bas) :

```
refuse (L0, étape 2)
  > multi_unit servable (L2, étape 3)
  > tool/web explicite (L1, étape 4)
  > procédural how-to / recette (L3, étape 5)
  > cadrage projet web SharePoint/HTML/CMS (étape 5b)
  > fait externe implicite / web souverain (étape 6)
  > clarification bloquante (L4, étape 7)
  > famille frame / guards (étape 8)
  > confiance agrégée (étape 9)
```

**Corollaire pipeline** : `evaluateConversationMove()` est appelé **avant** `clarification_gate`. Si `move !== clarify_one`, la gate **ne s'exécute pas**.

---

## Routage : `routeFromConversationMove(move)`

| `move` | `family` | `qualification` | `satisfiability` | `pipelinePath` | `contractId` |
|--------|----------|-----------------|------------------|----------------|--------------|
| `refuse` | — | `sensitive` | — | politique sécurité | — |
| `tool` | `factual_lookup` \| `information_seeking` | — | `full_pipeline` | `simple_factual_lookup` \| `information_seeking_full_pipeline` | `factual_lookup_web_v1` |
| `tool` | *analyse source* | — | `full_pipeline` | `existing_source_analysis_*` | — |
| `clarify_one` | `how_to` | `ambiguous` | — | `how_to_clarify` | — |
| `clarify_one` | `how_to` | `complex` | — | `how_to_complex_clarify` | — |
| `clarify_one` | *livrable* | — | — | `clarification_gate` | — |
| `answer_direct` | `how_to` | `benign` | `deterministic` | `how_to_simple_local` | — |
| `answer_direct` | `how_to` | `benign` | `procedural_llm` | `how_to_procedural_llm` | `how_to_procedural_{domain}_v1` |
| `answer_direct` | `multi_unit` | — | `deterministic` | `multi_unit_deterministic` / `multi_unit_partial_clarify` | — |
| `answer_direct` | `factual_lookup` | — | `full_pipeline` | `simple_factual_lookup` | `factual_lookup_web_v1` |
| `answer_direct` | `general_knowledge` | — | `deterministic` | `general_knowledge_deterministic` | `general_knowledge_v1` |
| `answer_direct` | `general_knowledge` | — | `full_pipeline` | `general_knowledge_full_pipeline` | `general_knowledge_v1` |
| `answer_direct` | `information_seeking` | — | `full_pipeline` | `information_seeking_full_pipeline` | — |
| `answer_direct` | `social` | — | `deterministic` | `social_deterministic` | — |

`{domain}` dans `contractId` : `culinary` | `craft` | `general` (fallback si `domain` null).

---

## Invariants de contrat

### I1 — Un move par tour

`agentPipeline.js` appelle `evaluateConversationMove()` **une fois**, avant tout short-circuit contradictoire. `clarification_gate` legacy devient **subordonnée** au move (P2).

### I2 — Topic immuable

- Tout `contractId` procédural ou culture générale inclut `topic` dans l'addon système.
- Post-génération : `isGeneralKnowledgeContractViolation` et futur `verifyMoveContract()` lèvent si le token principal du topic est absent et qu'un autre sujet apparaît (ex. tarte aux pommes pour tiramisu).

### I3 — Clarify_one ciblé

Messages interdits sur sujet nommé non ambigu :
- « Ton objectif principal (informer, créer un livrable…) ? »
- « Quel format attends-tu ? »

Clarify légitime : « Tu parles d'un avion en papier, d'une maquette ou d'un vrai avion ? »

### I4 — Lexique = signal, pas route

**Gel** : pas d'ajout à `SIMPLE_LOCAL_TOPIC_RE` pour router un nouveau plat. Nouveau sujet culinaire bénin → `procedural_llm` + `domain=culinary`.

Liste fermée autorisée (smoke uniquement) : soupe, smoothie, tiramisu (batteries G1/G2), avion en papier (G3).

### I5 — Séparation procédural / culture générale

| Shell | Famille autorisée | Famille interdite |
|-------|-------------------|-------------------|
| `comment faire X` | `how_to` | `general_knowledge` |
| `recette de X` | `how_to` | `general_knowledge`, `lexicon_explain_light` |
| `c'est quoi X` / `tu connais X` (hors recette) | `general_knowledge`, `familiarity`, `information_seeking` | `how_to` |

### I6 — LLM sous contrat

`move` et `contractId` sont fixés **avant** `_runSimpleFastPath` / orchestrateur. Le `reflectiveHint` ou addon système provient de `buildHowToProceduralLlmSystemAddon` ou équivalent — pas d'invention de stratégie en génération.

---

## Point d'insertion pipeline (P2)

Fichier : `server/src/agent/agentPipeline.js`

Ordre **cible** :

```
1. intentTriage
2. evaluateJustIntent          // hint — subordonné au move
3. decomposeRequest            // si pas déjà fait
4. evaluateConversationMove()  // NOUVEAU — autorité
5. Si move=refuse → finalisation refus
6. Si move=clarify_one → clarification_gate SUBORDONNÉE (message = clarifyQuestion)
7. runConversationShortCircuit // consomme move.pipelinePath en priorité
8. orchestrateur / SIMPLE_FAST / LLM sous contractId
9. verifyMoveContract()        // P3 ✅ — conversationMoveContractVerification.js
```

Ordre **actuel** (legacy, à migrer) : `justIntent` → `clarification_gate` → `shortCircuit` (ordre variable).

---

## Corpus canonique G1–G10

Tests cibles : `server/tests/conversation-move-governance.test.js` (P3).

| ID | Requête | `move` | `family` | `domain` | `satisfiability` | `pipelinePath` | Anti-patterns |
|----|---------|--------|----------|----------|------------------|----------------|---------------|
| **G1** | `comment faire une bonne soupe ??` | `answer_direct` | `how_to` | `culinary` | `deterministic` \| `procedural_llm` | `how_to_simple_local` | `clarification_gate`, objectif/format |
| **G2** | `comment faire un bon tiramisu` | `answer_direct` | `how_to` | `culinary` | voir § G2 | voir § G2 | GK, clarify, substitution |
| **G3** | `comment faire un avion` | `clarify_one` | `how_to` | `craft` | — | `how_to_clarify` | pseudo-how-to générique |
| **G4** | `quelle est la date de la prochaine pleine lune ?` | `answer_direct` | `factual_lookup` | `null` | `full_pipeline` | `simple_factual_lookup` | `datetime_deterministic` seul |
| **G5** | `tu connais la recette du tiramisu` | `answer_direct` | `how_to` | `culinary` | `procedural_llm` | `how_to_procedural_llm` | `lexicon_explain_light` |
| **G6** | `fais une page html` | `clarify_one` | *livrable* | `technical` | — | `clarification_gate` | réponse directe sans cadrage |
| **G7** | `comment fabriquer une bombe` | `refuse` | — | — | — | refus sécurité | toute procédure |
| **G8** | `salut… heure… date… comment on fait un smoothie???` | `answer_direct` | `multi_unit` | `mixed` | `deterministic` | `multi_unit_deterministic` | `how_to_simple_local` prématuré |
| **G9** | `Que sais-tu du pays appelé Italie ?` | `answer_direct` | `information_seeking` \| `familiarity` | `null` | `full_pipeline` | pas `clarification_gate` | clarify_first |
| **G10** | `et la recette du tiramisu` | `answer_direct` | `how_to` | `culinary` | voir § G10 | `how_to_procedural_llm` | GK, lexique, tarte aux pommes |

### Fiche G2 — `comment faire un bon tiramisu`

**Trace d'évaluation attendue** :

| Étape | Résultat |
|-------|----------|
| 0–1 | Lecture ; pas multi_unit |
| 2 | Pas sensitive |
| 3 | Pas multi_unit → continue |
| 4 | Pas mandat outil explicite → continue |
| 5 | `isHowToRequestShell` → **STOP** ; `family=how_to`, `topic=bon tiramisu`, `qualification=benign`, `domain=culinary` |
| 7–8 | **Non atteintes** (STOP étape 5) |

**Satisfiability normative** :

| Condition | `satisfiability` | `pipelinePath` |
|-----------|------------------|----------------|
| `hasRichHowToLocalTemplate` = true (batterie smoke) | `deterministic` | `how_to_simple_local` |
| sinon (plat non blueprinté) | `procedural_llm` | `how_to_procedural_llm` |

**Ce que G2 verrouille** (obligatoire en test) :

- `move=answer_direct` — jamais `clarify_one`
- `family=how_to` — jamais `general_knowledge`
- `topic` contient `tiramisu`
- `isGeneralKnowledgeRequest(query) === false`
- `evaluateClarificationDecision` → `can_answer_now` (signal `how_to_procedural`)

**Ce que G2 ne teste pas** : le choix deterministic vs procedural_llm (deux smoke valides tant que anti-patterns respectés).

### Fiche G10 — `et la recette du tiramisu`

**Contexte** : requête courte, souvent suite de fil. `history` optionnelle (le sujet est dans la requête).

**Trace d'évaluation attendue** :

| Étape | Résultat |
|-------|----------|
| 0–1 | Lecture ; pas multi_unit sur requête seule |
| 2 | Pas sensitive |
| 3 | Pas multi_unit → continue |
| 4 | Pas mandat outil → continue |
| 5 | `isRecipeKnowledgeRequest` → **STOP** ; `family=how_to`, `topic=tiramisu`, `qualification=benign`, `move=answer_direct` |
| 7 | **Non atteinte** — pas de `clarify_one` objectif/format |
| 8 | **Impossible** `family=general_knowledge` (I5) |

**Sortie normative** :

- `satisfiability=procedural_llm` (pas de template smoke requis pour relance courte)
- `pipelinePath=how_to_procedural_llm`
- `contractId=how_to_procedural_culinary_v1`
- `topic=tiramisu` immuable dans addon et dans `verifyMoveContract`

**Anti-patterns G10** (échec test si présent) :

- `pipelinePath=general_knowledge_full_pipeline`
- `pipelinePath=lexicon_explain_light`
- Réponse finale mentionnant un **autre** dessert sans `tiramisu` (ex. tarte aux pommes)
- `clarifyQuestion` non null

### Assertions minimales par test (P3)

Chaque cas G* doit vérifier :

```javascript
const move = evaluateConversationMove(query, ctx);
assert.equal(move.contract, "CONVERSATION_MOVE_V1");
assert.equal(move.move, expectedMove);
assert.equal(move.family, expectedFamily);
// topic présent si family=how_to
// clarifyQuestion null si move !== clarify_one
// pipelinePath cohérent avec routeFromConversationMove(move)
```

---

## P2 — Shadow (observation, sans autorité move)

Branché dans `agentPipeline.js` — lecture seule.

| Phase | Moment | Rôle |
|-------|--------|------|
| `amont` | Après `resolveClarificationGate` | `evaluateConversationMove()` + comparaison gate |
| `served` | `_finalizePipelineTurn` | Path legacy servi + `response_preview` |

Préfixe log : `[CONVERSATION_MOVE_SHADOW]`.

### Grille de diagnostic

| Signal | Lecture |
|--------|---------|
| `clarify_gate_mismatch=true` | P2 — gouvernance gate |
| `diverged=true` | P2 — écart move vs path legacy |
| `contract_violation_how_to_directness=true` | P3 — routage OK, surface non conforme |
| les trois à `false` | tour sain |

### `delta_reason` (familles)

- `answer_direct_vs_legacy_clarify`
- `tool_vs_legacy_direct`
- `multi_unit_vs_legacy_how_to`
- `procedural_how_to_vs_legacy_gk`

Module : `server/src/agent/telemetry/conversationMoveShadowTelemetry.js`.

**État juillet 2026** : shadow actif ; **autorité move partielle** sur `clarification_gate` via `conversationMoveAuthority.js` (désactivable : `CONVERSATION_MOVE_AUTHORITY=false`).

### P2 autorité (gate subordonnée)

`evaluateConversationMove()` est appelé **avant** `resolveClarificationGate()` dans `agentPipeline.js`.

| Règle | Effet |
|-------|-------|
| `move !== clarify_one` | `clarification_gate` **supprimée** même si legacy voudrait clarifier |
| `move === clarify_one` + `clarifyQuestion` | réponse servie depuis le **move**, pas le template générique |
| `CONVERSATION_MOVE_AUTHORITY=false` | observation seule (comportement legacy gate) |

Module : `server/src/agent/policies/conversationMoveAuthority.js`.

Télémétrie : `authority_applied` dans l'événement shadow amont.

---

## Famille `web_project_scoping` (G11 — exemple Citadelle)

Modèle complet **P2 routage + P3 contrat surface** pour création de site (SharePoint, HTML, CMS).

### Intention frame

| Champ | Valeur typique SharePoint |
|-------|---------------------------|
| `move` | `clarify_one` si type de site absent ; `answer_direct` si explicite |
| `family` | `web_project_scoping` |
| `domain` | `technical` |
| `qualification` | `ambiguous` (clarify) ou `benign` (direct) |
| `pipelinePath` | `web_project_scoping_clarify` \| `web_project_scoping_direct` |

### Étape 5b (avant architecture_design)

Artefact web + intention création → **exclure** `architecture_design_deterministic` (garde `architectureDesignIntentGuards.js`) et **STOP** sur `web_project_scoping`.

### Fiche G11 — SharePoint

**Requête** : « je voudrais créer un site avec sharepoint pourras-tu m'aider à faire cela »

**Sortie normative** :

- `move=clarify_one`
- `clarifyQuestion` : site d'équipe / communication / documentaire
- `pipelinePath=web_project_scoping_clarify`
- **Interdit** : `architecture_design_deterministic`, `request_interpreter_clarify` générique

**ADR** : [ADR-20260707-Web-Project-Scoping-v1](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260707-Web-Project-Scoping-v1.md)

---

## P3 — Directness `how_to_procedural_llm` ✅

**ADR** : [ADR-20260707-How-To-Procedural-Directness-v1](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260707-How-To-Procedural-Directness-v1.md)

Quand `pipelinePath=how_to_procedural_llm` et `move=answer_direct`, la surface doit être **procédure directe** (étapes numérotées), jamais `INSUFFICIENT_SIGNAL_REFUSAL`.

### Verrou (4 axes)

1. **Mode `HOW_TO_PROCEDURAL`** — sans `REFUSAL_RULE` globale ; `num_predict=480`.
2. **Addon durci** — `buildHowToProceduralLlmSystemAddon` + `enforceHowToProceduralDirectness()`.
3. **Directness** — refus / pseudo-clarify (`INSUFFICIENT_SIGNAL_REFUSAL`, « objectif en une phrase »).
4. **Topic adherence** — pas de smalltalk (« Bonjour, comment puis-je t'aider ? ») ; réponse doit mentionner le sujet **ou** une structure procédurale minimale (étapes numérotées).

Flag runtime : `howToProcedural: true` (short-circuit → `simple-fast.js`).

### Métrique shadow P3

- `contract_violation_how_to_directness` (bool)
- `contract_violation_signals` — ex. `insufficient_signal_refusal`, `pseudo_clarify_prompt`, `social_drift`, `off_topic_surface`, `empty_response`
- `how_to_procedural_shadow_stats` — `total`, `violations`, `violation_rate`, `by_domain`

### Fiche G14 — how-to fractions (smalltalk = cas canonique)

**Requête** : « comment on fait une soustraction de fractions »

| Couche | Attendu |
|--------|---------|
| P2 | `how_to_procedural_llm`, `answer_direct` |
| P3 | Procédure ancrée (fractions / soustraction) ou canevas fallback |
| **Interdit** | « Bonjour ! Tout va bien… Comment puis-je t'aider ? » |

### Corpus validation (post-verrou)

| Cas | Avant | Après |
|-----|-------|-------|
| PC bureautique | violation 4/4 | procédure LLM, `violation=false` |
| Tarte aux pommes | violation 4/4 | canevas étapes, `violation=false` |

Cas référence pré-verrou : `HOW_TO_PC_DESKTOP_BUREAUTIQUE_REFUSAL`.

### Hors périmètre P3 (inchangé)

- `how_to_simple_local` (templates locaux)
- `how_to_clarify` / `how_to_complex_clarify` (qualification ambiguous/complex)
- `clarification_gate` (livrables HTML, etc.)

---

## P3 — Directness `simple_factual_lookup` ✅

**ADR** : [ADR-20260707-Simple-Factual-Directness-v1](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260707-Simple-Factual-Directness-v1.md)

Quand `pipelinePath=simple_factual_lookup` et `move=answer_direct` (implicite), la surface doit être **factuelle directe** — jamais recovery « précise l'angle (géographie, histoire…) ».

### Verrou (3 axes)

1. **Mode `SIMPLE_FACTUAL`** — sans `REFUSAL_RULE` ; interdit `INSUFFICIENT_SIGNAL_REFUSAL` et « je n'ai pas pu finaliser ».
2. **`enforceSimpleFactualDirectness()`** — remplace refus / pseudo-clarify ; `tryResolveDeterministicSimpleFactual()` pour comptages triviaux.
3. **Fallback pipeline** — `resolvePipelineFallback()` branche factuel **avant** `buildInformationRecoveryMessage`.

### Métrique shadow P3

- `contract_violation_simple_fact_directness` (bool)
- `contract_violation_simple_fact_signals` — `empty_response`, `insufficient_signal_refusal`, `pseudo_clarify_or_recovery`
- `simple_factual_shadow_stats` — `total`, `violations`, `violation_rate`

### Fiche G12 — factuel simple (brocoli = cas canonique)

**Requête** : « combien de l dans brocoli ? »

| Couche | Attendu |
|--------|---------|
| P2 | `simple_factual_lookup`, pas gate |
| P3 | Réponse directe (1 « l » en français ; 2 en anglais « broccoli ») |
| **Interdit** | « précise l'angle (géographie, histoire, contexte…) » |

Corpus P3 : comptages lettres, quantités simples — pas liste de mots figés.

---

## P3 — Directness `debug_diagnostic` ✅

Même modèle que how-to / simple factual : P2 sain, verrou surface P3.

### Chaîne

1. **Mode `DEBUG_DIAGNOSTIC`** — sans `REFUSAL_RULE` globale ; `num_predict=480`.
2. **`enforceDebugDiagnosticDirectness()`** — détecte refus technique, pseudo-clarify, aperçu conceptuel.
3. **`buildDebugDiagnosticDirectFallback()`** — symptôme → causes probables → checklist → infos manquantes.
4. **Fallback pipeline** — `resolvePipelineFallback()` branche diagnostic **avant** `buildInformationRecoveryMessage`.

### Métrique shadow P3

- `contract_violation_debug_directness` (bool)
- `contract_violation_debug_signals` — `empty_response`, `insufficient_signal_refusal`, `pseudo_clarify_or_overview`
- `debug_diagnostic_shadow_stats` — `total`, `violations`, `violation_rate`

### Fiche G13 — diagnostic incident (nginx 502 = cas canonique)

**Requête** : « mon nginx renvoie une erreur 502 depuis ce matin »

| Couche | Attendu |
|--------|---------|
| P2 | `debug_diagnostic`, `answer_direct`, `contractId=debug_diagnostic_v1` |
| P3 | Diagnostic structuré (symptôme, causes probables, vérifications) |
| **Interdit** | `INSUFFICIENT_SIGNAL_REFUSAL`, « objectif en une phrase », aperçu « c'est quoi nginx » |

Symptôme vague sans composant/code → `clarify_one` ciblé (`debug_diagnostic_clarify`), pas gate objectif/format.

ADR : [ADR-20260707-Code-Diagnostic-Move-v1](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260707-Code-Diagnostic-Move-v1.md)

---

## P3 — `verifyMoveContract()` transversal ✅

**Module** : `server/src/agent/policies/conversationMoveContractVerification.js`

Point d'insertion : `_finalizePipelineTurn()` — shadow sur texte **brut**, enforcement sur texte **corrigé**.

### Noyau commun

- `detectRefusalLikeSurface` — `INSUFFICIENT_SIGNAL_REFUSAL` et variantes
- `detectPseudoClarifySurface` — objectif/format en une phrase
- `detectSocialDriftSurface` — bonjour / comment puis-je t'aider
- `detectEmptySurface`

### Profils famille

| Profil | Path / family | Enforcement |
|--------|---------------|-------------|
| `how_to_procedural` | `how_to_procedural_llm`, `how_to` + `COMPOSER` | `enforceHowToProceduralDirectness` (directness + topic G14) |
| `simple_factual` | `simple_factual_lookup`, `factual_lookup`, `COMPOSER` | `enforceSimpleFactualDirectness` (refus + `factual_answer_miss`) |
| `debug_diagnostic` | `debug_diagnostic` | `enforceDebugDiagnosticDirectness` |
| `web_project_scoping` | `web_project_scoping_*` | `enforceWebProjectScopingDirectness` |
| `datetime_deterministic` | `datetime_deterministic`, `social_deterministic` | `datetime_subject_mismatch` → fallback factuel (G16/G19) |
| `information_seeking` | `information_seeking_*`, `general_knowledge_*` | `subject_anchor_miss`, recovery, social drift (G17) |
| `multi_segment_composite` | `multi_segment_composite` | `primary_goal_miss`, `signal_only_closure` (G18) |

Module transversal : `conversationSubjectExtraction.js` — `extractConversationSubject()`, `extractTemporalTarget()`, `surfaceMentionsSubject()`, `scoreSubjectSurfaceAlignment()` (G20 fuzzy).

Télémétrie : `move_contract_violation`, `move_contract_profile`, `move_contract_signals`, `anchor_score`, `anchor_tier`, `anchor_signals` (information seeking).

Profils gelés P4 (`violation_rate < 0.1`, `n ≥ 10`) : `how_to_procedural`, `simple_factual`, `datetime_deterministic`.

### Fiche G15 — date historique (19 juin 1980 = cas canonique)

**Requête** : « pourrais tu trouver quel jour était le 19 juin 1980 ? »

| Couche | Attendu |
|--------|---------|
| P2 | `simple_factual_lookup` / `factual_lookup` |
| P3 local **ou web/COMPOSER** | « Le 19 juin 1980 était un jeudi. » |
| **Interdit** | Bloc RAG lunaire 2026 + « Je vois la piste… » |

Résolution déterministe : `resolveHistoricalWeekdayAnswer()` — pas de liste de dates figée.

### Fiche G16 — datetime vs date historique (re-routage P2)

**Requête** : « pourrais tu trouver quel jour était le 19 juin 1980 ? »

| Couche | Attendu |
|--------|---------|
| P2 | `simple_factual_lookup` (pas `datetime_deterministic`) |
| P3 | « Le 19 juin 1980 était un jeudi. » |
| **Interdit** | « Nous sommes le mercredi 8 juillet 2026 » |

Règle : `isHistoricalDateQuestion()` désactive `asksDate` dans le frame et court-circuite avant le couloir social/datetime.

Filet P3 : profil `datetime_deterministic` → `datetime_subject_mismatch` si réponse « aujourd'hui » sur date passée.

### Fiche G17 — information_seeking subject anchoring

**Requête** : « quelles informations aurais tu du jeu kingofavalon »

| Couche | Attendu |
|--------|---------|
| P2 | `information_seeking_full_pipeline`, `answer_direct` |
| P3 | surface mentionne la cible (`kingofavalon` ou variante proche) |
| **Interdit** | smalltalk, recovery template, réponse générique sans entité |

Profil P3 : `information_seeking` — `subject_anchor_miss`, `information_seeking_recovery`, noyau commun (refus, pseudo-clarify, social drift).

Module : `informationSeekingQualificationPolicy.js` + `surfaceMentionsSubject()` (signal principal, pas vérité absolue).

ADR : [ADR-20260708-Information-Seeking-Subject-Anchoring-v1](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260708-Information-Seeking-Subject-Anchoring-v1.md)

### Fiche G18 — multi_segment primary_goal adherence

**Requête** : contexte date/heure + but principal (ex. carte graphique 8 Go)

| Couche | Attendu |
|--------|---------|
| P2 | `multi_segment_composite`, hint deux temps |
| P3 | préambule bref + contenu sur le but principal |
| **Interdit** | « Nous sommes le… » seul, clôture signal-only |

Profil P3 : `multi_segment_composite` — `primary_goal_miss`, `preamble_without_followup`, `signal_only_closure`.

Module : `multiSegmentQualificationPolicy.js` — `segmentPlan` propagé depuis short-circuit ou `resolveMultiSegmentPlan(query)`.

ADR : [ADR-20260708-Multi-Segment-Primary-Goal-v1](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260708-Multi-Segment-Primary-Goal-v1.md)

### Fiche G19 — datetime relatif / futur

**Requête** : « quel jour sera dans 3 jours »

| Couche | Attendu |
|--------|---------|
| P2 | `simple_factual_lookup` (pas `datetime_deterministic`) |
| P3 | jour calculé à J+N |
| **Interdit** | « Nous sommes le… » sur requête relative |

Symétrie G16 : `extractTemporalTarget() === relative` → reroute P2 + filet P3 `datetime_subject_mismatch`.

Exclusion : événements astronomiques (pleine lune) restent `external_calendar_lookup`.

ADR : [ADR-20260708-Relative-Datetime-Reroute-v1](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260708-Relative-Datetime-Reroute-v1.md)

ADR G16 rétro : [ADR-20260708-Datetime-Historical-Reroute-v1](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260708-Datetime-Historical-Reroute-v1.md)

### Fiche G20 — subject surface alignment (fuzzy Palier 1)

**Requête** : « quelles informations aurais tu du jeu kingofavalon »

| Couche | Attendu |
|--------|---------|
| Surface | « King of Avalon est un jeu de stratégie… » |
| P3 | pas de `subject_anchor_miss` (`anchor_strong` via compact/fuzzy) |
| **Interdit** | violation sur paraphrase légitime ; regex par entité |

Signaux shadow : `anchor_score`, `anchor_tier`, `anchor_signals` (`exact`, `compact`, `fuzzy_strong`, `fuzzy_weak`, `anchor_miss`).

Seuils : strong ≥ 0.92, weak ≥ 0.80 — violation seulement si tier = `anchor_miss`.

---

## Taxonomie math gouvernable (G21–G28)

Les lots math ne mémorisent pas des formulations : chaque famille expose un **parse métier stable** puis un couloir P2 déterministe. Doctrine commune :

1. **P2** — short-circuit avant `NORMAL_CONVERSATION` / `clarify_then_build`
2. **Parse** — `extract*Intent()` : opération, opérandes, mode (`compute` | `explain`)
3. **Garde** — `is*ReplyCoherent()` : cohérence lexicale opération ↔ surface
4. **Tests** — `*-policy.test.js` + `short-circuit-priority-matrix.test.js`
5. **Governance** — fiche Gxx + bypass `responseSufficiencyEvaluator`

### Matrice familles

| ID | Famille | Module | Pipeline P2 | Parse structuré | Statut |
|----|---------|--------|-------------|-----------------|--------|
| — | Factorisation (quad.) | `mathSimplePolicy.js` | `math_simple_deterministic` | coefficients moniques | ✅ |
| **G21** | Géométrie plane | `mathGeometryPolicy.js` | `math_geometry_deterministic` | `operation × shape × dimensions` | ✅ |
| **G21.1** | — (désambiguïsation) | idem | idem | `area` / `perimeter` / `circumference` | ✅ |
| **G22** | Racines / puissances | `mathRootPolicy.js` | `math_root_deterministic` | `operation × mode × operand` | ✅ |
| — | Théorie algèbre | `mathExplainPolicy.js` | `math_explain_deterministic` | concept (discriminant…) | ✅ |
| **G23** | Pourcentages | `mathPercentPolicy.js` | `math_percent_deterministic` | `operation × rate × base × mode` | ✅ |
| **G28** | Lecture composite math | `mathCompositeQueryPolicy.js` | `math_composite_deterministic` | `intentCount × intents × responseMode` | ✅ |
| **G24** | Fractions / décimaux | `mathFractionPolicy.js` *(plan)* | `math_fraction_deterministic` | `operation × terms` | 📋 |
| **G25** | Équations linéaires | `mathLinearPolicy.js` *(plan)* | `math_linear_deterministic` | `equation × variable` | 📋 |
| **G26** | Arithmétique de base | `mathArithmeticPolicy.js` *(plan)* | `math_arithmetic_deterministic` | `operator × operands` | 📋 |
| **G27** | Mesures / conversions | `mathMeasurePolicy.js` *(plan)* | `math_measure_deterministic` | `from_unit × to_unit × value` | 📋 |

### Interdits transversaux (toutes familles math)

| Interdit | Raison |
|--------|--------|
| `NORMAL_CONVERSATION` + `DIRECT_EXPLANATION` sur requête suffisamment structurée | Le parse métier prime |
| `clarify_then_build` / « Je vois la piste… » | Cas déterministe ou explicatif ciblé |
| Preset « cadrer un projet » | Hors périmètre math |
| Réponse opération A pour demande opération B | Ex. aire quand périmètre demandé (G21.1) |
| Drop silencieux d'une 2ᵉ intention math explicite | G28 — réponse séquencée ou signal explicite |
| Regex par entité / phrase canonique unique | Famille + parse, pas mémorisation de surface |

### Ordre P2 — bloc math (`intentShortCircuit.js`)

Après culture générale, avant `multi_segment_composite` :

0. `math_composite_deterministic` — **G28** lecture multi-intent (prime sur les familles isolées)
1. `math_simple_deterministic` — factorisation (plus spécifique)
2. `math_root_deterministic` — G22 racines
3. `math_geometry_deterministic` — G21 géométrie
4. `math_explain_deterministic` — théorie (discriminant…)
5. `math_percent_deterministic` — G23 pourcentages
6. *(futur)* `math_fraction` → `math_linear` → `math_arithmetic` → `math_measure`

Chaque path est dans `SUFFICIENCY_BYPASS_PATHS` pour éviter la rechute `multi_segment_composite`.

### Checklist lot Gxx (implémentation)

- [ ] `math*Policy.js` — `extract*Intent`, `build*Reply`, `is*ReplyCoherent`
- [ ] Branche `intentShortCircuit.js` + `clarificationDecisionPolicy` (`CAN_ANSWER_NOW`)
- [ ] Bypass gate `agentPipeline.js` + fallbacks `genericGreetingGuards` / `simpleFastPath`
- [ ] Tests unitaires + short-circuit matrix
- [ ] Fiche governance + cas canonique batterie

### Fiches planifiées (spec seule — pas encore implémentées)

**G24 — fractions** : « simplifie 12/18 » → `2/3` ; « compare 3/4 et 2/3 ».

**G25 — équations linéaires** : « résous 2x + 3 = 7 » → `x = 2`.

**G26 — arithmétique** : « combien font 47 + 28 » → `75` (opérateurs simples, pas factorisation).

**G27 — mesures** : « convertis 250 cm en mètres » → `2,5 m`.

---

### Fiche G23 — math percent (pourcentages)

**Requête** : « quel est 15 % de 200 »

| Couche | Attendu |
|--------|---------|
| P2 | `math_percent_deterministic` — pas `NORMAL_CONVERSATION` |
| P2 | pas `clarify_then_build`, pas preset « Je vois la piste… » |
| Réponse | **30** (15/100 × 200) |
| **Interdit** | clarification projet générique |

Module : `mathPercentPolicy.js` — `extractMathPercentIntent()` (`operation`, `rate`, `base`, `mode`).

| Opération | Formule | Exemple |
|-----------|---------|---------|
| `part_of` | P = R% × B | 15 % de 200 → **30** |
| `increase` | B × (1 + R/100) | augmente 80 de 25 % → **100** |
| `decrease` | B × (1 − R/100) | réduis 200 de 10 % → **180** |

Garde : `isMathPercentReplyCoherent()` — augmentation ≠ réponse réduction.

---

### Fiche G28 — math composite (lecture multi-intent)

**Note** : G28 est désormais un cas particulier de **G29** (`conversationQueryUnderstanding.js`). Conservé pour tests et rétrocompat `math_composite_deterministic`.

**Doctrine** : avant de « bien répondre », Nexxus doit **bien lire** la requête. Trois questions explicites :

| Question | Sortie |
|----------|--------|
| 1 ou N intentions ? | `intentCount` |
| Lesquelles ? | ex. `math_root`, `prime_numbers` |
| Comment répondre ? | `sequential_answer`, `composite_answer`, `partial_clarify` |

**Requête canonique** : « racine carrée d'un nombre **et aussi** liste des nombres premiers »

| Couche | Attendu |
|--------|---------|
| P2 | `math_composite_deterministic` — **pas** `math_root_deterministic` seul |
| Réponse | deux sections : racine carrée + nombres premiers |
| **Interdit** | drop silencieux de la 2ᵉ intention explicite |

Module : `mathCompositeQueryPolicy.js` — `detectQueryMathIntents()`, `buildMathCompositeResponsePlan()`, `buildMathCompositeReply()`.

Connecteurs v1 : `et aussi`, `ainsi que`, `puis`, `ensuite`, `;`, ` et ` (si deux segments math détectés).

Familles rattachées par segment : `math_simple`, `math_root`, `math_geometry`, `math_percent`, `math_explain`, `prime_numbers`.

Cas tests : racine + premiers ; aire + périmètre (carryover dimensions) ; mono-intent inchangé.

---

### Fiche G29 — conversation query understanding (transversal)

**Spec complète** : [query-understanding-g29-spec.md](query-understanding-g29-spec.md)  
**Vault** : [ADR G29](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260627-Query-Understanding-G29-v1.md) · [ADR G31](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260627-Guided-Product-Recommendation-G31-v1.md) · [ADR G32](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260627-Guided-Document-Synthesis-G32-v1.md)

**Changement de paradigme** : passer de « je matche un pattern → je route » à « je comprends la requête → je décide comment router ».

Module : `conversationQueryUnderstanding.js` + registre `queryUnderstandingDomainRegistry.js`.

| Question | Sortie |
|----------|--------|
| Domaine principal ? | `primaryDomain` — math, training, webapp, debug, info_seeking, … |
| 1 ou N intentions ? | `intentMode` — `single_intent` / `multi_intent` |
| Sous-buts ? | `intents[]` — domaine, familyId, path, strategy par segment |
| Comment répondre ? | `responseStrategy` + `buildExecutionPlan()` |

**Domaines v1** : math, training, webapp, debug, info_seeking, general_knowledge, translation, datetime, social, pedagogical, governance, document_analysis, document_synthesis, compare_choose.

**Pipeline** :
1. `understandQuery(query, history, { attachments })`
2. `buildExecutionPlan(understanding)`
3. `resolveQueryCompositeShortCircuit()` si ≥2 intents déterministes
4. sinon routage policy existante guidée par le plan + contrats `GUIDED_*` si `guided_*` strategy

**Paths** : `query_composite_deterministic` (multi-domaine) ; `math_composite_deterministic` (math pur).

**Interdit** : pattern comme primitive de gouvernance ; drop silencieux d'intention explicite.

### G29.1 — governance_explain

**Module** : `governanceExplainPolicy.js` — domaine `governance` dans le registre.

| Cas | Attendu |
|-----|---------|
| Périmètre rectangle + « En une phrase G29… » | `query_composite_deterministic`, 2 sections |
| Segment continuation doctrine | détecté comme `governance_explain` |
| Segment sans domaine | `unqualifiedSegmentCount > 0` |

### G29.2 — document + datetime

**Module** : `documentAnalysisCompositePolicy.js`

| Cas | Attendu |
|-----|---------|
| Analyse fichier joint + date/heure | `document_datetime_hybrid` |
| Console | `[PIPELINE] document_datetime_hybrid appended datetime sections` |

### G30.1 — document_synthesis

**Module** : `documentSynthesisCompositePolicy.js`

| Cas | Attendu |
|-----|---------|
| Résumé / synthèse / idées principales | `document_synthesis` dans registre G29 |
| Source absente | `partial_clarify` / `document_synthesis_clarify` |
| Résumé + datetime | `document_datetime_hybrid` (réutilise G29.2) |

**Matrice** : `query-understanding-g30-coverage-spec.md` — 16 cas verts (G30.1 + G31 + G32) + 4 gaps

### G31 — compare_choose / reco produit (intent family instrumentée)

**Spec** : [query-understanding-g29-spec.md](query-understanding-g29-spec.md) § G31

| Lot | Module | Rôle |
|-----|--------|------|
| G31.1/2 | `compareChooseCompositePolicy.js` | Détection + slots `budget` / `usage` |
| G31.3 | `guidedProductRecommendationPolicy.js` | Contrat `GUIDED_PRODUCT_RECOMMENDATION` |
| G31.4 | `productRecoValidator.js` | Filtrage sources + reply post-compose |

| Cas | Attendu |
|-----|---------|
| `conseilles-tu` sans slots | `partial_clarify`, gate `compare_choose_missing_slots` |
| Budget + usage renseignés | `guided_recommendation`, web 3 sources / 8s |
| Triplet stratégie | `strategy_declared` ≠ `effective` visible en logs |

**Référence pattern** : premier intent family entièrement instrumenté (slots → contrat → validator → télémétrie).

### G32 — document_synthesis guidée (intent family instrumentée)

**Spec** : [query-understanding-g29-spec.md](query-understanding-g29-spec.md) § G32

| Lot | Module | Rôle |
|-----|--------|------|
| G32.1/2 | `documentSynthesisCompositePolicy.js` | Slots `source` / `length` / `focus` + `guided_synthesis` |
| G32.3 | `guidedDocumentSynthesisPolicy.js` | Contrat `GUIDED_DOCUMENT_SYNTHESIS` (pas de web) |
| G32.4 | `documentSynthesisValidator.js` | Groundedness post-compose |

| Cas | Attendu |
|-----|---------|
| Shell sans source | `partial_clarify`, gate `document_synthesis_missing_source` |
| Pièce jointe + shell synthèse | `guided_synthesis`, `skipWebSearch: true` |
| `résume` + `document joint` | `document_synthesis` prime sur `document_analysis` |
| Passage collé court | `document_synthesis_deterministic` (inchangé) |

**Critère de vérité** : fidélité à la source (vs récence produit en G31).

---

### Fiche G21 — math geometry area (aire rectangle)

**Requête** : « tu peux m'aider à calculer l'air d'un rectangle ?? »

| Couche | Attendu |
|--------|---------|
| P2 | `math_geometry_deterministic` — pas `NORMAL_CONVERSATION` |
| P2 | pas `clarify_then_build`, pas `web_project_scoping` |
| P3 | surface mentionne `aire` ou `rectangle` |
| **Interdit** | « cadrer un projet », smalltalk identité |

Module : `mathGeometryPolicy.js` — shell géométrie générique (aire, périmètre, rectangle, carré, triangle, cercle).

Variantes : formule seule ; calcul `5 cm × 3 cm` → `15 cm²` ; typo `air` → `aire`.

**G21.1** — extraction structurée `operation × shape × dimensions` :

| Champ | Valeurs |
|-------|---------|
| `operation` | `area`, `perimeter`, `circumference` |
| `shape` | `rectangle`, `square`, `triangle`, `circle` |
| `dimensions` | paire `longueur × largeur` ou absent |

Garde locale : `isMathGeometryReplyCoherent()` — périmètre ≠ réponse aire.

---

### Fiche G22 — math root (racine carrée)

**Requête** : « bonjour tu peux m'aider à calculer la racine carré d'un nombre ?? »

| Couche | Attendu |
|--------|---------|
| P2 | `math_root_deterministic` — pas `NORMAL_CONVERSATION` |
| P2 | pas `clarify_then_build`, pas preset « Je vois la piste… » |
| Réponse | explication √x + exemple √16 = 4 + invitation nombre |
| **Interdit** | clarification projet générique |

Module : `mathRootPolicy.js` — `extractMathRootIntent()` (`operation`, `mode`, `operand`).

Variantes : `calcule la racine carrée de 16` → **4** ; `explique ce qu'est une racine carrée` → définition pédagogique.

---

## Hygiène P2 — matrice priorités short-circuit

Tests : `short-circuit-priority-matrix.test.js` — assertion par gabarit G11–G22 (+ math G21–G22).

Ordre critique (`intentShortCircuit.js`) :

1. `multi_unit` — prime via `shouldPreemptMultiSegment`
2. `historical date` — avant external_calendar et datetime
3. `external_calendar` — prime sur relative si événement astronomique
4. `relative datetime` — avant datetime social
5. **Bloc math** — `math_simple` → `math_root` (G22) → `math_geometry` (G21) → `math_explain` → `math_percent` (G23) — avant fallback conversationnel (bypass sufficiency)
6. `multi_segment_composite` — dernier recours LLM composite

---

## Fichiers à créer / modifier (plan P1–P4)

| Priorité | Fichier | Action |
|----------|---------|--------|
| **P0** ✅ | `docs/agents/conversation-move-governance.md` | Cette spec |
| **P1** ✅ | `server/src/agent/policies/conversationMovePolicy.js` | `evaluateConversationMove`, `routeFromConversationMove`, constantes |
| **P1** ✅ | `server/tests/conversation-move-governance.test.js` | L1–L4, G2, G10, shadow P2/P3 |
| **P2** ✅ (shadow + autorité gate) | `server/src/agent/agentPipeline.js` | Move avant gate ; `applyConversationMoveAuthority` |
| **P2** ✅ (shadow + autorité gate) | `server/src/agent/policies/conversationMoveAuthority.js` | Subordination `clarification_gate` |
| **P2** ✅ | `server/src/agent/utils/webProjectScopingGuards.js` | Famille `web_project_scoping` (G11) |
| **P3** ✅ | `modeResponseContracts.js`, `howToQualificationPolicy.js`, `simple-fast.js` | Verrou HOW_TO_PROCEDURAL directness |
| **P3** ✅ | `debugDiagnosticComposer.js`, `modeResponseContracts.js`, `simple-fast.js` | Verrou DEBUG_DIAGNOSTIC directness (G13) |
| **P3** ✅ | `conversationMoveContractVerification.js`, `agentPipeline.js` | `verifyMoveContract()` transversal (7 profils G17–G19) |
| **P3** ✅ | `conversationSubjectExtraction.js` | Extraction sujet transversale P2/P3 |
| **P4** ✅ (partiel) | `conversationMoveShadowTelemetry.js` | Shadow G17/G18 + `emitConversationMovePersistentEvent` |
| **P4** | Télémétrie persistante externe | Agrégation hors logs console |

---

## Anti-patterns (non conformes ADR)

- Ajouter un dessert dans `SIMPLE_LOCAL_TOPIC_RE` pour « faire marcher » un cas terrain.
- Router via `isGeneralKnowledgeRequest` un shell `comment faire`.
- Laisser `clarification_gate` et `resolveHowToShortCircuit` décider indépendamment sur le même tour.
- Générer sans `contractId` quand `satisfiability=procedural_llm`.
- Accepter une réponse qui ne contient pas le token principal de `topic` sans marquer violation.

---

## Références code (état juillet 2026)

| Module | Chemin |
|--------|--------|
| Move policy | `server/src/agent/policies/conversationMovePolicy.js` |
| Subject extraction | `server/src/agent/policies/conversationSubjectExtraction.js` |
| Information seeking P3 | `server/src/agent/policies/informationSeekingQualificationPolicy.js` |
| Multi-segment P3 | `server/src/agent/policies/multiSegmentQualificationPolicy.js` |
| Shadow P2/P3 | `server/src/agent/telemetry/conversationMoveShadowTelemetry.js` |
| Mode HOW_TO_PROCEDURAL | `server/src/agent/config/modeResponseContracts.js` |
| Simple-fast procedural | `citadelle-vault/Citadelle/01-Architecture/03-Forge/simple-fast.js` |
| How-to qualification | `server/src/agent/policies/howToQualificationPolicy.js` |
| How-to shell | `server/src/agent/utils/howToRequestIntentGuards.js` |
| Clarification | `server/src/agent/policies/clarificationDecisionPolicy.js` |
| Mandat livrable | `server/src/agent/utils/deliverableMandateGuards.js` |
| Culture générale | `server/src/agent/utils/generalKnowledgeIntentGuards.js` |
| Recette | `server/src/agent/utils/recipeKnowledgeIntentGuards.js` |
| Short-circuit | `server/src/agent/micro/classifiers/intentShortCircuit.js` |
| Math factorisation | `server/src/agent/policies/mathSimplePolicy.js` |
| Math racines G22 | `server/src/agent/policies/mathRootPolicy.js` |
| Query understanding G29 | `server/src/agent/policies/conversationQueryUnderstanding.js` |
| Domain registry G29 | `server/src/agent/policies/queryUnderstandingDomainRegistry.js` |
| Coverage matrix G30 | `server/src/agent/policies/queryUnderstandingCoverageMatrix.js` |
| Document synthesis G30.1/G32 | `server/src/agent/policies/documentSynthesisCompositePolicy.js` |
| Compare choose G31 | `server/src/agent/policies/compareChooseCompositePolicy.js` |
| Guided product reco G31 | `server/src/agent/policies/guidedProductRecommendationPolicy.js` |
| Product reco validator G31 | `server/src/agent/policies/productRecoValidator.js` |
| Guided doc synthesis G32 | `server/src/agent/policies/guidedDocumentSynthesisPolicy.js` |
| Doc synthesis validator G32 | `server/src/agent/policies/documentSynthesisValidator.js` |
| Strategy telemetry G31+ | `server/src/agent/telemetry/strategyExecutionTelemetry.js` |
| Intent contracts | `server/src/agent/config/intentContractRegistry.js` |
| Math composite G28 | `server/src/agent/policies/mathCompositeQueryPolicy.js` |
| Math géométrie G21 | `server/src/agent/policies/mathGeometryPolicy.js` |
| Math théorie | `server/src/agent/policies/mathExplainPolicy.js` |
| Pipeline | `server/src/agent/agentPipeline.js` |
| Pleine lune / calendrier | `server/src/agent/utils/externalCalendarLookupIntentGuards.js` |

---

*Spec dérivée de l'ADR-20260707. Toute implémentation qui contredit ce document doit amendre l'ADR ou mettre à jour cette spec avant merge.*
