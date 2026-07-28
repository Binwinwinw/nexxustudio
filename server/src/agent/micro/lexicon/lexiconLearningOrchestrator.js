/**
 * Orchestrateur lexique vivant — observe, propose, promeut avec preuve.
 * Doctrine : pas d'apprentissage opaque ; promotion gouvernée local-first.
 */
import { detectUnknownSubjectObservation } from "./unknownSubjectDetector.js";
import {
  buildPromotedLexiconEntry,
  buildPromotionCandidateFromObservation,
  LEXICON_PROPOSAL_STATUS,
} from "./subjectPromotionCandidateBuilder.js";
import { assessLexiconPromotionCandidate, LEXICON_GATE_DECISIONS } from "./lexiconPromotionGate.js";
import {
  appendLexiconObservation,
  isLexiconLearningEnabled,
  promoteLexiconEntry,
  readLexiconProposals,
  readRejectedLexiconProposals,
  recordLexiconLearningEvent,
  upsertLexiconProposal,
} from "./lexiconLearningStore.js";

/**
 * @param {{
 *   query?: string,
 *   parsed?: object,
 *   subject?: object,
 *   sessionId?: string,
 *   hasStaticLexiconEntry?: (key: string) => boolean,
 * }} context
 */
export function observeLexiconLearning(context = {}) {
  if (!isLexiconLearningEnabled()) return null;

  const observation = detectUnknownSubjectObservation(context);
  if (!observation) return null;

  const sessionId = context.sessionId || "unknown";
  appendLexiconObservation({ ...observation, sessionId });

  const proposals = readLexiconProposals();
  const existing = proposals[`lexprop_${observation.canonicalKey.replace(/\s+/g, "_")}`] || null;
  const proposal = buildPromotionCandidateFromObservation(observation, existing);
  if (!proposal) return { observation, decision: LEXICON_GATE_DECISIONS.OBSERVE_ONLY };

  const rejected = readRejectedLexiconProposals();
  const gate = assessLexiconPromotionCandidate(proposal, {
    hasStaticLexiconEntry: context.hasStaticLexiconEntry,
    isRejected: (id) => Boolean(rejected[id]),
  });

  proposal.confidence = gate.confidence;

  if (gate.decision === LEXICON_GATE_DECISIONS.AUTO_PROMOTED) {
    proposal.status = LEXICON_PROPOSAL_STATUS.PROMOTED;
    upsertLexiconProposal(proposal);
    promoteLexiconEntry(
      proposal.canonicalKey,
      buildPromotedLexiconEntry(proposal),
    );
    recordLexiconLearningEvent({
      type: "promoted",
      proposalId: proposal.id,
      canonicalKey: proposal.canonicalKey,
      label: proposal.label,
      confidence: gate.confidence,
      provenanceCount: proposal.provenance?.length ?? 0,
      subjectShape: proposal.subjectShape,
    });
  } else if (gate.decision === LEXICON_GATE_DECISIONS.PROPOSED) {
    proposal.status = LEXICON_PROPOSAL_STATUS.PROPOSED;
    upsertLexiconProposal(proposal);
    recordLexiconLearningEvent({
      type: "proposed",
      proposalId: proposal.id,
      canonicalKey: proposal.canonicalKey,
      confidence: gate.confidence,
      reasons: gate.reasons,
    });
  } else if (gate.decision === LEXICON_GATE_DECISIONS.REJECTED) {
    recordLexiconLearningEvent({
      type: "rejected",
      proposalId: proposal.id,
      canonicalKey: proposal.canonicalKey,
      reasons: gate.reasons,
    });
  } else {
    upsertLexiconProposal(proposal);
    recordLexiconLearningEvent({
      type: "observed",
      canonicalKey: proposal.canonicalKey,
      occurrences: proposal.occurrences,
      confidence: gate.confidence,
    });
  }

  return { observation, proposal, gate };
}
