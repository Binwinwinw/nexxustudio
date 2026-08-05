/**
 * Porte transversale — AUTO_REPLY_SUFFICIENCY_RULE : clôture seulement si suffisance totale.
 */
import { AUTO_REPLY_SUFFICIENCY_DOCTRINE } from "./autoReplySufficiencyRule.js";
import { RESPONSE_MODES } from "../../config/modeResponseContracts.js";
import {
  evaluateAutoReplySufficiency,
  inferDetectedSignalFromPath,
  SUFFICIENCY_BYPASS_PATHS,
  SUFFICIENCY_TIER,
} from "./responseSufficiencyEvaluator.js";
import {
  buildMultiSegmentSystemHint,
  resolveMultiSegmentPlan,
} from "./multiSegmentResponsePlan.js";
import {
  extractTemporalTarget,
  TEMPORAL_TARGET_KIND,
} from "../../policies/conversation/conversationSubjectExtraction.js";

/**
 * @param {string} query
 * @param {object|null} hit — proposition de short-circuit
 * @param {ReturnType<import('./responseSufficiencyEvaluator.js').buildParseState>} [parseState]
 */
export function applyShortCircuitSufficiencyGate(query, hit, parseState = null) {
  if (!hit) return null;
  if (
    hit.path === "simple_factual_lookup" &&
    hit.reply &&
    (extractTemporalTarget(query) === TEMPORAL_TARGET_KIND.HISTORICAL ||
      extractTemporalTarget(query) === TEMPORAL_TARGET_KIND.RELATIVE)
  ) {
    return hit;
  }
  if (hit.deferToLlm) {
    return enrichDeferHit(query, hit, parseState);
  }
  if (!hit.reply || SUFFICIENCY_BYPASS_PATHS.has(hit.path)) {
    return hit;
  }

  const state = parseState || hit.segmentPlan || null;
  const evaluation = evaluateAutoReplySufficiency({
    query,
    detectedSignal: inferDetectedSignalFromPath(hit.path, query),
    parseState: state,
    candidateReply: hit.reply,
    shortCircuitPath: hit.path,
  });

  if (evaluation.sufficient) {
    return { ...hit, sufficiency: evaluation };
  }

  if (evaluation.tier === SUFFICIENCY_TIER.DEFER_PIPELINE) {
    return toDeferredCompositeHit(query, hit, evaluation);
  }

  return hit;
}

function enrichDeferHit(query, hit, parseState) {
  const plan = parseState || resolveMultiSegmentPlan(query);
  if (plan?.shouldDeferToPipeline && !hit.reflectiveHint) {
    return {
      ...hit,
      segmentPlan: plan,
      reflectiveHint: buildMultiSegmentSystemHint(plan),
      sufficiency: evaluateAutoReplySufficiency({
        query,
        parseState: plan,
        detectedSignal: "time_lookup",
      }),
    };
  }
  return hit;
}

function toDeferredCompositeHit(query, originalHit, evaluation) {
  const plan = evaluation.parseState || resolveMultiSegmentPlan(query);
  const hint = buildMultiSegmentSystemHint({
    ...plan,
    shouldDeferToPipeline: true,
    preamble: plan.preamble || null,
    followUpOpening: plan.followUpOpening || null,
  });

  return {
    path: "multi_segment_composite",
    mode: RESPONSE_MODES.SIMPLE_FAST,
    reply: null,
    deferToLlm: true,
    step: "🔗 Auto-réponse insuffisante — contexte + but principal...",
    enforce: { allowRefusal: false },
    reflectiveHint: hint || buildInsufficientAutoReplyHint(query, evaluation),
    segmentPlan: plan,
    sufficiency: evaluation,
    supersededPath: originalHit.path,
  };
}

function buildInsufficientAutoReplyHint(query, evaluation) {
  const reasons = evaluation.reasons?.join(", ") || "compound_intent";
  const headline = AUTO_REPLY_SUFFICIENCY_DOCTRINE.principles[0];
  return [
    `RÈGLE ${AUTO_REPLY_SUFFICIENCY_DOCTRINE.ruleId} : ${headline}`,
    `Raisons : ${reasons}.`,
    "Produis une réponse en deux temps : amorce utile au signal contextuel, puis réponse structurée au but principal.",
    `Requête utilisateur : ${String(query).slice(0, 500)}`,
  ].join("\n");
}
