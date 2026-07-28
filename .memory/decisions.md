# Architecture & Strategic Decisions

## [2026-04-10] Standalone Sovereignty Pivot
- **Decision**: Decouple Nexxus Studio from EasyLocalAI V2.
- **Rationale**: Ensure Nexxus Studio can function as a standalone, sovereign web application. Allow users to use it independently.
- **Tech Stack**: 
    - Frontend: Vite + React (JS).
    - Backend: Node.js + Express.
    - AI: Direct integration with Ollama (nomic-embed-text for routing).
- **Storage**: Projects are physically built on disk in the `projects/` directory.

## [2026-04-10] Design System: Liquid Glass
- **Decision**: Adopt a high-end, cinematic aesthetic.
- **Rationale**: Market positioning as a "Premium AI Workstation". Focus on visual excellence and micro-animations.
- **Standard**: No Tailwind for core styling to preserve unique brand identity.

## [2026-04-12] Triumvirat Architecture & VRAM Hardening
- **Decision**: Shift to a specialized three-model architecture (DeepSeek-R1, Qwen2.5, Mistral) with deterministic VRAM swapping.
- **Rationale**: 8GB VRAM limit requires strict context management (4096 tokens) and explicit model eviction.
- **Outcome**: Drastic reduction in "Out of Memory" errors and faster inference cycles.

## [2026-04-12] Hybrid Hardened Routing (V7.4)
- **Decision**: Implement a dual-search pipeline (Keywords BM25 + Semantic Vector) fused via Reciprocal Rank Fusion (RRF).
- **Rationale**: Vector search alone (semantic) lacks precision for technical keywords (e.g. "Node.js"). BM25 provides lexical anchoring.
- **Optimization**: Field weighting (Boost name x3) and tech-aware tokenization to handle software engineering specific signals.

- [existing-ai-instructions-file] Use the existing .github/copilot-instructions.md for repository-specific AI guidance in this workspace.

- [left-panel-exclusive-toggle] Les onglets Audit, Projet et Cockpit sont mutuellement exclus via un toggle central pour empêcher un état actif incohérent avec le contenu rendu.

- [deterministic-date-time-fastpath] Date/heure courante passe par getDeterministicSocialResponse avec réponse runtime en une ligne, sans appel LLM.

- [silence-onstep-deterministic] IntentStage ne publie plus onStep quand deterministic est présent pour éviter la méta sur fast-path.

- [agents-architecture-fastpath] Question simple sur agents/sous-agents passe en réponse déterministe courte: agent principal, agents spécialisés, Forge sous-système technique.

- [anti-grandiose-architecture-guard] ControlHarness rejette le style grandiloquent sur questions d’architecture agentique via isGrandioseArchitectureStyle.

- [identity-sober-wording] Identité système remplace Maître Orchestrateur/entité souveraine par vocabulaire fonctionnel et sobre.

- [thinking-response-isolation] Réflexion interne isolée de la réponse utilisateur via triple-couche: (1) responseThinkingCleaner module ultra-strict, (2) nettoyage agressif dans agentPipeline.js post-composition, (3) filtre final dans endpoint /api/chat avant SSE. Élimine <think>, <action>, marqueurs textuels (Thinking Process:, Raisonnement:), blocs épistémiques.

- [final-output-safety-regression-tests] Ajout d une regression compose: la sortie finale doit supprimer marqueurs bruts (<think>, PENSEE INTERNE, Raisonnement:) et paraphrases (voici mon raisonnement, analyse interne, raisonnement interne) avec test dedie final-output-safety.test.js.

- [pedagogical-python-routing-invariant] Invariant teste au niveau resolveIntentContract: une requete pedagogique plan atelier Python ne doit pas etre routée vers CODE_DELIVERY_V1 ni FORGE_WEBAPP_BUILD.

