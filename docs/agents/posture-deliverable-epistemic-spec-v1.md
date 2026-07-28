# Posture + Deliverable + Épistémique — spec opérationnelle v1

**Autorité** : [ADR-20260722-Posture-Deliverable-Epistemic-v1](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260722-Posture-Deliverable-Epistemic-v1.md) (Proposé)

**Voir aussi** : [Conversation Move Governance](conversation-move-governance.md), `epistemicUncertaintyResolutionPolicy.js`, [Voix Nexxus — consolidation P0](voix-nexxus-consolidation-p0.md), [Voix Nexxus — doctrine v1](voix-nexxus-doctrine-v1.md) (`VOICE_CONTINUITY_V1`)

---

## 1. Objectif

Rendre Nexxus polyvalent (mentor, conseiller, exécutant, formatteur, conversationnel, architecte) **sans** exploser les short-circuits : postures sticky + contrats de sortie + épistémique mère + calibration utilisateur.

---

## 2. Objets

### 2.1 `SESSION_MODE_STATE_V1` (P0 implémenté)

Fichiers : `sessionModeState.js`, `posturePolicy.js` ; persistance `sessionWorkMemory.sessionMode` ; hook `agentPipeline.js`.

```javascript
{
  contract: "SESSION_MODE_STATE_V1",
  posture: "conversational" | "mentor" | "advisor" | "executor" | "formatter" | "architect",
  source: "explicit" | "inferred" | "sticky" | "default" | "authority_override" | "fallback",
  ttlTurns: 8,                 // max 10 ; décrément chaque tour
  confidence: "low" | "medium" | "high",
  lockedByUser: false,         // true après « reste en mode … »
  lastReaffirmedAt: null | string,
  breakReason: null | string,  // ttl_expired | execution_mandate | user_clear_mode | …
  dominantPromisedValue: null | string,
  turnCountAtSet: 0
}
```

**Garde-fous d’expiration** (obligatoires) :

1. TTL (`ttlTurns` → 0) → `conversational` + `breakReason=ttl_expired`
2. Rupture forte (mandat exécution / forge / web explicite non locked) → break ou override
3. Collision mandat incompatible → `authority_override` (executor ce tour) même si sticky mentor locked

**Switch explicite utilisateur** :

- set : « reste en mode mentor », « passe en mode conseiller », …
- clear : « arrête le mentorat », « donne la réponse directe », « mode normal »

**Observabilité par tour** (console + `pipelineTelemetryCtx`) :

- `posture`, `source`, `intensity` (`light|normal|strong`)
- `ttlBefore` / `ttlAfter` / `ttlResetReason`
- `maintainReason`, `breakReason`, `authorityConflict`, `lockedByUser`

**P0.1** : TTL observé + intensité ; forge/web cassent le sticky même `lockedByUser`.

### 2.2 `POSTURE_DECISION_V1`

```javascript
{
  contract: "POSTURE_DECISION_V1",
  posture: string,
  source: "explicit" | "inferred" | "sticky" | "default" | "authority_override" | "fallback",
  mayAskQuestions: boolean,
  mayExecute: boolean,
  initiative: "low" | "medium" | "high",
  styleHints: string[],
  maintainReason: string | null,
  breakReason: string | null,
  authorityConflict: object | null,
  nextState: object,
  telemetry: object
}
```

### 2.4 `INTENT_COMPOSITION_V1` (P0 observe)

Une requête = **plan composé**, pas une intention unique ni N rails naïfs.

```javascript
{
  contract: "INTENT_COMPOSITION_V1",
  social: [],                    // greeting | thanks
  primary_action: null,          // explain | compare | summarize | …
  secondary_actions: [],         // max 2 si compatibles
  output_constraints: { format: null, depth: null },  // table ≠ intention
  execution_constraints: { with_sources: false, no_web: false, budget_units: null },
  targets: [],
  followup_mode: null,           // inline_after_primary | …
  compatibility_score: 0,
  clarification_required: false,
  just_relation: "confirmed" | "refined" | "too_flat" | "overridden",
  execution_plan: { mode: "single_rail_augmented" | "single_rail" | "social_only" | "none", … },
  confidence_breakdown: {
    primary_action: 0,
    secondary_actions: 0,
    constraints: 0,
    social: 0,
  },
  dropped_candidates: [
    // { label, reason: incompatible|low_confidence|budget_exceeded|downgraded_to_followup|absorbed_as_constraint }
  ],
}
```

