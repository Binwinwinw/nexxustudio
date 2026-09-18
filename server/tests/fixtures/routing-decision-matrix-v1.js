/**
 * MATRIX-ROUTING-DECISION-V1 — artefact de conception Lot 2.
 * Siège DECIDE-TARGET-SEAT-AND-CONTRACT : Option C provisoire.
 * A = labels non autoritaires. Priorité = HYPOTHÈSE, pas un routeur.
 *
 * PAS un routeur. Interdit d'importer depuis
 * intentShortCircuit / socialPatternPolicy / justIntentDetectionPolicy.
 *
 * Cibles = labels de matrice, pas des champs frame extraits.
 */
export const MATRIX_ID = "MATRIX-ROUTING-DECISION-V1";
export const REVIEW_ID = "REVIEW-MATRIX-ROUTING-DECISION-V1";
export const SEAT_DECISION_ID = "DECIDE-TARGET-SEAT-AND-CONTRACT";
export const REVIEW_LOT3_ID = "REVIEW-LOT3-SHADOW-CONTEXT";
export const MATRIX_STATUS = "hypothesis_unadopted";
export const PRODUCT_DECISIONS_STATUS = "recorded";
export const TARGET_SEAT_STATUS = "option_c_provisional";

export const GH_SAMPLE =
  "https://github.com/Tencent-Hunyuan/Hy4-preview";

export const RTS_CANONICAL =
  'j\'ai entendu parler d\'un dépôt github dont le nom est "caveman" vas te renseigner là dessus et fait moi un résumé consistant sur son utilité et sa conception';

/**
 * Clarify interrompt une route à tout rang si les préconditions échouent.
 * Le rang 8 documente le fallback ; ce n'est pas le seul siège de clarify.
 */
export const CLARIFY_INTERRUPT = Object.freeze({
  isPrecondition: true,
  notLastCategoryOnly: true,
  rule: "clarify interrompt une route à tout niveau si acte, cible, locator compatible ou contexte actif manquent",
});

/** @type {readonly { rank: number, id: string, label: string }[]} */
export const PRIORITY_HYPOTHESIS = Object.freeze([
  { rank: 1, id: "security_or_action_constraint", label: "sécurité et contraintes d'action" },
  { rank: 2, id: "contextual_continuation", label: "continuation conversationnelle contextualisée" },
  { rank: 3, id: "specified_explicit_action", label: "action explicite suffisamment spécifiée" },
  { rank: 4, id: "assistant_directed_deterministic", label: "demande assistant-directed déterministe" },
  { rank: 5, id: "specialized_locator_compatible_act", label: "locator spécialisé avec acte compatible" },
  { rank: 6, id: "external_factual", label: "question factuelle externe" },
  { rank: 7, id: "general_explain", label: "explication générale" },
  { rank: 8, id: "clarify_or_fallback_by_precondition", label: "clarification/fallback selon préconditions" },
]);

export const FAMILIES = Object.freeze({
  A: "assistant_directed_social",
  B: "external_resource_availability",
  C: "external_factual",
  D: "repo_analysis_or_summary",
  E: "page_summary",
  F: "workspace_action",
  G: "conversational_continuation",
  H: "real_ambiguity",
});

export const COST = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  VERY_HIGH: "very_high",
  CLARIFY: "clarify",
});

/**
 * Décisions produit figées (revue Lot 2). Pas d'implémentation runtime.
 * @type {readonly { id: string, query: string, decision: string, forbidden: string }[]}
 */
export const PRODUCT_DECISIONS = Object.freeze([
  {
    id: "M3",
    query: "tu peux m'aider ?",
    decision: "assistant-directed sociale ; réponse déterministe de disponibilité ; pas une action",
    forbidden: "déclencher une action sans tâche concrète",
  },
  {
    id: "M7",
    query: "et maintenant ?",
    decision: "continuation seulement si un contexte actif fournit une tâche ou une cible compatible ; sinon clarification courte",
    forbidden: "inventer une cible",
  },
  {
    id: "M8",
    query: "crée un fichier",
    decision: "action seulement si nom, contenu et contexte sont suffisamment déterminés ; sinon clarification ; contrôles existants conservés",
    forbidden: "créer sans nom/contenu/contexte, ou contourner confirmations",
  },
  {
    id: "T9",
    query: "le dépôt est disponible ?",
    decision: "cible dépôt/ressource externe ; question d'état",
    forbidden: "social assistant ; résumé ou analyse automatique",
  },
]);