- [vault-canonical-structure] Refactorisation du Vault en 5 piliers actifs + zone d'exclusion, avec ajout d'exclusions à l'indexeur pour éviter la pollution par les archives/brouillons.
- [conversational-micro-signals] Interception instantanée des salutations courtes et acknowledgments, et traitement des messages mixtes (salutation + requête).
- [core-architecture-confirmed] Confirmation du rôle de 5 fichiers clés : intent classifier, conversational recall synthesizer, grounding validator, tool registry, ground truth service.
- [ground-truth-resilience] Améliorations de GroundTruthService : injection de chemins, index auto-réparant, metadata enrichies, calcul de variance/stdDev de dérive avec taille d'échantillon récente, ajout de `getRecentAnnotations()`.

## [2026-06-27] Query Understanding G29–G32 — intent families instrumentées

- **Decision**: Étendre G29 (understandQuery) avec playbook « intent family » : détecteur registre → slots → stratégie `guided_*` → contrat orchestrateur → validator post-compose → télémétrie.
- **Livrés**:
  - G29.2 `document_datetime_hybrid`
  - G30 matrice couverture (`queryUnderstandingCoverageMatrix.js`, 16 verts + 4 gaps)
  - G30.1 `document_synthesis` dans registre G29
  - G31 `compare_choose` / reco produit : slots budget+usage, `GUIDED_PRODUCT_RECOMMENDATION`, `productRecoValidator`, triplet stratégie
  - G32 `document_synthesis` guidée : slots source, `GUIDED_DOCUMENT_SYNTHESIS`, `documentSynthesisValidator` (groundedness)
- **Docs**: `docs/agents/query-understanding-g29-spec.md`, `query-understanding-g30-coverage-spec.md`, fiches G31/G32 dans `conversation-move-governance.md`
- **Vault**: ADR G29/G31/G32 + module `Query-Understanding-G29.md` + Index-ADR + Bienvenue
- **Backlog**: G30.2–G30.6 (gaps), G33 dissertation guidée (extension G32)
- **Pattern de référence**: G31 smartphone (récence) et G32 synthèse (fidélité source) — répliquer pour nouveaux domaines métier.

## [2026-07-19] file_target_resolver — Forme B dossier + filename

- **Decision**: Résoudre `filename` + `folder` (ex. `index.html` dans `projects/demo-citadelle/`) en chemin complet **avant** justIntent / document_synthesis / Generator-First.
- **Module**: `server/src/agent/utils/fileTargetResolver.js` (`explicit_path` | `folder_plus_filename` | `unresolved`).
- **Wiring**: `extractLocalFileReference` → `isExistingSourceAnalysisRequest` → short-circuit `existing_source_analysis_*`.
- **Rationale**: Sinon `index.html` + HTML lexical → `web_html/create` + `document_synthesis_clarify` (demande PDF hors sujet).

## [2026-07-19] SOURCE_FILE_ANALYSIS_V1 — minima review-grade

- **Decision**: `REVIEW_GRADE_MINIMUMS` — ≥2 forces, ≥3 findings, ≥1 inconnue, ≥2 actions, résumé ≥40 car. ; section **Pourquoi ce rôle** (`roleRationale`).
- **HTML**: profil `presentation landing` (skip link, atelier, CSS/JS locaux) pour `projects/demo-citadelle/index.html` — même enveloppe que Martinique.
- **Tests**: `source-file-analysis-v1.test.js` compare demo-citadelle vs fixture Martinique.

## [2026-07-20] REPO_ANALYSIS_V1 — revue dépôt ≠ DOCUMENT

- **Decision**: Contrat `REPO_ANALYSIS` (prio 790) + rubric `REPO_ANALYSIS_V1` (≥3 forces, ≥5 risques, ≥2 inconnues, ≥3 actions).
- **Routing**: `analyse le dépôt` / URL GitHub → `repo_analysis_*`, pas `DOCUMENT_ANALYSIS` ni `document_synthesis`.
- **Local**: scanner borné `projects/` → `repo_analysis_deterministic`. Distant → LLM + web + composer dédié.
- **Distinction**: fichier seul → `SOURCE_FILE_ANALYSIS` ; « vas te renseigner + résumé » → `RESEARCH_THEN_SUMMARIZE`.

