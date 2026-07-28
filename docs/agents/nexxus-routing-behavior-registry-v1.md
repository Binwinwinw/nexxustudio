# Nexxus Routing & Behavior Registry v1

Registre opérationnel du routage et des comportements — aligné sur le code réel, pas sur une vision « 4 couches à construire ».

**État** : juillet 2026 — Plans A/B/C documentés ; policy packs G31–G45 (G38.2, G40.1–G40.4, G41, G41.1, G42, G43–G45 livrés) ; G36 orchestrateur social **à faire**.

**Sources de vérité** :
- `server/src/agent/agentPipeline.js` — orchestration d'entrée (`run()`)
- `server/src/agent/micro/classifiers/intentShortCircuit.js` — délestage conversationnel (Plan B)
- `server/src/agent/config/intentContractRegistry.js` — contrats Plan C
- `server/src/agent/policies/clarificationDecisionPolicy.js` — gate clarification
- `server/src/agent/policies/conversationMovePolicy.js` — move stratégique P2

**Voir aussi** :
- [query-understanding-g29-spec.md](query-understanding-g29-spec.md)
- [conversation-move-governance.md](conversation-move-governance.md)
- [intent-families-doctrine.md](intent-families-doctrine.md)
- [family-catalog-and-constraints.md](family-catalog-and-constraints.md)

---

## Doctrine (recalibrée)

> Nexxus est déjà un système à **trois plans**. Le travail n'est pas d'ajouter des couches abstraites, mais de **durcir les frontières**, **doctriner les policy packs** et **éviter les fuites de régime**.

| Plan | Nom | Fonction |
|------|-----|----------|
| **A** | Pré-routage et gouvernance d'entrée | Comprendre, encadrer, décider si réponse rapide possible |
| **B** | Réponse locale à faible coût | Absorber le maximum via short-circuits et canaux spécialisés |
| **C** | Orchestration souveraine profonde | Planification, agents, web, documents, validators, composition |

**Règle d'or** : la majorité des tours utilisateur devraient se terminer en **Plan B**. Chaque escalade vers **Plan C** doit être **justifiable en télémétrie**.

La doctrine comportementale est **distribuée** (pas un prompt constitution unique) :
1. Règles des short-circuits et guards (Plan B)
2. Contrats orchestrateurs (`intentContractRegistry`, Plan C)
3. Validators de sortie (`productRecoValidator`, `documentSynthesisValidator`, `conversationMoveContractVerification`, etc.)

---

## Plan A — Pré-routage et gouvernance d'entrée

Exécuté dans `agentPipeline.run()` **avant** toute réponse. Composants distribués — c'est le **control plane réel**.

### Séquence (ordre d'exécution)

| # | Composant | Trace / `pipelinePath` | Fichier | Sortie anticipée ? |
|---|-----------|------------------------|---------|-------------------|
| 1 | Topic shift | log `conversation_topic_shift` | `conversationTopicShiftPolicy.js` | Non (reset historique) |
| 2 | Triage intent | step `📋 Intention` (pas de path dédié) | `intentTriageClassifier.js` | Non |
| 3 | Context reference | `context_reference_not_found` | guards session | Oui |
| 4 | Pending clarification resume | `resumePath` dynamique | `pendingClarificationResume` | Oui |
| 5 | Request decomposition | télémétrie `request_decomp` | `requestDecompositionPolicy.js` | Non |
| 6 | Query understanding (G29) | télémétrie `query_understanding` | `conversationQueryUnderstanding.js` | Non |
| 7 | **Just intent detection** | **`just_intent_detection`** (toujours loggé) | `justIntentDetectionPolicy.js` | Non |
| 8 | Structured request | `interpreter_lock` | `requestInterpreter.js` | Non |
| 9 | Conversation move (P2) | shadow `conversation_move` | `conversationMovePolicy.js` | Parfois (`earlyTurn`) |
| 10 | Clarification gate | `clarification_gate` (+ bypasses) | `clarificationDecisionPolicy.js` | Oui |
| 11 | Strategy execution | log `strategy declared/effective` | `strategyExecutionTelemetry.js` | Non |

### Signaux télémétrie Plan A

| Signal | Où | Usage |
|--------|-----|-------|
| `justIntent.domain` / `intent` / `strategy` / `confidence` | `justIntentTelemetry` | Console orchestration |
| `queryUnderstanding.domains[]` / `workIntentCount` | `pipelineTelemetryCtx` | Multi-intent |
| `intentContractId` (amont G29) | `guided*IntentContractId` | GUIDED_* avant short-circuit |
| `conversation_move.move` / `family` / `pipelinePath` | shadow amont/servi | Gouvernance P2 |
| `clarification_gate_source` | `justIntentTelemetry` | Gate vs triage |
| `strategy_declared` / `strategy_effective` | `strategyExecutionTelemetry` | Écart stratégie |

---

## Plan B — Réponse locale à faible coût

Surface produit principale. `runConversationShortCircuit()` — **premier match gagne**.

### Moteurs Plan B

