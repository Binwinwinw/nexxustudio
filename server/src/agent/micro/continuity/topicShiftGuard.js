/**
 * Détection de rupture de sujet — complément à conversation_engagement_honor_open_branch.
 * Quand l'utilisateur change franchement de domaine, on relâche la branche active
 * et on ne réinjecte pas le contexte du tour précédent.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { isStructuredAssistanceRequest } from "../../utils/conversationGuards.js";
import { isCodeGenerationRequest } from "../../policies/code/codeDeliveryPolicy.js";
import {
  isShortFollowupText,
  readRecentTurns,
} from "./conversationContinuityContext.js";

export const CONVERSATION_TOPIC_SHIFT_RULE = "conversation_reset_on_topic_shift";

export const TOPIC_DOMAINS = {
  CODE_DELIVERY: "code_delivery",
  WORKSHOP_TRAINING: "workshop_training",
  CONSUMER_TECH: "consumer_tech",
  CULINARY: "culinary",
  AUTOMOTIVE: "automotive",
  LANDMARK: "landmark",
  FAMILIARITY: "familiarity",
  META_CONVERSATION: "meta_conversation",
  GENERAL: "general",
  UNKNOWN: "unknown",
};

const CONTINUATION_SIGNAL_PATTERN =
  /\b(?:compare aussi|et pour|et sur|meme sujet|même sujet|la suite|en plus de ca|en plus de ça|sur le meme|sur le même|celui la|celui-là|celle la|celle-la|detaille ca|détaille ça|detaille cela|détaille cela|continue sur|reprends sur|et le galaxy|et l iphone|et l'iphone)\b/i;

const CONSUMER_TECH_PATTERN =
  /\b(?:iphone|ipad|galaxy|samsung|pixel|smartphone|android|ios|oneplus|xiaomi|huawei|flagship)\b/i;

const COMPARATIVE_PATTERN =
  /\b(?:comparatif|comparer|versus|\bvs\b|meilleur entre)\b/i;

const WORKSHOP_PATTERN =
  /\b(?:atelier|formation|initiation|support animateur|parcours pédagogique|parcours pedagogique)\b/i;

const NOTION_APP_PATTERN = /\bnotion\b/i;

const HTML_UI_PATTERN =
  /\b(?:fichier html|page html|\.html\b|sidebar|header|doctype|structure html)\b/i;

const CULINARY_PATTERN =
  /\b(?:recette|bourguignon|carbonara|plat|cuisine|mijot)\b/i;

const AUTOMOTIVE_PATTERN =
  /\b(?:nissan|skyline|gtr|bmw|mercedes|voiture|vehicule|véhicule)\b/i;

const LANDMARK_PATTERN =
  /\b(?:tour eiffel|monument|cathedrale|cathédrale|musee|musée)\b/i;

const FAMILIARITY_SHELL_PATTERN =
  /^(?:tu connais|connais tu|sais tu ce qu est|sais-tu ce qu est)\b/i;

const TASK_RESET_DOMAINS = new Set([
  TOPIC_DOMAINS.CODE_DELIVERY,
  TOPIC_DOMAINS.WORKSHOP_TRAINING,
]);

function normalizeProbe(text = "") {
  return normalizeFamiliarityQuery(text);
}

function findLastMessageByRole(turns = [], role = "user") {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.role === role && String(turns[i]?.content || "").trim()) {
      return String(turns[i].content).trim();
    }
  }
  return null;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function classifyConversationTopic(text = "") {
  const raw = String(text || "");
  const q = normalizeProbe(raw);
  if (!q) return TOPIC_DOMAINS.UNKNOWN;

  if (isCodeGenerationRequest(raw) || (HTML_UI_PATTERN.test(q) && /\b(?:creer|créer|generer|générer|fichier|page)\b/.test(q))) {
    return TOPIC_DOMAINS.CODE_DELIVERY;
  }

  if (WORKSHOP_PATTERN.test(q) && (NOTION_APP_PATTERN.test(q) || HTML_UI_PATTERN.test(q))) {
    return TOPIC_DOMAINS.WORKSHOP_TRAINING;
  }

  if (WORKSHOP_PATTERN.test(q) && isStructuredAssistanceRequest(raw)) {
    return TOPIC_DOMAINS.WORKSHOP_TRAINING;
  }

  if (COMPARATIVE_PATTERN.test(q) && CONSUMER_TECH_PATTERN.test(q)) {
    return TOPIC_DOMAINS.CONSUMER_TECH;
  }

  if (CONSUMER_TECH_PATTERN.test(q)) {
    return TOPIC_DOMAINS.CONSUMER_TECH;
  }

  if (CULINARY_PATTERN.test(q)) return TOPIC_DOMAINS.CULINARY;
  if (AUTOMOTIVE_PATTERN.test(q)) return TOPIC_DOMAINS.AUTOMOTIVE;
  if (LANDMARK_PATTERN.test(q)) return TOPIC_DOMAINS.LANDMARK;

  if (FAMILIARITY_SHELL_PATTERN.test(q) && q.length < 80) {
    return TOPIC_DOMAINS.FAMILIARITY;
  }

  if (COMPARATIVE_PATTERN.test(q)) return TOPIC_DOMAINS.GENERAL;
  if (q.length >= 12) return TOPIC_DOMAINS.GENERAL;

  return TOPIC_DOMAINS.UNKNOWN;
}

/**
 * @param {string} query
 */
