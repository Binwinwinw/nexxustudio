import { normalizeText as normalizeTextBase } from "./normalizationGuards.js";

const REPAIR_PATTERNS = [
  /\b(j ai pas|je n ai pas|j ai rien|je n ai rien)\s+(compris|saisi|pige)\b/i,
  /\b(tu n as pas|tu as mal|tu n as rien|tu m as mal)\s+(compris|saisi|pige)\b/i,
  /\b(ce n est pas ce que|c est pas ce que).{0,20}(voulais|demandais|disais|cherchais)\b/i,
  /\b(hors sujet|a cote de la plaque|pas (ca|ça)|pas du tout)\b/i,
  /\b(?:ta|votre|cette)\s+reponse\b.{0,40}\b(?:echec|incorrecte?|pas\s+correcte?|mauvaise)\b/i,
  /\bce n est pas une reponse correcte\b/i,
  /\breponse\s+(?:est|etait)\s+(?:un\s+)?echec\b/i,
];

function normalizeText(input = "") {
  return normalizeTextBase(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.*]+$/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if the user is attempting to repair the conversation due to a misunderstanding.
 * @param {string} query The user's query
 * @param {Array<{ role?: string, content?: string }>} history The conversation history
 * @returns {boolean}
 */
export function isAssistantRepairIntent(query = "", history = []) {
  const text = normalizeText(query);
  
  // Rule 1: It must match a strong repair pattern
  const matchesPattern = REPAIR_PATTERNS.some((p) => p.test(text));
  if (!matchesPattern) return false;

  // Rule 2: There must be a recent assistant response to repair
  // We check if the last message in history before this one is from the assistant
  if (!Array.isArray(history) || history.length === 0) return false;
  
  // Find the most recent assistant message
  let hasRecentAssistant = false;
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg?.role === "assistant" || msg?.role === "model") {
      // Must be recent (e.g. within the last 2-3 turns)
      if (history.length - i <= 3) {
        hasRecentAssistant = true;
      }
      break;
    }
  }

  return hasRecentAssistant;
}