| Moteur | Latence | LLM | Web | Exemples de `pipelinePath` |
|--------|---------|-----|-----|---------------------------|
| **SIL** | ~30 ms | Non | Non | `social_deterministic`, `math_*_deterministic`, `clarification_gate` |
| **SIMPLE_FAST** | 1–15 s | Oui local | Parfois | `guided_creation_scoping`, `lexicon_explain_light`, `simple_factual_lookup` |
| **Defer full pipeline** | — | — | — | Marqueur vers Plan C sans réponse B |

### Registre `pipelinePath` — Plan B (par priorité short-circuit)

| Priorité | `pipelinePath` | Famille | Moteur | Contrat amont (si applicable) |
|----------|----------------|---------|--------|-------------------------------|
| 1 | `acknowledgment_deterministic` | Acquittement | SIL | — |
| 2 | **`social_deterministic`** | Small talk G35 + classique | SIL | `SOCIAL` |
| 3 | `subject_type_clarify` | Typage entité | SIL | — |
| 4 | `self_modification_deterministic` | Refus auto-modif | SIL | — |
| 5 | **`guided_creation_scoping`** | Création code/web guidée | SIMPLE_FAST | `GUIDED_CREATION_SCOPING` |
| 6 | `web_project_scoping_clarify` / `web_project_scoping_direct` | Projet web | SIL / LLM | `web_project_scoping_v1` |
| 7 | `translation_pipeline` / `translation_multi_target` / `translation_clarify` | Traduction | SIMPLE_FAST | — |
| 8 | `pedagogy_soft_overview_*` | Aperçu souple | SIL / LLM | — |
| 9 | `prompt_for_artifact_deterministic` | Prompt opératoire | SIL | — |
| 10 | `conversation_continuity_deterministic` / `general_knowledge_continuity_carryover` | Continuité | SIL / defer C | — |
| 11 | `lexicon_explain_light` | Définition lexique | SIMPLE_FAST | — |
| 12 | `subject_reference_*` / `familiarity_domain_overview_deterministic` | Reprise sujet | SIL | — |
| 13 | `familiarity_deterministic` | « Tu connais X ? » | SIL | — |
| 14 | `beginner_topic_overview` | Initiation | SIMPLE_FAST | — |
| 15 | `career_learning_path` | Parcours carrière | SIMPLE_FAST | — |
| 16 | `presentation_outline` | Plan slides | SIMPLE_FAST | `PRESENTATION_OUTLINE` |
| 17 | `technical_learning_path` | Apprentissage technique | SIL / SIMPLE_FAST | — |
| 18 | `architecture_design_deterministic` | Design 3 approches | SIL | `ARCHITECTURE_OPTIONS` |
| 19 | `technical_overview` | Aperçu technique | SIMPLE_FAST | — |
| 20 | `debug_diagnostic` | Diagnostic | SIMPLE_FAST / defer C | `DIAGNOSTIC` |
| 21 | `compare_choose` / `compare_choose_clarify` | Comparatif produit | defer C | `GUIDED_PRODUCT_RECOMMENDATION` |
| 22 | `admin_procedure` | Procédure admin | defer C + web | `FACTUAL_RESEARCH` |
| 23 | `pedagogical_overview_*` | Aperçu pédagogique | SIL / LLM / web | — |
| 24 | `multi_unit_deterministic` / `multi_unit_partial_clarify` | Multi-unités | SIL composite | — |
| 25 | `how_to_*` | How-to | SIL / LLM | `how_to_procedural_*_v1` |
| 26 | `general_knowledge_deterministic` / `general_knowledge_full_pipeline` | Culture générale | SIL / defer C | — |
| 27 | `query_composite_deterministic` / `math_composite_deterministic` | Multi-domaine G28/G29 | SIL | — |
| 28–33 | `math_simple` / `math_root` / `math_geometry` / `math_explain` / `math_percent` | Maths | SIL | — |
| 34 | `existing_source_analysis_clarify_access` | Fichier local | SIL | — |
| 35 | `document_synthesis_*` / `document_synthesis_llm` | Synthèse doc | SIL / LLM | `GUIDED_DOCUMENT_SYNTHESIS` |
| 36 | `exploratory_conversation_light` | Exploration ouverte | SIMPLE_FAST | — |
| 37 | `simple_factual_lookup` (+ abstain/clarify) | Factuel simple | SIMPLE_FAST → web | ⚠️ `DIRECT_EXPLANATION` |
| 38 | `datetime_deterministic` | Date/heure | SIL | `SOCIAL` / `INSTANT` |
| 39–44 | `meta_*`, `assistant_repair_*`, `ideation_deterministic`, `comprehension_grounding_deterministic` | Méta / idéation / grounding | SIL / SIMPLE_FAST | `IDEATION_OPEN` |
| 45 | `information_seeking_full_pipeline` | Recherche ciblée | defer C | `FACTUAL_RESEARCH` |
| 46–47 | `anaphora_reference_*` | Anaphore | SIL / defer C | — |
| 48 | `launcher_guide_*` | Guide lancement | SIL | — |
| 49 | `forge_handoff_ready` / `forge_project_scoping_ready` | Forge | SIL | `FORGE_WEBAPP_BUILD` |
| 50 | `procedure_deterministic` (+ gates) | Procédure | SIL / raisonné | — |
| 51 | `multi_segment_composite` | Multi-segments | SIMPLE_FAST | — |
| 52 | `request_interpreter_clarify` / `request_interpreter_confirm` | Interprète | SIL | lock contrat |

