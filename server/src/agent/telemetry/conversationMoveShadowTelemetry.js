/**
 * P2 shadow — Conversation Move vs routage legacy (lecture seule, sans pilotage).
 * Spec : docs/agents/conversation-move-governance.md
 */
import {
  evaluateConversationMove,
  shouldRunClarificationGate,
  CONVERSATION_MOVE_CONTRACT,
} from "../policies/conversation/conversationMovePolicy.js";
import { isInsufficientSignalRefusal } from "../config/modeResponseContracts.js";
import {
  isHowToProceduralSocialDrift,
  isHowToProceduralTopicViolation,
} from "../policies/qualification/howToQualificationPolicy.js";
import { isDebugDiagnosticOverRefusal } from "../micro/replies/debugDiagnosticComposer.js";
import { isSimpleFactualContractViolation } from "../micro/replies/simpleFactualComposer.js";
import {
  detectMoveContractViolations,
  MOVE_CONTRACT_PROFILES,
} from "../policies/conversation/conversationMoveContractVerification.js";
import { resolveMultiSegmentPlan } from "../micro/parsing/multiSegmentResponsePlan.js";
import { assessInformationSeekingSubjectAlignment } from "../policies/routing/informationSeekingQualificationPolicy.js";

export const CONVERSATION_MOVE_SHADOW_EVENT = "conversation_move_shadow";
export const CONVERSATION_MOVE_SHADOW_MODE = "observe_only";

/** Profils P3 stabilisés — gel documentaire quand violation_rate < 0.1 sur n ≥ 10. */
export const FROZEN_MOVE_CONTRACT_PROFILES = Object.freeze([
  MOVE_CONTRACT_PROFILES.HOW_TO_PROCEDURAL,
  MOVE_CONTRACT_PROFILES.SIMPLE_FACTUAL,
  MOVE_CONTRACT_PROFILES.DATETIME_DETERMINISTIC,
]);

/** P3 observation — pseudo-clarification sur path procédural direct. */
const HOW_TO_PSEUDO_CLARIFY_RE =
  /\b(?:je vois la piste|pas encore la destination|pas encore l['']objectif|donne[- ]moi l['']objectif|pr[ée]cise(?:\s+ton|\s+ta|\s+le|\s+la)?\s+(?:besoin|objectif|demande)|quel(?:le)?\s+format|il faudrait que tu arrives|pour avancer sur|en une phrase|tu veux quel angle|pr[ée]ciser ton)\b/i;

/** P3 observation — over-refusal sur simple_factual_lookup. */
const SIMPLE_FACT_OVER_REFUSAL_RE =
  /\b(?:je n['']?ai pas pu finaliser|reessaie ou precise|réessaie ou précise|precise l['']?angle|précise l['']?angle|geographie, histoire, contexte|géographie, histoire, contexte|objectif en une phrase|pas encore la destination)\b/i;

/** @type {{ total: number, violations: number, byDomain: Record<string, { total: number, violations: number }> }} */
const howToProceduralShadowStats = {
  total: 0,
  violations: 0,
  byDomain: {},
};

/** P3 observation — over-refusal sur debug_diagnostic. */
const DEBUG_DIAGNOSTIC_OVER_REFUSAL_RE =
  /\b(?:je n['']?ai pas pu finaliser|reessaie ou precise|réessaie ou précise|objectif en une phrase|pas encore la destination|precise l['']?angle|précise l['']?angle|geographie, histoire|géographie, histoire|c est quoi|qu est[- ]ce qu|aperçu conceptuel|apercu conceptuel)\b/i;

/** @type {{ total: number, violations: number, byDomain: Record<string, { total: number, violations: number }> }} */
const debugDiagnosticShadowStats = {
  total: 0,
  violations: 0,
  byDomain: {},
};

/** @type {{ total: number, violations: number, byDomain: Record<string, { total: number, violations: number }> }} */
const simpleFactualShadowStats = {
  total: 0,
  violations: 0,
  byDomain: {},
};

/** @type {{ total: number, violations: number, byDomain: Record<string, { total: number, violations: number }> }} */
const informationSeekingShadowStats = {
  total: 0,
  violations: 0,
  byDomain: {},
};

/** @type {{ total: number, violations: number, byDomain: Record<string, { total: number, violations: number }> }} */
const multiSegmentShadowStats = {
  total: 0,
  violations: 0,
  byDomain: {},
};

function bumpDomainStat(domain = "unknown", violated = false) {
  const key = domain || "unknown";
  if (!howToProceduralShadowStats.byDomain[key]) {
    howToProceduralShadowStats.byDomain[key] = { total: 0, violations: 0 };
  }
  howToProceduralShadowStats.byDomain[key].total += 1;
  if (violated) {
    howToProceduralShadowStats.byDomain[key].violations += 1;
  }
}

