import { normalizeQueryText } from "../../utils/normalizationUtils.js";

export const RESPONSE_MODES = Object.freeze({
  CONVERSATION: "conversation",
  AUDIT: "audit",
  DEBUG: "debug",
  EXPLAIN: "explain",
});

export const TRUTH_POLICY = Object.freeze({
  noFabrication: true,
  groundedFirst: true,
  clarifyOnlyWhenNecessary: true,
  noRawChainOfThought: true,
  leastPrivilegeOutput: true,
  separateObservedVsInferredInternally: true,
  leadWithAnswer: true,
  noScaffoldLeakage: true,
});

export const STYLE_CONTRACTS = Object.freeze({
  [RESPONSE_MODES.CONVERSATION]: {
    tone: "natural",
    verbosity: "short",
    structure: "plain_answer",
    exposeReasoning: false,
    allowBullets: true,
    maxBullets: 5,
    allowSections: false,
    allowInternalLabels: false,
    preferDirectAnswer: true,
    clarificationStyle: "single_short_question_only_if_blocked",
  },

  [RESPONSE_MODES.AUDIT]: {
    tone: "professional",
    verbosity: "medium",
    structure: "findings_risks_actions",
    exposeReasoning: "summarized_only",
    allowBullets: true,
    maxBullets: 8,
    allowSections: true,
    allowInternalLabels: false,
    preferDirectAnswer: true,
    clarificationStyle: "single_targeted_question_if_evidence_missing",
  },

  [RESPONSE_MODES.DEBUG]: {
    tone: "technical_direct",
    verbosity: "medium",
    structure: "symptom_cause_checks_fix",
    exposeReasoning: "condensed",
    allowBullets: true,
    maxBullets: 10,
    allowSections: true,
    allowInternalLabels: false,
    preferDirectAnswer: true,
    clarificationStyle: "ask_only_for_missing_blocking_artifact",
  },

  [RESPONSE_MODES.EXPLAIN]: {
    tone: "pedagogical",
    verbosity: "adaptive",
    structure: "answer_then_breakdown",
    exposeReasoning: "teaching_only",
    allowBullets: true,
    maxBullets: 8,
    allowSections: true,
    allowInternalLabels: false,
    preferDirectAnswer: true,
    clarificationStyle: "ask_if_learning_goal_changes_depth",
  },
});

export const MODE_PRIORITY = Object.freeze([
  RESPONSE_MODES.DEBUG,
  RESPONSE_MODES.AUDIT,
  RESPONSE_MODES.EXPLAIN,
  RESPONSE_MODES.CONVERSATION,
]);

export const MODE_TRIGGERS = Object.freeze({
  [RESPONSE_MODES.DEBUG]: {
    intents: ["bug_report", "runtime_error", "broken_behavior", "non_regression_failure", "incident", "stacktrace_analysis", "startup_failure"],
    actions: ["debug", "fix", "investigate", "troubleshoot", "root_cause_analysis"],
    lexicalHints: ["bug", "erreur", "ça plante", "plantage", "stacktrace", "exception", "logs", "cassé", "broken", "not working", "ko", "startup", "démarrage"],
    contextSignals: { hasLogs: true, hasError: true, hasStacktrace: true },
  },

  [RESPONSE_MODES.AUDIT]: {
    intents: ["audit", "review", "assessment", "comparative_analysis", "postmortem", "risk_review", "architecture_review"],
    actions: ["analyze", "review", "audit", "compare", "assess", "evaluate"],
    lexicalHints: ["analyse", "audit", "review", "comparatif", "avant/après", "évalue", "risques", "constat", "bilan", "postmortem"],
    contextSignals: { hasLogs: false, hasError: false, hasArtifacts: true },
  },

  [RESPONSE_MODES.EXPLAIN]: {
    intents: ["explain", "teaching", "how_it_works", "why_question", "conceptual_help", "comparison_for_understanding"],
    actions: ["explain", "teach", "clarify", "simplify", "compare_for_understanding"],
    lexicalHints: ["explique", "pourquoi", "comment ça marche", "c'est quoi", "what is", "how does", "difference between", "différence", "vulgarise"],
    contextSignals: {},
  },

  [RESPONSE_MODES.CONVERSATION]: {
    intents: ["social", "small_talk", "general_question", "light_meta", "greeting_plus_simple_question"],
    actions: ["answer", "chat", "respond", "continue"],
    lexicalHints: ["salut", "bonjour", "yo", "yop", "ça va", "tu fais quoi", "tu t'appelles comment"],
    contextSignals: {},
  },
});