### Sorties anticipées Plan B (hors short-circuit, dans `agentPipeline`)

| `pipelinePath` | Moment | Moteur |
|----------------|--------|--------|
| `social_deterministic` (G35 bypass gate) | Dans bloc `shouldClarify` | SIL |
| `query_composite_deterministic` / `math_*` (bypass gate) | Idem | SIL |
| `clarification_gate` | Gate finale | SIL |
| `document_needs_raw_reingest` | Post-gate | Déterministe |
| `document_analysis_followup` | Post-gate | LLM doc |
| `analytical_critique` | Post-gate | SIMPLE_FAST |
| `hook_blocked` | Post-gate | Refus |
| `instant` | Cache / commandes `/` | SIL |
| `conversation_recall` | Avant short-circuit | LLM |
| `subject_deepening_bounded_llm` | Avant short-circuit | LLM léger |
| `semantic_intent_resolver` | Fallback si short-circuit null | Déterministe / LLM |
| `simple_fast` (word_guard) | Fallback mots courts | LLM |
| `intent_stage_deterministic` | IntentStage social/datetime | SIL |
| `code_create_text_fallback` | Échec guided creation | SIL |

---

## Plan C — Orchestration souveraine profonde

Régime où `resolveIntentContract()` **prend effet à l'exécution**.

### Canaux Plan C

| `pipelinePath` | Déclencheur | Contrats typiques | Sous-systèmes |
|----------------|-------------|-------------------|---------------|
| **`COMPOSER`** | Short-circuit null, defer, ou bypass | `CONVERSATION_STANDARD`, `DIRECT_EXPLANATION`, `GUIDED_*`, `CODE_*` | Planner, hub agents, web search, `finalRendererAgent` |
| **`DOCUMENT`** | Analyse document / URL / PJ | `DOCUMENT_ATTACHED`, `DOCUMENT_ANALYSIS`, `FACTUAL_RESEARCH` | `document-analysis.js`, ingestion |
| **`CRITICAL`** | ADR, criticité HIGH, design audit | `DIAGNOSTIC`, `DESIGN_AUDIT` | Sequential consensus |
| `document_datetime_hybrid` | Doc + repère temporel G29 | `DOCUMENT_ANALYSIS` + datetime | Hybride |
| `information_seeking_escalation` | Échec `simple_factual_lookup` | `FACTUAL_RESEARCH` | Web forcé |

### Registre `intentContract` (Plan C)

Source : `intentContractRegistry.js` — tri par `priority` décroissante.

| `id` | `responseMode` | `skipWebSearch` | `orchestratorMode` | Guard / détection |
|------|----------------|-----------------|--------------------|-------------------|
| `INSTANT` | INSTANT | oui | — | `isInstantCommand` |
| `CODE_DELIVERY_V1` | COMPOSER | non | OPERATIONAL | `isCodeDeliveryRequest` |
| `FORGE_WEBAPP_BUILD` | COMPOSER | oui | OPERATIONAL | `isForgeWebappProductionIntent` |
| `PRESENTATION_OUTLINE` | OPEN_PROPOSITION | oui | IDEATION | `isPresentationOutlineRequest` |
| **`GUIDED_CREATION_SCOPING`** | OPEN_PROPOSITION | **oui** | OPERATIONAL | `isGuidedCreationScopingContractRequest` |
| `ARCHITECTURE_OPTIONS` | OPEN_PROPOSITION | oui | IDEATION | `isArchitectureDesignIntent` |
| `IDEATION_OPEN` | OPEN_PROPOSITION | oui | IDEATION | `isOpenProjectIdeation` |
| `VIDEO_ANALYSIS` | DOCUMENT | oui | EPISTEMIC | PJ vidéo |
| `DOCUMENT_ATTACHED` | DOCUMENT | non | EPISTEMIC | PJ document |
| `VISION_ATTACHED` | COMPOSER | oui | EPISTEMIC | PJ image |
| `DESIGN_EXTRACT` | DOCUMENT | non | EPISTEMIC | design extract |
| `DESIGN_AUDIT` | CRITICAL | oui | EPISTEMIC | design audit |
| `DESIGN_CREATE` | OPEN_PROPOSITION | oui | IDEATION | design create |
| **`GUIDED_PRODUCT_RECOMMENDATION`** | COMPOSER | **borné** (3 src / 8s) | OPERATIONAL | slots G31 remplis |
| **`GUIDED_DOCUMENT_SYNTHESIS`** | COMPOSER | **oui** | OPERATIONAL | slots G32 + source |
| **`SOCIAL`** | INSTANT | **oui** | SOCIAL | `isSocialQuery` |
| `DIRECT_EXPLANATION` | COMPOSER | non | EPISTEMIC | interpreter haute confiance |
| `CODE_INTENT` | COMPOSER | oui | OPERATIONAL | snippet code |
| `DOCUMENT_ANALYSIS` | DOCUMENT | non | EPISTEMIC | verbe analyse |
| `DIAGNOSTIC` | CRITICAL | non | EPISTEMIC | diagnostic technique |
| `FACTUAL_RESEARCH` | DOCUMENT | non | EPISTEMIC | compilation sources |
| `CONVERSATION_STANDARD` | COMPOSER | non | OPERATIONAL | **fallback** (priority 0) |