## [2026-07-20] REPO deep sample → SOURCE_FILE_ANALYSIS_V1

- **Decision**: Petits repos locaux (≤20 fichiers) : après hygiène dépôt, échantillonner 1–2 fichiers structurants (`index.html`, `app.js`…) via SFA et exiger ≥2 findings code.
- **Module**: `repoDeepSample.js` ; section sortie **Findings code (échantillon)** ; validator `requireCodeFindings`.
- **Rationale**: passer de structure-centric à code-centric sans crawl des gros repos.

## [2026-07-20] Web search help ≠ idéation

- **Decision**: Demande explicite de recherche internet sans sujet → `web_search_help_clarify` ; avec sujet → `information_seeking_full_pipeline` + web. Continuité sans plafond de tours : pivots « et sur… » tant que `isWebSearchThreadActive` (rompue seulement par intention dure). Contrat `FACTUAL_RESEARCH`. Jamais idéation RAG. Composer : pas de `INSUFFICIENT_SIGNAL_REFUSAL` si preuves web.

## [2026-07-20] Comparatif produit ≠ fiche locale

- **Decision**: Query web produit dérivée par catégorie (SSD/GPU/smartphone…) — jamais défaut GPU. Move contract n’applique pas le fallback information_seeking (« fiche locale ») sur `compare_choose` / produit. Fallback info-seeking sans vocabulaire fiche.

## [2026-07-21] PlacementPlan P0 (philosophie Colibrì, sans Colibrì)

- **Decision**: Snapshot `buildPlacementPlan` (resident/lazy/prefetch/never) injecté dans `warmupStatus.placementPlan` + cockpit. Pas de changement d’éviction.
- **Raffinements**: `class` ≠ `intentHint` ; `deferred` ≠ `refuse` (actions P1) ; `observedProcessor`/`observedSizeGb` via REST `/api/ps` ; keep_alive critique = `ollama_rest`.
- **Module**: `server/src/llm/placement/placementPlan.js`
- **Wiring**: `warmupService` → `placement.plan.built` ; cockpit via `summarizePlacementForCockpit`.

## [2026-07-22] PlacementPlan — P1 après fenêtre d’observation P0

- **Decision**: Ne pas lancer P1 (éviction pilotée) tant que P0 n’a pas tenu quelques jours en prod.
- **Observer**: (1) stabilité resident reactive ornith+nomic, (2) écart plan vs `/api/ps`, (3) lisibilité reason/source/class/intentHint, (4) cockpit « va bien » vs placements bizarres.
- **Go P1 si**: plusieurs sessions réelles + cockpit trivial à lire, sans surprises.
- **Sinon**: 2–5 jours + revue manuelle snapshots/events, puis P1 avec rollback mental simple.

## [2026-07-21] Couche épistémique sous incertitude

- **Decision**: Politique système `epistemicUncertaintyResolutionPolicy` au même niveau que intent/routing/short-circuit — pas seulement un prompt.
- **Règle**: inférer → clarifier ciblé (hypothèse) → vérifier → répondre ; jamais inventer ; jamais clarify générique si hypothèse.
- **États**: `known_contextualizable` | `ambiguous_probable` | `unknown_real` | `potentially_stale`.
- **Actions**: `respond` | `targeted_clarify` | `admit_uncertainty` | `verify_external`.
- **Hooks**: short-circuit (avant `request_interpreter_clarify`), `clarificationDecisionPolicy`, `uncertaintyPolicy` (prompt).

## [2026-07-22] Posture + contrat de sortie + épistémique mère (spec)

