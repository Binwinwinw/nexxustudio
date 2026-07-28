/**
 * exploratory_conversation_light — thème ouvert sans mandat livrable.
 */
import {
  extractExploratoryTopic,
  isExploratoryTopicIntent,
} from "../utils/exploratoryConversationGuards.js";
import { isAttachedVisionRequest } from "../utils/conversationGuards.js";

export const EXPLORATORY_CONVERSATION_RULE = "exploratory_conversation_light_v1";

/** Batterie arts martiaux — exploration. */
export const EXPLORATORY_CANONICAL_MARTIAL_QUERY =
  "ok on part vers des enseignements d'art martiaux…";

/**
 * @param {string} query
 * @returns {string}
 */
export function buildExploratoryConversationSystemAddon(query = "") {
  const topic = extractExploratoryTopic(query) || "le thème évoqué";
  return [
    "VARIANTE EXPLORATION CONVERSATIONNELLE (pas mandat livrable) :",
    `- Thème : **${topic}**.`,
    "FORMAT OBLIGATOIRE :",
    "1) Accueille le thème avec enthousiasme mesuré (1–2 phrases).",
    "2) Propose 2–3 pistes naturelles d'exploration (pas un plan de cours structuré).",
    "3) Une question ouverte légère pour la suite.",
    "INTERDIT :",
    "- « Je vois la piste, mais pas encore la destination… »",
    "- Clarification objectif/format/livrable.",
    "- Refus repeated_fallback ou orchestrateur lourd.",
  ].join("\n");
}

/**
 * @param {string} query
 * @returns {{ path: string, deferToLlm: boolean, reflectiveHint: string, exploratoryConversation: boolean }|null}
 */
export function resolveExploratoryConversationShortCircuit(
  query = "",
  options = {},
) {
  if (isAttachedVisionRequest(query, options.attachments || [])) return null;
  if (!isExploratoryTopicIntent(query)) return null;
  return {
    path: "exploratory_conversation_light",
    deferToLlm: true,
    reflectiveHint: buildExploratoryConversationSystemAddon(query),
    exploratoryConversation: true,
  };
}