function bumpSimpleFactualDomainStat(domain = "unknown", violated = false) {
  const key = domain || "unknown";
  if (!simpleFactualShadowStats.byDomain[key]) {
    simpleFactualShadowStats.byDomain[key] = { total: 0, violations: 0 };
  }
  simpleFactualShadowStats.byDomain[key].total += 1;
  if (violated) {
    simpleFactualShadowStats.byDomain[key].violations += 1;
  }
}

function bumpDebugDiagnosticDomainStat(domain = "unknown", violated = false) {
  const key = domain || "unknown";
  if (!debugDiagnosticShadowStats.byDomain[key]) {
    debugDiagnosticShadowStats.byDomain[key] = { total: 0, violations: 0 };
  }
  debugDiagnosticShadowStats.byDomain[key].total += 1;
  if (violated) {
    debugDiagnosticShadowStats.byDomain[key].violations += 1;
  }
}

function bumpInformationSeekingDomainStat(domain = "unknown", violated = false) {
  const key = domain || "unknown";
  if (!informationSeekingShadowStats.byDomain[key]) {
    informationSeekingShadowStats.byDomain[key] = { total: 0, violations: 0 };
  }
  informationSeekingShadowStats.byDomain[key].total += 1;
  if (violated) {
    informationSeekingShadowStats.byDomain[key].violations += 1;
  }
}

function bumpMultiSegmentDomainStat(domain = "unknown", violated = false) {
  const key = domain || "unknown";
  if (!multiSegmentShadowStats.byDomain[key]) {
    multiSegmentShadowStats.byDomain[key] = { total: 0, violations: 0 };
  }
  multiSegmentShadowStats.byDomain[key].total += 1;
  if (violated) {
    multiSegmentShadowStats.byDomain[key].violations += 1;
  }
}

/**
 * @param {string} profile
 * @param {{ total?: number, violations?: number }} stats
 */
export function isMoveContractProfileFrozen(profile = "", stats = {}) {
  if (!FROZEN_MOVE_CONTRACT_PROFILES.includes(profile)) return false;
  const total = stats.total ?? 0;
  const violations = stats.violations ?? 0;
  if (total < 10) return false;
  return violations / total < 0.1;
}

/**
 * @returns {{ total: number, violations: number, violation_rate: number|null, by_domain: Record<string, { total: number, violations: number, violation_rate: number|null }> }}
 */
export function getHowToProceduralShadowStats() {
  const byDomain = {};
  for (const [domain, bucket] of Object.entries(howToProceduralShadowStats.byDomain)) {
    byDomain[domain] = {
      ...bucket,
      violation_rate:
        bucket.total > 0 ? Number((bucket.violations / bucket.total).toFixed(4)) : null,
    };
  }
  return {
    total: howToProceduralShadowStats.total,
    violations: howToProceduralShadowStats.violations,
    violation_rate:
      howToProceduralShadowStats.total > 0
        ? Number(
            (
              howToProceduralShadowStats.violations /
              howToProceduralShadowStats.total
            ).toFixed(4),
          )
        : null,
    by_domain: byDomain,
  };
}

/** @param {{ total?: number, violations?: number, byDomain?: Record<string, { total: number, violations: number }> }} snapshot */
export function resetHowToProceduralShadowStats(snapshot = null) {
  howToProceduralShadowStats.total = snapshot?.total ?? 0;
  howToProceduralShadowStats.violations = snapshot?.violations ?? 0;
  howToProceduralShadowStats.byDomain = snapshot?.byDomain
    ? { ...snapshot.byDomain }
    : {};
}

/**
 * @returns {{ total: number, violations: number, violation_rate: number|null, by_domain: Record<string, { total: number, violations: number, violation_rate: number|null }> }}
 */
export function getSimpleFactualShadowStats() {
  const byDomain = {};
  for (const [domain, bucket] of Object.entries(simpleFactualShadowStats.byDomain)) {
    byDomain[domain] = {
      ...bucket,
      violation_rate:
        bucket.total > 0 ? Number((bucket.violations / bucket.total).toFixed(4)) : null,
    };
  }
  return {
    total: simpleFactualShadowStats.total,
    violations: simpleFactualShadowStats.violations,
    violation_rate:
      simpleFactualShadowStats.total > 0
        ? Number(
            (
              simpleFactualShadowStats.violations / simpleFactualShadowStats.total
            ).toFixed(4),
          )
        : null,
    by_domain: byDomain,
  };
}

