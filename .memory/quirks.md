# Project Quirks & Hacks

## UI & ANIMATIONS
- **Centering Hack**: Every orbital or spinning element MUST include `translate(-50%, -50%)` inside its CSS `@keyframes`. If not, the animation will break the absolute centering on the icons.
- **Terminal Glow**: The terminal uses specific CSS classes (`log-routing`, `log-search`) to trigger cinematic glows. Avoid adding generic log levels if they aren't mapped in `Terminal.jsx`.

## LLM & ORCHESTRATION
- **The [READY] Signal**: The forge authorization is strictly conditioned by the detection of the `[READY]` tag in the stream. If the model fails to output this tag, the "Launch Forge" success state in the UI will not trigger.
- **Thought Standard**: DeepSeek-R1 (Analyst) uses the `<think>...</think>` tags for internal reasoning. The UI is hardcoded to capture these tags for verbose terminal output.
- **8GB VRAM Context Switch**: When switching between Mistral and DeepSeek, a `keep_alive: 0` purge is performed to avoid memory allocation errors (Runtime OOM).
- **Anti-Hallucination Trigger**: The `DISCUSSION:` prefix in a query forces the agent into "Analyst Mode", disabling the creation of physical files even if the model suggests one.

## ENVIRONMENT
- **Pathing**: The system is hardcoded for **Windows paths**. Always use backslashes or handle escaping when creating new directories in the `projects/` folder.
- **Hybrid Key Mapping**: Experts in the router are indexed with division prefixes (`Elite:key` or `General:key`). Always search using the full key or ensure the router's `getExpertByKey` is maintained for dual-key lookup.

- [start-balanced-runtime-certification-instable] npm run start:balanced peut provoquer des redemarrages en cascade (backend crash + Vite reset), ce qui fausse les tests runtime UI. Pour certifier le frontend, isoler dev+server sans services annexes.

- [lazy-fallback-not-always-visible] Le fallback CHARGEMENT DU MODULE SOUVERAIN peut ne pas apparaître en test runtime si le chunk est déjà chaud; vérifier aussi la présence des marqueurs de vue.

- [vram-spike-not-backend-restart] Une montée VRAM peut déclencher purge/reload des modèles (keep_alive:0) sans redémarrage Node; valider via server_ready_at stable sur plusieurs échantillons.

- [no-php-pdo-stack-in-repo] Ce workspace ne contient pas l’app PHP/PDO mentionnee (pas de Database.php/bootstrap.php PHP). Les erreurs PDO externes doivent etre analysees sur le repo source, pas ici.

- [file-target-forme-b] « analyse le fichier X dans le dossier projects/Y/ » n’est pas un chemin explicite : sans `fileTargetResolver`, le routeur retombe sur web_html/create + document_synthesis_clarify. Toujours composer folder+filename avant classification thématique.

- [repo-analysis-vs-document] « analyse le dépôt X » / URL GitHub → `REPO_ANALYSIS` / `REPO_ANALYSIS_V1`, jamais DOCUMENT social. Paths `repo_analysis_*` doivent rester dans `SUFFICIENCY_BYPASS_PATHS` sinon le gate tombe en `multi_segment_composite`.

- [web-help-vs-ideation] « je veux faire une recherche sur internet » matchait `je veux faire` → idéation RAG. Exclure via `isExplicitWebSearchRequest` + short-circuit `web_search_help_clarify` avant G46.

- [web-help-followup-topic] Après clarify web, un sujet court (« sur la mixtrack Pro 2 ») doit reprendre le fil via history (`isWebSearchHelpClarifyPending`) → `information_seeking_full_pipeline` + `FACTUAL_RESEARCH`. Sans ça : NORMAL_CONVERSATION / DIRECT_EXPLANATION + refus « Je vois la piste… » malgré 3 sources web. Composer : interdire `INSUFFICIENT_SIGNAL_REFUSAL` si `web_consulted_at` / expert `web_research`.

