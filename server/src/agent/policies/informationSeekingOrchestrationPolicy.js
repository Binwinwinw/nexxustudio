/**
 * Politique d'orchestration aval — information_seeking_with_target(X).
 *
 * Matrice (v1.1.3) :
 *   couverture locale forte     → deliver_local
 *   couverture partielle/medium → full_pipeline
 *   miss / empty / insuffisant  → web_fallback
 */
import {
  isInformationSeekingWithTarget,
  extractInformationSeekingTarget,
  buildInformationSeekingWebQuery,
  isInformationSeekingRecoveryResponse,
} from "../utils/informationSeekingIntentGuards.js";
import { resolveLocalGeneralKnowledgeDetail } from "../micro/replies/generalKnowledgeComposerContract.js";

export const INFORMATION_SEEKING_ORCHESTRATION_RULE =
  "information_seeking_confidence_routing_v1";

export const INFORMATION_SEEKING_ACTIONS = {
  DELIVER_LOCAL: "deliver_local",
  FULL_PIPELINE: "full_pipeline",
  WEB_FALLBACK: "web_fallback",
};

export const INFORMATION_SEEKING_SHORT_CIRCUIT_STATUS = {
  SUCCESS: "success",
  EMPTY: "empty_short_circuit_llm",
  INSUFFICIENT: "insufficient_signal",
};

/**
 * @param {string} query
 * @returns {"product_app_game"|"general_entity"}
 */
export function classifyInformationSeekingTargetType(query = "") {
  const q = String(query || "").toLowerCase();
  if (/\b(?:jeu|jeux|app|application|logiciel|mobile game|mmorpg)\b/i.test(q)) {
    return "product_app_game";
  }
  return "general_entity";
}

/**
 * @param {string} query
 * @returns {{ found: boolean, confidence: "high"|"medium"|"low", source: string|null }}
 */
export function assessInformationSeekingLocalCoverage(query = "") {
  const local = resolveLocalGeneralKnowledgeDetail(query);
  const body = String(local || "").trim();
  if (body.length >= 80) {
    return {
      found: true,
      confidence: "high",
      source: "general_knowledge_fiche",
    };
  }
  if (body.length >= 20) {
    return {
      found: true,
      confidence: "medium",
      source: "general_knowledge_fiche_partial",
    };
  }
  return { found: false, confidence: "low", source: null };
}

/**
 * @param {object} ctx
 * @returns {string|null}
 */
function resolveShortCircuitStatus(ctx = {}) {
  if (ctx.shortCircuitStatus) return ctx.shortCircuitStatus;
  if (ctx.fallbackReason === "empty_short_circuit_llm") {
    return INFORMATION_SEEKING_SHORT_CIRCUIT_STATUS.EMPTY;
  }
  if (isInformationSeekingRecoveryResponse(ctx.responseText)) {
    return INFORMATION_SEEKING_SHORT_CIRCUIT_STATUS.INSUFFICIENT;
  }
  if (ctx.localAnswerFound === true) {
    return INFORMATION_SEEKING_SHORT_CIRCUIT_STATUS.SUCCESS;
  }
  return null;
}

/**
 * @param {string} query
 * @param {{
 *   phase?: "route"|"post_simple_fast"|"escalation"|"orchestrator_gate",
 *   shortCircuitPath?: string|null,
 *   shortCircuitStatus?: string|null,
 *   fallbackReason?: string|null,
 *   responseText?: string|null,
 *   localAnswerFound?: boolean,
 *   informationSeekingEscalation?: boolean,
 *   escalationReason?: string|null,
 * }} [ctx]
 */
export function resolveInformationSeekingOrchestration(query = "", ctx = {}) {
  const applicable =
    isInformationSeekingWithTarget(query) ||
    Boolean(ctx.informationSeekingEscalation);

  if (!applicable) {
    return { applicable: false };
  }

  const target = extractInformationSeekingTarget(query);
  const targetType = classifyInformationSeekingTargetType(query);
  const local = assessInformationSeekingLocalCoverage(query);
  const shortCircuitStatus = resolveShortCircuitStatus(ctx);
  const webQuery = buildInformationSeekingWebQuery(query);

  let recommendedAction = INFORMATION_SEEKING_ACTIONS.FULL_PIPELINE;
  let escalationReason = null;
  let preferWebResearch = true;

  const missedLocal =
    shortCircuitStatus === INFORMATION_SEEKING_SHORT_CIRCUIT_STATUS.EMPTY ||
    shortCircuitStatus === INFORMATION_SEEKING_SHORT_CIRCUIT_STATUS.INSUFFICIENT ||
    ctx.phase === "escalation" ||
    ctx.informationSeekingEscalation;

  if (missedLocal) {
    recommendedAction = INFORMATION_SEEKING_ACTIONS.WEB_FALLBACK;
    escalationReason =
      ctx.escalationReason ||
      shortCircuitStatus ||
      "information_seeking_miss_local";
    preferWebResearch = true;
  } else if (local.found && local.confidence === "high") {
    recommendedAction = INFORMATION_SEEKING_ACTIONS.DELIVER_LOCAL;
    preferWebResearch = false;
    escalationReason = "local_fiche_high_confidence";
  } else if (local.found && local.confidence === "medium") {
    recommendedAction = INFORMATION_SEEKING_ACTIONS.FULL_PIPELINE;
    preferWebResearch = false;
    escalationReason = "local_fiche_partial";
  } else if (targetType === "product_app_game") {
    recommendedAction = INFORMATION_SEEKING_ACTIONS.FULL_PIPELINE;
    preferWebResearch = true;
    escalationReason = "product_target_no_local_fiche";
  } else {
    recommendedAction = INFORMATION_SEEKING_ACTIONS.FULL_PIPELINE;
    preferWebResearch = true;
    escalationReason = "general_entity_overview";
  }

  return {
    applicable: true,
    rule: INFORMATION_SEEKING_ORCHESTRATION_RULE,
    shellRecognized: isInformationSeekingWithTarget(query),
    target,
    targetType,
    localAnswerFound: local.found,
    localConfidence: local.confidence,
    localSource: local.source,
    shortCircuitStatus,
    recommendedAction,
    preferWebResearch,
    webQuery,
    escalationReason,
    phase: ctx.phase || "route",
    pipelinePath: ctx.shortCircuitPath ?? null,
    webFallbackTriggered:
      recommendedAction === INFORMATION_SEEKING_ACTIONS.WEB_FALLBACK,
  };
}

/**
 * Enrichissement knowledge layer pour info-seeking.
 * @param {string} query
 * @param {object} [ctx]
 */
export function resolveInformationSeekingEnrichmentPolicy(query = "", ctx = {}) {
  const orchestration = resolveInformationSeekingOrchestration(query, ctx);
  if (!orchestration.applicable) {
    return {
      applicable: false,
      preferWebResearch: false,
      domain: "unknown",
      subject: null,
      reason: null,
      webQuery: null,
      orchestration: null,
    };
  }

  return {
    applicable: true,
    preferWebResearch: orchestration.preferWebResearch,
    domain: "information_seeking",
    subject: orchestration.target,
    reason: orchestration.escalationReason,
    webQuery: orchestration.webQuery,
    orchestration,
  };
}