/** @param {{ total?: number, violations?: number, byDomain?: Record<string, { total: number, violations: number }> }} snapshot */
export function resetSimpleFactualShadowStats(snapshot = null) {
  simpleFactualShadowStats.total = snapshot?.total ?? 0;
  simpleFactualShadowStats.violations = snapshot?.violations ?? 0;
  simpleFactualShadowStats.byDomain = snapshot?.byDomain
    ? { ...snapshot.byDomain }
    : {};
}

/**
 * @returns {{ total: number, violations: number, violation_rate: number|null, by_domain: Record<string, { total: number, violations: number, violation_rate: number|null }> }}
 */
export function getDebugDiagnosticShadowStats() {
  const byDomain = {};
  for (const [domain, bucket] of Object.entries(debugDiagnosticShadowStats.byDomain)) {
    byDomain[domain] = {
      ...bucket,
      violation_rate:
        bucket.total > 0 ? Number((bucket.violations / bucket.total).toFixed(4)) : null,
    };
  }
  return {
    total: debugDiagnosticShadowStats.total,
    violations: debugDiagnosticShadowStats.violations,
    violation_rate:
      debugDiagnosticShadowStats.total > 0
        ? Number(
            (
              debugDiagnosticShadowStats.violations / debugDiagnosticShadowStats.total
            ).toFixed(4),
          )
        : null,
    by_domain: byDomain,
  };
}

/** @param {{ total?: number, violations?: number, byDomain?: Record<string, { total: number, violations: number }> }} snapshot */
export function resetDebugDiagnosticShadowStats(snapshot = null) {
  debugDiagnosticShadowStats.total = snapshot?.total ?? 0;
  debugDiagnosticShadowStats.violations = snapshot?.violations ?? 0;
  debugDiagnosticShadowStats.byDomain = snapshot?.byDomain
    ? { ...snapshot.byDomain }
    : {};
}

function buildShadowStatsSnapshot(bucket) {
  const byDomain = {};
  for (const [domain, entry] of Object.entries(bucket.byDomain)) {
    byDomain[domain] = {
      ...entry,
      violation_rate:
        entry.total > 0 ? Number((entry.violations / entry.total).toFixed(4)) : null,
    };
  }
  return {
    total: bucket.total,
    violations: bucket.violations,
    violation_rate:
      bucket.total > 0
        ? Number((bucket.violations / bucket.total).toFixed(4))
        : null,
    by_domain: byDomain,
  };
}

export function getInformationSeekingShadowStats() {
  return buildShadowStatsSnapshot(informationSeekingShadowStats);
}

export function getMultiSegmentShadowStats() {
  return buildShadowStatsSnapshot(multiSegmentShadowStats);
}

/**
 * P3 shadow — information_seeking / general_knowledge (G17).
 */
export function detectInformationSeekingDirectnessViolation(
  responseText = "",
  legacyPipelinePath = null,
  query = "",
) {
  const servedPath = legacyPipelinePath ?? null;
  const onPath =
    servedPath === "information_seeking_full_pipeline" ||
    servedPath === "information_seeking_escalation" ||
    servedPath === "general_knowledge_full_pipeline";

  if (!onPath) {
    return {
      applicable: false,
      contract_violation_information_seeking_directness: false,
      signals: [],
      response_preview: null,
    };
  }

  const hit = detectMoveContractViolations(responseText, query, {
    conversationMove: { family: "information_seeking" },
    pipelinePath: servedPath,
  });
  const alignment = assessInformationSeekingSubjectAlignment(responseText, query);

  return {
    applicable: hit.applicable,
    contract_violation_information_seeking_directness: hit.violated,
    signals: hit.signals,
    anchor_score: alignment.score,
    anchor_tier: alignment.tier,
    anchor_signals: alignment.signals,
    response_preview: String(responseText || "").slice(0, 160) || null,
  };
}

/**
 * P3 shadow — multi_segment_composite (G18).
 */
export function detectMultiSegmentDirectnessViolation(
  responseText = "",
  legacyPipelinePath = null,
  query = "",
) {
  const servedPath = legacyPipelinePath ?? null;
  if (servedPath !== "multi_segment_composite") {
    return {
      applicable: false,
      contract_violation_multi_segment_directness: false,
      signals: [],
      response_preview: null,
    };
  }

  const hit = detectMoveContractViolations(responseText, query, {
    pipelinePath: servedPath,
    segmentPlan: resolveMultiSegmentPlan(query),
  });

  return {
    applicable: hit.applicable,
    contract_violation_multi_segment_directness: hit.violated,
    signals: hit.signals,
    response_preview: String(responseText || "").slice(0, 160) || null,
  };
}

/**
 * Événement persistant P4 — hors shadow observe_only.
 * @param {object} payload
 */
