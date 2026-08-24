import { nsToMs } from "../../llm/ollamaCallMetrics.js";

export const DOCUMENT_LATENCY_KEYS = Object.freeze([
  "document_extract_ms",
  "prompt_build_ms",
  "model_load_ms",
  "prompt_eval_ms",
  "first_token_ms",
  "generation_ms",
  "sanitize_ms",
  "delivery_ms",
]);

function roundMs(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Décompose la latence DOCUMENT : timings client + durées natives Ollama (ns).
 * TTFT client ≠ load / prompt_eval / génération.
 */
export function buildDocumentLatencyBreakdown({
  document_extract_ms = null,
  prompt_build_ms = null,
  ollamaDone = null,
  first_token_ms = null,
  sanitize_ms = null,
  delivery_ms = null,
} = {}) {
  const breakdown = {
    document_extract_ms: roundMs(document_extract_ms),
    prompt_build_ms: roundMs(prompt_build_ms),
    model_load_ms: nsToMs(ollamaDone?.load_duration),
    prompt_eval_ms: nsToMs(ollamaDone?.prompt_eval_duration),
    first_token_ms: roundMs(first_token_ms),
    generation_ms: nsToMs(ollamaDone?.eval_duration),
    sanitize_ms: roundMs(sanitize_ms),
    delivery_ms: roundMs(delivery_ms),
  };
  const ranked = DOCUMENT_LATENCY_KEYS
    .filter((key) => key !== "first_token_ms")
    .map((key) => [key, breakdown[key]])
    .filter(([, value]) => value != null && value > 0)
    .sort((a, b) => b[1] - a[1]);
  breakdown.dominant = ranked[0]?.[0] ?? null;
  breakdown.dominant_ms = ranked[0]?.[1] ?? null;
  return breakdown;
}

export function logDocumentLatencyBreakdown(breakdown, extra = {}) {
  console.log(
    `[DOCUMENT][latency] ${JSON.stringify({
      event: "document.latency",
      ...breakdown,
      ...extra,
    })}`,
  );
}

export function applyDocumentLatencyMetrics(turnTelemetry, breakdown) {
  if (!turnTelemetry?.setMetric || !breakdown) return;
  for (const key of DOCUMENT_LATENCY_KEYS) {
    if (breakdown[key] != null) turnTelemetry.setMetric(key, breakdown[key]);
  }
}