**Règles dures** : une primary ; format/depth/sources = contraintes ; social = ouverture ; max 2 secondaires.  
**Anti-wrapper** : `just_relation` doit pouvoir être `refined` / `too_flat`, pas seulement recopier JUST.  
**Runtime P0** : `intentCompositionPolicy.js` + matrice ; log `[PIPELINE] intent_composition …` ; consommateur pédagogique (greeting + summarize inline). Pas d’enforcement gate global.  
**P1** : enforcement localisé sur rails à forte valeur.

### 2.4.1 `WORK_UNIT_COUNT_AND_PLAN_V1` (boucle amont)

Comprendre le **nombre d’unités** et **verrouiller un plan** avant toute exécution (parallèle ou non).

```javascript
{
  contract: "WORK_UNIT_COUNT_AND_PLAN_V1",
  unit_count: 4,
  count: {
    declared_count: 4,   // « 4 choses à faire »
    parsed_count: 4,     // liste 1..N isolée
    reconciled_count: 4, // figé si declared === parsed (ou parsed seul)
    confidence: 0.97,
    ok: true,
  },
  units: [
    {
      id: "u2",
      primary_action: "explain",
      target: "cycle de vie d'une libellule",
      output_format: "table",
      depth: "detailed",
      independent: true,
    },
  ],
  mode: "single_unit" | "multi_unit_sequential" | "multi_unit_parallel" | "blocked_clarify",
  all_units_accounted_for: true,
  execution_allowed: true,
  parallelism: { eligible: true, reason: "all_independent_within_budget" },
  unit_lifecycle: ["start", "execute", "validate", "retry", "complete"],
}
```

**Boucle bornée (déterministe)** : Count → Reconcile → Normalize → Plan.  
**Règle dure** : pas d’exécution si `declared_count ≠ parsed_count` (`blocked_clarify`).  
**Parallèle** seulement si toutes les unités sont indépendantes, contrats compatibles, et `unit_count ≤ MAX_PARALLEL_WORK_UNITS` (4). Sinon séquentiel.  
**Runtime** : `workUnitCountAndPlanPolicy.js` ; log `📋 Plan unités` ; garde pédagogique si cardinalité non verrouillée. Le parallèle est une **éligibilité** d’orchestration, pas une fondation.

### 2.3 `DELIVERABLE_CONTRACT_V1`

```javascript
{
  contract: "DELIVERABLE_CONTRACT_V1",
  promisedValue:
    | "advice"
    | "plan"
    | "patch"
    | "explanation"
    | "workshop"
    | "execution"
    | "transform"
    | "scoping"
    | "clarify"
    | "refusal"
    // Relances floues / sociales (≠ explanation, ≠ clarify livrable)
    | "social_continuity"
    | "exploration_proposal"
    | "guided_choice",
  structureHint: string | null,
  evidenceLevel: "none" | "local" | "web" | "file",
  mayAct: boolean,
  verifyBeforeDeliver: boolean,
  clarificationRequired: boolean, // false pour les 3 contrats exploration
  transformTarget: null | "email" | "markdown" | "json" | "slides_outline" | "formal_doc" | "report",
  sourceRef: null | string  // obligatoire si promisedValue === "transform"
}
```

#### 2.3.1 Mini-spec — contrats exploration (priorité DeliverableContract)

Ces trois `promisedValue` empêchent le fallback `clarify_then_build` + gate objectif/format quand l’utilisateur n’a **pas encore** de sujet.