- [web-help-thread-no-turn-cap] Pas de plafond de tours : tant que le fil recherche web est ouvert (`isWebSearchThreadActive`), les pivots « et sur… / et pour… » restent en pipeline web (`web_help_thread_continuation`). Seule une intention dure (code, trad, forge, salut…) casse le fil — pas un changement de sujet.

- [guided-product-no-gpu-default] `deriveGuidedProductWebSearchQuery` ne doit JAMAIS défauter à « carte graphique ». SSD/NVMe → query SSD. Sinon sources GPU + composer refuse + move `information_seeking` réécrit en rail « fiche locale » (archaïque). Comparatif produit exclu du profil move information_seeking.

- [social-chat-invite-vs-recall] « on discute un peu avant… » matchait `discut…avant` → `conversation_recall` (récap « yop yop »). Exclure les invitations sociales ; « avant » seul n’est pas une ancre mémoire. Pattern `social/chat_invite` → `social_deterministic`.

- [social-chat-topic-continuity] Après offre « on discute / sujet en tête », un mot ou groupe de mots (« musique », « les jeux video ») doit rester en fil papoter (`socialChatContinuityPolicy` → `exploratory_conversation_light` + rewrite `On discute de …`), jamais clarify livrable / recall. Cassé seulement par une demande métier dure. Phrases floues (« heu ben je pense à… ligue NXT, ça te dit ? ») aussi — sinon `request_interpreter_clarify` (« Tu parles de quel sujet ? »).

- [social-cultural-hypothesis] Fil social + terme culturel semi-spécifique (NXT, NBA, UFC…) → hypothèse medium + question fermée (« Tu parles de la WWE NXT ? Si oui, je vois. ») via `epistemicUncertaintyResolutionPolicy` (`targeted_clarify`), pas clarify routeur ni pipeline d’explication général.

- [epistemic-uncertainty-resolution] Couche au-dessus du routeur : états known/ambiguous/unknown/stale → actions respond / targeted_clarify / admit / verify. Interdit « Tu parles de quel sujet ? » si hypothèse ; interdit d’inventer.

- [social-invite-vs-recall-shell] Exclusion invite « discute…avant » seulement sur surface sociale (`on discute` / `un peu`) et jamais si shell recall (`de quoi`, `rappelle`, `on a`). Soft chat refuse info-seeking / factuel / culture générale.

- [posture-not-more-rails] Polyvalence Nexxus = PosturePolicy + DeliverableContract (`promisedValue`) + Epistemic mère + SessionMode sticky — pas « mode 3D » ni formatter fourre-tout. Spec : `docs/agents/posture-deliverable-epistemic-spec-v1.md`.

