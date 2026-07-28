/**
 * Enregistre épisode + candidate fact après un succès web_fallback (ADR-20260603).
 */
import { logTraceEvent } from "../../telemetry/traceLogger.js";
import { getLastPipelineMode } from "../../telemetry/pipelineTelemetry.js";
import { memoryOrchestrator } from "../MemoryOrchestrator.js";
import {
  appendWebCandidate,
  appendWebEpisode,
  findCandidatesByQueryNormalized,
  findCandidatesBySessionId,
  isWebCandidateMemoryEnabled,
  updateWebCandidate,
} from "./candidateKnowledgeStore.js";
import {
  assessWebCandidatePromotion,
  buildPromotionBlockReasons,
} from "./webCandidatePromotionPolicy.js";
import {
  answersAreCoherent,
  buildCandidateId,
  buildEpisodeId,
  computeSourceConsensusScore,
  inferCaseType,
  inferWebDomain,
  mapWebSources,
  normalizeWebQuery,
  WEB_CANDIDATE_POLICY_VERSION,
} from "./webCandidateUtils.js";
import { consumeWebTurnSnapshot } from "./webTurnContext.js";

const MIN_QUERY_LEN = 4;
const MIN_ANSWER_LEN = 24;

function logWebMemory(event, fields = {}) {
  logTraceEvent({
    event: `nexxus.web_memory.${event}`,
    ...fields,
  });
}

/**
 * @param {{
 *   userQuery: string,
 *   assistantResponse: string,
 *   sessionId?: string,
 *   turnId?: string,
 *   webSnapshot?: object,
 * }} input
 */
export function recordWebFallbackMemory(input = {}) {
  if (!isWebCandidateMemoryEnabled()) {
    return { status: "disabled" };
  }

  const snapshot = input.webSnapshot || consumeWebTurnSnapshot();
  if (!snapshot?.webPacket?.sources?.length) {
    return { status: "skipped", reason: "no_web_snapshot" };
  }

  const userQuery = String(input.userQuery || snapshot.query || "").trim();
  const assistantResponse = String(input.assistantResponse || "").trim();
  if (userQuery.length < MIN_QUERY_LEN || assistantResponse.length < MIN_ANSWER_LEN) {
    return { status: "skipped", reason: "insufficient_content" };
  }

  const webPacket = snapshot.webPacket;
  const queryNormalized = normalizeWebQuery(userQuery);
  const pipelineMode = snapshot.pipelineMode || getLastPipelineMode();
  const sessionId = input.sessionId || snapshot.sessionId || null;
  const turnId = input.turnId || null;
  const sources = mapWebSources(webPacket.sources);
  const consensus = computeSourceConsensusScore(webPacket.sources);

  const episode = {
    id: buildEpisodeId(),
    status: "ephemeral_success",
    query_raw: userQuery,
    query_normalized: queryNormalized,
    resolution_path: "web_fallback",
    source_count: sources.length,
    session_id: sessionId,
    turn_id: turnId,
    created_at: new Date().toISOString(),
  };
  appendWebEpisode(episode);
  logWebMemory("episode", {
    session_id: sessionId,
    turn_id: turnId,
    candidate_episode_id: episode.id,
    source_count: sources.length,
  });

  const existing = findCandidatesByQueryNormalized(queryNormalized, 5);
  let coherentReplays = 0;
  for (const prev of existing) {
    if (
      answersAreCoherent(
        prev.answer_synthesized,
        assistantResponse,
      )
    ) {
      coherentReplays = Math.max(
        coherentReplays,
        (prev.validation?.coherent_replays ?? 0) + 1,
      );
    }
  }

  const assessment = assessWebCandidatePromotion({
    sources,
    web: {
      confidence: webPacket.confidence ?? 0,
      source_consensus_score: consensus,
    },
    validation: {
      validated_by_user: false,
      implicitly_accepted: true,
      coherent_replays: coherentReplays,
      user_corrected: false,
    },
    provenance: { pipeline_mode: pipelineMode },
  });

  const candidate = {
    id: buildCandidateId(),
    status: "candidate_fact",
    query_raw: userQuery,
    query_normalized: queryNormalized,
    answer_synthesized: assistantResponse.slice(0, 8000),
    domain: inferWebDomain(queryNormalized),
    case_type: inferCaseType(queryNormalized),
    sources,
    web: {
      expert: "expert_web_search",
      confidence: webPacket.confidence ?? 0,
      source_consensus_score: consensus,
      failure_mode: webPacket.failure_mode ?? null,
      elapsed_ms: webPacket.elapsed_ms ?? null,
    },
    validation: {
      validated_by_user: false,
      implicitly_accepted: true,
      feedback_rating: null,
      user_corrected: false,
      reuse_count: 0,
      coherent_replays: coherentReplays,
    },
    provenance: {
      session_id: sessionId,
      turn_id: turnId,
      pipeline_mode: pipelineMode,
      resolution_path: "web_fallback",
      episode_id: episode.id,
    },
    promotion: {
      eligible: assessment.eligible,
      reasons: assessment.eligible
        ? []
        : buildPromotionBlockReasons(assessment),
      policy_version: WEB_CANDIDATE_POLICY_VERSION,
    },
    created_at: new Date().toISOString(),
  };

  appendWebCandidate(candidate);
  logWebMemory("candidate", {
    session_id: sessionId,
    turn_id: turnId,
    candidate_id: candidate.id,
    eligible: assessment.eligible,
    coherent_replays: coherentReplays,
  });

  if (assessment.eligible) {
    return tryPromoteWebCandidate(candidate, { sessionId, turnId });
  }

  return {
    status: "candidate_saved",
    candidateId: candidate.id,
    promotion: candidate.promotion,
  };
}

