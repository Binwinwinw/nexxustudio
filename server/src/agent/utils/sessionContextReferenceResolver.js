/**
 * Résolution session-local des références conversationnelles (fenêtre récente + recherche légère).
 */
import { filterRecallHistoryEntries } from "./conversationGuards.js";
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import {
  buildContextReferenceNotFoundMessage,
  detectContextReferenceType,
  extractContextReferenceTarget,
  isContextReferenceRequest,
} from "./contextReferenceIntentGuards.js";
import {
  buildTranslationClarifyReply,
  buildTranslationEffectiveQuery,
  extractTargetLanguage,
  extractTranslationSourceFromHistory,
  isTranslationDerivedRequest,
} from "./translationIntentGuards.js";

export const SESSION_CONTEXT_REFERENCE_RULE = "session_local_context_reference_v1";

const BOILERPLATE_SKIP_RE =
  /\b(?:je vois la piste|destination exacte|il faudrait que tu arrives|pour traduire|on se rate|pas encore l'objectif|pas encore la destination|redonne[- ]?moi le contexte|nous n'avons pas parlé)\b/i;

/**
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeForMatch(text = "") {
  return normalizeFamiliarityQuery(text)
    .split(/[^a-z0-9àâäéèêëïîôùûüç]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

/**
 * @param {string} target
 * @param {string} text
 * @returns {boolean}
 */
function matchesContextTarget(target = "", text = "") {
  const normalizedTarget = normalizeFamiliarityQuery(target);
  const normalizedText = normalizeFamiliarityQuery(text);
  if (!normalizedTarget || !normalizedText) return false;

  if (normalizedText.includes(normalizedTarget)) return true;

  const compactTarget = normalizedTarget.replace(/\s+/g, "");
  const compactText = normalizedText.replace(/\s+/g, "");
  if (compactTarget.length >= 4 && compactText.includes(compactTarget)) return true;

  const targetTokens = tokenizeForMatch(normalizedTarget);
  if (!targetTokens.length) return false;
  const textTokens = new Set(tokenizeForMatch(normalizedText));
  const hits = targetTokens.filter((t) => textTokens.has(t));
  return hits.length >= Math.min(2, targetTokens.length);
}

/**
 * @param {string} target
 * @param {Array<{ role?: string, content?: string }>} history
 * @returns {{ message: object, index: number, source: "recent_turns"|"session_search" }|null}
 */
export function findSessionMatchForTarget(target = "", history = []) {
  const entries = filterRecallHistoryEntries("", history, 24);
  if (!entries.length) return null;

  const recentStart = Math.max(0, entries.length - 6);
  const recentWindow = entries.slice(-6);
  for (let i = recentWindow.length - 1; i >= 0; i--) {
    const msg = recentWindow[i];
    if (BOILERPLATE_SKIP_RE.test(String(msg.content || ""))) continue;
    if (matchesContextTarget(target, msg.content || "")) {
      return { message: msg, index: recentStart + i, source: "recent_turns" };
    }
  }

  for (let i = entries.length - 1; i >= 0; i--) {
    const msg = entries[i];
    if (BOILERPLATE_SKIP_RE.test(String(msg.content || ""))) continue;
    if (matchesContextTarget(target, msg.content || "")) {
      return { message: msg, index: i, source: "session_search" };
    }
  }

  return null;
}

/**
 * @param {string} target
 * @param {Array<{ role?: string, content?: string }>} history
 * @param {number} [fromIndex]
 * @returns {string|null}
 */
function findOriginalUserQueryForTarget(target = "", history = [], fromIndex = -1) {
  const entries = filterRecallHistoryEntries("", history, 24);
  const start = fromIndex >= 0 ? fromIndex : entries.length - 1;
  for (let i = start; i >= 0; i--) {
    const msg = entries[i];
    if (msg.role !== "user") continue;
    if (matchesContextTarget(target, msg.content || "")) {
      return String(msg.content || "").trim();
    }
  }
  if (fromIndex >= 0) {
    for (let i = fromIndex; i >= 0; i--) {
      const msg = entries[i];
      if (msg.role === "user") {
        return String(msg.content || "").trim();
      }
    }
  }
  return null;
}

/**
 * @param {string} target
 * @param {Array<{ role?: string, content?: string }>} history
 * @param {{ index?: number }|null} [match]
 * @returns {string}
 */
function buildSubjectResumeQuery(target = "", history = [], match = null) {
  const original = findOriginalUserQueryForTarget(
    target,
    history,
    match?.index ?? -1,
  );
  if (original) return original;
  return `quelles informations as-tu sur ${target}`;
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
export function resolveSessionContextReference(query = "", history = []) {
  if (!isContextReferenceRequest(query)) {
    return { applicable: false };
  }

  const referenceType = detectContextReferenceType(query);
  const target = extractContextReferenceTarget(query) || "";

  if (
    referenceType === "previous_translation" ||
    referenceType === "previous_message" ||
    isTranslationDerivedRequest(query)
  ) {
    const previousText = extractTranslationSourceFromHistory(history);
    const lang = extractTargetLanguage(query);
    if (previousText && lang) {
      return {
        applicable: true,
        rule: SESSION_CONTEXT_REFERENCE_RULE,
        referenceType: "previous_translation",
        target: lang,
        resolved: true,
        resolutionSource: "recent_turns",
        previousOutputAsSource: true,
        previousText,
        enrichedQuery: buildTranslationEffectiveQuery(query, previousText),
        notFoundMessage: null,
      };
    }
    return {
      applicable: true,
      rule: SESSION_CONTEXT_REFERENCE_RULE,
      referenceType: "previous_translation",
      target: lang,
      resolved: false,
      resolutionSource: "none",
      previousOutputAsSource: false,
      previousText: null,
      enrichedQuery: null,
      notFoundMessage:
        buildTranslationClarifyReply(query, history) ||
        buildContextReferenceNotFoundMessage("la phrase précédente"),
    };
  }

  const match = findSessionMatchForTarget(target, history);
  if (!match) {
    return {
      applicable: true,
      rule: SESSION_CONTEXT_REFERENCE_RULE,
      referenceType,
      target,
      resolved: false,
      resolutionSource: "none",
      previousOutputAsSource: false,
      previousText: null,
      enrichedQuery: null,
      notFoundMessage: buildContextReferenceNotFoundMessage(target),
    };
  }

  return {
    applicable: true,
    rule: SESSION_CONTEXT_REFERENCE_RULE,
    referenceType,
    target,
    resolved: true,
    resolutionSource: match.source,
    previousOutputAsSource: false,
    previousText: String(match.message.content || "").trim(),
    enrichedQuery: buildSubjectResumeQuery(target, history, match),
    notFoundMessage: null,
  };
}