- **Decision**: Polyvalence = postures sticky + `promisedValue` + épistémique transverse + calibration — pas explosion de rails.
- **Briques**: `PosturePolicy`, `DeliverableContractPolicy`, `EpistemicResolutionPolicy` (mère), `SessionModeState` (+ UserCalibration).
- **Autorité**: sécurité → mandat exécution tour → épistémique → contrat sortie → posture sticky → ConversationMove → JUST/SC → LLM.
- **Formatter**: shell `transform` uniquement (source + cible), jamais fourre-tout production.
- **Docs**: ADR `ADR-20260722-Posture-Deliverable-Epistemic-v1.md` ; spec `docs/agents/posture-deliverable-epistemic-spec-v1.md`.
- **P0 fait**: `sessionModeState.js` + `posturePolicy.js` ; persistance `sessionWorkMemory.sessionMode` ; log `[PIPELINE] posture=…` ; addon prompt style ; tests `posture-session-mode-p0.test.js`. Garde-fous : TTL, rupture, switch explicite, conflict mandat→executor.
- **P0.1**: `ttlBefore`/`ttlAfter`/`ttlResetReason` ; `intensity` light|normal|strong ; forge/web cassent sticky même locked.
- **Backlog**: Deliverable → Epistemic mère → mentor/advisor rails → repair/G36 → puis workshop/pair/long-form/agent IA.
- **Exploration contracts** (2026-07-22) : `social_continuity` | `exploration_proposal` | `guided_choice` — relance floue = menu, **pas** clarification_gate. Bridge runtime : `social/open_prompt`. Mini-spec : `docs/agents/posture-deliverable-epistemic-spec-v1.md` §2.3.1.
- **DeliverableContract P0 observe** (2026-07-22) : `deliverableContractPolicy.js` — lecture/télémétrie (`promisedValue`, `clarificationRequired`, `gateSuppressed`, `replyShape`) ; `enforcement: false` ; short-circuit inchangé. Hook `agentPipeline` après SC.
- **DeliverableContract P0.1** (2026-07-22) : instrumentation honnête avant tout enforcement — (1) wording UI « observe / pas d'enforcement / candidat suppression » ; (2) default `promisedValue=null` (`unknown`) hors cas connus ; (3) `guided_choice` ancré sur panel structurel + `runtimeAligned=false` ; (4) `personal_discomfort` → `care_ack` ; (5) tests `deliverable-contract-p0.test.js`. Formule : P0 = instrumentation, pas vérité exécutoire.
- **OpenExplorationFrame P0** (2026-07-22) : forme conversationnelle à slots (`openExplorationFramePolicy.js`) **avant JUST** — opener collectif + activity shell + absence d’objet ; modal = bruit (pourrait/pourrais). `surfaceFrame=open_exploration` → `exploration_proposal`, clarify interdit. Bridge UX `social/open_prompt`. Spec §2.3.2.
- **INSTANT ne coupe plus les panels** (2026-07-23) : `enforceModeContract(INSTANT)` faisait `split("\n").slice(0,6)` → panel open_prompt tronqué après l’item 4. Skip si liste structurée / `sectionedComposite` sur short-circuit social.
- **guided_choice runtime P1** (2026-07-23) : `guidedChoicePolicy.js` — sélection 1–5 / mot d’option après panel → `guided_choice_deterministic` (aide au choix, pas livrable inventé). `runtimeAligned=true`.
- **Glossaire php:function** (2026-07-23) : « fonction PHP » → `code_concept_glossary_direct` avec exemple + rôle.
- **fileContextGuard soft** (2026-07-23) : si réponse concrète ancrée sur PJ + refs secondaires hors inventaire → `softened` (livrable + note), jamais full-block. Full-block réservé aux citations inventées sans analyse.
- **AttachmentTask P1** (2026-07-23) : `attachmentTaskPolicy.js` — intention×kind PJ ; code short query + PJ → `classifyCodeIntent({attachments})` ; bypass Document Analysis ; soft-guard multi-shapes ; docx extracteur ZIP minimal.
- **Guard precedence P1.1** (2026-07-23) : `buildAttachmentResponseState` (`hasConcreteAttachmentAnswer`, `sourceBacked`, `overrideLocked`, `guardMode`). Matrice : no source → replace ; incapacity → no_op ; concrete+PJ → append_only never kill.
- **PJ vs TEXT_SUMMARY P1.2** (2026-07-23) : si `attachmentTask` code/doc_improve (pas `doc_summarize`) → interdire G38 `TEXT_SUMMARY` / `document_synthesis_llm` ; short-circuit `attachment_task_full_pipeline` (`deferToFullPipeline`). Garde interprétation : assets liés (`home.js`) → « non visible dans ce fichier », pas « inopérant ». Fix `presentationOutline` manquant dans `applySimpleFastDeliveryPipeline` ; fail-fast SIMPLE_FAST → PJ experte. Telemetry fallback LLM : `fallbackReason=primary_400` (technique).
- **Coder stack = 7b seul** (2026-07-23) : `qwen2.5-coder:14b` hors stack (`alternative: null`, matrix/executionBrief, purge candidates, doc 8 Go). Placement `never` inchangé. Tier 3 coding = uniquement `qwen2.5-coder:7b`.
- **Output Shape Critic G50** (2026-07-23) : doctrine figée — LLM = fond sous contrainte, pas arbitre d’affichage. Formes : `prose_only` \| `table` \| `code_snippet` \| `no_snippet` \| `action_block`. Spec `docs/agents/output-shape-critic-g50-spec.md` ; ADR-20260723. Observe-first avant enforce.
- **explanationRegister simple_first** (2026-07-23) : pour « c’est quoi une spec / mini-spec », défaut = pédagogique progressif (humain → exemple → pont jargon), pas densification technique ni refus. Spec posture §4.1 ; manner `pedagogic_explain_simple` ; dual `buildSpecVsMiniSpecGlossaryReply`.
- **lexicon sciences scolaires** (2026-07-23) : « tu connais le cycle de l’eau… » ≠ reconnaissance culturelle (angles sans développer). Rail `lexicon_explain_light` + `lexiconSchoolScienceExplain` → addon explicatif, OPEN_PROPOSITION, fallback local évaporation/condensation/précipitations, `allowRefusal=false` strip refus.
- **continuité schéma pédagogique** (2026-07-24) : après explication sciences, « le détailler sous forme de schéma » → `lexicon_science_format_deterministic` (registre `illustrated`), pas simple_fast/refus. Sujet depuis « Oui. Le X, c’est… » ou user précédent ; bypass `SUFFICIENCY_BYPASS_PATHS`.
- **mini_panorama lexicon** (2026-07-24) : « connais-tu X et son impact… » / phénomènes naturels → shape `mini_panorama` (socle + établi + nuance + 1 ouverture), jamais « oui je connais + menu d’angles ». Spec posture §4.1.1 ; anti-fuite menu en delivery.
- **outputFormat Response Contract** (2026-07-24) : intent multi-dimensionnel action+format+profondeur. « explique … tableau » sciences → `lexicon_science_format_table_deterministic` + `responseContract` **avant** `technical_overview` ; JUST n’émet plus `data/spreadsheet`. Spec posture §4.1.2.
- **table contract + UI GFM** (2026-07-24) : template 3 cols (`Étape` / `Description` / `Résultat / Exemple`) + note ; `validatePedagogicalTableResponse` (contains_table, header_equals, min_rows, no_truncation) avant short-circuit ; chat UI = `remark-gfm` + CSS `.custom-markdown table` (sinon pipes bruts).
- **PedagogicalMarkdownMessage** (2026-07-24) : rendu typé `.message--pedagogical` (intro / `.table-wrap` scroll / note / À retenir / bouton sources). Split `shared/pedagogicalTableContract.js` ; branché dans `ChatBento` si contrat table OK.
- **format=table prioritaire hors glossaire** (2026-07-24) : « cycle de la lune … tableau » → template local ; autres sciences → `lexicon_science_format_table_llm` + contrat (pas `simple_fast` / « Je vois la piste »). Validation post-LLM → repli glossaire si dispo.
- **multi-tableaux pédagogiques** (2026-07-24) : « fait 2 tableaux : 1 - … 2 - … » → `parsePedagogicalStructuredUnits` + `lexicon_science_format_table_multi_deterministic` (lune + libellule, etc.) ; UI multi-blocs via `splitPedagogicalMarkdownBlocks`. Interdit de s’arrêter au 1er sujet glossaire.
- **scheduler pédagogique lots** (2026-07-24) : `pedagogicalTableSchedulerPolicy` — `MAX_PER_BATCH=4`, `MAX_AUTO=8` ; modes `single_batch` / `multi_batch_auto` / `multi_batch_confirmed` ; hybride local+LLM par unité ; validation par bloc ; **continue** / confirm avant continuité générique.
- **INTENT_COMPOSITION_V1 P0** (2026-07-24) : `intentCompositionPolicy` observe — primary/secondary/contraintes/social + `confidence_breakdown` + `dropped_candidates` + `just_relation` (anti-wrapper JUST). Consommateur pédagogique : greeting + summarize inline + sources. Spec posture §2.4.
- **P0 observe avant P1** (2026-07-24) : ne pas enforcer tout de suite. Critères (pas « ça marche une fois ») : (1) réduit les clarifications inutiles ; (2) enrichit vraiment le plan de réponse ; (3) reste neutre sur requête simple. Revue logs `🧩 Composition` : social+explain+format ; explain+summarize/sources ; contradictions depth ; flou non surcomposé. Aussi : `just_relation` sans gain ; `dropped_candidates`. P1 localisé seulement si signal réel stable.
- **WorkloadSignal / Unit Planning** (2026-07-24) : avant composition/orchestration, `requestWorkloadSignalPolicy` compte les unités (`X choses à faire`, listes `1 - … N - …`). Invariant cardinalité demandé=planifié ; `parsePedagogicalStructuredUnits` garde **toutes** les cibles (pas seulement glossaire) ; social = modulateur (`deferred_to_response` si multi-unités), pas force de routage. Fiches = templates de rendu, pas gouvernance.
- **WorkUnitCountAndPlanPolicy** (2026-07-24) : brique structurante Count→Reconcile→Normalize→Plan (`WORK_UNIT_COUNT_AND_PLAN_V1`). Modes `single_unit` / `multi_unit_sequential` / `multi_unit_parallel` / `blocked_clarify`. Parallèle seulement si indépendant + budget ; écart déclaré/parsé → pas d’exécution. Spec posture §2.4.1.
- **Voix Nexxus consolidation P0** (2026-07-24) : mémo discovery `docs/agents/voix-nexxus-consolidation-p0.md` — 12 élans à garder, 7 ruptures à neutraliser. Pas de personality pack ; continuité de voix avant injection ; brancher plus tard dans policies/modes/contrats, pas un prompt « âme ».
- **Voix Nexxus doctrine v1** (2026-07-24) : `voix-nexxus-doctrine-v1.md` + `voiceContinuityPolicy.js` (`VOICE_CONTINUITY_V1`). Branche : addon pipeline après posture ; ligne continuité dans `getModeSystemPrompt` ; OPEN_PROPOSITION sans « gardien souverain ». Continuité comportementale, pas prompt âme.
- **Voix R1+R6** (2026-07-24) : R1 = bloquer refus « piste » si ancré (`enforceModeContract` + simpleFast + SC). R6 = `buildPostureDeliveryAddon` / `meta.postureDecision` → composer.
- **Voix R2/R4/R5/R7** (2026-07-24) : R2/R7 `applyVoiceContinuityVisibleText` dans cleanVisible ; R4 `shouldSuppressPrematureClarify` (étroit) ; R5 `shouldDeferSocialRouting` (SC social + composition). Sans nouvelle couche conceptuelle.
- **WEB_SUMMARY vs INLINE_FILE** (2026-07-24) : résumer une URL `https://…/fichier.ext` ≠ analyse fichier local. `stripHttpUrlSpans` avant matching chemin (`fileTargetResolver`, `EXISTING_FILE_PATH_RE`, Sovereign `_evaluateFileDrivenIntent`) ; WEB_SUMMARY early avant `existingSourceEarly` ; `isGuidedDocumentSynthesisRequest` false si URL sans chemin local (évite `skipWebSearch`).
- **WEB_SUMMARY générique** (2026-07-25) : stratégie = interroger n’importe quel site public (ex. moncoachscolaire.fr), pas un domaine figé. `extractSummaryUrl` accepte https + domaine nu ; fetch `extractUrlContent` injecté avant SIMPLE_FAST si `webSummary` ; pas d’invention si fetch échoue.