| `promisedValue` | Quand | Shape | Clarification |
|-----------------|-------|-------|---------------|
| `social_continuity` | Fil papoter / check-in / « on discute » | 1–2 phrases + ouverture | **interdite** (sauf sécurité) |
| `exploration_proposal` | Relance floue (« qu’est-ce qu’on pourrait faire ») | 1 ack + **3–5 options** + 1 question ouverte | **interdite** |
| `guided_choice` | Germe présent (mot, piste, n°) mais pas encore de mandat | Panel resserré + aide au choix | légère OK (choix A/B), **pas** specs livrable |

**Priorité (règle dure)** :

```
si surface ∈ { open_prompt, chat_invite, soft_social, exploration_open }
  → promisedValue ∈ { social_continuity | exploration_proposal | guided_choice }
  → clarification_gate INTERDIT
  → JUST clarify_then_build n’écrase pas ce contrat
```

**Escalade** (quand un germe apparaît) :

1. flou total → `exploration_proposal` (menu)
2. choix / mot / piste → `guided_choice` (aider à décider)
3. sujet + mandat (code, forge, web explicite) → contrat métier (`scoping` / `execution` / info-seeking…)
4. papoter sans agenda → `social_continuity`

**Exemple `exploration_proposal`** (surface actuelle ≈ `social/open_prompt`) :

1. Reconnaître le flou (« pas encore de sujet précis »)
2. Menu : papoter · germe d’idée · recherche web · petit livrable · apprendre
3. « Dis-moi un numéro, ou lance juste un mot »

**Contre-exemples** (ne pas utiliser ces contrats) :

- « crée un agent python… » → `execution` / scoping, pas exploration
- « c’est quoi la photosynthèse » → explanation / factuel
- « on pourrait faire quoi **comme projet** » → idéation / workshop, pas open_prompt social

**Runtime actuel** :

- **Surface** : frame `open_exploration` (§2.3.2) → bridge `social/open_prompt` + G35 `can_answer_now`.
- **P0 observe** : `deliverableContractPolicy.js` émet `promisedValue` + télémétrie console (`[PIPELINE] deliverable …`) **sans enforcement** — short-circuit inchangé.
- **P1 guided_choice** : après panel, sélection `1–5` / mot d’option → `guidedChoicePolicy` / path `guided_choice_deterministic` (`runtimeAligned=true`). Aide au choix seulement — pas de mandat livrable inventé.
- **P1 AttachmentTask** : PJ → `classifyAttachmentTask` (`doc_improve` | `doc_summarize` | `code_fix` | `code_refactor` | `code_review` | `doc_analyze`) avant livrable. Code task → bypass Document Analysis ; soft `fileContextGuard` si livrable concret ancré.
- **P1.1 Guard precedence** : `buildAttachmentResponseState` — si réponse concrète + source PJ → `overrideLocked` / `append_only` (note suffixe possible), **jamais** remplacement par refus « fichiers non fournis ».
- **P1+** : enforcement optionnel (bloquer gate si `gateSuppressed`) quand la télémétrie est stable.

#### 2.3.2 Mini-spec P0 — `isOpenExplorationFrame(query)`

**Ce n’est pas un intent.** C’est une forme conversationnelle de surface (slots / frame), évaluée **avant JUST** et avant `clarification_gate`.

##### Signature

```javascript
assessOpenExplorationSlots(query) → {
  hasCollectiveOpener,
  hasOpenActivityShell,
  hasConcreteObject,
  isShortAndUnderspecified,
  isExplorationFrame
}

isOpenExplorationFrame(query) → boolean  // === slots.isExplorationFrame

resolveOpenExplorationFrame(query) → {
  matched, surfaceFrame, promisedValue, clarificationRequired, slots, telemetry
}
```

Fichier : `server/src/agent/policies/openExplorationFramePolicy.js`

##### Slots

| Slot | Vrai si | Rôle |
|------|---------|------|
| `hasCollectiveOpener` | sujet collectif interrogatif (`qu'est-ce qu'on`, `on fait quoi`, `faire quoi`…) | structure |
| `hasOpenActivityShell` | verbe d’activité large (`faire`, `discuter`, `bosser`…) | coquille |
| `hasConcreteObject` | objet / mandat (`projet`, `code`, `dépôt`, `recherche web`…) | **anti-slot** |
| `isShortAndUnderspecified` | phrase courte, peu de contraintes | flou |

