/**
 * Telemetry observable — politique d'orchestration information_seeking_with_target(X).
 */
import { resolveInformationSeekingOrchestration } from "../policies/informationSeekingOrchestrationPolicy.js";

export const INFO_SEEKING_ORCHESTRATION_EVENT = "info_seeking_orchestration";

/**
 * @param {string} query
 * @param {ReturnType<typeof resolveInformationSeekingOrchestration>} orchestration
 * @param {{ pipelinePath?: string|null }} [extra]
 */
export function buildInformationSeekingOrchestrationEvent(
  query = "",
  orchestration = {},
  extra = {},
) {
  if (!orchestration?.applicable) {
    return {
      event: INFO_SEEKING_ORCHESTRATION_EVENT,
      applicable: false,
      timestamp: new Date().toISOString(),
      query_preview: String(query || "").slice(0, 120),
    };
  }

  return {
    event: INFO_SEEKING_ORCHESTRATION_EVENT,
    applicable: true,
    timestamp: new Date().toISOString(),
    rule: orchestration.rule,
    phase: orchestration.phase,
    shell_recognized: orchestration.shellRecognized,
    target: orchestration.target,
    target_type: orchestration.targetType,
    local_answer_found: orchestration.localAnswerFound,
    local_confidence: orchestration.localConfidence,
    local_source: orchestration.localSource,
    short_circuit_status: orchestration.shortCircuitStatus,
    recommended_action: orchestration.recommendedAction,
    pipeline_path: extra.pipelinePath ?? orchestration.pipelinePath ?? null,
    escalation_reason: orchestration.escalationReason,
    web_fallback_triggered: orchestration.webFallbackTriggered,
    web_query: orchestration.webQuery,
    prefer_web_research: orchestration.preferWebResearch,
    query_preview: String(query || "").slice(0, 120),
  };
}

/**
 * @param {string} query
 * @param {ReturnType<typeof resolveInformationSeekingOrchestration>} orchestration
 * @param {{ pipelinePath?: string|null }} [extra]
 */
export function recordInformationSeekingOrchestrationTelemetry(
  query = "",
  orchestration = {},
  extra = {},
) {
  const event = buildInformationSeekingOrchestrationEvent(
    query,
    orchestration,
    extra,
  );
  if (event.applicable !== false) {
    console.log(`[INFO_SEEK_ORCH] ${JSON.stringify(event)}`);
  }
  return event;
}

/**
 * @param {string} query
 * @param {object} [ctx]
 * @param {{ pipelinePath?: string|null }} [extra]
 */
export function observeInformationSeekingOrchestration(
  query = "",
  ctx = {},
  extra = {},
) {
  const orchestration = resolveInformationSeekingOrchestration(query, ctx);
  if (!orchestration.applicable) return { orchestration, event: null };
  const event = recordInformationSeekingOrchestrationTelemetry(
    query,
    orchestration,
    extra,
  );
  return { orchestration, event };
}
