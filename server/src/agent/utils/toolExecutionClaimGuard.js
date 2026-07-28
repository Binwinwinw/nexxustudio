/**
 * Fail-closed — bloque les promesses d'outils non exécutés au runtime (tool theater).
 */
import { UNSUPPORTED_ACTION_REFUSAL } from "../config/modeResponseContracts.js";

const TOOL_NAMES = ["webSummarize", "webSearch", "knowledgeSearch", "librarianSearch"];

const TOOL_PROMISE_PATTERNS = [
  /\b(?:en utilisant|via|avec|grace a|grâce a|grâce à)\s+(?:ma capacite|ma capacité)?\s*webSummarize\b/i,
  /\bje pourrai procéder\b.{0,80}\bwebSummarize\b/i,
  /\bwebSummarize\b.{0,60}\b(?:recherche|document|officiel)/i,
  /\b(?:en utilisant|via|avec)\s+webSearch\b/i,
  /\bje vais (?:lancer|utiliser|executer|exécuter)\s+webSearch\b/i,
];

/**
 * @param {string} text
 * @param {string[]} [toolsUsed=[]]
 * @returns {string[]}
 */
export function detectUnverifiedToolExecutionClaims(text = "", toolsUsed = []) {
  const body = String(text || "").trim();
  if (!body) return [];

  const used = new Set(
    (Array.isArray(toolsUsed) ? toolsUsed : []).map((t) => String(t || "").trim()),
  );

  const violations = [];
  for (const pattern of TOOL_PROMISE_PATTERNS) {
    if (!pattern.test(body)) continue;
    for (const tool of TOOL_NAMES) {
      if (!new RegExp(`\\b${tool}\\b`, "i").test(body)) continue;
      if (!used.has(tool)) {
        violations.push(tool);
      }
    }
  }

  return [...new Set(violations)];
}

/**
 * @param {string} text
 * @param {string[]} [toolsUsed=[]]
 * @returns {string}
 */
export function sanitizeUnverifiedToolExecutionClaims(text = "", toolsUsed = []) {
  const violations = detectUnverifiedToolExecutionClaims(text, toolsUsed);
  if (!violations.length) return text;

  let cleaned = String(text || "");
  for (const tool of violations) {
    cleaned = cleaned.replace(new RegExp(`[^.!?]*\\b${tool}\\b[^.!?]*[.!?]?`, "gi"), "").trim();
  }

  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length > 40) return cleaned;

  return UNSUPPORTED_ACTION_REFUSAL;
}