/**
 * Le pronom de 2e personne n'élit pas le rail.
 * @type {readonly { id: string, query: string, rail: string, isAction: boolean, isAnalysis: boolean }[]}
 */
export const SECOND_PERSON_POLICY = Object.freeze([
  { id: "M3", query: "tu peux m'aider ?", rail: "social_deterministic", isAction: false, isAnalysis: false },
  { id: "ACTION_ADDRESSED", query: "tu peux lancer les tests ?", rail: "action_pipeline", isAction: true, isAnalysis: false },
  { id: "REPO_ADDRESSED", query: "tu peux analyser ce dépôt ?", rail: "repo_analysis_llm", isAction: false, isAnalysis: true },
]);

/**
 * Siège cible : C provisoire. A = labels non autoritaires. B = pas maintenant.
 * @type {readonly { id: string, adopted: boolean, role: string }[]}
 */
export const TARGET_CONTRACT_OPTIONS = Object.freeze([
  {
    id: "derived_nondecisional_projection",
    adopted: false,
    role: "diagnostic_or_policy_label_only",
  },
  {
    id: "future_controlled_task_extension",
    adopted: false,
    role: "deferred",
  },
  {
    id: "outside_frame_selection_policy",
    adopted: true,
    role: "provisional_reversible_seat",
  },
]);

export const TARGET_SEAT_GUARDRAILS = Object.freeze({
  seat: "outside_frame_selection_policy",
  provisional: true,
  reversible: true,
  targetInEntities: false,
  newTaskField: false,
  secondNlu: false,
  independentTargetDetector: false,
  projectionsAuthoritative: false,
  absentSignal: "unknown",
  projectionSources: Object.freeze([
    "existing_signals",
    "existing_guards",
    "recognized_locators",
    "available_context",
    "upstream_chain_results",
  ]),
});

export const CONTEXT_STATES = Object.freeze({
  NO_CONTEXT: "NO_CONTEXT",
  ACTIVE_CONTEXT: "ACTIVE_CONTEXT",
  CONTEXT_AMBIGUOUS: "CONTEXT_AMBIGUOUS",
});

export const CONTEXT_CRITERIA = Object.freeze([
  "last_exploitable_act",
  "unambiguous_target_or_locator",
  "open_task_or_exploitable_result",
  "compatible_with_continuation",
  "no_newer_incompatible_request",
]);

/**
 * Conjunction diagnostique. Pas un frame métier.
 * false → NO_CONTEXT ; unknown sans false → CONTEXT_AMBIGUOUS ; cinq true → ACTIVE_CONTEXT.
 */
export function deriveContextState(criteria = {}) {
  const values = CONTEXT_CRITERIA.map((id) => criteria[id]);
  const isFalse = (v) => v === false || v === "false";
  const isUnknown = (v) => v === "unknown" || v == null;
  const isTrue = (v) => v === true || v === "true";
  if (values.some(isFalse)) return CONTEXT_STATES.NO_CONTEXT;
  if (values.some(isUnknown)) return CONTEXT_STATES.CONTEXT_AMBIGUOUS;
  if (values.every(isTrue)) return CONTEXT_STATES.ACTIVE_CONTEXT;
  return CONTEXT_STATES.CONTEXT_AMBIGUOUS;
}

/**
 * Contexte M7 — REVIEW-LOT3-SHADOW-CONTEXT.
 * Historique seul insuffisant. Résultat exploitable ≠ message assistant non vide.
 */
