/**
 * Métriques Ollama sans prompt ni réponse.
 * Durées natives Ollama : nanosecondes → ms.
 */

export function nsToMs(ns) {
  if (ns == null || ns === "") return null;
  const n = Number(ns);
  return Number.isFinite(n) ? Math.round(n / 1e6) : null;
}

export function buildOllamaCallMetrics(fields = {}) {
  return {
    event: "ollama.call",
    model: fields.model || null,
    attempt: fields.attempt || 1,
    kind: fields.kind || null,
    duration_ms: fields.durationMs ?? null,
    ttft_ms: fields.ttftMs ?? null,
    total_duration_ms: nsToMs(fields.total_duration),
    load_duration_ms: nsToMs(fields.load_duration),
    prompt_eval_duration_ms: nsToMs(fields.prompt_eval_duration),
    eval_duration_ms: nsToMs(fields.eval_duration),
    eval_count: fields.eval_count ?? fields.tokenCount ?? null,
    status: fields.status || "ok",
  };
}

export function logOllamaCallMetrics(fields) {
  console.log(`[Ollama] ${JSON.stringify(buildOllamaCallMetrics(fields))}`);
}