**Invariant** : le modal (`peut` / `pourrait` / `pourrais`…) est du **bruit** entre opener et activité — jamais un déclencheur.

```
isExplorationFrame =
  hasCollectiveOpener
  && hasOpenActivityShell
  && !hasConcreteObject
  && isShortAndUnderspecified
```

##### Pseudo-code priorité

```
frame = resolveOpenExplorationFrame(query)   // avant evaluateJustIntent
si frame.matched:
  surfaceFrame = open_exploration
  promisedValue = exploration_proposal
  clarificationRequired = false
  clarification_gate INTERDIT
  JUST ne doit pas imposer general/explain → clarify_then_build
  bridge UX = social/open_prompt (panel)
sinon:
  suite JUST / patterns habituels
```

##### Cas de test minimaux (12)

1. `qu'est-ce qu'on pourrait faire??` → frame ✓  
2. `qu'est-ce qu'on pourrais faire??` → frame ✓ (faute = bruit)  
3. `qu'est-ce qu'on peut faire aujourd'hui?` → frame ✓  
4. `alors qu'est-ce qu'on pourrait faire aujourd'hui?` → frame ✓  
5. `on fait quoi?` → frame ✓  
6. `faire quoi maintenant?` → frame ✓  
7. `on pourrait faire quoi comme projet` → ✗ (objet `projet`)  
8. `on peut faire une recherche web?` → ✗ (objet web)  
9. `qu'est-ce qu'on pourrait faire sur ce dépôt?` → ✗ (objet dépôt)  
10. `crée un agent python` → ✗  
11. `c'est quoi la photosynthèse` → ✗  
12. `ben on va papoter` → ✗ (autre surface : `chat_invite`)

### 2.4 `EPISTEMIC_RESOLUTION_V1` (mère)

États : `known` | `inferable` | `ambiguous` | `externally_verifiable` | `unsafe_to_conclude`  
Actions : `respond` | `targeted_clarify` | `verify` | `admit_or_refuse`

Mapping runtime actuel → mère :

| Runtime actuel | État mère |
|----------------|-----------|
| `known_contextualizable` | `known` |
| `ambiguous_probable` | `inferable` / `ambiguous` |
| `unknown_real` | `ambiguous` ou `unsafe_to_conclude` |
| `potentially_stale` | `externally_verifiable` |

---

## 3. Autorités (conflit)

```
1. Sécurité / permission
2. Mandat d’exécution explicite du tour
3. Épistémique (unsafe / clarify bloquant)
4. DeliverableContract du tour
5. Posture sticky
6. ConversationMove / famille
7. JUST + short-circuit
8. LLM (rédaction)
```

### Matrice d’exemples

| Sticky | Tour | Gagnant | Effet |
|--------|------|---------|-------|
| mentor | « explique doucement les hooks » | sticky + advice/explanation | socratique si mentor |
| mentor | « écris le patch maintenant » | mandat exécution | executor + patch **ce tour** |
| advisor | « NXT ça te dit ? » | épistémique | targeted_clarify WWE NXT |
| formatter | « crée une app » | contrat / intention | **pas** transform — forge/scoping |
| conversational | « c’est quoi la photosynthèse » | domaine/rail factuel | pas exploratory chat |

---

## 4. Postures — contrats de sortie typiques

| Posture | `promisedValue` par défaut | Structure attendue |
|---------|----------------------------|--------------------|
| conversational | social_continuity / exploration_proposal / explanation | court, ouvert ; **pas** clarify livrable sur flou |
| mentor | explanation | 1 piste + 1–2 questions ; **interdit** solution complète d’emblée sauf demande |
| advisor | advice / guided_choice | options → critères → reco → risques → prochaine question |
| executor | patch / execution / plan | livrable actionnable ; `mayAct` selon permission |
| formatter | transform | source + cible ; pas de création from scratch |
| architect | workshop | trade-offs itératifs ; peut enchaîner sur ADR léger — ≠ one-shot 3 options |

### 4.1 Registre d’explication (`explanationRegister`) — simple d’abord