## [2026-07-22] Social papoter / critique / mal-être

- **Decision**: Trois filets déterministes pour éviter COMPOSER / debug / Forge hors sujet.
- **Papoter**: `CHAT_INVITE_RE` + `on va|vais|allons` ; acceptation d’offre étendue au menu mood (`papotage` / exploration / debug).
- **Critique réponse**: `isAssistantResponseQualityFeedback` exclut debug ; markers meta + repair ; short-circuit meta/repair avant debug.
- **Mal-être**: pattern `social/personal_discomfort` → empathie + limites médicales, hors `assistant-scope` / GK.

- **Vision mllama / Ollama 0.32** (2026-07-25) : pipeline VISION_ATTACHED branche OK ; echec = moteur Ollama >=0.30 refuse archi mllama (llama3.2-vision). imageAnalyzer fallback auto -> deepseek-ocr / NEXXUS_VISION_FALLBACK_MODEL. Alternative durable : pull VL compatible (llava/gemma3/qwen2.5vl) ou Ollama ante-0.30.

- **Vision primaire gemma4:12b** (2026-07-25) : remplace llama3.2-vision (mllama mort Ollama 0.32). Fallback deepseek-ocr. unwrapVisionReply pour thinking Gemma4.

- **Vision review patches** (2026-07-25) : vision_failed si visionData.error ; ContextStage filtre buffers ; chatVision num_predict 1024 (NEXXUS_VISION_NUM_PREDICT) ; doc stack gemma4.