export function emitConversationMovePersistentEvent(payload = {}) {
  const event = {
    event: "conversation_move",
    timestamp: new Date().toISOString(),
    ...payload,
  };
  console.info(`[CONVERSATION_MOVE] ${JSON.stringify(event)}`);
  return event;
}

/**
 * Détecte une pseudo-clarification sur how_to_procedural_llm (P3 shadow).
 * @param {string} responseText
 * @param {ReturnType<typeof evaluateConversationMove>} conversationMove
 * @param {string|null} [legacyPipelinePath]
 * @param {string} [query]
 */
export function detectHowToProceduralDirectnessViolation(
  responseText = "",
  conversationMove = {},
  legacyPipelinePath = null,
  query = "",
) {
  const servedPath = legacyPipelinePath ?? null;
  const movePath = conversationMove.pipelinePath ?? null;
  const onProceduralPath =
    servedPath === "how_to_procedural_llm" ||
    movePath === "how_to_procedural_llm";

  if (!onProceduralPath || conversationMove.move !== "answer_direct") {
    return {
      applicable: false,
      contract_violation_how_to_directness: false,
      signals: [],
      response_preview: null,
    };
  }

  const text = String(responseText || "").trim();
  const signals = [];

  if (isInsufficientSignalRefusal(text)) {
    signals.push("insufficient_signal_refusal");
  }
  if (HOW_TO_PSEUDO_CLARIFY_RE.test(text)) {
    signals.push("pseudo_clarify_prompt");
  }
  if (isHowToProceduralSocialDrift(text)) {
    signals.push("social_drift");
  } else if (query && isHowToProceduralTopicViolation(text, query)) {
    signals.push("off_topic_surface");
  } else if (!text) {
    signals.push("empty_response");
  }

  return {
    applicable: true,
    contract_violation_how_to_directness: signals.length > 0,
    signals,
    response_preview: text ? text.slice(0, 160) : null,
  };
}

/**
 * Détecte un over-refusal sur simple_factual_lookup (P3).
 * @param {string} responseText
 * @param {string|null} [legacyPipelinePath]
 * @param {string} [query]
 */
export function detectSimpleFactualDirectnessViolation(
  responseText = "",
  legacyPipelinePath = null,
  query = "",
) {
  const servedPath = legacyPipelinePath ?? null;
  const onFactualPath = servedPath === "simple_factual_lookup";

  if (!onFactualPath) {
    return {
      applicable: false,
      contract_violation_simple_fact_directness: false,
      signals: [],
      response_preview: null,
    };
  }

  const text = String(responseText || "").trim();
  const signals = [];

  if (!text) {
    signals.push("empty_response");
  }
  if (query && isSimpleFactualContractViolation(text, query)) {
    if (isInsufficientSignalRefusal(text) || SIMPLE_FACT_OVER_REFUSAL_RE.test(text)) {
      if (!signals.includes("insufficient_signal_refusal")) {
        signals.push("insufficient_signal_refusal");
      }
      if (SIMPLE_FACT_OVER_REFUSAL_RE.test(text)) {
        signals.push("pseudo_clarify_or_recovery");
      }
    } else {
      signals.push("factual_answer_miss");
    }
  } else {
    if (isInsufficientSignalRefusal(text)) {
      signals.push("insufficient_signal_refusal");
    }
    if (SIMPLE_FACT_OVER_REFUSAL_RE.test(text)) {
      signals.push("pseudo_clarify_or_recovery");
    }
  }

  return {
    applicable: true,
    contract_violation_simple_fact_directness: signals.length > 0,
    signals,
    response_preview: text ? text.slice(0, 160) : null,
  };
}

/**
 * Détecte un over-refusal sur debug_diagnostic (P3).
 * @param {string} responseText
 * @param {string|null} [legacyPipelinePath]
 */
export function detectDebugDiagnosticDirectnessViolation(
  responseText = "",
  legacyPipelinePath = null,
) {
  const servedPath = legacyPipelinePath ?? null;
  const onDebugPath = servedPath === "debug_diagnostic";

  if (!onDebugPath) {
    return {
      applicable: false,
      contract_violation_debug_directness: false,
      signals: [],
      response_preview: null,
    };
  }

  const text = String(responseText || "").trim();
  const signals = [];

  if (!text) {
    signals.push("empty_response");
  }
  if (isInsufficientSignalRefusal(text)) {
    signals.push("insufficient_signal_refusal");
  }
  if (DEBUG_DIAGNOSTIC_OVER_REFUSAL_RE.test(text) || isDebugDiagnosticOverRefusal(text)) {
    signals.push("pseudo_clarify_or_overview");
  }

  return {
    applicable: true,
    contract_violation_debug_directness: signals.length > 0,
    signals,
    response_preview: text ? text.slice(0, 160) : null,
  };
}

