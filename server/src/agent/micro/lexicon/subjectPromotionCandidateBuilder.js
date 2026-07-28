/**
 * Construit une proposition d'entrée lexique canonique à partir d'observations agrégées.
 */
import { sanitizeQuery } from "../normalization/querySanitizer.js";
import { SUBJECT_SHAPES } from "../classifiers/subjectUnderstanding.js";
import {
  computeProposalConfidence,
  countDistinctSessions,
  LEXICON_PROMOTION_POLICY_V1,
} from "./lexiconPromotionPolicy.js";
import { readLexiconObservations } from "./lexiconLearningStore.js";

export const LEXICON_PROPOSAL_STATUS = {
  OBSERVED: "observed",
  PROPOSED: "proposed",
  PROMOTED: "promoted",
  REJECTED: "rejected",
};

function normalizeAlias(value = "") {
  return sanitizeQuery(value);
}

function mapShapeToCategory(shape = "", fallbackCategory = "unknown_subject") {
  switch (shape) {
    case SUBJECT_SHAPES.PLACE:
      return "place_institution";
    case SUBJECT_SHAPES.TOOL:
      return "tool_platform";
    case SUBJECT_SHAPES.CONCEPT:
      return "concept_method";
    case SUBJECT_SHAPES.PERSON:
      return "person_entity";
    default:
      return fallbackCategory || "unknown_subject";
  }
}

function mergeAliases(existing = [], ...candidates) {
  const set = new Set(existing.map(normalizeAlias).filter(Boolean));
  for (const candidate of candidates) {
    const norm = normalizeAlias(candidate);
    if (norm) set.add(norm);
  }
  return [...set];
}

function buildProposalId(canonicalKey) {
  return `lexprop_${canonicalKey.replace(/\s+/g, "_")}`;
}

export function aggregateObservationsForKey(canonicalKey, observations = []) {
  const rows = observations.filter((o) => o.canonicalKey === canonicalKey);
  if (!rows.length) return null;

  const aliases = mergeAliases(
    [],
    canonicalKey,
    ...rows.map((r) => r.rawSubject),
    ...rows.map((r) => r.label),
  );

  const latest = rows[rows.length - 1];
  const provenance = rows.map((r) => ({
    at: r.at,
    sessionId: r.sessionId || "unknown",
    query: r.query,
    rawSubject: r.rawSubject,
  }));

  const occurrences = rows.length;
  const distinctSessions = countDistinctSessions(provenance);

  const proposal = {
    id: buildProposalId(canonicalKey),
    canonicalKey,
    label: latest.label,
    aliases,
    category: mapShapeToCategory(latest.subjectShape, latest.category),
    subjectShape: latest.subjectShape,
    definition: latest.definition,
    intentKinds: [...new Set(rows.map((r) => r.intentKind).filter(Boolean))],
    occurrences,
    distinctSessions,
    provenance,
    status: LEXICON_PROPOSAL_STATUS.OBSERVED,
    createdAt: rows[0].at,
    updatedAt: latest.at,
  };

  proposal.confidence = computeProposalConfidence(proposal);
  return proposal;
}

export function buildPromotionCandidateFromObservation(observation, existingProposal = null) {
  if (!observation?.canonicalKey) return null;

  const historical = readLexiconObservations(1000).filter(
    (row) => row.canonicalKey === observation.canonicalKey,
  );

  const merged = aggregateObservationsForKey(observation.canonicalKey, historical);

  if (!merged) return null;

  if (existingProposal?.status === LEXICON_PROPOSAL_STATUS.PROMOTED) {
    return existingProposal;
  }

  if (existingProposal?.status === LEXICON_PROPOSAL_STATUS.REJECTED) {
    return existingProposal;
  }

  merged.status =
    existingProposal?.status === LEXICON_PROPOSAL_STATUS.PROPOSED
      ? LEXICON_PROPOSAL_STATUS.PROPOSED
      : LEXICON_PROPOSAL_STATUS.OBSERVED;

  if (
    merged.occurrences >= LEXICON_PROMOTION_POLICY_V1.thresholds.minOccurrencesProposed &&
    merged.status === LEXICON_PROPOSAL_STATUS.OBSERVED
  ) {
    merged.status = LEXICON_PROPOSAL_STATUS.PROPOSED;
  }

  merged.createdAt = existingProposal?.createdAt || merged.createdAt;
  merged.updatedAt = new Date().toISOString();
  return merged;
}

export function buildPromotedLexiconEntry(proposal = {}) {
  return {
    label: proposal.label,
    category: proposal.category,
    subjectShape: proposal.subjectShape,
    definition: proposal.definition,
    aliases: proposal.aliases || [proposal.canonicalKey],
    confidence: proposal.confidence,
    promotionId: proposal.id,
    provenance: proposal.provenance?.slice(-5) || [],
    source: "governed_auto_promotion",
    policyVersion: LEXICON_PROMOTION_POLICY_V1.version,
  };
}