// La fonction normalizeText a été extraite vers normalizeQueryText dans normalizationUtils.js dans le cadre du Lot A.

export function resolveResponseMode(input = {}) {
  const {
    dominantIntent = null,
    secondaryIntents = [],
    requestedAction = null,
    userText = "",
    hasLogs = false,
    hasError = false,
    hasStacktrace = false,
    hasArtifacts = false,
    explicitMode = null,
    userWantsTechnicalDetail = false,
    userWantsPedagogy = false,
  } = input;

  if (explicitMode && STYLE_CONTRACTS[explicitMode]) return explicitMode;

  const normalizedText = normalizeQueryText(userText);
  const candidates = MODE_PRIORITY.map((mode) => {
    const trigger = MODE_TRIGGERS[mode];
    let score = 0;

    if (dominantIntent && trigger.intents.includes(dominantIntent)) score += 100;
    for (const intent of secondaryIntents) if (trigger.intents.includes(intent)) score += 20;
    if (requestedAction && trigger.actions.includes(requestedAction)) score += 60;
    for (const hint of trigger.lexicalHints) if (normalizedText.includes(normalizeQueryText(hint))) score += 8;

    if (trigger.contextSignals.hasLogs && hasLogs) score += 40;
    if (trigger.contextSignals.hasError && hasError) score += 40;
    if (trigger.contextSignals.hasStacktrace && hasStacktrace) score += 50;
    if (trigger.contextSignals.hasArtifacts && hasArtifacts) score += 20;

    if (mode === RESPONSE_MODES.EXPLAIN && userWantsPedagogy) score += 25;
    if ((mode === RESPONSE_MODES.AUDIT || mode === RESPONSE_MODES.DEBUG) && userWantsTechnicalDetail) score += 20;

    return { mode, score };
  });

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  const second = candidates[1];

  if (!top || top.score <= 0) return RESPONSE_MODES.CONVERSATION;
  if (second && top.score - second.score < 15) {
    return tieBreakModes({ topMode: top.mode, secondMode: second.mode, hasLogs, hasError, hasStacktrace, requestedAction, dominantIntent });
  }

  return top.mode;
}

function tieBreakModes(input = {}) {
  const { topMode, secondMode, hasLogs, hasError, hasStacktrace, requestedAction, dominantIntent } = input;
  if (hasStacktrace || hasError) return RESPONSE_MODES.DEBUG;
  if (requestedAction === "audit" || dominantIntent === "audit") return RESPONSE_MODES.AUDIT;
  if (requestedAction === "explain" || dominantIntent === "explain") return RESPONSE_MODES.EXPLAIN;
  if (topMode === RESPONSE_MODES.CONVERSATION && secondMode) return secondMode;
  return topMode || RESPONSE_MODES.CONVERSATION;
}

export function resolveFallbackMode(input = {}) {
  const { classificationConfidence = 1, hasBlockingMissingInput = false, hasCriticalError = false } = input;
  if (hasCriticalError) return RESPONSE_MODES.DEBUG;
  if (classificationConfidence < 0.45) return RESPONSE_MODES.CONVERSATION;
  if (hasBlockingMissingInput) return RESPONSE_MODES.CONVERSATION;
  return null;
}

