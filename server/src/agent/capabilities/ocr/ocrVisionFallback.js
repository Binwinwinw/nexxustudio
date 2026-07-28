/**
 * Fallback OCR HTTP quand le pipeline Vision (Ollama) échoue sur une PJ image.
 */

import { resolveOcrServiceBaseUrl } from "./ocrConfig.js";
import { ocrPageRequest } from "./ocrClient.js";
import { resolveAttachmentPathsForOcr } from "./ocrConfig.js";

const TRANSCRIBE_OR_OCR_RE =
  /\b(transcri(?:re|ption|re)?|retranscri|ocr|extraire|extrait|texte dans|lis(?:er)?(?:\s+le)?\s+texte)\b/i;

/**
 * @param {string} query
 * @param {unknown[]} attachments
 * @returns {Promise<{ text: string, markdown: string, backend: string }|null>}
 */
export async function tryOcrServiceFallbackForVisionFailure(query = "", attachments = []) {
  if (!TRANSCRIBE_OR_OCR_RE.test(String(query || ""))) return null;
  if (!resolveOcrServiceBaseUrl()) return null;

  const { imagePaths } = resolveAttachmentPathsForOcr(attachments);
  const imagePath = imagePaths[0];
  if (!imagePath) return null;

  const run = await ocrPageRequest({ imagePath });
  if (!run?.ok || !run.data) return null;

  const text = String(run.data.text || run.data.markdown || "").trim();
  if (!text) return null;

  return {
    text,
    markdown: String(run.data.markdown || text),
    backend: run.data.backend || "ocr-service",
  };
}

/**
 * @param {string} [ollamaHost]
 */
export function buildVisionInfrastructureFailureReply(ollamaHost) {
  const host = ollamaHost || process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
  const ocrUrl = resolveOcrServiceBaseUrl();
  const ocrHint = ocrUrl
    ? `Le service OCR interne est configuré (${ocrUrl}) — une transcription peut passer par ce fallback si la vision Ollama échoue.`
    : "Pour la transcription sans vision Ollama, lance `ocr-service` (stub ou Transformers) et définis `OCR_SERVICE_URL` dans server/.env.";
  return (
    `Je n'ai pas pu analyser l'image : le moteur vision local (Ollama, ${host}) ne répond pas (connexion refusée).\n\n` +
    `À vérifier : Ollama démarré (\`ollama serve\`), modèles vision installés (ex. \`ollama pull gemma4:12b\`).\n\n` +
    ocrHint
  );
}
