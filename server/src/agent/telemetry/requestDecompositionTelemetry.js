/**
 * Telemetry — décomposition gouvernée des requêtes.
 */
import { decomposeRequest } from "../policies/routing/requestDecompositionPolicy.js";

export const REQUEST_DECOMPOSITION_EVENT = "request_decomposition";

/**
 * @param {string} query
 * @param {ReturnType<typeof decomposeRequest>|null} [decomposition]
 * @param {{ pipelinePath?: string|null }} [extra]
 */
export function buildRequestDecompositionTelemetryEvent(
  query = "",
  decomposition = null,
  extra = {},
) {
  const resolved = decomposition || decomposeRequest(query);
  return {
    event: REQUEST_DECOMPOSITION_EVENT,
    timestamp: new Date().toISOString(),
    request_mode: resolved.requestMode,
    execution_mode: resolved.executionMode,
    unit_count: resolved.unitCount,
    unit_types: resolved.unitTypes,
    contains_social_preamble: resolved.containsSocialPreamble,
    has_cross_unit_dependencies: resolved.hasCrossUnitDependencies,
    primary_unit_id: resolved.primaryUnitId,
    pipeline_path: extra.pipelinePath ?? null,
    query_preview: String(query || "").slice(0, 120),
  };
}

/**
 * @param {string} query
 * @param {ReturnType<typeof decomposeRequest>|null} [decomposition]
 * @param {{ pipelinePath?: string|null }} [extra]
 */
export function recordRequestDecompositionTelemetry(
  query = "",
  decomposition = null,
  extra = {},
) {
  const event = buildRequestDecompositionTelemetryEvent(
    query,
    decomposition,
    extra,
  );
  console.log(`[REQUEST_DECOMP] ${JSON.stringify(event)}`);
  return event;
}
