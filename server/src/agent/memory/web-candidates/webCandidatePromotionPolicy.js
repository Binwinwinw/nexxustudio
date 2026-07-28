/**
 * Politique web_candidate_promotion_v1 — promotion vers evaluateAndCommitMemory uniquement si preuve accumulée.
 */
import { PROMOTION_POLICY_V1 } from "../guardianship/memoryPromotionPolicy.js";
import { WEB_CANDIDATE_POLICY_VERSION } from "./webCandidateUtils.js";

export const WEB_PROMOTION_POLICY = {
  version: WEB_CANDIDATE_POLICY_VERSION,
  thresholds: {
    minSources: 2,
    minWebConfidence: 0.65,
    minConsensus: 0.55,
    minCoherentReplays: 2,
  },
};

function distinctUrlCount(sources = []) {
  return new Set(
    sources.map((s) => String(s.url || "").trim()).filter(Boolean),
  ).size;
}

/**
 * @param {object} candidate — enregistrement candidate fact v1
 * @returns {{ eligible: boolean, status: string, reasons: string[] }}
 */
export function assessWebCandidatePromotion(candidate = {}) {
  const reasons = [];
  const { thresholds } = WEB_PROMOTION_POLICY;
  const web = candidate.web || {};
  const validation = candidate.validation || {};
  const sources = candidate.sources || [];

  if (validation.user_corrected) {
    reasons.push("user_corrected");
  }
  if (distinctUrlCount(sources) < thresholds.minSources) {
    reasons.push("insufficient_distinct_sources");
  }
  if ((web.confidence ?? 0) < thresholds.minWebConfidence) {
    reasons.push("web_confidence_below_threshold");
  }
  if ((web.source_consensus_score ?? 0) < thresholds.minConsensus) {
    reasons.push("source_consensus_below_threshold");
  }

  const hasExplicitValidation = validation.validated_by_user === true;
  const implicitOk =
    validation.implicitly_accepted === true &&
    (validation.coherent_replays ?? 0) >= thresholds.minCoherentReplays;

  if (!hasExplicitValidation && !implicitOk) {
    reasons.push("awaiting_validation_or_replays");
  }

  const pipelineMode = candidate.provenance?.pipeline_mode || "SIMPLE_FAST";
  const ephemeralOnly =
    PROMOTION_POLICY_V1.pipeline.ephemeralModes.includes(pipelineMode) &&
    !hasExplicitValidation;

  if (ephemeralOnly) {
    reasons.push("ephemeral_pipeline_requires_explicit_validation");
  }

  const eligible = reasons.length === 0;

  return {
    eligible,
    status: eligible ? "promotion_eligible" : "candidate_saved",
    reasons: [...new Set(reasons)],
    policy_version: WEB_CANDIDATE_POLICY_VERSION,
  };
}

export function buildPromotionBlockReasons(assessment) {
  if (assessment.eligible) return [];
  return assessment.reasons?.length
    ? assessment.reasons
    : ["promotion_rejected_unknown"];
}