const TOOL_LEGACY_PATH_RE =
  /^(simple_factual_lookup|information_seeking_full_pipeline|external_calendar)/;

const GK_LEGACY_PATH_RE =
  /^(general_knowledge|lexicon_explain)/;

const HOW_TO_LEGACY_PATH_RE = /^how_to/;

/**
 * @param {string|null|undefined} pipelinePath
 */
function isToolLegacyPipelinePath(pipelinePath = "") {
  return TOOL_LEGACY_PATH_RE.test(String(pipelinePath || ""));
}

/**
 * @param {string|null|undefined} pipelinePath
 */
function isGkLegacyPipelinePath(pipelinePath = "") {
  return GK_LEGACY_PATH_RE.test(String(pipelinePath || ""));
}

/**
 * @param {string|null|undefined} pipelinePath
 */
function isHowToLegacyPipelinePath(pipelinePath = "") {
  return HOW_TO_LEGACY_PATH_RE.test(String(pipelinePath || ""));
}

/**
 * @param {ReturnType<typeof evaluateConversationMove>} conversationMove
 * @param {{
 *   clarificationGateWouldRun?: boolean,
 *   legacyPipelinePath?: string|null,
 *   justIntentStrategy?: string|null,
 * }} [legacyCtx]
 */
export function computeConversationMoveDivergence(
  conversationMove = {},
  legacyCtx = {},
) {
  const {
    clarificationGateWouldRun = false,
    legacyPipelinePath = null,
    justIntentStrategy = null,
  } = legacyCtx;

  const deltaReasons = [];
  const moveWouldClarify = shouldRunClarificationGate(conversationMove);
  const movePipelinePath = conversationMove.pipelinePath ?? null;
  const legacyPath = legacyPipelinePath ?? null;

  if (
    conversationMove.move === "answer_direct" &&
    clarificationGateWouldRun
  ) {
    deltaReasons.push("answer_direct_vs_legacy_clarify");
  }

  if (
    conversationMove.move === "tool" &&
    legacyPath &&
    !clarificationGateWouldRun &&
    !isToolLegacyPipelinePath(legacyPath)
  ) {
    deltaReasons.push("tool_vs_legacy_direct");
  }

  if (
    conversationMove.family === "multi_unit" &&
    legacyPath &&
    isHowToLegacyPipelinePath(legacyPath) &&
    !legacyPath.startsWith("multi_unit")
  ) {
    deltaReasons.push("multi_unit_vs_legacy_how_to");
  }

  if (
    movePipelinePath?.includes("how_to_procedural") &&
    legacyPath &&
    isGkLegacyPipelinePath(legacyPath)
  ) {
    deltaReasons.push("procedural_how_to_vs_legacy_gk");
  }

  const clarifyGateMismatch =
    moveWouldClarify !== clarificationGateWouldRun;

  const pipelinePathMismatch =
    Boolean(movePipelinePath) &&
    Boolean(legacyPath) &&
    movePipelinePath !== legacyPath;

  if (
    pipelinePathMismatch &&
    deltaReasons.length === 0 &&
    conversationMove.stopped
  ) {
    deltaReasons.push("pipeline_path_mismatch");
  }

  return {
    diverged: deltaReasons.length > 0 || clarifyGateMismatch,
    deltaReasons,
    deltaReason: deltaReasons[0] ?? (clarifyGateMismatch ? "clarify_gate_mismatch" : null),
    clarifyGateMismatch,
    moveWouldClarify,
    pipelinePathMismatch,
    justIntentStrategy,
  };
}

/**
 * @param {string} query
 * @param {ReturnType<typeof evaluateConversationMove>} conversationMove
 * @param {{
 *   phase?: "amont"|"served",
 *   clarificationGateWouldRun?: boolean,
 *   legacyPipelinePath?: string|null,
 *   legacyClarificationPath?: string|null,
 *   justIntentStrategy?: string|null,
 *   responseText?: string|null,
 * }} [ctx]
 */
