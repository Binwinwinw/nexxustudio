import {
  createKnowledgeRecord,
  findKnowledgeMatches,
  markKnowledgeSuperseded,
  reinforceRecord,
  recordOrUpdateCanonicalRecord,
} from "./knowledgeRecordStore.js";

function randomHex(length = 4) {
  return [...Array(length)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");
}

export async function ingestPromotedCandidate({
  candidate,
  sessionId = null,
  source = "candidate_promoted",
}) {
  if (!candidate || candidate.status !== "promoted") {
    return {
      ok: true,
      action: "noop",
      knowledge_id: null,
      matched_knowledge_id: null,
      warning: "candidate_not_promoted",
    };
  }

  const candidateRecord = normalizeCandidateToKnowledgeRecord({
    candidate,
    sessionId,
    source,
  });

  if (!candidateRecord || !candidateRecord.statement_canonical) {
    return {
      ok: false,
      action: "noop",
      knowledge_id: null,
      matched_knowledge_id: null,
      warning: "normalization_failed",
    };
  }

  try {
    return await recordOrUpdateCanonicalRecord({
      incomingRecord: candidateRecord,
      matchStrategy: "conservative",
    });
  } catch (error) {
    console.error(
      "[knowledgeIngestionService] ingestion failed:",
      error.message,
    );
    return {
      ok: false,
      action: "noop",
      knowledge_id: null,
      matched_knowledge_id: null,
      warning: "ingestion_error",
    };
  }
}

export function normalizeCandidateToKnowledgeRecord({
  candidate,
  sessionId = null,
  source = "candidate_promoted",
}) {
  if (!candidate) return null;

  const subject = candidate.subject || candidate.fact_text || "unknown";
  const statementCanonical =
    candidate.statement_canonical || candidate.fact_text || "";

  return {
    knowledge_id: `kh-${Date.now()}-${randomHex(4)}`,
    kind: candidate.kind || candidate.fact_type || "technical_fact",
    scope: candidate.scope || "global",
    namespace: candidate.namespace || null,
    subject: String(subject).trim(),
    statement_canonical: String(statementCanonical).trim(),
    aliases: Array.isArray(candidate.aliases) ? candidate.aliases : [],
    confidence:
      candidate.confidence ?? candidate.source_consensus_score ?? 0.75,
    status: "active",
    sources: [
      {
        candidate_id: candidate.candidate_id || null,
        episode_id: candidate.source_episode_id || candidate.episode_id || null,
        session_id: sessionId || candidate.session_id || null,
        validated_by_user: Boolean(candidate.validated_by_user),
        source_type: source,
        timestamp: new Date().toISOString(),
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_validated_at: new Date().toISOString(),
    supersedes: candidate.supersedes || null,
    superseded_by: null,
    tags: Array.isArray(candidate.tags) ? candidate.tags : [],
  };
}

export function decideKnowledgeIngestionAction({
  candidateRecord,
  existingMatches = [],
}) {
  if (!Array.isArray(existingMatches) || existingMatches.length === 0) {
    return { action: "created", match: null };
  }

  const exact = existingMatches.find(
    (match) =>
      match.statement_canonical === candidateRecord.statement_canonical,
  );

  if (exact) {
    return { action: "reinforced", match: exact };
  }

  const contradictory = existingMatches.find(
    (match) =>
      match.subject === candidateRecord.subject &&
      match.kind === candidateRecord.kind &&
      match.scope === candidateRecord.scope &&
      match.namespace === (candidateRecord.namespace ?? null),
  );

  if (contradictory && shouldSupersede(contradictory, candidateRecord)) {
    return { action: "superseded", match: contradictory };
  }

  return { action: "noop", match: contradictory || existingMatches[0] };
}

export async function applyKnowledgeIngestionAction({
  action,
  candidateRecord,
  existingMatch = null,
}) {
  switch (action) {
    case "created": {
      const created = createKnowledgeRecord(candidateRecord);
      return {
        ok: true,
        action: "created",
        knowledge_id: created.knowledge_id,
        matched_knowledge_id: null,
        warning: null,
      };
    }
    case "reinforced": {
      reinforceRecord(existingMatch.knowledge_id, candidateRecord.sources[0]);
      return {
        ok: true,
        action: "reinforced",
        knowledge_id: existingMatch.knowledge_id,
        matched_knowledge_id: existingMatch.knowledge_id,
        warning: null,
      };
    }
    case "superseded": {
      const created = createKnowledgeRecord({
        ...candidateRecord,
        supersedes: existingMatch.knowledge_id,
      });
      markKnowledgeSuperseded({
        previousKnowledgeId: existingMatch.knowledge_id,
        newKnowledgeId: created.knowledge_id,
        reason: "superseded_by_newer_fact",
      });
      return {
        ok: true,
        action: "superseded",
        knowledge_id: created.knowledge_id,
        matched_knowledge_id: existingMatch.knowledge_id,
        warning: null,
      };
    }
    case "noop":
    default:
      return {
        ok: true,
        action: "noop",
        knowledge_id: null,
        matched_knowledge_id: existingMatch?.knowledge_id || null,
        warning: "no_action_taken",
      };
  }
}

function shouldSupersede(existingRecord, incomingRecord) {
  if (incomingRecord.supersedes === existingRecord.knowledge_id) return true;
  if (
    incomingRecord.confidence >= existingRecord.confidence &&
    incomingRecord.statement_canonical !== existingRecord.statement_canonical
  ) {
    return true;
  }
  return false;
}
