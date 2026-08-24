/**
 * Options Ollama du rail DOCUMENT uniquement.
 * think=false : champ top-level /api/chat, pas une consigne prompt.
 */

export const DOCUMENT_OLLAMA_TEMPERATURE = 0.3;
export const DOCUMENT_OLLAMA_THINK = false;

export function buildDocumentOllamaChatOptions({
  think = DOCUMENT_OLLAMA_THINK,
} = {}) {
  const options = { temperature: DOCUMENT_OLLAMA_TEMPERATURE };
  if (think === true || think === false) options.think = think;
  return options;
}

export function isDocumentThinkUnsupportedError(error) {
  const status = error?.response?.status;
  const body = String(
    error?.response?.data?.error || error?.message || "",
  ).toLowerCase();
  return (
    body.includes("think") ||
    (status === 400 && body.includes("unknown"))
  );
}

/** Chemins DOCUMENT après think=false : nominal | retry | fallback. */
export function resolveDocumentRailPath({
  thinkRetry = false,
  usedFallback = false,
} = {}) {
  if (usedFallback) return "invalid_fallback";
  if (thinkRetry) return "think_rejected_retry";
  return "nominal";
}
