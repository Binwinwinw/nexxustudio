/**
 * Télémétrie discrète — factualSanityGate (observation terrain).
 */
import { normalizeFamiliarityQuery } from "../utils/familiarityIntentGuards.js";

export const FACTUAL_SANITY_TELEMETRY_EVENT = "factual_sanity_gate";

/**
 * @param {string} query
 * @param {{
 *   path: string,
 *   decision: string,
 *   reason?: string|null,
 *   matchedRule?: string|null,
 * }} outcome
 */
export function buildFactualSanityTelemetryEvent(query = "", outcome = {}) {
  const normalized = normalizeFamiliarityQuery(query) || "";
  return {
    event: FACTUAL_SANITY_TELEMETRY_EVENT,
    timestamp: new Date().toISOString(),
    path: outcome.path || null,
    decision: outcome.decision || null,
    reason: outcome.reason ?? null,
    matched_rule: outcome.matchedRule ?? null,
    query_preview: String(query || "").slice(0, 160),
    query_length: normalized.length,
  };
}

/**
 * @param {string} query
 * @param {Parameters<typeof buildFactualSanityTelemetryEvent>[1]} outcome
 */
export function recordFactualSanityTelemetry(query = "", outcome = {}) {
  const event = buildFactualSanityTelemetryEvent(query, outcome);
  console.log(`[FACTUAL_SANITY] ${JSON.stringify(event)}`);
  return event;
}