export function hasStrongContinuationSignal(query = "") {
  if (isShortFollowupText(query)) return true;

  const q = normalizeProbe(query);
  if (!q) return false;

  if (/^(?:oui|ouais|ok|okay|vas y|allez y|continue|volontiers|avec plaisir)\b/.test(q)) {
    return true;
  }

  return CONTINUATION_SIGNAL_PATTERN.test(q);
}

/**
 * @param {string} query
 */
export function hasStrongNewTaskSignal(query = "") {
  const raw = String(query || "");
  const q = normalizeProbe(raw);
  if (!q) return false;

  if (isCodeGenerationRequest(raw)) return true;
  if (HTML_UI_PATTERN.test(q) && /\b(?:creer|créer|generer|générer|construire|produire)\b/.test(q)) {
    return true;
  }
  if (WORKSHOP_PATTERN.test(q) && (NOTION_APP_PATTERN.test(q) || HTML_UI_PATTERN.test(q))) {
    return true;
  }

  return false;
}

/**
 * @param {string} previous
 * @param {string} current
 */
export function areConversationTopicsCompatible(previous, current) {
  if (!previous || !current) return true;
  if (previous === current) return true;
  if (previous === TOPIC_DOMAINS.UNKNOWN || current === TOPIC_DOMAINS.UNKNOWN) return true;
  if (previous === TOPIC_DOMAINS.GENERAL || current === TOPIC_DOMAINS.GENERAL) return true;

  const incompatiblePairs = [
    [TOPIC_DOMAINS.CONSUMER_TECH, TOPIC_DOMAINS.CODE_DELIVERY],
    [TOPIC_DOMAINS.CONSUMER_TECH, TOPIC_DOMAINS.WORKSHOP_TRAINING],
    [TOPIC_DOMAINS.CONSUMER_TECH, TOPIC_DOMAINS.CULINARY],
    [TOPIC_DOMAINS.CONSUMER_TECH, TOPIC_DOMAINS.AUTOMOTIVE],
    [TOPIC_DOMAINS.CULINARY, TOPIC_DOMAINS.CODE_DELIVERY],
    [TOPIC_DOMAINS.CULINARY, TOPIC_DOMAINS.CONSUMER_TECH],
    [TOPIC_DOMAINS.AUTOMOTIVE, TOPIC_DOMAINS.CODE_DELIVERY],
    [TOPIC_DOMAINS.LANDMARK, TOPIC_DOMAINS.CODE_DELIVERY],
    [TOPIC_DOMAINS.FAMILIARITY, TOPIC_DOMAINS.CODE_DELIVERY],
  ];

  return !incompatiblePairs.some(
    ([a, b]) =>
      (previous === a && current === b) || (previous === b && current === a),
  );
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
export function assessConversationTopicShift(query = "", history = []) {
  const empty = {
    detected: false,
    rule: CONVERSATION_TOPIC_SHIFT_RULE,
    previousDomain: null,
    currentDomain: classifyConversationTopic(query),
    reason: "no_history_or_compatible",
  };

  if (!Array.isArray(history) || history.length === 0) return empty;
  if (hasStrongContinuationSignal(query)) {
    return { ...empty, reason: "continuation_signal" };
  }

  const turns = readRecentTurns(history, 4);
  const lastUser = findLastMessageByRole(turns, "user");
  const lastAssistant = findLastMessageByRole(turns, "assistant");
  const previousContext = `${lastUser || ""} ${lastAssistant || ""}`.trim();

  if (!previousContext) return empty;

  const previousDomain = classifyConversationTopic(previousContext);
  const currentDomain = classifyConversationTopic(query);

  if (areConversationTopicsCompatible(previousDomain, currentDomain)) {
    return {
      detected: false,
      rule: CONVERSATION_TOPIC_SHIFT_RULE,
      previousDomain,
      currentDomain,
      reason: "compatible_domains",
    };
  }

  const strongNewTask = hasStrongNewTaskSignal(query);
  const taskReset =
    TASK_RESET_DOMAINS.has(currentDomain) && previousDomain !== currentDomain;

  if (strongNewTask || taskReset) {
    return {
      detected: true,
      rule: CONVERSATION_TOPIC_SHIFT_RULE,
      previousDomain,
      currentDomain,
      reason: strongNewTask ? "strong_new_task" : "task_domain_reset",
    };
  }

  return {
    detected: true,
    rule: CONVERSATION_TOPIC_SHIFT_RULE,
    previousDomain,
    currentDomain,
    reason: "incompatible_domains",
  };
}

/**
 * Historique à utiliser pour l'orchestration après éventuel reset.
 * @param {Array} history
 * @param {ReturnType<typeof assessConversationTopicShift>} assessment
 */
export function resolveHistoryAfterTopicShift(history = [], assessment = {}) {
  if (!assessment?.detected) return history;
  return [];
}
