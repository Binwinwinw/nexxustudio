/**
 * Telemetry — résolution de références au contexte de session.
 */
import { resolveSessionContextReference } from "../utils/sessionContextReferenceResolver.js";

export const CONTEXT_REFERENCE_EVENT = "context_reference_resolution";

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} history
 * @param {{ pipelinePath?: string|null }} [extra]
 */
export function buildContextReferenceTelemetryEvent(
  query = "",
  history = [],
  extra = {},
) {
  const resolution = resolveSessionContextReference(query, history);
  if (!resolution.applicable) {
    return { event: CONTEXT_REFERENCE_EVENT, applicable: false };
  }

  return {
    event: CONTEXT_REFERENCE_EVENT,
    applicable: true,
    timestamp: new Date().toISOString(),
    reference_type: resolution.referenceType,
    reference_target: resolution.target,
    reference_resolved: resolution.resolved,
    resolution_source: resolution.resolutionSource,
    previous_output_as_source: resolution.previousOutputAsSource,
    pipeline_path: extra.pipelinePath ?? null,
    enriched_query_preview: resolution.enrichedQuery
      ? String(resolution.enrichedQuery).slice(0, 120)
      : null,
    query_preview: String(query || "").slice(0, 120),
  };
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} history
 * @param {{ pipelinePath?: string|null }} [extra]
 */
export function recordContextReferenceTelemetry(query = "", history = [], extra = {}) {
  const event = buildContextReferenceTelemetryEvent(query, history, extra);
  if (!event.applicable) return null;
  console.log(`[CONTEXT_REF] ${JSON.stringify(event)}`);
  return event;
}