export function buildConversationMoveShadowEvent(
  query = "",
  conversationMove = {},
  ctx = {},
) {
  const phase = ctx.phase ?? "amont";
  const clarificationGateWouldRun = Boolean(ctx.clarificationGateWouldRun);
  const legacyPipelinePath = ctx.legacyPipelinePath ?? null;
  const divergence = computeConversationMoveDivergence(conversationMove, {
    clarificationGateWouldRun,
    legacyPipelinePath,
    justIntentStrategy: ctx.justIntentStrategy ?? null,
  });

  const directness =
    phase === "served"
      ? detectHowToProceduralDirectnessViolation(
          ctx.responseText ?? "",
          conversationMove,
          legacyPipelinePath,
          query,
        )
      : {
          applicable: false,
          contract_violation_how_to_directness: false,
          signals: [],
          response_preview: null,
        };

  const simpleFactDirectness =
    phase === "served"
      ? detectSimpleFactualDirectnessViolation(
          ctx.responseText ?? "",
          legacyPipelinePath,
          query,
        )
      : {
          applicable: false,
          contract_violation_simple_fact_directness: false,
          signals: [],
          response_preview: null,
        };

  const debugDirectness =
    phase === "served"
      ? detectDebugDiagnosticDirectnessViolation(
          ctx.responseText ?? "",
          legacyPipelinePath,
        )
      : {
          applicable: false,
          contract_violation_debug_directness: false,
          signals: [],
          response_preview: null,
        };

  const informationSeekingDirectness =
    phase === "served"
      ? detectInformationSeekingDirectnessViolation(
          ctx.responseText ?? "",
          legacyPipelinePath,
          query,
        )
      : {
          applicable: false,
          contract_violation_information_seeking_directness: false,
          signals: [],
          response_preview: null,
        };

  const multiSegmentDirectness =
    phase === "served"
      ? detectMultiSegmentDirectnessViolation(
          ctx.responseText ?? "",
          legacyPipelinePath,
          query,
        )
      : {
          applicable: false,
          contract_violation_multi_segment_directness: false,
          signals: [],
          response_preview: null,
        };

  const shadowStats =
    phase === "served" && directness.applicable
      ? getHowToProceduralShadowStats()
      : null;

  const simpleFactualShadowStatsOut =
    phase === "served" && simpleFactDirectness.applicable
      ? getSimpleFactualShadowStats()
      : null;

  const debugDiagnosticShadowStatsOut =
    phase === "served" && debugDirectness.applicable
      ? getDebugDiagnosticShadowStats()
      : null;

  const informationSeekingShadowStatsOut =
    phase === "served" && informationSeekingDirectness.applicable
      ? getInformationSeekingShadowStats()
      : null;

  const multiSegmentShadowStatsOut =
    phase === "served" && multiSegmentDirectness.applicable
      ? getMultiSegmentShadowStats()
      : null;

  return {
    event: CONVERSATION_MOVE_SHADOW_EVENT,
    phase,
    shadow_mode: CONVERSATION_MOVE_SHADOW_MODE,
    contract: CONVERSATION_MOVE_CONTRACT,
    timestamp: new Date().toISOString(),
    move: conversationMove.move ?? null,
    family: conversationMove.family ?? null,
    qualification: conversationMove.qualification ?? null,
    satisfiability: conversationMove.satisfiability ?? null,
    pipeline_path: conversationMove.pipelinePath ?? null,
    contract_id: conversationMove.contractId ?? null,
    stopped: Boolean(conversationMove.stopped),
    confidence: conversationMove.confidence ?? null,
    signals: conversationMove.signals ?? [],
    clarification_gate_would_run: clarificationGateWouldRun,
    move_would_clarify: divergence.moveWouldClarify,
    clarify_gate_mismatch: divergence.clarifyGateMismatch,
    legacy_pipeline_path: ctx.legacyPipelinePath ?? null,
    legacy_clarification_path: ctx.legacyClarificationPath ?? null,
    just_intent_strategy: ctx.justIntentStrategy ?? null,
    diverged: divergence.diverged,
    delta_reason: divergence.deltaReason,
    delta_reasons: divergence.deltaReasons,
    pipeline_path_mismatch: divergence.pipelinePathMismatch,
    domain: conversationMove.domain ?? null,
    contract_violation_how_to_directness:
      directness.contract_violation_how_to_directness,
    contract_violation_signals: directness.signals,
    contract_violation_simple_fact_directness:
      simpleFactDirectness.contract_violation_simple_fact_directness,
    contract_violation_simple_fact_signals: simpleFactDirectness.signals,
    contract_violation_debug_directness:
      debugDirectness.contract_violation_debug_directness,
    contract_violation_debug_signals: debugDirectness.signals,
    contract_violation_information_seeking_directness:
      informationSeekingDirectness.contract_violation_information_seeking_directness,
    contract_violation_information_seeking_signals:
      informationSeekingDirectness.signals,
    anchor_score: informationSeekingDirectness.anchor_score ?? null,
    anchor_tier: informationSeekingDirectness.anchor_tier ?? null,
    anchor_signals: informationSeekingDirectness.anchor_signals ?? [],
    contract_violation_multi_segment_directness:
      multiSegmentDirectness.contract_violation_multi_segment_directness,
    contract_violation_multi_segment_signals: multiSegmentDirectness.signals,
    response_preview:
      directness.response_preview ||
      simpleFactDirectness.response_preview ||
      debugDirectness.response_preview ||
      informationSeekingDirectness.response_preview ||
      multiSegmentDirectness.response_preview,
    how_to_procedural_shadow_stats: shadowStats,
    simple_factual_shadow_stats: simpleFactualShadowStatsOut,
    debug_diagnostic_shadow_stats: debugDiagnosticShadowStatsOut,
    information_seeking_shadow_stats: informationSeekingShadowStatsOut,
    multi_segment_shadow_stats: multiSegmentShadowStatsOut,
    authority_applied: Boolean(ctx.authorityApplied),
    query_preview: String(query || "").slice(0, 120),
  };
}

