/**
 * Rapport de gouvernance du lexique vivant — agrégats et journal des promotions.
 */
import {
  readLexiconLearningEvents,
  readLexiconObservations,
  readLexiconProposals,
  readPromotedLexiconFile,
  readRejectedLexiconProposals,
} from "./lexiconLearningStore.js";
import { LEXICON_PROPOSAL_STATUS } from "./subjectPromotionCandidateBuilder.js";

function countByStatus(proposals = {}) {
  const counts = {
    observed: 0,
    proposed: 0,
    promoted: 0,
    rejected: 0,
  };
  for (const proposal of Object.values(proposals)) {
    if (proposal.status === LEXICON_PROPOSAL_STATUS.OBSERVED) counts.observed += 1;
    else if (proposal.status === LEXICON_PROPOSAL_STATUS.PROPOSED) counts.proposed += 1;
    else if (proposal.status === LEXICON_PROPOSAL_STATUS.PROMOTED) counts.promoted += 1;
    else if (proposal.status === LEXICON_PROPOSAL_STATUS.REJECTED) counts.rejected += 1;
  }
  return counts;
}

function countEventsToday(events = []) {
  const day = new Date().toISOString().slice(0, 10);
  const today = { proposed: 0, promoted: 0, rejected: 0, revoked: 0, observed: 0 };
  for (const event of events) {
    if (!event.at?.startsWith(day)) continue;
    if (event.type === "proposed") today.proposed += 1;
    if (event.type === "promoted") today.promoted += 1;
    if (event.type === "rejected") today.rejected += 1;
    if (event.type === "revoked") today.revoked += 1;
    if (event.type === "observed") today.observed += 1;
  }
  return today;
}

export function buildLexiconLearningSnapshot() {
  const proposals = readLexiconProposals();
  const promoted = readPromotedLexiconFile();
  const rejected = readRejectedLexiconProposals();
  const events = readLexiconLearningEvents(300);
  const observations = readLexiconObservations(300);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      observations: observations.length,
      proposals: Object.keys(proposals).length,
      promotedEntries: Object.keys(promoted.entries || {}).length,
      rejected: Object.keys(rejected).length,
    },
    statusCounts: countByStatus(proposals),
    today: countEventsToday(events),
    recentEvents: events.slice(0, 20),
    recentPromotions: Object.entries(promoted.entries || {})
      .slice(-10)
      .map(([key, entry]) => ({
        key,
        label: entry.label,
        confidence: entry.confidence,
        promotedAt: entry.promotedAt,
      })),
  };
}

export function formatLexiconLearningReportMarkdown(snapshot = buildLexiconLearningSnapshot()) {
  return `# Rapport lexique vivant

Généré : ${snapshot.generatedAt}

## Totaux
- Observations : ${snapshot.totals.observations}
- Propositions : ${snapshot.totals.proposals}
- Entrées promues : ${snapshot.totals.promotedEntries}
- Rejets : ${snapshot.totals.rejected}

## Aujourd'hui
- Observé : ${snapshot.today.observed}
- Proposé : ${snapshot.today.proposed}
- Promu : ${snapshot.today.promoted}
- Rejeté : ${snapshot.today.rejected}

## Statuts propositions
- observed: ${snapshot.statusCounts.observed}
- proposed: ${snapshot.statusCounts.proposed}
- promoted: ${snapshot.statusCounts.promoted}
- rejected: ${snapshot.statusCounts.rejected}
`;
}