export const ACTIVE_CONTEXT_DEFINITION = Object.freeze({
  historyAloneInsufficient: true,
  requireAll: true,
  lastAssistantNonEmptyInsufficient: true,
  noMinuteWindow: true,
  criteria: CONTEXT_CRITERIA,
  states: CONTEXT_STATES,
  examples: Object.freeze([
    {
      id: "continue_same_repo_summary",
      previous: "résumé dépôt GitHub livré par repo_analysis_llm",
      query: "continue",
      state: CONTEXT_STATES.ACTIVE_CONTEXT,
      resultUsable: true,
    },
    {
      id: "append_section_named_file",
      previous: "fichier notes.md créé, pipeline create confirmé",
      query: "ajoute une section changelog",
      state: CONTEXT_STATES.ACTIVE_CONTEXT,
      resultUsable: true,
    },
    {
      id: "rerun_tests_after_result",
      previous: "tests lancés, résultat de pipeline",
      query: "relance-les",
      state: CONTEXT_STATES.ACTIVE_CONTEXT,
      resultUsable: true,
    },
    {
      id: "M7_isolated",
      previous: null,
      query: "et maintenant ?",
      state: CONTEXT_STATES.NO_CONTEXT,
      resultUsable: false,
    },
    {
      id: "social_then_continue",
      previous: "comment ça va ?",
      query: "et maintenant ?",
      state: CONTEXT_STATES.NO_CONTEXT,
      resultUsable: false,
    },
    {
      id: "history_only",
      previous: "historique long sans tâche ouverte",
      query: "continue",
      state: CONTEXT_STATES.NO_CONTEXT,
      resultUsable: false,
    },
    {
      id: "repo_then_server_state",
      previous: "résumé d'un dépôt",
      query: "le serveur est dispo ?",
      state: CONTEXT_STATES.NO_CONTEXT,
      resultUsable: false,
      newerIncompatible: true,
    },
    {
      id: "ambiguous_locator",
      previous: "deux dépôts cités, locator non unique",
      query: "fais pareil",
      state: CONTEXT_STATES.CONTEXT_AMBIGUOUS,
      resultUsable: false,
    },
    {
      id: "unknown_compatibility_after_repo",
      previous: "résumé dépôt GitHub",
      query: "et maintenant ?",
      state: CONTEXT_STATES.CONTEXT_AMBIGUOUS,
      resultUsable: false,
    },
  ]),
});

export const RESULT_USABILITY = Object.freeze({
  lastAssistantNonEmptyInsufficient: true,
  triState: Object.freeze(["true", "false", "unknown"]),
  shadowValues: Object.freeze(["exploitable", "non_exploitable", "unknown"]),
  requirements: Object.freeze([
    "identifiable_pipeline",
    "associated_act_or_task",
    "not_interrupted",
    "not_purely_social",
    "not_purely_meta",
    "compatible_with_continuation",
  ]),
  criterionKeys: Object.freeze([
    "pipeline_identifiable",
    "act_or_task_associated",
    "not_interrupted",
    "not_social",
    "not_meta",
    "continuation_compatible",
  ]),
  positives: Object.freeze([
    { id: "repo_summary", label: "résumé de dépôt", usable: true, pipeline: "repo_analysis_llm" },
    { id: "file_analysis", label: "analyse de fichier", usable: true, pipeline: "existing_source_analysis" },
    { id: "test_result", label: "résultat de tests", usable: true, pipeline: "action_pipeline" },
    { id: "confirmed_create_or_edit", label: "création ou modification confirmée", usable: true, pipeline: "named_create_or_action" },
    { id: "identified_task_result", label: "résultat d'une tâche explicitement identifiée", usable: true, pipeline: "information_seeking_full_pipeline" },
  ]),
  negatives: Object.freeze([
    { id: "greeting", label: "salutation", usable: false },
    { id: "availability_reply", label: "réponse de disponibilité", usable: false },
    { id: "clarify_only", label: "clarification seule", usable: false },
    { id: "generic_error", label: "erreur générique", usable: false },
    { id: "internal_diagnostic", label: "sortie de diagnostic interne", usable: false },
    { id: "interrupted_reply", label: "réponse interrompue", usable: false },
    { id: "no_identifiable_pipeline", label: "réponse sans pipeline identifiable", usable: false },
  ]),
  unknowns: Object.freeze([
    { id: "assistant_nonempty_without_metadata", label: "assistant non vide sans métadonnées" },
    { id: "legacy_turn_without_act", label: "ancien tour sans acte exposé" },
    { id: "task_status_absent", label: "statut de tâche absent" },
    { id: "pipeline_without_act", label: "pipeline connu mais acte associé absent" },
  ]),
});