---

## Règles de passage A → B → C

### Matrice d'escalade

| De → Vers | Condition | Signal attendu | Anti-pattern |
|-----------|-----------|----------------|--------------|
| **A → B** | `evaluateClarificationDecision` = `CAN_ANSWER_NOW` OU bypass gate | `conversation_social_only`, `social_pattern_hardening_g35` | Clarifier un small talk |
| **A → B** | Short-circuit match | `pipelinePath=<canal B>` | Passer C sans essayer B |
| **A → B (gate)** | Ambiguïté bloquante | `clarification_gate` | Formulaire sur relance sociale |
| **B → C** | `deferToFullPipeline: true` | `defer full pipeline ← <path>` | Tronquer conseil pratique |
| **B → C** | `simple_factual` miss | `information_seeking_escalation` | Web sur « tu as faim ? » |
| **B → C** | Short-circuit null + pas word_guard | Entrée `IntentStage` puis orchestrateur | — |
| **B → B** | Réponse SIL / SIMPLE_FAST OK | Fin tour `<path> (fin tour)` | Escalade inutile |
| **A → C (direct)** | `wantsAnalysis` + PJ/URL | `DOCUMENT` | Court-circuiter analyse doc |
| **A → C (direct)** | `needsConsensus` / ADR | `CRITICAL` | — |

### Arbre de décision (texte)

```
Requête
  → Plan A (toujours)
  → earlyTurn move ? → réponse (souvent clarification ciblée)
  → shouldClarify ?
       → G35 social ? → Plan B social_deterministic
       → bypass métier ? → Plan B déterministe
       → sinon → clarification_gate (Plan B)
  → document / critique / instant / recall ? → Plan B ou C ciblé
  → runConversationShortCircuit()
       → match + reply → Plan B (fin)
       → match + deferToLlm → SIMPLE_FAST (Plan B) → échec ? → Plan C
       → match + deferToFullPipeline → Plan C
       → null → semantic → simple_fast word_guard → IntentStage → Plan C
```

---

## Interdictions structurelles par contrat

### `SOCIAL`

| Interdit | Raison | Enforcement actuel | Gap |
|----------|--------|-------------------|-----|
| `clarification_gate` (formulaire objectif/format) | Relance conversationnelle | G35 `clarificationDecisionPolicy` + bypass `agentPipeline` | OK |
| `simple_factual_lookup` | Faux positif interrogatif | G35 + `isSimpleFactualQuestion` | OK |
| `information_seeking_*` | Recherche web | G35 blocked paths | OK |
| `COMPOSER` + web | Escalade lourde | Partiel (`skipWebSearch` registry) | **G36 à faire** : verrou orchestrateur |
| `semantic_intent_resolver` si pattern G35 | Doublon mécanique | Partiel | Adoucir ou subordonner à G35 |

### `GUIDED_CREATION_SCOPING`

