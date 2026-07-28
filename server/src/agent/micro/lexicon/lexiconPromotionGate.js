/**
 * Gate de promotion lexique — proposé / auto-promu / rejeté selon seuils et shape.
 */
import {
  computeProposalConfidence,
  LEXICON_PROMOTION_POLICY_V1,
} from "./lexiconPromotionPolicy.js";
import { LEXICON_PROPOSAL_STATUS } from "./subjectPromotionCandidateBuilder.js";

export const LEXICON_GATE_DECISIONS = {
  OBSERVE_ONLY: "observe_only",
  PROPOSED: "proposed",
  AUTO_PROMOTED: "auto_promoted",
  REJECTED: "rejected",
};

/**
 * @param {object} proposal
 * @param {{ hasStaticLexiconEntry?: (key: string) => boolean, isRejected?: (id: string) => boolean }} context
 */
export function assessLexiconPromotionCandidate(proposal = {}, context = {}) {
  const reasons = [];
  const policy = LEXICON_PROMOTION_POLICY_V1;
  const key = proposal.canonicalKey || "";

  if (!key) {
    return { decision: LEXICON_GATE_DECISIONS.REJECTED, reasons: ["missing_canonical_key"], confidence: 0 };
  }

  if (policy.blockedKeys.has(key)) {
    return { decision: LEXICON_GATE_DECISIONS.REJECTED, reasons: ["blocked_key"], confidence: 0 };
  }

  if (key.length < policy.thresholds.minKeyLength) {
    return { decision: LEXICON_GATE_DECISIONS.REJECTED, reasons: ["key_too_short"], confidence: 0 };
  }

  if (context.isRejected?.(proposal.id)) {
    return { decision: LEXICON_GATE_DECISIONS.REJECTED, reasons: ["previously_rejected"], confidence: 0 };
  }

  if (context.hasStaticLexiconEntry?.(key)) {
    return { decision: LEXICON_GATE_DECISIONS.REJECTED, reasons: ["already_in_static_lexicon"], confidence: 0 };
  }

  if (proposal.status === LEXICON_PROPOSAL_STATUS.PROMOTED) {
    return { decision: LEXICON_GATE_DECISIONS.AUTO_PROMOTED, reasons: ["already_promoted"], confidence: proposal.confidence ?? 1 };
  }

  const confidence = computeProposalConfidence(proposal);
  const occurrences = proposal.occurrences ?? 0;
  const sessions = proposal.distinctSessions ?? 0;

  if (occurrences < policy.thresholds.minOccurrencesProposed) {
    return {
      decision: LEXICON_GATE_DECISIONS.OBSERVE_ONLY,
      reasons: ["insufficient_occurrences"],
      confidence,
    };
  }

  const reviewRequired = policy.reviewRequiredShapes.includes(proposal.subjectShape);
  const autoEligible = policy.autoPromoteShapes.includes(proposal.subjectShape);

  if (
    autoEligible &&
    occurrences >= policy.thresholds.minOccurrencesAutoPromote &&
    sessions >= policy.thresholds.minDistinctSessionsAutoPromote &&
    confidence >= policy.thresholds.minConfidenceAutoPromote
  ) {
    return { decision: LEXICON_GATE_DECISIONS.AUTO_PROMOTED, reasons: [], confidence };
  }

  if (reviewRequired) {
    reasons.push("review_required_shape");
  } else if (!autoEligible) {
    reasons.push("shape_not_auto_promotable");
  } else {
    reasons.push("awaiting_auto_promotion_threshold");
  }

  return {
    decision: LEXICON_GATE_DECISIONS.PROPOSED,
    reasons,
    confidence,
  };
}