/**
 * @param {object} candidate
 */
export async function tryPromoteWebCandidate(candidate, { sessionId, turnId } = {}) {
  const assessment = assessWebCandidatePromotion(candidate);
  if (!assessment.eligible) {
    const updated = updateWebCandidate(candidate.id, {
      promotion: {
        eligible: false,
        reasons: buildPromotionBlockReasons(assessment),
        policy_version: WEB_CANDIDATE_POLICY_VERSION,
      },
    });
    logWebMemory("promotion", {
      session_id: sessionId,
      candidate_id: candidate.id,
      promotion_status: "promotion_rejected",
      reasons: assessment.reasons,
    });
    return {
      status: "promotion_rejected",
      candidateId: candidate.id,
      reasons: assessment.reasons,
      candidate: updated,
    };
  }

  if (process.env.CURATED_MEMORY_INGEST !== "1") {
    updateWebCandidate(candidate.id, {
      promotion: {
        eligible: true,
        reasons: ["curated_memory_ingest_disabled"],
        policy_version: WEB_CANDIDATE_POLICY_VERSION,
      },
    });
    return {
      status: "promotion_deferred",
      candidateId: candidate.id,
      reason: "CURATED_MEMORY_INGEST_not_enabled",
    };
  }

  const result = await memoryOrchestrator.evaluateAndCommitMemory(
    candidate.query_raw,
    candidate.answer_synthesized,
    {
      sessionId: sessionId || candidate.provenance?.session_id,
      turnId: turnId || candidate.provenance?.turn_id,
      pipelineMode: candidate.provenance?.pipeline_mode,
      webCandidateId: candidate.id,
    },
  );

  const promoted =
    result?.status === "committed" || result?.status === "promoted";
  const finalStatus = promoted
    ? "promoted_to_local_knowledge"
    : "promotion_rejected";

  updateWebCandidate(candidate.id, {
    status: promoted ? "promoted_to_local_knowledge" : candidate.status,
    promotion: {
      eligible: promoted,
      reasons: promoted
        ? []
        : [result?.status || "evaluate_rejected", ...(result?.reasons || [])],
      policy_version: WEB_CANDIDATE_POLICY_VERSION,
      curated_result: result?.status,
    },
  });

  logWebMemory("promotion", {
    session_id: sessionId,
    candidate_id: candidate.id,
    promotion_status: finalStatus,
    curated_status: result?.status,
  });

  return {
    status: finalStatus,
    candidateId: candidate.id,
    curated: result,
  };
}

/**
 * Feedback utilisateur → validation + promotion éventuelle.
 */
export async function applyWebCandidateSessionFeedback({
  sessionId,
  rating,
  comment = "",
}) {
  if (!isWebCandidateMemoryEnabled() || !sessionId) {
    return { status: "disabled" };
  }

  const recent = findCandidatesBySessionId(sessionId, 3);
  if (!recent.length) {
    return { status: "skipped", reason: "no_candidates_for_session" };
  }

  const target = recent[0];
  const validationPatch = {
    feedback_rating: rating,
    feedback_comment: String(comment).slice(0, 500),
  };

  if (rating === "useful") {
    validationPatch.validated_by_user = true;
    validationPatch.implicitly_accepted = true;
  } else if (rating === "unhelpful") {
    validationPatch.validated_by_user = false;
    validationPatch.user_corrected = true;
    validationPatch.implicitly_accepted = false;
  } else {
    validationPatch.implicitly_accepted = true;
  }

  const updated = updateWebCandidate(target.id, {
    validation: validationPatch,
  });
  if (!updated) {
    return { status: "skipped", reason: "candidate_not_found" };
  }

  if (rating === "unhelpful") {
    return {
      status: "candidate_saved",
      candidateId: target.id,
      validation: updated.validation,
    };
  }

  return tryPromoteWebCandidate(updated, {
    sessionId,
    turnId: updated.provenance?.turn_id,
  });
}