- [papoter-on-va] « ben on va papoter » ≠ `on peut/veut` seul — `CHAT_INVITE_RE` doit accepter `va|vais|allons`. Sinon SIMPLE_FAST → COMPOSER + fuite consignes (« L'utilisateur veut juste papoter… »).

- [echec-pas-debug] « ta réponse est un échec » matchait `échec` → `debug_diagnostic_clarify`. Exclure via `isAssistantResponseQualityFeedback` ; meta/repair avant debug dans short-circuit.

- [mal-etre-pas-forge] « j'ai mal au ventre… qu'est-ce que tu peux faire » → `assistant-scope` / Forge. Pattern `social/personal_discomfort` (empathie + limites, pas médecin, pas handoff).

- [symptome-pas-exploratory] Après chat_invite, « caca bleu / d'où ça peut venir » matchait soft chat → `exploratory_conversation_light` + COMPOSER (fuite consignes). Étendre `personal_discomfort` (symptômes corporels) et exclure de `isSoftSocialChatFollowup`.

- [d-ou-apres-sanitize] `normalizeFamiliarityQuery` → « d ou ca » (apostrophe → espace). Les regex `d'où` doivent accepter `d['']?\s*ou`. Sinon curiosité médicale retombe sur la variante générique.

- [whimsical-pas-web] « m'asseoir sur une branche » après mal-être → simple_fast + web + Molière. Pattern `social/whimsical_pivot` déterministe ; closers mal-être gardent le fil chat ouvert (`pas un médecin`, `changer les idées`).

- [open-prompt-propose-pas-clarify] « qu'est-ce qu'on pourrait faire aujourd'hui » → clarify livrable. Causes : regex sans `pourrait` + G46 idéation (`faire` trop large) skip social. Fix : OPEN_PROMPT + panel ; idéation exige objet ; `isKnownSocialPattern` prime sur skip idéation.

- [open-prompt-just-social] JUST ne voyait que les salutations courtes → `general/explain` + `clarify_then_build` en console même si short-circuit social. Domain SOCIAL doit inclure `isKnownSocialPattern`. Panel via `OPEN_PROMPT_EXPLORATION` (variantes manner), pas fiche figée.

- [deliverable-observe-honest] Deliverable P0.1 : ne pas dire « gate supprimée » en observe ; default ≠ `explanation` (null/unknown) ; `guided_choice` seulement après panel structurel (pas « papoter » dans un ack mal-être) ; `personal_discomfort` → `care_ack` ; `runtimeAligned=false` tant qu’aucun rail n’exécute `choice_help`.

- [open-exploration-frame-slots] « qu'est-ce qu'on pourrais/pourrait faire » n’est pas un intent lexical : frame slots (opener collectif + faire + pas d’objet). Ne pas patcher les modaux un par un. Anti-slots : projet / dépôt / recherche web. « tu veux faire quoi » reste meta_who_drives.

- [manner-preserve-newlines] `composeMannerReply` ne doit plus faire `.replace(/\s+/g, " ")` — ça aplatissait le panel open_prompt en une seule ligne (ReactMarkdown + chat). Garder les `\n` ; n’aplatir que espaces/tabs.

- [panel-list-one-chunk] Panel open_prompt tronqué mid-liste : (1) chunking SSE mid-`1)` + pacing UI forcé via `shortReplyPacingHold` sur texte long ; (2) émettre les listes structurées en **un seul** chunk (`isStructuredListReply` / garde index.js) ; (3) pacing interdit si `length > CHAR_THRESHOLD` ; (4) markdown `1.` pas `1)` ; (5) `social_deterministic` ≠ profil move datetime.

- [panel-pre-wrap-not-ol] ReactMarkdown transforme `1. item` en `<ol><li>` : à la copie/écran les numéros disparaissent et on croit à une troncature. Pour open_exploration, `ChatBento` affiche en `whitespace-pre-wrap` (payload = écran).

- [instant-6-lines-truncates-panel] Short-circuit social en `RESPONSE_MODES.INSTANT` → `enforceModeContract` faisait `.split("\n").slice(0, 6)` : coupait pile après « 4. petit livrable tech » (137 chars). Fix : skip si `isStructuredListReply` / `sectionedComposite` sur patterns sociaux.

- [guided-choice-observe-only-hallucinated] Après panel, « 4 » émettait `guided_choice` observe (`runtimeAligned=false`) sans rail → COMPOSER inventait « option UX/UI React ». Fix : `guidedChoicePolicy` mappe 1–5 → `guided_choice_deterministic`.

- [php-fonction-not-code-concept] « expliquer … fonction en php » ratait `code_concept` (`fonction` absent du token) → `technical_overview` LLM mort. Fix : token `fonction` + glossaire `php:function`.

- [file-guard-kills-doc-analysis] Analyse DOCUMENT jointe (AGENTS.md) écrasée si la réponse cite un fichier secondaire (IA-SETUP.md) → refus full-block. Fix : `isConcreteGroundedResponse` → action `softened` (livrable + note), pas remplacement.

- [attachment-task-multi] PJ ≠ seulement plan d’améliorations : `attachmentTaskPolicy` distingue doc_improve / doc_summarize / code_fix / code_refactor / code_review. Soft-guard shapes fix/refactor/résumé. Word : `.docx` ZIP+XML ; `.doc` legacy = incapacité claire.

- [guard-precedence-append-only] Soft-guard ne remplace JAMAIS une réponse concrète ancrée (`overrideLocked` / `guardMode=append_only|no_op`). Remplacement seulement si aucune source disponible. Incapacité Word déjà livrée ≠ « fichier manquant ».

- [pj-analyse-not-text-summary] « Analyse le fichier joint et propose un contenu amélioré » + `.html` matchait COMMENTARY_SHELL (`analyse`) → G38 TEXT_SUMMARY / SIMPLE_FAST avant `attachmentTask=doc_improve`. Coût : double tour + DeepSeek 400 → ornith. Fix : `shouldSuppressSummaryContractForAttachment` + path `attachment_task_full_pipeline`.

- [presentationOutline-undef-simplefast] `applySimpleFastDeliveryPipeline` utilisait `presentationOutline` hors destructuring → ReferenceError après le LLM SIMPLE_FAST. Toujours déclarer le flag dans les params.

- [llm-fallback-technical-not-semantic] Fallback ornith après HTTP 400 DeepSeek = résilience connecteur (`primary_400`), pas choix sémantique « code → ornith ». Journaliser `llm_fallback_kind=technical`.

- [audit-securite-not-react-doctor] « analyse le fichier joint pour un audit sécurité » + `.html` matchait G48 `react_audit_clarify` via le mot `audit`. React Doctor = repo React uniquement. Fix : exclude sécu/PJ non-React + `attachmentTask=security_audit` avant G48.

- [spec-minispec-not-refusal] « qu'est ce qu'une spec / mini-spec » → sanitize retire apostrophes (`qu est ce qu une`) : shell G40 ne matchait pas `qu est ce que` → SIMPLE_FAST + `allowRefusal` → « Je vois la piste… ». Fix : shell `qu est ce qu (un|une)` + glossaire dual `process:spec+mini_spec` + `allowRefusal=false` sur code_concept. Sortie : registre `simple_first` (pédagogique), pas jargon-first.

- [lexicon-science-not-cultural-recog] « connais tu le cycle de l'eau… » → `lexicon_explain_light` mais `isLightCulturalRecognitionRequest` interdisait d’expliquer + `allowRefusal` true en SIMPLE_FAST + refus LLM non filtré. Fix : sciences scolaires → `simple_first` + OPEN_PROPOSITION + fallback pédagogique + `allowRefusal=false` strip refus tous modes.

- [lexicon-schema-followup-sufficiency] Tour 2 « le détailler sous forme de schéma pédagogique » : sujet non extrait (réponse « Oui. Le… ») + anaphore + gate suffisance → `multi_segment_composite` / refus. Fix : parse pédagogique + offre « si tu veux… détailler » + schéma déterministe `lexicon_science_format_deterministic` bypass suffisance.

- [schema-detail-vs-short + takeaway] « expliquer en détail … schéma » rejouait le schéma court ; « quel résumé on peut en tirer » → G38 cultural_summary / simple_factual. Fix : `lexicon_science_format_detailed_deterministic` ; takeaway `lexicon_science_takeaway_deterministic` ; exclude `isConversationTakeawaySummaryRequest` du cultural summary.

- [tableau + trunc + plantes] Tour « sous forme de tableau » → schéma détaillé tronqué (`OPEN_PROPOSITION` 750) + cleaner `/Plan:.*/` mangeait « plantes ». Fix : format table markdown ; skip trunc si `sectionedComposite` ; `\bPlan:` dans responseThinkingCleaner.

- [gfm-tables-need-remark-gfm] ReactMarkdown sans `remark-gfm` affiche `| Étape | … |` en texte brut. Fix : `remark-gfm` dans ChatBento/App + styles table ; ne pas forcer `<pre>` si table GFM détectée.

- [pedagogical-not-flat-md] Table GFM seule = encore un « bloc compact ». Fix UI : `PedagogicalMarkdownMessage` sépare intro / table / note / takeaway / sources (toggle), pas un seul flux markdown.

- [pedagogical-table-a11y] `.table-wrap` : `tabindex=0` (scroll clavier) + `role=region` + `aria-labelledby` → `<caption>` ; en-têtes `th scope="col"` via renderer ReactMarkdown.

- [table-format-not-water-only] « cycle de la lune … tableau » → `isPedagogicalStructuredExplainRequest` true mais `buildLexiconPedagogicalSchemaReply` null → SC null → JUST/simple_fast → « Je vois la piste ». Fix : template lune + path `_llm` sous contrat si hors glossaire ; format avant fallback rapide.

- [multi-table-first-subject-only] « fait 2 tableaux : 1 - lune 2 - libellule » → un seul extractSubject (lune) → 1 tableau. Fix : `parsePedagogicalStructuredUnits` + path `_multi_deterministic` ; template cycle de vie libellule ; UI multi-blocs.

- [pedagogical-continue-vs-continuity] « continue » après lot multi-tableaux était capturé par `conversationContinuity` générique. Fix : `resolvePedagogicalScheduledExplain` **avant** continuity early.

- [workload-cardinality-drop] « fait 4 choses à faire : 1…4… » → parse ne gardait que sujets glossaire (lune+libellule) → annonce « 2 tableaux ». Fix : `WorkloadSignal` + cibles freeform (pollinisation, addition) + invariant `assertPedagogicalWorkloadCardinality` ; hybride local+LLM pour N=4.

- [parallel-after-plan-lock] Ne jamais paralléliser avant reconcile. `WorkUnitCountAndPlanPolicy` : écart déclaré/parsé → `blocked_clarify` ; parallèle seulement si `independent` + budget ≤4.

- [https-path-as-local-file] « résumer ce site : https://host/…/index.php » → regex chemin matchait `/…/index.php` (boundary après domaine) → `existing_source_analysis_clarify_access` / `INLINE_FILE_ANALYSIS_V4_1` hard-fail + GUIDED skip web. Fix : `stripHttpUrlSpans` (+ domaines nus) + WEB_SUMMARY early + guided exclus si cible web seule.

- [web-summary-no-fetch] WEB_SUMMARY partait en SIMPLE_FAST avec addon prompt seulement, sans `extractUrlContent` → résumé inventé / hors page. Fix : fetch page générique avant SIMPLE_FAST si `webSummary` / `fetchRequired` ; domaine nu normalisé en `https://`.

- [web-fetch-redirect-ssrf] Redirect axios auto + check sync seul = DNS rebinding. Fix : redirects manuels, `validateEgressUrl` chaque hop + URL finale ; `sanitizeToolOutput` extract+pipeline ; Content-Type HTML only.

- [vision-pj-meta-modalities] « décris la photo jointe » + PNG → G46 `meta_capabilities_modalities` (fiche formats) au lieu de Vision. Cause : `photo`+`peux tu` = modalities ; attachments non passés à G46. Fix : `shouldBypassMetaCapabilitiesForVision` / `isOperationalVisionDescribeQuery` ; pass `attachments` ; path `attached_vision_full_pipeline`.

- [vision-websearch-noise] VISION_ATTACHED : router alignait Expert Web Search puis `🚫 contournée`. Cause : triage `expert_task` + skip après announce. Fix : intent `vision` si PJ image ; `excludeExpertKeys` avant announce ; composer VISION_ATTACHED ancré sur `vision_briefing` (pas refus « accès restreint »).

- [vision-mllama-ollama-032] Ollama 0.32.3 + llama3.2-vision = HTTP 500 unknown model architecture mllama (~3s). Pas buffer multer manquant. Fallback OCR deepseek-ocr actif.

- [meta-modalities-info-seeking-rewrite] Follow-up vision + avis fonctionnement matchait modalities puis family information_seeking ecrasait avec prix/specs (subject_anchor_miss). Fix: exclude meta_* du move contract + runtime_progress.

- [code-review-html-order-demon] Audit sécu index.html : findings sans label Python → logic-error puis kind:runtime-critical → ordre invalide → message CODE_REVIEW_V1_1. Fix classify + scope blockers.