- **Anti-demon meta vs info_seeking** (2026-07-25) : path/family meta_capabilities ne passent plus resolveMoveContractProfile information_seeking (evite rewrite prix/specs). Subkind runtime_progress apres vision OK (yeux/mains/amelioration).

- **CODE_REVIEW HTML/sécu** (2026-07-25) : classifyErrorCategory honore kind: + map XSS/CSP/injection → runtime-critical ; ordre V1 seulement sur ## blockers (pas evidence) ; evite faux refus CODE_REVIEW_V1_1.

- **sur la toile trouve + Sources** (2026-07-25) : EXPLICIT_WEB_SEARCH_RE accepte ordre toile→trouve ; ensureExplicitWebSourceLinks append URLs ; critère € hors word-boundary.

- **Ponytail Cursor** (2026-07-25) : `.cursor/rules/ponytail.mdc` (upstream DietrichGebert/ponytail + section tokens Nexxus). Pas de `/plugin` Cursor ; YAGNI + diff minimal pour limiter sorties agent et scope outils.

- **Capability packs v1 (spec)** (2026-07-27) : design `behavior.ponytail` / `behavior.caveman` / `tool.graphify` — routing par intent, injection Plan A, pas d’activation globale. Voir `docs/agents/capability-packs-v1.md`.

- **Capability packs P0 livré** (2026-07-27) : `server/src/agent/capabilities/` + injection `structuredRequestHint` post-`justIntent` ; Ponytail actif sur code ; Caveman/Graphify match-only (tools/instruction P1/P2). Tests `capability-packs-p0.test.js`.

- **Capability packs P1a Graphify CLI** (2026-07-27) : `graph_query` / `graph_path` / `graph_explain` via CLI locale (`server/graphify-out/graph.json`), session par tour, fallback silencieux. Tests `capability-packs-p1.test.js`.

- **Capability packs P2 Caveman lite** (2026-07-27) : instruction formulation serrée si `cavemanLevel !== NORMAL` + tour technique compatible ; `detectCavemanLevel` dans pipeline ; exclusions pédagogie/code_explain/spec. Tests `capability-packs-p2.test.js`.

- **Tier 2 R1 retiré** (2026-07-26) : `deepseek-r1:8b` hors matrice warm-up, placement (`never`) et rôles agents. Reasoner runtime = **ornith:9b** (Tier 1). R1 reste installable Ollama en manuel, sans warm-up Citadelle.