Décider **si** répondre ne suffit pas : il faut aussi décider **comment**.

Pour une demande de compréhension (« c’est quoi… », « qu’est-ce qu’une… », définition process / concept), le défaut n’est **pas** le mode technique dense.

| Registre | Quand | Forme |
|----------|-------|--------|
| `simple_first` (**défaut** définition) | comprendre, pas implémenter | langage humain → exemple concret → pont jargon seulement si utile |
| `technical` | audit, patch, API, mandat exécution | précision, contraintes, termes métier |
| `synthetic` | récap / « en bref » | 3–6 phrases max, peu d’exemple |
| `direct` | fait simple, oui/non, lookup | une réponse nette |
| `illustrated` | « montre un exemple », syntaxe | mini-exemple avant ou juste après la déf. |

**Règle de style** : par défaut, expliquer simplement, puis approfondir seulement si le besoin apparaît (relance, posture mentor sticky, ou demande explicite « plus technique »).

Ancrage runtime (process / dual spec·mini-spec) : `buildSpecVsMiniSpecGlossaryReply` + manner `pedagogic_explain_simple` (`responseMannerPolicy.js`).

#### 4.1.1 Shape `mini_panorama` (lexique sciences / « connais-tu… et son impact »)

Pour une demande d’information générale sur un phénomène (nature, sciences, « impact sur… »), le défaut n’est **pas** « Oui je connais + menu d’angles ».

| Bloc | Obligatoire | Contenu |
|------|-------------|---------|
| Accroche | oui | « Oui » + ancrage sujet |
| Socle | oui | de quoi il s’agit (1–2 phrases) |
| Établis | oui | effet le plus solide / visible |
| Nuance | si pertinent | observé vs débattu |
| Ouverture | facultative | **une** piste (« Si tu veux, on peut creuser X ») |

**Interdit** : « Dis-moi ce que tu veux creuser — vue d’ensemble, contexte, modèles… » comme seule matière.

Runtime : `lexiconExplainLightPolicy` (`replyShape=mini_panorama`) + fallback local (ex. cycles lunaires) + anti-fuite menu dans `applySimpleFastDeliveryPipeline`.

#### 4.1.2 Dimension `outputFormat` + Response Contract (éducation structurée)

Le routeur ne doit **pas** décider uniquement sur l’action sémantique (`explain`). Le **format de sortie** est une dimension de routage.

| Signal | Exemple | Pipeline attendu | Interdit |
|--------|---------|------------------|----------|
| `outputFormat=table` + glossaire local | « cycle de l’eau / lune … tableau » | `lexicon_science_format_table_deterministic` | `simple_fast` refus, JUST `data/spreadsheet` |
| `outputFormat=table` multi (1 -/2 -) | « fait N tableaux : 1 - … » | Scheduler : N≤4 `single_batch` ; 5–8 lots de 4 + **continue** ; N>8 **confirmation** puis lots. Hybride local/LLM par unité. | monolithe « 10 tableaux d’un coup » / 1 seul sujet |
| `outputFormat=table` + sciences hors glossaire | « photosynthèse … tableau » | `lexicon_science_format_table_llm` (contrat + `allowRefusal=false`) | `simple_fast` au-dessus du format |
| `outputFormat=schema` + sciences | « … sous forme de schéma » | `lexicon_science_format_*_deterministic` ou `_llm` | idem |

Contrat runtime (observabilité + validation avant publication) :

```javascript
responseContract: {
  type: "table" | "schema",
  minRows: 5,
  headers: ["Étape", "Description", "Résultat / Exemple"], // si type=table
  completenessRequired: true,
  domain: "science_education",
  depth: "detailed" | "standard",
}
```

Checks table (`validatePedagogicalTableResponse`) : `contains_table`, `header_equals`, `row_count >= minRows`, `no_truncated_tokens`. Échec → pas de short-circuit (repli pipeline).

UI : tables GFM via `remark-gfm` ; bloc typé `PedagogicalMarkdownMessage` (`.message--pedagogical`) quand le contrat table passe — intro / `.table-wrap` / note / À retenir / bouton « Afficher les sources ». A11y table : `tabindex=0` + `role=region` + `aria-labelledby` (caption) + `th scope="col"`.

