/**
 * Politique de promotion mémoire v1
 * Seuils, staleness, et refus explicites episodic → semantic → heritage.
 */

export const PROMOTION_POLICY_V1 = {
  version: "memory_promotion_v1",
  thresholds: {
    episodicMin: 0.5,
    semanticMin: 0.75,
    heritageMin: 0.92,
  },
  staleness: {
    /** Mémoire dont review_at est dépassé */
    rejectIfReviewPast: true,
    /** unknowns > max → refus semantic/heritage */
    maxUnknownsSemantic: 2,
    maxUnknownsHeritage: 0,
  },
  pipeline: {
    /** Modes autorisés pour promotion semantic/heritage */
    durableModes: ["DOCUMENT", "CRITICAL", "COMPOSER"],
    /** Modes limités à episodic max */
    ephemeralModes: ["INSTANT", "SIMPLE_FAST"],
  },
};

const { thresholds, staleness, pipeline } = PROMOTION_POLICY_V1;

export function countDistinctTurnRefs(evidence = []) {
  if (!Array.isArray(evidence)) return 0;
  return new Set(
    evidence
      .map((e) => e?.turn_ref)
      .filter((ref) => typeof ref === "string" && ref.trim()),
  ).size;
}

export function countDistinctSourceTypes(evidence = []) {
  if (!Array.isArray(evidence)) return 0;
  return new Set(
    evidence
      .map((e) => e?.source_type)
      .filter((t) => typeof t === "string" && t.trim()),
  ).size;
}

export function isRetentionStale(retention = {}) {
  if (!retention?.review_at) return false;
  return new Date(retention.review_at).getTime() <= Date.now();
}

function resolveTargetTier(payload = {}, confidence = 0) {
  const requested = payload.memory_type;
  if (requested === "heritage" && confidence >= thresholds.heritageMin) {
    return "heritage";
  }
  if (
    (requested === "semantic" || requested === "heritage") &&
    confidence >= thresholds.semanticMin
  ) {
    return "semantic";
  }
  if (
    (requested === "episodic" ||
      requested === "semantic" ||
      requested === "heritage") &&
    confidence >= thresholds.episodicMin
  ) {
    return "episodic";
  }
  return null;
}

/**
 * Évalue si une mémoire commitée peut être promue et vers quel tier.
 * @param {Object} storeRecord — enregistrement JSONL commité
 * @param {Object} packet — { payload, meta }
 */
export function assessPromotionEligibility(storeRecord = {}, packet = {}) {
  const payload = packet.payload || {};
  const provenance = packet.meta?.provenance || {};
  const reasons = [];
  const confidence = Number(storeRecord.confidence ?? payload.confidence ?? 0);
  const memoryType = storeRecord.memory_type || payload.memory_type;
  const evidence = storeRecord.evidence || payload.evidence || [];
  const retention = storeRecord.retention || payload.retention || {};
  const pipelineMode = provenance.pipelineMode || "COMPOSER";
  const distinctTurns = countDistinctTurnRefs(evidence);
  const distinctSources = countDistinctSourceTypes(evidence);
  const unknowns = Array.isArray(payload.unknowns) ? payload.unknowns : [];
  const forbidden = Array.isArray(payload.forbidden_speculation)
    ? payload.forbidden_speculation
    : [];
  const conflicts = payload.conflict_check?.possible_conflicts || [];

  if (memoryType === "working") {
    reasons.push("working_not_durable");
  }

  if (confidence < thresholds.episodicMin) {
    reasons.push("confidence_below_episodic_min");
  }

  if (staleness.rejectIfReviewPast && isRetentionStale(retention)) {
    reasons.push("retention_stale");
  }

  if (conflicts.length > 0 && !(payload.conflict_check?.supersedes_memory_ids || []).length) {
    reasons.push("unresolved_conflicts");
  }

  const target = resolveTargetTier(payload, confidence);

  if (!target) {
    reasons.push("no_promotion_tier");
  }

  if (target === "semantic" || target === "heritage") {
    if (pipeline.ephemeralModes.includes(pipelineMode)) {
      reasons.push("pipeline_mode_too_ephemeral");
    }
    if (distinctTurns < 2 && distinctSources < 2) {
      reasons.push("insufficient_cross_turn_evidence");
    }
    if (unknowns.length > staleness.maxUnknownsSemantic) {
      reasons.push("too_many_unknowns_for_semantic");
    }
  }

  if (target === "heritage") {
    if (confidence < thresholds.heritageMin) {
      reasons.push("confidence_below_heritage_min");
    }
    if (pipelineMode !== "CRITICAL" && pipelineMode !== "DOCUMENT") {
      reasons.push("heritage_requires_durable_pipeline");
    }
    if (forbidden.length > 0) {
      reasons.push("forbidden_speculation_present");
    }
    if (unknowns.length > staleness.maxUnknownsHeritage) {
      reasons.push("unknowns_block_heritage");
    }
    if (!["system", "project"].includes(storeRecord.scope || payload.scope)) {
      reasons.push("heritage_scope_not_durable");
    }
  }

  const eligible = reasons.length === 0 && target !== null;

  return {
    eligible,
    target: eligible ? target : null,
    reasons: [...new Set(reasons)],
    confidence,
    pipelineMode,
    policyVersion: PROMOTION_POLICY_V1.version,
  };
}

export default {
  PROMOTION_POLICY_V1,
  assessPromotionEligibility,
  countDistinctTurnRefs,
  isRetentionStale,
};