/**
 * Évaluation shadow amont — après resolveClarificationGate, avant routage effectif.
 * @param {string} query
 * @param {{
 *   pipelineTelemetryCtx?: object|null,
 *   clarificationGate?: { shouldClarify?: boolean, pipelinePath?: string|null },
 *   conversationMove?: ReturnType<typeof evaluateConversationMove>|null,
 *   justIntent?: { strategy?: string|null },
 *   intentTriage?: object|null,
 *   history?: Array<{ role?: string, content?: string }>,
 *   authorityApplied?: boolean,
 * }} [ctx]
 */
export function runConversationMoveShadowAmont(query = "", ctx = {}) {
  const {
    pipelineTelemetryCtx = null,
    clarificationGate = {},
    justIntent = {},
    conversationMove: precomputedMove = null,
    authorityApplied = false,
  } = ctx;

  const conversationMove =
    precomputedMove ??
    evaluateConversationMove(query, {
      history: ctx.history ?? [],
      intentTriage: ctx.intentTriage ?? null,
    });

  const event = buildConversationMoveShadowEvent(query, conversationMove, {
    phase: "amont",
    clarificationGateWouldRun: Boolean(clarificationGate.shouldClarify),
    legacyPipelinePath: clarificationGate.shouldClarify
      ? clarificationGate.pipelinePath ?? "clarification_gate"
      : null,
    legacyClarificationPath: clarificationGate.pipelinePath ?? null,
    justIntentStrategy: justIntent.strategy ?? null,
    authorityApplied,
  });

  if (pipelineTelemetryCtx) {
    pipelineTelemetryCtx.conversationMoveShadow = {
      conversationMove,
      amontEvent: event,
    };
  }

  console.log(`[CONVERSATION_MOVE_SHADOW] ${JSON.stringify(event)}`);
  return { conversationMove, event };
}

/**
 * Réconciliation shadow — path legacy effectivement servi en fin de tour.
 * @param {object|null} pipelineTelemetryCtx
 * @param {string|null} legacyPipelinePath
 * @param {{
 *   responseText?: string|null,
 *   turnTelemetry?: { setMetric?: (key: string, value: unknown) => void }|null,
 * }} [options]
 */