/** Conjunction RESULT_USABILITY — `unknown` n'est jamais converti. */
export function deriveResultUsability(criteria = {}) {
  const values = RESULT_USABILITY.criterionKeys.map((key) => {
    const value = criteria[key];
    if (value === true || value === "true") return "true";
    if (value === false || value === "false") return "false";
    return "unknown";
  });
  if (values.some((value) => value === "false")) return "non_exploitable";
  if (values.some((value) => value === "unknown")) return "unknown";
  return "exploitable";
}

export const TEMPORAL_POLICY = Object.freeze({
  noMinuteWindow: true,
  order: Object.freeze([
    "existing_task_status",
    "turn_id_or_conversational_order",
    "semantic_compatibility",
    "no_newer_incompatible_task",
  ]),
  unavailable: "unknown",
});

/** Échantillons de conjunction — spec only, pas le runtime Lot 3. */
export const CONTEXT_CRITERIA_SAMPLES = Object.freeze([
  {
    id: "active_all_true",
    expected: CONTEXT_STATES.ACTIVE_CONTEXT,
    criteria: Object.freeze({
      last_exploitable_act: true,
      unambiguous_target_or_locator: true,
      open_task_or_exploitable_result: true,
      compatible_with_continuation: true,
      no_newer_incompatible_request: true,
    }),
  },
  {
    id: "no_context_isolated",
    expected: CONTEXT_STATES.NO_CONTEXT,
    criteria: Object.freeze({
      last_exploitable_act: false,
      unambiguous_target_or_locator: false,
      open_task_or_exploitable_result: false,
      compatible_with_continuation: "unknown",
      no_newer_incompatible_request: true,
    }),
  },
  {
    id: "no_context_incompatible_newer",
    expected: CONTEXT_STATES.NO_CONTEXT,
    criteria: Object.freeze({
      last_exploitable_act: true,
      unambiguous_target_or_locator: true,
      open_task_or_exploitable_result: true,
      compatible_with_continuation: false,
      no_newer_incompatible_request: false,
    }),
  },
  {
    id: "ambiguous_unknown_compatibility",
    expected: CONTEXT_STATES.CONTEXT_AMBIGUOUS,
    criteria: Object.freeze({
      last_exploitable_act: true,
      unambiguous_target_or_locator: true,
      open_task_or_exploitable_result: true,
      compatible_with_continuation: "unknown",
      no_newer_incompatible_request: true,
    }),
  },
]);

/**
 * T2 Lot 3 : observé suspect, non consommé.
 */
export const T2_FUTURE_SHADOW_RULE = Object.freeze({
  implemented: false,
  observed: true,
  consumed: false,
  shadowOnly: true,
  namedAvailabilityCheck: false,
  promoteCandidateRoute: false,
  secondPersonAloneInsufficient: true,
  covers: "assistant_directed_act",
  subjectDeferred: true,
  conditions: Object.freeze([
    "short_query",
    "second_person",
    "no_external_object",
    "costly_factual_route",
    "plausible_assistant_directed",
  ]),
  effect: "mark_factual_route_suspect",
  observedValue: "suspect",
  mustNotMatch: Object.freeze(["TU_DATETIME", "ESTCE_FACTUAL", "T9", "M2", "M4"]),
  tuDatetimeExclusionIncomplete: true,
});

/** Périmètre d'un futur Lot 3 shadow — non ouvert, non consommé. */
export const LOT3_SHADOW_SCOPE = Object.freeze({
  opened: true,
  in: Object.freeze([
    "observe_t2_suspect_factual_vs_assistant_directed",
    "project_a_labels_from_existing_guards",
    "diagnose_m7_active_context_predicate",
    "align_result_usability_shadow",
    "keep_runtime_routes_unchanged",
  ]),
  out: Object.freeze([
    "consume_matrix_in_short_circuit",
    "independent_target_detector",
    "write_task_or_entities",
    "social_availability_check_patch",
    "widen_isSimpleFactualQuestion",
    "fix_m4_est_elle",
    "promote_second_person",
    "pack_6",
    "pack_8",
    "tls",
    "github",
    "task_kind",
  ]),
});

/** Plan persist métadonnées — préparé, non ouvert, non consommé. */
export const PERSIST_ROUTING_METADATA_V1 = Object.freeze({
  opened: true,
  consumeForbidden: true,
  persistShadowFields: false,
  inferActFromAssistantText: false,
  rewriteEntities: false,
  rewriteTask: false,
  namedAvailabilityCheck: false,
  vehicle: "session_events.metadata_json",
  reconstruct: "mapEventsToConversationHistory",
  ignoreLegacyWithoutMetadata: true,
  lastAssistantOnly: true,
});

