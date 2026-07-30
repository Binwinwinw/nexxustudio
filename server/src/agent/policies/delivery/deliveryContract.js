/**
 * DELIVERY_CONTRACT_V1 — tout tour terminal doit produire un texte visible
 * ou un fallback utile avant la couche HTTP.
 */
import { resolvePipelineFallback } from "../../utils/genericGreetingGuards.js";

export const DELIVERY_CONTRACT_V1 = "DELIVERY_CONTRACT_V1";

export const DELIVERY_MODES = Object.freeze({
  BUFFERED_FINAL: "buffered_final",
  STREAMED: "streamed",
});

/**
 * @param {{
 *   text?: string,
 *   query?: string,
 *   history?: object[],
 *   rawResponse?: string,
 *   reason?: string,
 * }} params
 * @returns {{ text: string, fallbackApplied: boolean, fallbackReason: string|null }}
 */
export function ensureTerminalDeliveryText({
  text = "",
  query = "",
  history = [],
  rawResponse = "",
  reason = "empty_pipeline_output",
} = {}) {
  const trimmed = String(text || "").trim();
  if (trimmed) {
    return { text: String(text), fallbackApplied: false, fallbackReason: null };
  }

  const fallback = resolvePipelineFallback({
    query,
    history,
    rawResponse: rawResponse || String(text || ""),
    reason,
  });
  const fallbackTrimmed = String(fallback || "").trim();

  return {
    text: fallbackTrimmed ? fallback : "",
    fallbackApplied: Boolean(fallbackTrimmed),
    fallbackReason: fallbackTrimmed ? reason : null,
  };
}
