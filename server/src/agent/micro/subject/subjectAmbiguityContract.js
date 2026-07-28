import { SUBJECT_CONFIDENCE } from "./subjectConfidence.js";
import { SUBJECT_NATURES } from "./subjectIntelligenceLayer.js";

/** Règle globale — aucun module ne doit répondre directement en violation. */
export const AMBIGUITY_CONTRACT_RULE = "subject_ambiguity_contract";

/**
 * @param {{
 *   confidence?: string,
 *   candidates?: object[],
 *   ambiguous?: boolean,
 *   resolvedEntityId?: string|null,
 * }} state
 * @returns {{
 *   mustClarify: boolean,
 *   allowDirectAnswer: boolean,
 *   reason: string|null,
 *   candidateCount: number,
 * }}
 */
export function evaluateAmbiguityContract(state = {}) {
  const candidates = Array.isArray(state.candidates) ? state.candidates : [];
  const candidateCount =
    candidates.length > 0 ? candidates.length : state.resolvedEntityId ? 1 : 0;

  const lowConfidence = state.confidence === SUBJECT_CONFIDENCE.LOW;
  const multiCandidate = candidateCount > 1;
  const flaggedAmbiguous = Boolean(state.ambiguous);
  const compositeMixed = state.nature === SUBJECT_NATURES.COMPOSITE_MIXED;

  const mustClarify =
    lowConfidence || multiCandidate || flaggedAmbiguous || compositeMixed;

  let reason = null;
  if (compositeMixed) reason = "composite_mixed_domain";
  else if (lowConfidence) reason = "confidence_low";
  else if (multiCandidate) reason = "multiple_candidates";
  else if (flaggedAmbiguous) reason = "entity_ambiguous";

  return {
    mustClarify,
    allowDirectAnswer: !mustClarify,
    reason,
    candidateCount,
  };
}

/**
 * Garde-fou transverse — à appeler avant toute réponse directe déterministe.
 * @throws ne lève pas — retourne { ok: false } si violation
 */
export function assertDirectAnswerAllowed(state, ambiguity) {
  const contract = ambiguity || evaluateAmbiguityContract(state);
  if (!contract.allowDirectAnswer) {
    return {
      ok: false,
      contract,
      requiredAction: contract.candidateCount > 1 ? "disambiguate" : "clarify",
    };
  }
  return { ok: true, contract };
}