export const ESCAPE_HATCHES = Object.freeze({
  maxClarifyingQuestions: 1,
  fallbackConfidenceThreshold: 0.45,
  lowConfidenceBehavior: "answer_minimally_then_clarify_if_needed",
  blockedTaskBehavior: "state_missing_piece_and_ask_one_targeted_question",
  criticalFailureBehavior: "switch_to_debug_mode",
  repeatedConfusionBehavior: "simplify_and_offer_explicit_options",
});

export function getResponseStyleContext(input = {}) {
  const mode = resolveResponseMode(input);
  const fallbackMode = resolveFallbackMode(input);
  const finalMode = fallbackMode || mode;

  return {
    mode: finalMode,
    truthPolicy: TRUTH_POLICY,
    style: STYLE_CONTRACTS[finalMode],
    escapeHatches: ESCAPE_HATCHES,
  };
}

export function buildOutputContract(input = {}) {
  const ctx = getResponseStyleContext(input);

  return {
    mode: ctx.mode,
    truthPolicy: ctx.truthPolicy,
    styleContract: ctx.style,
    escapeHatches: ctx.escapeHatches,
    instructions: buildModeInstructions(ctx),
  };
}

function buildModeInstructions(ctx) {
  const shared = [
    "Do not fabricate facts, files, logs, states, or results.",
    "Lead with the useful answer.",
    "Do not expose raw chain-of-thought or internal routing.",
    "Ask at most one clarifying question, only if required to proceed correctly.",
  ];

  const byMode = {
    conversation: [
      "Use natural, fluid phrasing.",
      "Do not use technical labels or scaffolding.",
      "Keep the response brief unless the user asks for more.",
    ],
    audit: [
      "Use clear sections when helpful.",
      "Present findings, risks, and actions.",
      "Summarize reasoning without exposing internal deliberation.",
    ],
    debug: [
      "Start from symptom, then probable cause, checks, and likely fix.",
      "Be explicit about uncertainty.",
      "Prefer actionable troubleshooting steps over theory.",
    ],
    explain: [
      "Answer directly first, then explain.",
      "Use teaching language and short examples if useful.",
      "Optimize for understanding, not exhaustiveness.",
    ],
  };

  return [...shared, ...(byMode[ctx.mode] || [])];
}

// Wrapper for existing architecture (replaces legacy buildStyleModule)
export function buildStyleModule(modeOverrideOrInput = {}) {
  let input = modeOverrideOrInput;
  if (typeof modeOverrideOrInput === 'string') {
    // Map legacy modes to new modes if possible
    let explicitMode = RESPONSE_MODES.CONVERSATION;
    if (modeOverrideOrInput === 'AUDIT') explicitMode = RESPONSE_MODES.AUDIT;
    if (modeOverrideOrInput === 'EXECUTION' || modeOverrideOrInput === 'DEBUG') explicitMode = RESPONSE_MODES.DEBUG;
    if (modeOverrideOrInput === 'ADVICE' || modeOverrideOrInput === 'IDEATION') explicitMode = RESPONSE_MODES.EXPLAIN;
    input = { explicitMode };
  }

  const contract = buildOutputContract(input);

  return `
[POLICY: RESPONSE_STYLE v2.0 - MODE: ${contract.mode.toUpperCase()}]
- TONE: ${contract.styleContract.tone}
- VERBOSITY: ${contract.styleContract.verbosity}
- STRUCTURE: ${contract.styleContract.structure}
- EXPOSE REASONING: ${contract.styleContract.exposeReasoning}

INSTRUCTIONS SPECIFIQUES :
${contract.instructions.map(i => "- " + i).join('\\n')}

RÈGLES TRANSVERSES :
1. RÉPONDRE EN FRANÇAIS.
2. ÉVITER LES LISTES SI UN PARAGRAPHE EST PLUS CLAIR.
3. AUCUNE AFFIRMATION SANS PREUVE INTERNE.
`.trim();
}

export default buildStyleModule;
