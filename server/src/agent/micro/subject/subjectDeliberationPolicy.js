import { SUBJECT_CONFIDENCE } from "./subjectConfidence.js";
import { detectCompositeSubject } from "./subjectDomainSignals.js";
import { SUBJECT_NATURES } from "./subjectIntelligenceLayer.js";
import { isForgeProjectScopingQuery } from "./forgeProjectScoping.js";

export const DELIBERATION_MODES = {
  NONE: "none",
  MINI: "mini",
  CLARIFY: "clarify",
};

export const REPLY_POLICIES = {
  FAST_DIRECT: "fast_direct",
  FAST_REASONED: "fast_reasoned",
  CLARIFY_FIRST: "clarify_first",
};

/**
 * Politique dérivée — hint pour router / gates (pas de texte utilisateur).
 * @param {object} interpreted — sortie buildSubjectInterpretedState
 * @param {string} [query]
 */
export function resolveDeliberationPolicy(interpreted = {}, query = "") {
  const state = interpreted.state || {};
  const ambiguity = interpreted.ambiguity || {};
  const composite = detectCompositeSubject(query, state);
  const forgeProjectScoping = isForgeProjectScopingQuery(query);

  let deliberationMode = DELIBERATION_MODES.NONE;
  let replyPolicy = REPLY_POLICIES.FAST_DIRECT;

  if (
    ambiguity.mustClarify &&
    (state.ambiguous || (ambiguity.candidateCount ?? 0) > 1)
  ) {
    deliberationMode = DELIBERATION_MODES.CLARIFY;
    replyPolicy = REPLY_POLICIES.CLARIFY_FIRST;
  } else if (composite.composite || state.nature === SUBJECT_NATURES.COMPOSITE_MIXED) {
    deliberationMode = DELIBERATION_MODES.MINI;
    replyPolicy = REPLY_POLICIES.FAST_REASONED;
  } else if (forgeProjectScoping) {
    deliberationMode = DELIBERATION_MODES.MINI;
    replyPolicy = REPLY_POLICIES.FAST_REASONED;
  } else if (ambiguity.mustClarify || state.confidence === SUBJECT_CONFIDENCE.LOW) {
    deliberationMode = DELIBERATION_MODES.CLARIFY;
    replyPolicy = REPLY_POLICIES.CLARIFY_FIRST;
  } else if (state.confidence === SUBJECT_CONFIDENCE.MEDIUM) {
    deliberationMode = DELIBERATION_MODES.MINI;
    replyPolicy = REPLY_POLICIES.FAST_REASONED;
  }

  const requiresReasonedReply =
    deliberationMode === DELIBERATION_MODES.MINI ||
    deliberationMode === DELIBERATION_MODES.CLARIFY;
  const requiresClarification = deliberationMode === DELIBERATION_MODES.CLARIFY;
  const safeFastReply =
    deliberationMode === DELIBERATION_MODES.NONE &&
    state.confidence === SUBJECT_CONFIDENCE.HIGH &&
    !composite.composite;

  return {
    deliberationMode,
    replyPolicy,
    requiresReasonedReply,
    requiresClarification,
    safeFastReply,
    composite,
    forgeProjectScoping,
  };
}

/**
 * @param {object} policy
 */
export function shouldBlockThinAutoProcedure(policy = {}) {
  return (
    policy.requiresReasonedReply ||
    policy.deliberationMode !== DELIBERATION_MODES.NONE ||
    policy.composite?.composite === true
  );
}