| Interdit | Raison | Enforcement actuel | Gap |
|----------|--------|-------------------|-----|
| `architecture_design_deterministic` (requête courte) | Même surface, promesses différentes | `architectureDesignIntentGuards` exclusion mutuelle | OK |
| `technical_overview` sur `code/create` court | Gabarit aperçu | Guards + ordre short-circuit (#5 avant #19) | OK |
| `clarification_gate` générique | Réflexion warm attendue | `guidedCreationScopingPolicy` | Surveiller dérives |
| Web libre | Scoping local | `skipWebSearch: true` | OK |

### `GUIDED_PRODUCT_RECOMMENDATION`

| Interdit | Raison | Enforcement |
|----------|--------|-------------|
| `clarification_gate` si slots presque pleins | G31 clarify dédié | `compareChooseCompositePolicy` |
| Web non borné | Coût / qualité | `webSearchMaxSources: 3`, timeout 8s |
| `simple_factual_lookup` seul | Perte structure reco | Routage `compare_choose` |

### `GUIDED_DOCUMENT_SYNTHESIS`

| Interdit | Raison | Enforcement |
|----------|--------|-------------|
| Web libre | Ancrage source | `skipWebSearch: true` |
| `simple_factual_lookup` | Hors promesse | Slots G32 |
| Synthèse sans source | Hallucination | `document_synthesis_clarify` |

### `DIRECT_EXPLANATION` / `CONVERSATION_STANDARD`

| Risque | Symptôme observé | Mitigation |
|--------|------------------|------------|
| Absorption du social | « est-ce que tu as faim » → livre Grace Ly | G35 |
| Absorption des relances | « on fait quoi » → formulaire | G35 |
| Web par défaut | 74 s TTFT | Classifier amont + blocked paths |

---

## Policy packs existants

Pattern commun : **intent family + slots + contract + telemetry + validator + forbidden paths**.

| Pack | Lot | Plan principal | `pipelinePath` | Contrat | Télémétrie clé | Validator |
|------|-----|----------------|----------------|---------|----------------|-----------|
| **Social pattern hardening** | G35 | B | `social_deterministic` | `SOCIAL` | `social_pattern_matched`, `social_pattern_name`, `social_fallback_blocked_paths[]` | guards amont |
| **Cultural content summary** | G37 | B | `cultural_content_summary` | `DIRECT_SUMMARY` (sous-ensemble G38) | `cultural_content_summary_g37` | anti document_synthesis |
| **Summary contract router** | G38 | A→B | `summary/*` → paths ci-dessous | `DIRECT_SUMMARY` / `TEXT_SUMMARY` / `WEB_SUMMARY` | `summaryContract.*`, `resolution.strategy` | [summary-contract-g38-spec.md](summary-contract-g38-spec.md) |
| **Known entity execution lock** | G38.2 | B | `cultural_content_summary` / `_fallback` | `DIRECT_SUMMARY` terminal | `summary_execution_path`, `composer_bypassed`, `known_entity_validation_issues[]` | `knownEntitySummaryValidator.js` |
| **Code concept explain** | G40 | A→B | hors summary/code_delivery | `code_explain` (triage) | `code_concept_explain_g40` | `codeConceptExplainPolicy.js` |
| **HTML tag explain vs web create** | G40.1 | A | `web_html/create` supprimé si concept explain | `code/explain` (justIntent) | `can_answer_now` (clarification) | `htmlProjectDeliveryPolicy.js`, `justIntentDetectionPolicy.js`, `clarificationDecisionPolicy.js` |
| **Code concept execution lock** | G40.2 | B | `technical_overview` terminal | `code_explain` sans orchestrateur | `code_concept_execution_path`, `composer_bypassed` | `codeConceptExplainExecutionPolicy.js` |
| **Safe concept glossary fallback** | G40.3 | B | `code_concept_explain_fallback` | glossaire local borné | `concept_fallback_used`, `concept_source`, `concept_key_resolved` | `codeConceptGlossaryPolicy.js`, `codeConceptGlossary.js` |
| **Glossary prioritaire** | G40.4 | B | `code_concept_glossary_direct` | glossaire avant LLM | `glossary_direct`, `concept_key_resolved` | `codeConceptExplainExecutionPolicy.js` |
| **Response manner policy** | G41 | B (transversal) | toutes sorties déterministes | variantes + réparation | `manner_family`, anti-répétition | `responseMannerPolicy.js` |
| **Social composite** | G41.1 | B | `social_composite_deterministic` | identité + capacités en un tour | `compositeKind` | `socialCompositeReplyPolicy.js` |
| **Open prompt vs compare_choose** | G42 | B | `open_prompt_continuity` / `ideation_deterministic` | pas `compare_choose` sur « proposer » seul | `open_prompt_continuity`, `decline_continuation` | `openPromptContinuityPolicy.js` |
| **Social phatic continuity** | G43 | B | `social_deterministic` | « tu fais quoi de beau » ≠ culture générale | `social/phatic_checkin` | `socialPatternPolicy.js`, `responseMannerPolicy.js` |
| **Meta assistant behavior** | G44 | B | `meta_assistant_behavior_deterministic` | critique réflexion / rails, pas orchestrateur | `meta_assistant_behavior_v1` | `metaAssistantBehaviorPolicy.js` |
| **Ideation Citadelle lock** | G44.1 | B | `ideation_deterministic` | « mettre sur pied » ≠ `PRESENTATION_OUTLINE` | `g44_sil_meta_ideation_block` | `ideationIntentGuards.js`, `intentContractRegistry.js` |
| **Comprehension grounding** | G45 | B | `comprehension_grounding_deterministic` | « montre que tu comprends » → state dump fil | `comprehension_grounding_g45` | `comprehensionGroundingPolicy.js` |
| **Conversation turn classifier** | G46 | A→B | famille → rail (avant semantic/factual) | taxonomie 7 familles + contexte fil | `turn_family`, `turn_family_confidence` | `conversationTurnClassifier.js` |
| **Social acceptance of offer** | G46.1 | B | `social_deterministic` | `social_acceptance_of_offer` après menu code/doc/archi/papoter | `social_acceptance_of_offer` | `socialAcceptanceOfOfferPolicy.js` |
| **Meta capabilities lock** | G47 | B | `meta_capabilities_deterministic` | capacités internes / intégration — blacklist document_* | `meta_capabilities_*` | `metaCapabilitiesPolicy.js` |
| **Model stack opinion** | G47.x | B | `meta_capabilities_model_stack_deterministic` | avis sur modèle Ollama déjà dans la stack | `meta_capabilities_model_stack` | `metaCapabilitiesPolicy.js` |
| **Prediction limits** | G47.x | B | `meta_capabilities_prediction_limits_deterministic` | pronostic / pari subjectif — limites d'anticipation, pas orchestrateur | `meta_capabilities_prediction_limits` | `metaCapabilitiesPolicy.js` |
| **Information seeking light** | G49 | B | `information_seeking_light_deterministic` | factoid culturel / ludique (« tu en connais ? ») — pas dossier web | `information_seeking_light_*` | `informationSeekingLightPolicy.js` |
| **Casual explanation light** | G49 | B | `casual_explanation_light_deterministic` | relance banter ancrée fil (« et le poker… ») — pas orchestrateur | `casual_explanation_light` | `casualExplanationLightPolicy.js` |
| **Known game entity** | G49.x | B | `information_seeking_light_deterministic` | « tu connais UNO ? » — glossaire jeu sans web | `known_game_entity` | `informationSeekingLightPolicy.js` |
| **Peer assistants** | G47.x | B | `meta_capabilities_peer_assistants_deterministic` | écosystème assistants IA — pas identité recycle | `meta_capabilities_peer_assistants` | `metaCapabilitiesPolicy.js` |
| **Meta-critique patterns** | G44.x | B | `meta_assistant_behavior_deterministic` | « sans réfléchir », « mauvais rail », « trop COMPOSER » | `surface_meta_critique` | `metaAssistantBehaviorGuards.js` |
| **Social élargi** | G46.x | B | `social_deterministic` | mood check-in, papoter Citadelle | `social/mood_checkin`, `social/papoter_citadelle` | `socialPatternPolicy.js` |
| **Guided product reco** | G31 | B→C | `compare_choose` | `GUIDED_PRODUCT_RECOMMENDATION` | slots, strategy triplet | `productRecoValidator` |
| **Guided document synthesis** | G32 | B→C | `document_synthesis_*` | `GUIDED_DOCUMENT_SYNTHESIS` | slots source | `documentSynthesisValidator` |
| **Guided creation scoping** | — | B | `guided_creation_scoping` | `GUIDED_CREATION_SCOPING` | `constraints_extracted[]`, `guided_creation_compliant` | drift signals |
| **Query understanding** | G29 | A | (amont) | injection `intentContractId` | `domains[]`, `workIntentCount` | G30 matrix |
| **Conversation move** | P2 | A | dérivé move | `contractId` move-level | shadow amont/servi | `conversationMoveContractVerification` |
| **Clarification decision** | — | A | `clarification_gate` | — | `clarification_gate_source` | blocking ambiguity only |

### Fichiers par pack

| Pack | Policy | Télémétrie | Tests |
|------|--------|------------|-------|
| G35 | `socialPatternPolicy.js` | `socialPatternTelemetry.js` | `social-pattern-hardening.test.js` |
| G37 | `culturalContentSummaryPolicy.js` | — | `cultural-content-summary-routing.test.js` |
| G38 | `summaryContractRouter.js`, `summaryContractShortCircuit.js` | `summaryContractTelemetry.js` | `summary-contract-g38-routing.test.js` |
| G38.2 | `knownEntitySummaryExecutionPolicy.js`, `knownEntitySummaryValidator.js` | `knownEntitySummaryExecution` (ctx) | `summary-execution-g38-2.test.js` |
| G40 | `codeConceptExplainPolicy.js` | `code_concept_explain_g40` (triage) | `code-concept-explain-g40.test.js` |
| G40.1 | `htmlProjectDeliveryPolicy.js`, `justIntentDetectionPolicy.js`, `clarificationDecisionPolicy.js` | — | `code-concept-explain-g40.test.js` |
| G40.2 | `codeConceptExplainExecutionPolicy.js`, `intentShortCircuit.js`, `agentPipeline.js` | `code_concept_execution_path` | `code-concept-explain-g40.test.js` |
| G40.3 | `codeConceptGlossaryPolicy.js`, `data/codeConceptGlossary.js` | `concept_fallback_used`, `concept_source` | `code-concept-glossary-g40-3.test.js` |
| G40.4 | `codeConceptExplainExecutionPolicy.js`, `intentShortCircuit.js` | `code_concept_glossary_direct` | `code-concept-glossary-g40-3.test.js` |
| G41 | `responseMannerPolicy.js` | — | `code-concept-glossary-g40-3.test.js` |
| G41.1 | `socialCompositeReplyPolicy.js`, `metaConversationIntentGuards.js` | `social_composite` | `social-composite-g41-1.test.js` |
| G42 | `openPromptContinuityPolicy.js`, `compareChooseIntentGuards.js`, `intentShortCircuit.js` | `open_prompt_continuity` | `open-prompt-continuity-g42.test.js` |
| G43 | `socialPatternPolicy.js`, `responseMannerPolicy.js`, `generalKnowledgeIntentGuards.js` | `social/phatic_checkin` | `social-pattern-hardening.test.js` |
| G44 | `metaAssistantBehaviorPolicy.js`, `assistantUtteranceClarifyPolicy.js`, `intentContractRegistry.js` | `meta_assistant_behavior_v1` | `social-meta-g44.test.js` |
| G45 | `comprehensionGroundingPolicy.js`, `assistantRepairReplyBuilder.js`, `semanticIntentResolver.js` | `comprehension_grounding_g45` | `social-meta-g44.test.js` (G45-T*) |
| G46 | `conversationTurnClassifier.js`, `conversationTurnRoutingPolicy.js`, `intentShortCircuit.js`, `agentPipeline.js` | `turn_family` | `conversation-turn-g46.test.js`, `fuzz-g45-routing.mjs` |
| G46.1 | `socialAcceptanceOfOfferPolicy.js`, `conversationTurnClassifier.js`, `conversationTurnRoutingPolicy.js` | `social_acceptance_of_offer` | `conversation-turn-g46.test.js` (G46-T08/T09) |
| G31 | `guidedProductRecommendationPolicy.js`, `compareChooseCompositePolicy.js` | `strategyExecutionTelemetry.js` | `compare-choose-g31-policy.test.js` |
| G32 | `guidedDocumentSynthesisPolicy.js`, `documentSynthesisCompositePolicy.js` | slot telemetry | `guided-document-synthesis-g32-policy.test.js` |
| Guided creation | `guidedCreationScopingPolicy.js` | `guidedCreationScopingTelemetry.js` | `guided-creation-scoping.test.js` |

---

## Doctrine G46 — famille de tour avant intention métier

Les intentions métier (`general/explain`, `compare_choose`, `simple_factual_lookup`, etc.) sont des **stratégies d'exécution**, pas la clé structurelle du tour. G46 pose l'acte de dialogue en amont.

### Règles

1. **La famille de tour n'est jamais surclassée par un score d'intention métier.** Une fois `turn_family` fixée avec confiance ≥ seuil, les rails concurrents sont supprimés (`FAMILY_SUPPRESSIONS`), pas arbitrés par un autre pattern.
2. **Chaque famille a une liste blanche implicite de rails autorisés** (via `conversationTurnRoutingPolicy` + short-circuits dédiés). Tout rail non listé pour la famille est inaccessible, même si un guard métier matche en aval.
3. **Les patterns regex ne changent jamais de famille** — ils affinent à l'intérieur (signal, reply, slot). Ex. : `social_acceptance_of_offer` ne rivalise pas avec `general/explain` ; il renforce `social_checkin` quand le fil assistant contient l'offre « papoter ».

### Signaux contextuels (sous-types)

| Signal | Famille | Sens conversationnel |
|--------|---------|----------------------|
| `social_acceptance_of_offer` | `social_checkin` | L'utilisateur accepte une option que l'assistant a proposée (relance ancrée, pas nouvelle demande) |
| `meta_capabilities_combined` | `meta_capabilities` | Lecture fichiers propres + intégration système externe |
| `meta_capabilities_nature` | `meta_capabilities` | Nature / intelligence de l'assistant |
| `meta_capabilities_prediction_limits` | `meta_capabilities` | Pronostic / pari subjectif — limites d'anticipation |
| `meta_capabilities_peer_assistants` | `meta_capabilities` | Autres assistants IA — écosystème, pas identité recycle |
| `information_seeking_light_game_culture` | (rail G49) | Factoid ludique — jeux, cartes, culture légère |
| `casual_explanation_light` | (rail G49) | Relance fil conversationnel — explication courte ancrée |
| `surface_comprehension_proof` | `comprehension_proof` | Preuve de suivi du fil |
| `surface_meta_critique` | `meta_critique_assistant` | Critique du comportement assistant |
| `open_project_wording` | `ideation` | Ouverture projet / pistes |

### Écart actuel (à combler)

- `FAMILY_SUPPRESSIONS` couvre quelques rails ; pas encore de verrou orchestrateur global par famille (chantier G36).
- `semantic_intent_resolver` et `justIntent` peuvent encore s'activer **avant** G46 sur certains chemins — G46 doit rester le premier verrou structurant après `effectiveQuery`.

---

## Policy packs manquants (trous du registre)

| Pack proposé | Plan cible | Besoin | Priorité |
|--------------|------------|--------|----------|
| **G48 React Audit (React Doctor)** | B | Audit déterministe repo React/Vite ; `REACT_AUDIT_V1` | **G48.1 livré** — [react-audit-g48-spec.md](react-audit-g48-spec.md) |
| **G49 OpenPencil Forge atelier** | B→C | Design-as-Code UI canvas | P1 (spec à faire) |
| **G47 GUI Operator (Peekaboo MCP)** | C | Vision + action GUI macOS only | P2 conditionnel |
| **G38 Summary Contract Router** | A→B | Unifier `summary/*` sous contrat JSON — implémentation post-spec | **livré** |
| **G38.2 known_entity execution lock** | B | Rail terminal DIRECT_SUMMARY — pas d'escalade COMPOSER | **livré** |
| **G36 orchestrator social lock** | C | Si pattern G35 aurait dû matcher, forcer `SOCIAL` + refus web/COMPOSER | Haute |
| **conversation_repair** | B | Réparation légère sans `clarification_gate` bureaucratique | Haute |
| **complex_request_handling** | A→C | Détection multi-étapes avec contrat dédié (pas nouveau runtime) | Moyenne |
| **long_form_strategic** | C | Analyse stratégique structurée (contrat + validator) | Basse |
| **document_task_composite** | B/C | Doc + tâche (extension G32/G29) | Moyenne |

---

## Table de compatibilité `pipelinePath × intentContract`

Légende : **N/A** = SIL Plan B, contrat orchestrateur non atteint.

| `pipelinePath` | Contrat primaire | Web | Notes |
|----------------|------------------|-----|-------|
| `social_deterministic` | `SOCIAL` | Non | N/A SIL |
| `guided_creation_scoping` | `GUIDED_CREATION_SCOPING` | Non | SIMPLE_FAST |
| `architecture_design_deterministic` | `ARCHITECTURE_OPTIONS` | Non | Exclut guided creation court |
| `compare_choose` | `GUIDED_PRODUCT_RECOMMENDATION` | Borné | |
| `document_synthesis_llm` | `GUIDED_DOCUMENT_SYNTHESIS` | Non | |
| `simple_factual_lookup` | `DIRECT_EXPLANATION` / `FACTUAL_RESEARCH` | Oui si escalade | Zone rouge social |
| `information_seeking_full_pipeline` | `FACTUAL_RESEARCH` | Oui | |
| `COMPOSER` | `resolveIntentContract()` runtime | Selon contrat | Fallback `CONVERSATION_STANDARD` |
| `DOCUMENT` | `DOCUMENT_*` / `FACTUAL_RESEARCH` | Variable | |
| `CRITICAL` | `DIAGNOSTIC` / `DESIGN_AUDIT` | Rare | |
| `clarification_gate` | — | Non | Pas de contrat |

---

## Observabilité — lecture Console d'Orchestration

### Séquence type d'un tour

```
pipelinePath=just_intent_detection
justIntent=general/explain strategy=clarify_then_build conf=low
📋 Intention : …
pipelinePath=<canal servi>
stream delivery: N chunks · TTFT Xms · total Yms · pipeline
```

### Diagnostic rapide

| Symptôme | Cause probable | Canal attendu |
|----------|----------------|---------------|
| TTFT > 30 s sur phrase courte | Fuite B → C + web | `social_deterministic` ou SIL |
| « objectif principal / format » sur small talk | Gate avant G35 (régressé) | `social_deterministic` |
| « Mes systèmes sont nominaux » sur critique compréhension | `semantic_intent_resolver` confond social_checkin | `comprehension_grounding_deterministic` G45 |
| « Mes systèmes sont nominaux » sur check-in santé | `semantic_intent_resolver` | `social_deterministic` G35 |
| Web sur question anthropomorphique | `simple_factual_lookup` → `COMPOSER` | G35 + G36 |
| Gabarit 3 approches sur « créer agent python » | `architecture_design` au lieu de guided | `guided_creation_scoping` |

---

## Skills / compétences métier — mapping recalibré

Les « skills » ne sont pas une couche runtime. Ce sont des **packs** rattachés à un plan existant.

| Compétence métier | Plan | `pipelinePath` / contrat | Extension, pas nouveau runtime |
|-------------------|------|--------------------------|--------------------------------|
| Social companion | B | `social_deterministic` / `SOCIAL` | G35 |
| Python agent builder | B | `guided_creation_scoping` | guided creation |
| HTML/JSON app builder | B | `guided_creation_scoping` | idem |
| Document reasoner | B→C | `document_synthesis_*` / `GUIDED_DOCUMENT_SYNTHESIS` | G32 |
| Product advisor | B→C | `compare_choose` / `GUIDED_PRODUCT_RECOMMENDATION` | G31 |
| Multi-agent orchestrator | C | `COMPOSER` + experts | contrat spécialisé |
| Architecture advisor | B | `architecture_design_deterministic` | distinct de guided creation |

---

## Chantiers concrets (recalibrés)

1. **Verrouiller frontières** — G36 orchestrateur ; affiner `semantic_intent_resolver` vs G35
2. **Policy packs** — formaliser le template : family + slots + contract + telemetry + validator + `forbidden_paths[]`
3. **Registre vivant** — tenir ce document + CSV export depuis les tests de couverture G30
4. **Nouveaux cas** — uniquement où le registre a un trou (repair, complex handling)

---

## Export CSV

Fichier machine : [nexxus-pipeline-path-registry.csv](./nexxus-pipeline-path-registry.csv) (généré manuellement v1 — à automatiser depuis tests).

---

## Changelog

| Date | Version | Changement |
|------|---------|------------|
| 2026-07-11 | v1.0 | Registre initial — plans A/B/C, interdictions, policy packs G31/G32/G35 |
| 2026-07-13 | v1.1 | G43–G45 : phatic, meta-comportement, idéation Citadelle, grounding explicite |
| 2026-07-14 | v1.2 | G46 : classifieur de tour conversationnel (famille → rail, contexte fil) |
| 2026-07-14 | v1.3 | G46.1 : `social_acceptance_of_offer` ; doctrine famille-first formalisée |
| 2026-07-14 | v1.4 | G47 : `meta_capabilities` — blacklist document_synthesis / document_analysis |
| 2026-07-14 | v1.5 | G47.x self_awareness ; G44.x meta-critique ; G46.x social/ideation élargis |
| 2026-07-14 | v1.6 | G47.x model_stack_opinion — avis modèle stack sans COMPOSER |
