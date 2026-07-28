/**
 * Politique de promotion lexique v1 — seuils, shapes à risque, auto-promotion faible risque.
 */

export const LEXICON_PROMOTION_POLICY_V1 = {
  version: "lexicon_promotion_v1",
  thresholds: {
    minKeyLength: 3,
    minOccurrencesProposed: 2,
    minOccurrencesAutoPromote: 3,
    minDistinctSessionsAutoPromote: 1,
    minConfidenceAutoPromote: 0.72,
    minDistinctSessionsReview: 2,
  },
  autoPromoteShapes: [
    "cultural_event_or_festival",
    "sport_or_game",
  ],
  reviewRequiredShapes: ["generic_topic", "person"],
  blockedKeys: new Set(["oui", "non", "salut", "hey", "ok"]),
};

export function computeProposalConfidence(proposal = {}) {
  const occurrences = proposal.occurrences ?? 0;
  const sessions = proposal.distinctSessions ?? 0;
  const shapeBonus = LEXICON_PROMOTION_POLICY_V1.autoPromoteShapes.includes(
    proposal.subjectShape,
  )
    ? 0.12
    : 0;
  const aliasBonus = Math.min(0.08, (proposal.aliases?.length ?? 0) * 0.02);
  const raw = 0.32 + occurrences * 0.11 + sessions * 0.07 + shapeBonus + aliasBonus;
  return Math.round(Math.min(0.96, raw) * 100) / 100;
}

export function countDistinctSessions(provenance = []) {
  return new Set(
    provenance.map((p) => p.sessionId).filter((id) => typeof id === "string" && id.trim()),
  ).size;
}