export function runConversationMoveShadowServed(
  pipelineTelemetryCtx = null,
  legacyPipelinePath = null,
  options = {},
) {
  const shadowState = pipelineTelemetryCtx?.conversationMoveShadow;
  if (!shadowState?.conversationMove) return null;

  const query = pipelineTelemetryCtx?.query ?? "";
  const amont = shadowState.amontEvent ?? {};
  const conversationMove = shadowState.conversationMove;

  const directnessProbe = detectHowToProceduralDirectnessViolation(
    options.responseText ?? "",
    conversationMove,
    legacyPipelinePath,
    query,
  );
  if (directnessProbe.applicable) {
    howToProceduralShadowStats.total += 1;
    if (directnessProbe.contract_violation_how_to_directness) {
      howToProceduralShadowStats.violations += 1;
    }
    bumpDomainStat(
      conversationMove.domain,
      directnessProbe.contract_violation_how_to_directness,
    );
  }

  const simpleFactProbe = detectSimpleFactualDirectnessViolation(
    options.responseText ?? "",
    legacyPipelinePath,
    query,
  );
  if (simpleFactProbe.applicable) {
    simpleFactualShadowStats.total += 1;
    if (simpleFactProbe.contract_violation_simple_fact_directness) {
      simpleFactualShadowStats.violations += 1;
    }
    bumpSimpleFactualDomainStat(
      conversationMove.domain,
      simpleFactProbe.contract_violation_simple_fact_directness,
    );
  }

  const debugProbe = detectDebugDiagnosticDirectnessViolation(
    options.responseText ?? "",
    legacyPipelinePath,
  );
  if (debugProbe.applicable) {
    debugDiagnosticShadowStats.total += 1;
    if (debugProbe.contract_violation_debug_directness) {
      debugDiagnosticShadowStats.violations += 1;
    }
    bumpDebugDiagnosticDomainStat(
      conversationMove.domain,
      debugProbe.contract_violation_debug_directness,
    );
  }

  const infoSeekingProbe = detectInformationSeekingDirectnessViolation(
    options.responseText ?? "",
    legacyPipelinePath,
    query,
  );
  if (infoSeekingProbe.applicable) {
    informationSeekingShadowStats.total += 1;
    if (infoSeekingProbe.contract_violation_information_seeking_directness) {
      informationSeekingShadowStats.violations += 1;
    }
    bumpInformationSeekingDomainStat(
      conversationMove.domain,
      infoSeekingProbe.contract_violation_information_seeking_directness,
    );
  }

  const multiSegmentProbe = detectMultiSegmentDirectnessViolation(
    options.responseText ?? "",
    legacyPipelinePath,
    query,
  );
  if (multiSegmentProbe.applicable) {
    multiSegmentShadowStats.total += 1;
    if (multiSegmentProbe.contract_violation_multi_segment_directness) {
      multiSegmentShadowStats.violations += 1;
    }
    bumpMultiSegmentDomainStat(
      conversationMove.domain,
      multiSegmentProbe.contract_violation_multi_segment_directness,
    );
  }

  const event = buildConversationMoveShadowEvent(
    query,
    conversationMove,
    {
      phase: "served",
      clarificationGateWouldRun: Boolean(amont.clarification_gate_would_run),
      legacyPipelinePath,
      legacyClarificationPath: amont.legacy_clarification_path ?? null,
      justIntentStrategy: amont.just_intent_strategy ?? null,
      responseText: options.responseText ?? null,
    },
  );

  shadowState.servedEvent = event;

  const turnTelemetry = options.turnTelemetry ?? null;
  if (directnessProbe.applicable) {
    turnTelemetry?.setMetric?.("how_to_procedural_llm_shadow_total", event.how_to_procedural_shadow_stats?.total);
    turnTelemetry?.setMetric?.(
      "how_to_procedural_llm_directness_violations",
      event.how_to_procedural_shadow_stats?.violations,
    );
    turnTelemetry?.setMetric?.(
      "contract_violation_how_to_directness",
      event.contract_violation_how_to_directness,
    );
  }

  if (simpleFactProbe.applicable) {
    turnTelemetry?.setMetric?.(
      "simple_factual_shadow_total",
      event.simple_factual_shadow_stats?.total,
    );
    turnTelemetry?.setMetric?.(
      "simple_factual_directness_violations",
      event.simple_factual_shadow_stats?.violations,
    );
    turnTelemetry?.setMetric?.(
      "contract_violation_simple_fact_directness",
      event.contract_violation_simple_fact_directness,
    );
  }

  if (debugProbe.applicable) {
    turnTelemetry?.setMetric?.(
      "debug_diagnostic_shadow_total",
      event.debug_diagnostic_shadow_stats?.total,
    );
    turnTelemetry?.setMetric?.(
      "debug_diagnostic_directness_violations",
      event.debug_diagnostic_shadow_stats?.violations,
    );
    turnTelemetry?.setMetric?.(
      "contract_violation_debug_directness",
      event.contract_violation_debug_directness,
    );
  }

  console.log(`[CONVERSATION_MOVE_SHADOW] ${JSON.stringify(event)}`);
  if (event.contract_violation_how_to_directness) {
    console.warn(
      `[CONVERSATION_MOVE_SHADOW] contract_violation_how_to_directness domain=${event.domain ?? "unknown"} ` +
        `signals=${event.contract_violation_signals.join(",")} ` +
        `rate=${event.how_to_procedural_shadow_stats?.violation_rate ?? "n/a"}`,
    );
  }
  if (event.contract_violation_simple_fact_directness) {
    console.warn(
      `[CONVERSATION_MOVE_SHADOW] contract_violation_simple_fact_directness domain=${event.domain ?? "unknown"} ` +
        `signals=${(event.contract_violation_simple_fact_signals || []).join(",")} ` +
        `rate=${event.simple_factual_shadow_stats?.violation_rate ?? "n/a"}`,
    );
  }
  if (event.contract_violation_debug_directness) {
    console.warn(
      `[CONVERSATION_MOVE_SHADOW] contract_violation_debug_directness domain=${event.domain ?? "unknown"} ` +
        `signals=${(event.contract_violation_debug_signals || []).join(",")} ` +
        `rate=${event.debug_diagnostic_shadow_stats?.violation_rate ?? "n/a"}`,
    );
  }
  return event;
}