/**
 * Exclusions testables — ne pas les réduire à un mot-clé.
 * @type {readonly { id: string, rule: string }[]}
 */
export const EXCLUSIONS = Object.freeze([
  { id: "server_dispo_not_social", rule: "ressource externe (serveur) + dispo ≠ social assistant" },
  { id: "repo_available_not_analysis", rule: "dépôt disponible sans verbe d'analyse/résumé ≠ REPO_ANALYSIS" },
  { id: "page_summary_not_repo", rule: "résume cette page sans GitHub ≠ REPO_ANALYSIS" },
  { id: "keep_research_then_summarize", rule: "va te renseigner puis résume = RTS, pas REPO_ANALYSIS ni WEB_SUMMARY isolé" },
  { id: "tu_insufficient_for_social", rule: "présence de tu ≠ demande sociale" },
  { id: "dispo_insufficient_for_target", rule: "mot dispo/disponible ≠ identification de cible" },
  { id: "url_insufficient_for_act", rule: "URL seule ≠ acte" },
  { id: "est_ce_que_insufficient_for_factual", rule: "amorce est-ce que ≠ preuve de factualité" },
  { id: "social_miss_not_factual_proof", rule: "absence de pattern social ≠ preuve de factualité" },
  { id: "help_offer_not_action", rule: "tu peux m'aider ≠ action workspace" },
  { id: "state_question_not_analysis_or_action", rule: "dépôt disponible = état, pas analyse ni action" },
  { id: "second_person_insufficient_for_rail", rule: "pronom 2e personne n'élit pas le rail" },
]);

/**
 * @typedef {object} MatrixRow
 * @property {string} id
 * @property {string} query
 * @property {string} family
 * @property {string} act
 * @property {string} target
 * @property {string|null} locator
 * @property {string|null} externalObject
 * @property {"low"|"medium"|"high"} ambiguity
 * @property {string} candidateRoute
 * @property {number} priority
 * @property {string[]} exclusions
 * @property {string} expectedDecision
 * @property {boolean} clarify
 * @property {string} maxCost
 * @property {string|null} currentObserved
 * @property {boolean} gap
 * @property {boolean} [productRecorded]
 * @property {boolean} [isAction]
 * @property {boolean} [inventTarget]
 * @property {boolean} [continuationRequiresActiveContext]
 * @property {string[]} [actionPreconditions]
 * @property {boolean} [keepExistingControls]
 * @property {"state"|"analysis"|"action"|null} [resourceKind]
 */

