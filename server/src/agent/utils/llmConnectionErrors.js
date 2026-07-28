/**
 * Erreurs connexion LLM local (Ollama / AirLLM).
 */

import { buildVisionInfrastructureFailureReply } from "../capabilities/ocr/ocrVisionFallback.js";

export function isOllamaUnreachableError(error) {
  if (!error) return false;
  const code = error.code || error.cause?.code;
  if (code === "ECONNREFUSED") return true;
  const msg = String(error.message || error).toLowerCase();
  return msg.includes("econnrefused") || msg.includes("11434");
}

/**
 * @param {Error|object} error
 * @param {{ visionFailed?: boolean }} [ctx]
 */
export function buildLlmUnreachableUserMessage(error, ctx = {}) {
  if (!isOllamaUnreachableError(error)) {
    return null;
  }
  if (ctx.visionFailed) {
    return buildVisionInfrastructureFailureReply();
  }
  return (
    "Le moteur de langage local (Ollama) ne répond pas sur le port 11434. " +
    "Démarre Ollama (`ollama serve`) ou vérifie `OLLAMA_HOST` dans server/.env, puis réessaie."
  );
}
