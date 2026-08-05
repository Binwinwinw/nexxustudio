/**
 * Shadow telemetry — RequestIntentFrame vs path servi (v1.1 observation).
 */
import { analyzeRequestIntentFrame } from "../policies/intent/requestIntentFrame.js";
import { isInformationSeekingWithTarget } from "../utils/informationSeekingIntentGuards.js";

export const REQUEST_INTENT_FRAME_TELEMETRY_EVENT = "request_intent_frame_shadow";

/**
 * @param {string} query
 * @param {{ pipelinePath?: string|null, shortCircuitPath?: string|null }} [ctx]
 */
export function buildRequestIntentFrameTelemetryEvent(query = "", ctx = {}) {
  const frame = analyzeRequestIntentFrame(query);
  const pipelinePath = ctx.pipelinePath ?? ctx.shortCircuitPath ?? null;

  return {
    event: REQUEST_INTENT_FRAME_TELEMETRY_EVENT,
    timestamp: new Date().toISOString(),
    version: frame.version,
    task_kind: frame.task?.kind ?? null,
    domain_kind: frame.domain?.kind ?? null,
    domain_target: frame.domain?.target ?? null,
    family_hint: frame.familyHint?.id ?? null,
    family_hint_confidence: frame.familyHint?.confidence ?? null,
    social_only: frame.conversation?.socialOnly ?? false,
    composite: frame.composite ?? false,
    confidence: frame.confidence ?? null,
    information_seeking: isInformationSeekingWithTarget(query),
    pipeline_path: pipelinePath,
    path_divergence:
      frame.familyHint?.id && pipelinePath
        ? frame.familyHint.id !== pipelinePath
        : null,
    query_preview: String(query || "").slice(0, 120),
  };
}

/**
 * @param {string} query
 * @param {{ pipelinePath?: string|null, shortCircuitPath?: string|null }} [ctx]
 */
export function recordRequestIntentFrameTelemetry(query = "", ctx = {}) {
  const event = buildRequestIntentFrameTelemetryEvent(query, ctx);
  console.log(`[INTENT_FRAME] ${JSON.stringify(event)}`);
  return event;
}