/** @type {readonly MatrixRow[]} */
export const DECISION_ROWS = Object.freeze([
  {
    id: "M1",
    query: "tu es dispo ?",
    family: FAMILIES.A,
    act: "assistant_availability_check",
    target: "assistant",
    locator: null,
    externalObject: null,
    ambiguity: "low",
    candidateRoute: "social_deterministic",
    priority: 4,
    exclusions: ["simple_factual_lookup", "ollama_unjustified", "est_ce_que_insufficient_for_factual", "social_miss_not_factual_proof"],
    expectedDecision: "social_deterministic",
    clarify: false,
    maxCost: COST.LOW,
    currentObserved: null,
    gap: true,
  },
  {
    id: "T2",
    query: "est ce que tu es dispo maintenant ?",
    family: FAMILIES.A,
    act: "assistant_availability_check",
    target: "assistant",
    locator: null,
    externalObject: null,
    ambiguity: "low",
    candidateRoute: "social_deterministic",
    priority: 4,
    exclusions: ["simple_factual_lookup", "ollama_unjustified", "est_ce_que_insufficient_for_factual", "social_miss_not_factual_proof", "dispo_insufficient_for_target"],
    expectedDecision: "social_deterministic",
    clarify: false,
    maxCost: COST.LOW,
    currentObserved: "simple_factual_lookup",
    gap: true,
  },
  {
    id: "T1",
    query: "salut comment cava aujourd'hui?",
    family: FAMILIES.A,
    act: "wellbeing_checkin",
    target: "assistant",
    locator: null,
    externalObject: null,
    ambiguity: "low",
    candidateRoute: "social_deterministic",
    priority: 4,
    exclusions: ["simple_factual_lookup"],
    expectedDecision: "social_deterministic",
    clarify: false,
    maxCost: COST.LOW,
    currentObserved: "social_deterministic",
    gap: false,
  },
  {
    id: "M2",
    query: "le serveur est dispo ?",
    family: FAMILIES.B,
    act: "resource_availability",
    target: "server",
    locator: null,
    externalObject: "server",
    ambiguity: "low",
    candidateRoute: "factual_or_tool_resource",
    priority: 6,
    exclusions: ["social_deterministic", "server_dispo_not_social", "dispo_insufficient_for_target"],
    expectedDecision: "factual_or_tool_resource",
    clarify: false,
    maxCost: COST.MEDIUM,
    currentObserved: null,
    gap: true,
    resourceKind: "state",
  },
  {
    id: "M3",
    query: "tu peux m'aider ?",
    family: FAMILIES.A,
    act: "assistant_help_offer",
    target: "assistant",
    locator: null,
    externalObject: null,
    ambiguity: "low",
    candidateRoute: "social_deterministic",
    priority: 4,
    exclusions: ["simple_factual_lookup", "ollama_unjustified", "help_offer_not_action", "second_person_insufficient_for_rail"],
    expectedDecision: "social_deterministic",
    clarify: false,
    maxCost: COST.LOW,
    currentObserved: null,
    gap: true,
    productRecorded: true,
    isAction: false,
  },
  {
    id: "M4",
    query: "Paris est-elle la capitale de la France ?",
    family: FAMILIES.C,
    act: "world_fact_question",
    target: "world",
    locator: null,
    externalObject: "world",
    ambiguity: "low",
    candidateRoute: "simple_factual_lookup",
    priority: 6,
    exclusions: ["social_deterministic", "est_ce_que_insufficient_for_factual"],
    expectedDecision: "simple_factual_lookup",
    clarify: false,
    maxCost: COST.LOW,
    currentObserved: null,
    gap: true,
  },
  {
    id: "M5",
    query: `résume ce dépôt ${GH_SAMPLE}`,
    family: FAMILIES.D,
    act: "repo_summary",
    target: "repository",
    locator: "github_repo_root",
    externalObject: "repository",
    ambiguity: "low",
    candidateRoute: "repo_analysis_llm",
    priority: 5,
    exclusions: ["document_synthesis_llm", "WEB_SUMMARY"],
    expectedDecision: "repo_analysis_llm",
    clarify: false,
    maxCost: COST.HIGH,
    currentObserved: "repo_analysis_llm",
    gap: false,
    resourceKind: "analysis",
  },
  {
    id: "M6",
    query: "résume cette page https://example.com",
    family: FAMILIES.E,
    act: "page_summary",
    target: "page",
    locator: "web_url",
    externalObject: "page",
    ambiguity: "low",
    candidateRoute: "document_synthesis_llm",
    priority: 5,
    exclusions: ["REPO_ANALYSIS", "page_summary_not_repo"],
    expectedDecision: "document_synthesis_llm",
    clarify: false,
    maxCost: COST.HIGH,
    currentObserved: "document_synthesis_llm",
    gap: false,
  },
  {
    id: "M7",
    query: "et maintenant ?",
    family: FAMILIES.G,
    act: "continuation",
    target: "context",
    locator: null,
    externalObject: null,
    ambiguity: "high",
    candidateRoute: "continuation_if_active_context_else_clarify",
    priority: 2,
    exclusions: ["simple_factual_lookup", "ollama_unjustified"],
    expectedDecision: "clarify",
    clarify: true,
    maxCost: COST.CLARIFY,
    currentObserved: null,
    gap: true,
    productRecorded: true,
    inventTarget: false,
    continuationRequiresActiveContext: true,
  },
  {
    id: "M8",
    query: "crée un fichier",
    family: FAMILIES.F,
    act: "workspace_create",
    target: "workspace",
    locator: null,
    externalObject: null,
    ambiguity: "high",
    candidateRoute: "named_create_if_specified_else_clarify",
    priority: 3,
    exclusions: ["social_deterministic"],
    expectedDecision: "clarify",
    clarify: true,
    maxCost: COST.CLARIFY,
    currentObserved: null,
    gap: true,
    productRecorded: true,
    isAction: false,
    actionPreconditions: ["name", "content", "context"],
    keepExistingControls: true,
  },
  {
    id: "M9",
    query: "c'est disponible ?",
    family: FAMILIES.H,
    act: "undetermined",
    target: "unknown",
    locator: null,
    externalObject: null,
    ambiguity: "high",
    candidateRoute: "clarify",
    priority: 8,
    exclusions: ["social_deterministic", "simple_factual_lookup", "dispo_insufficient_for_target", "ollama_unjustified"],
    expectedDecision: "clarify",
    clarify: true,
    maxCost: COST.CLARIFY,
    currentObserved: null,
    gap: true,
  },
  {
    id: "T9",
    query: `est-ce que le dépôt est disponible ? ${GH_SAMPLE}`,
    family: FAMILIES.B,
    act: "resource_availability",
    target: "repository",
    locator: "github_repo_root",
    externalObject: "repository",
    ambiguity: "low",
    candidateRoute: "factual_or_tool_resource",
    priority: 5,
    exclusions: [
      "social_deterministic",
      "REPO_ANALYSIS",
      "repo_available_not_analysis",
      "est_ce_que_insufficient_for_factual",
      "state_question_not_analysis_or_action",
    ],
    expectedDecision: "factual_or_tool_resource",
    clarify: false,
    maxCost: COST.MEDIUM,
    currentObserved: null,
    gap: true,
    productRecorded: true,
    resourceKind: "state",
    isAction: false,
  },
  {
    id: "T10",
    query: `bonjour, résumer ce dépôt ${GH_SAMPLE}`,
    family: FAMILIES.D,
    act: "repo_summary",
    target: "repository",
    locator: "github_repo_root",
    externalObject: "repository",
    ambiguity: "low",
    candidateRoute: "repo_analysis_llm",
    priority: 5,
    exclusions: ["WEB_SUMMARY", "social_deterministic"],
    expectedDecision: "repo_analysis_llm",
    clarify: false,
    maxCost: COST.HIGH,
    currentObserved: "repo_analysis_llm",
    gap: false,
    resourceKind: "analysis",
  },
  {
    id: "RTS",
    query: RTS_CANONICAL,
    family: FAMILIES.C,
    act: "research_then_summarize",
    target: "named_repo_topic",
    locator: null,
    externalObject: "github_named",
    ambiguity: "low",
    candidateRoute: "information_seeking_full_pipeline",
    priority: 6,
    exclusions: ["REPO_ANALYSIS", "keep_research_then_summarize", "WEB_SUMMARY"],
    expectedDecision: "information_seeking_full_pipeline",
    clarify: false,
    maxCost: COST.HIGH,
    currentObserved: "information_seeking_full_pipeline",
    gap: false,
  },
  {
    id: "TU_DATETIME",
    query: "pourrais tu trouver quel jour était le 19 juin 1980 ???",
    family: FAMILIES.C,
    act: "historical_date_fact",
    target: "world",
    locator: null,
    externalObject: "world",
    ambiguity: "low",
    candidateRoute: "simple_factual_lookup",
    priority: 6,
    exclusions: ["social_deterministic", "tu_insufficient_for_social", "second_person_insufficient_for_rail"],
    expectedDecision: "simple_factual_lookup",
    clarify: false,
    maxCost: COST.LOW,
    currentObserved: "simple_factual_lookup",
    gap: false,
  },
  {
    id: "ESTCE_FACTUAL",
    query: "est-ce que Paris est la capitale de la France ?",
    family: FAMILIES.C,
    act: "world_fact_question",
    target: "world",
    locator: null,
    externalObject: "world",
    ambiguity: "low",
    candidateRoute: "simple_factual_lookup",
    priority: 6,
    exclusions: ["social_deterministic", "est_ce_que_insufficient_for_factual"],
    expectedDecision: "simple_factual_lookup",
    clarify: false,
    maxCost: COST.LOW,
    currentObserved: "simple_factual_lookup",
    gap: false,
  },
  {
    id: "ACTION_EXPLICIT",
    query: "lance les tests",
    family: FAMILIES.F,
    act: "workspace_run_tests",
    target: "workspace",
    locator: null,
    externalObject: null,
    ambiguity: "low",
    candidateRoute: "action_pipeline",
    priority: 3,
    exclusions: ["social_deterministic"],
    expectedDecision: "action_pipeline",
    clarify: false,
    maxCost: COST.MEDIUM,
    currentObserved: null,
    gap: true,
    isAction: true,
  },
  {
    id: "ACTION_ADDRESSED",
    query: "tu peux lancer les tests ?",
    family: FAMILIES.F,
    act: "workspace_run_tests",
    target: "workspace",
    locator: null,
    externalObject: null,
    ambiguity: "low",
    candidateRoute: "action_pipeline",
    priority: 3,
    exclusions: ["social_deterministic", "second_person_insufficient_for_rail", "help_offer_not_action"],
    expectedDecision: "action_pipeline",
    clarify: false,
    maxCost: COST.MEDIUM,
    currentObserved: null,
    gap: true,
    isAction: true,
  },
  {
    id: "REPO_ADDRESSED",
    query: `tu peux analyser ce dépôt ? ${GH_SAMPLE}`,
    family: FAMILIES.D,
    act: "repo_analysis",
    target: "repository",
    locator: "github_repo_root",
    externalObject: "repository",
    ambiguity: "low",
    candidateRoute: "repo_analysis_llm",
    priority: 5,
    exclusions: ["social_deterministic", "second_person_insufficient_for_rail", "WEB_SUMMARY"],
    expectedDecision: "repo_analysis_llm",
    clarify: false,
    maxCost: COST.HIGH,
    currentObserved: "repo_analysis_llm",
    gap: false,
    isAction: false,
    resourceKind: "analysis",
  },
  {
    id: "LA",
    query: "tu es là ?",
    family: FAMILIES.A,
    act: "assistant_presence_check",
    target: "assistant",
    locator: null,
    externalObject: null,
    ambiguity: "low",
    candidateRoute: "social_deterministic",
    priority: 4,
    exclusions: ["simple_factual_lookup", "ollama_unjustified"],
    expectedDecision: "social_deterministic",
    clarify: false,
    maxCost: COST.LOW,
    currentObserved: null,
    gap: true,
  },
]);