Ancrage : `resolvePedagogicalStructuredExplainShortCircuit` (solo, sans historique) **avant** `technical_overview` ; continuité fil si historique présent.

---

## 5. Formatter : bornage strict

Le shell formatter **n’est pas** un rail de production.

**Entrée** : contenu source identifiable + cible de forme.  
**Sortie** : même information, autre forme.  
**Interdit** : inventer des features, lancer Forge, remplacer mentor/advisor.

Si pas de source → clarify ciblée (« Tu veux reformater quel texte / fichier ? ») — pas `request_interpreter_clarify` générique.

---

## 6. Agent IA — décomposition (P1, après fondations)

| Shell | `promisedValue` | Sortie |
|-------|-----------------|--------|
| `agent_scoping` | scoping | objectif, utilisateurs, contraintes |
| `agent_architecture` | workshop | composants, outils, limites |
| `agent_memory_tools_evals` | plan | mémoire, tools, métriques |
| `agent_forge_handoff` | execution | handoff Forge si mandat |

---

## 7. Hooks pipeline (ordre cible par tour)

```
1. Charger SessionModeState (fil)
2. UserCalibrationPolicy (update léger)
3. EpistemicResolutionPolicy (mère)
4. PosturePolicy (sticky | explicit | override autorité)
5. DeliverableContractPolicy (promisedValue)
5b. OutputShapeCritic G50 (`evidenceShape` — forme de preuve ; observe-first — [spec](./output-shape-critic-g50-spec.md))
6. evaluateConversationMove (annoté posture + contrat)
7. short-circuits / rails (mentor_rail, advisor_rail, repair, …)
8. composer / LLM sous contrat
9. verifyMoveContract + décrément sticky
10. Persister SessionModeState
```

Fichiers d’ancrage :

- `server/src/agent/agentPipeline.js`
- `server/src/agent/policies/conversationMovePolicy.js`
- `server/src/agent/policies/epistemicUncertaintyResolutionPolicy.js`
- `server/src/agent/micro/classifiers/intentShortCircuit.js`
- `server/src/agent/policies/clarificationDecisionPolicy.js`
- `server/src/agent/policies/responseMannerPolicy.js`

---

## 8. Rails à ajouter (après briques 1–4)

| Rail / path | Posture | Notes |
|-------------|---------|-------|
| `mentor_socratic_deterministic` / `_llm` | mentor | questions > dump |
| `advisor_decision_deterministic` / `_llm` | advisor | options+reco+risques |
| `format_transform_deterministic` | formatter | source+cible |
| `conversation_repair_deterministic` | any | 1 tour : ack erreur de couloir + reprise |
| `self_architecture_audit_deterministic` | any | lit registres ; fail-closed |

Packs **ensuite** : `architecture_workshop_*`, `pair_program_*`, `incident_debug_*`, `long_form_writing_*`, shells agent IA.

---

## 9. Critères d’acceptation (fondations)

- [ ] Sticky mentor tient ≥ 3 tours sans retomber en explain général
- [ ] « fais-le maintenant » sous mentor → patch/executor **sans** perdre la capacité de revenir en mentor
- [ ] Formatter sans source → clarify ciblée, pas forge
- [ ] Terme culturel ambigu → épistémique targeted_clarify (déjà partiel NXT)
- [ ] Question factuelle sur fil papoter → rail factuel, pas exploratory (déjà corrigé)
- [x] Relance floue « qu’est-ce qu’on pourrait faire » → frame `open_exploration` (slots) → panel `exploration_proposal` (bridge `social/open_prompt`), **pas** clarification_gate ; modal = bruit
- [ ] Télémétrie : `posture`, `promisedValue`, `epistemic.state` dans console orchestration

---

## 10. Hors scope v1

- Mode « 3D » comme posture
- Rail unique « build AI »
- Dissertation longue / pair TDD / atelier design UI (P1 après fondations)
- GUI Operator (G47 P2)
