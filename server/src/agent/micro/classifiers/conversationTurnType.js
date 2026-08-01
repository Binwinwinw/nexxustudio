/**
 * Classification du type de tour — avant résolution de sujet métier (évite carry-over NFS, etc.).
 */
import { normalizeText } from "../../utils/normalizationGuards.js";
import { isAssistantUtteranceClarifyRequest } from "../../policies/qualification/assistantUtteranceClarifyPolicy.js";

export const CONVERSATION_TURN_TYPES = {
  TASK_REQUEST: "task_request",
  ELLIPTIC_FOLLOWUP: "elliptic_followup",
  META_FEEDBACK: "meta_feedback",
  ASSISTANT_CORRECTION: "assistant_correction",
};

const META_FEEDBACK_MARKERS = [
  /\battention\b/i,
  /\bil\s+(parle|parlait|traite|traitait|ne\s+ma[iî]trise)\b/i,
  /\btu\s+(parles|parlais|ne\s+ma[iî]trise|devrais)\b/i,
  /\b(l['']?assistant|l\s+agent)\b/i,
  /\b(la\s+|ta\s+|votre\s+|cette\s+)?r[eé]ponse\s+(était|est|parle|parlait|dérive|derive|incorrecte|hors\s+sujet|un\s+[eé]chec)\b/i,
  /\b(?:ta|votre|cette)\s+r[eé]ponse\b.{0,40}\b(?:[eé]chec|incorrecte?|pas\s+correcte?|mauvaise)\b/i,
  /\bce n['']est pas une r[eé]ponse correcte\b/i,
  /\bil\s+faut\s+(revoir|corriger|réviser|reviser|ajuster)\b/i,
  /\b(fichier|module|brique|fichiers)\b.*\b(nfs|need\s+for\s+speed)\b/i,
  /\b(nfs|need\s+for\s+speed)\b.*\b(fichier|module|traitait|trait(e|é)|revoir)\b/i,
  /\btraitait\s+de\s+(nfs|need\s+for\s+speed)\b/i,
  /\brevoir\s+le\s+(fichier|module|code)\b/i,
  /\bne\s+ma[iî]trise\s+pas\b/i,
  /\bhors\s+sujet\b/i,
  /\bfaux\s+positif\b/i,
  /\bcarry[- ]?over\b/i,
  /\bdérive\b/i,
  /\bje\s+pense\s+qu['']?on\s+doit\b/i,
  /\bcorriger\s+(le\s+)?(comportement|routage|fichier)\b/i,
  /\btu penses qu.{0,50}(reflechir|réfléchir|penser)\b/i,
  /\b(avant de repondre|avant de répondre)\b/i,
  /\bpourquoi tu reponds\b/i,
  /\bpourquoi tu réponds\b/i,
  /\bj aimerais que tu (?:reflechisses|réfléchisses)\b/i,
];

const ELLIPTIC_FOLLOWUP_MARKERS =
  /^(oui|ok|vas[- ]?y|continue|explique|un\s+aper[cç]u|parle[- ]?m['']?en|donne[- ]?moi)\b/i;

const FORGE_CONTEXT_MARKERS =
  /\b(forge|cadrage\s+projet|react\/vite|react\s*\/\s*vite|calculatrice|plotly|vite\s+react|handoff|livrables?|mvp)\b/i;

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 */
export function classifyConversationTurn(query = "", options = {}) {
  const q = normalizeText(query).toLowerCase();
  const history = Array.isArray(options.history) ? options.history : [];

  if (!q || q.length < 4) {
    return buildTurnResult(CONVERSATION_TURN_TYPES.TASK_REQUEST);
  }

  const isMeta =
    !isAssistantUtteranceClarifyRequest(query, options) &&
    META_FEEDBACK_MARKERS.some((pattern) => pattern.test(q));
  if (isMeta) {
    const topicHint = inferMetaTopicHint(q, history);
    return buildTurnResult(CONVERSATION_TURN_TYPES.META_FEEDBACK, {
      topicHint,
      disableSubjectCarryOver: true,
      disableLauncherHints: true,
      disableBusinessSubjectResolution: true,
      shortCircuit: true,
    });
  }

  if (ELLIPTIC_FOLLOWUP_MARKERS.test(q) && q.split(/\s+/).length <= 8) {
    return buildTurnResult(CONVERSATION_TURN_TYPES.ELLIPTIC_FOLLOWUP, {
      disableSubjectCarryOver: false,
    });
  }

  return buildTurnResult(CONVERSATION_TURN_TYPES.TASK_REQUEST);
}

/**
 * @param {string} turnType
 * @param {object} [overrides]
 */
function buildTurnResult(turnType, overrides = {}) {
  return {
    turnType,
    disableSubjectCarryOver: Boolean(overrides.disableSubjectCarryOver),
    disableLauncherHints: Boolean(overrides.disableLauncherHints),
    disableBusinessSubjectResolution: Boolean(overrides.disableBusinessSubjectResolution),
    shortCircuit: Boolean(overrides.shortCircuit),
    topicHint: overrides.topicHint ?? null,
  };
}

/**
 * @param {string} q
 * @param {Array<{ role?: string, content?: string }>} history
 */
function inferMetaTopicHint(q, history = []) {
  const blob = [q, ...history.slice(-4).map((t) => t.content || "")].join(" ").toLowerCase();
  if (FORGE_CONTEXT_MARKERS.test(blob)) return "forge_react_mvp";
  if (/\b(nfs|need\s+for\s+speed|steam|installer)\b/.test(q) && /\b(fichier|revoir|corriger|parle)\b/.test(q)) {
    return "routing_correction";
  }
  return "general_meta";
}

/**
 * Mention référentielle « le fichier nfs » — pas une intention de lancer le jeu.
 * @param {string} query
 */
export function isReferentialEntityMention(query = "") {
  const q = normalizeText(query).toLowerCase();
  return (
    META_FEEDBACK_MARKERS.some((pattern) => pattern.test(q)) &&
    /\b(nfs|need\s+for\s+speed)\b/.test(q) &&
    /\b(fichier|module|traitait|trait(e|é)|revoir|parle|parlait|corriger)\b/.test(q)
  );
}