export const CONFLICTS = Object.freeze([
  {
    id: "assistant_vs_workspace",
    cases: ["M3", "ACTION_EXPLICIT", "ACTION_ADDRESSED"],
    issue: "aide adressée à l'assistant vs action workspace explicite",
    resolved: true,
    resolution: "tu peux m'aider = social pas action ; tu peux lancer les tests = action workspace",
  },
  {
    id: "assistant_vs_external_resource",
    cases: ["T2", "T9", "M2"],
    issue: "disponible + 2e personne vs ressource nommée / locator",
    resolved: true,
    resolution: "T9/M2 = ressource externe état ; T2 = assistant ; tu n'élit pas le rail",
  },
  {
    id: "github_locator_vs_general",
    cases: ["T9", "M5", "T10", "REPO_ADDRESSED"],
    issue: "URL GitHub sans verbe d'analyse ≠ REPO ; avec résumé/analyse = REPO",
    resolved: true,
    resolution: "T9 état ≠ analyse ≠ action ; M5/T10/REPO_ADDRESSED = analyse",
  },
  {
    id: "continuation_vs_new_request",
    cases: ["M7"],
    issue: "suivi elliptique exige un contexte actif ; sinon clarification, pas un rail inventé",
    resolved: true,
    resolution: "continuation seulement si contexte actif compatible ; sinon clarify ; pas d'invention de cible",
  },
  {
    id: "factual_without_source",
    cases: ["M4", "ESTCE_FACTUAL"],
    issue: "fait monde sans URL : factual déterministe possible, pas Ollama 24s par défaut",
    resolved: false,
  },
  {
    id: "ambiguity_vs_deterministic",
    cases: ["M9"],
    issue: "cible inconnue : clarify, pas social ni factual",
    resolved: true,
    resolution: "H = clarify ; dispo seul n'identifie pas la cible",
  },
  {
    id: "tu_shadow_noise",
    cases: ["TU_DATETIME"],
    issue: "token tu sur factual/datetime ne doit pas proposer social (bruit Lot 1)",
    resolved: false,
  },
]);

export function rowById(id) {
  return DECISION_ROWS.find((r) => r.id === id) || null;
}
