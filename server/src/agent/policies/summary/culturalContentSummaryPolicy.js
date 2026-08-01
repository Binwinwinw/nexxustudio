/**
 * G37 — résumé d'œuvre culturelle (film, livre, série…) sans document joint.
 * Distinct de document_synthesis (passage / PJ / texte collé).
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { extractPastedSourceText } from "../document/index.js";
import { suppressesCulturalSummaryForConceptExplain } from "../code/codeConceptExplainPolicy.js";

export const CULTURAL_CONTENT_SUMMARY_RULE = "cultural_content_summary_g37";

const CULTURAL_SUMMARY_SHELL_RE =
  /\b(?:resume|resumer|fais\s+un\s+resume|faire\s+un\s+resume|synthese|synthèse|summary|summarize|resumer\s+moi|resume\s+moi)\b/i;

/** « quel résumé on peut en tirer » = takeaway de fil, pas résumé d’œuvre. */
const CONVERSATION_TAKEAWAY_SUMMARY_RE =
  /\b(?:quel\s+)?(?:resume|resumé|résumé|synthese|synthèse)\b.{0,48}\b(?:en\s+tirer|tirer|a\s+retenir|à\s+retenir|essentiel|de\s+(?:tout\s+)?(?:ca|ça|cela))\b/i;

export const CULTURAL_WORK_MARKER_RE =
  /\b(?:film|films|movie|movies|serie|series|série|séries|livre|livres|book|books|roman|romans|album|albums|chanson|chansons|episode|episodes|épisode|épisodes|documentaire|court\s+metrage|court\s+métrage|oeuvre|œuvre)\b/i;

const DOCUMENT_ANCHOR_RE =
  /\b(?:ce\s+(?:passage|texte|document|fichier|extrait|article)|texte\s+suivant|document\s+joint|fichier\s+joint|colle\s+le|coller\s+le|ci[- ]dessus|ci[- ]dessous|passage\s+suivant)\b/i;

const SUBJECT_STOP_RE =
  /^(?:film|films|movie|livre|livres|book|serie|series|série|roman|album|chanson|episode|épisode|documentaire|le|la|les|un|une|du|de|des|sur|moi)$/i;

/**
 * @param {string} query
 * @returns {string}
 */
function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractCulturalSummarySubject(query = "") {
  const q = normalizeQuery(query);
  if (!q) return null;

  const patterns = [
    /\b(?:resume|resumer|fais\s+un\s+resume|faire\s+un\s+resume|synthese|summary)\s+(?:du|de\s+la|de\s+l|d|sur|le|la|les|l)\s*(?:film|films|movie|livre|livres|book|roman|serie|series|série|séries|album|documentaire)?\s*(?:du|de|d|sur|le|la|les|l)?\s*([a-z0-9][a-z0-9\s'.-]{2,50})/i,
    /\b(?:film|movie|livre|book|roman|serie|series|série|album|documentaire)\s+([a-z0-9][a-z0-9\s'.-]{2,50})/i,
    /\b(?:resume|resumer|summary)\s+(?:moi\s+)?([a-z0-9][a-z0-9\s'.-]{2,50})/i,
  ];

  for (const re of patterns) {
    const match = q.match(re);
    const raw = String(match?.[1] || "")
      .replace(/\b(?:stp|svp|merci|s il te plait)\b/gi, "")
      .trim();
    if (!raw || raw.length < 3) continue;
    const tokens = raw.split(/\s+/).filter(Boolean);
    const cleaned = tokens
      .filter((token) => !SUBJECT_STOP_RE.test(token))
      .join(" ")
      .trim();
    if (cleaned.length >= 3) return cleaned;
  }

  return null;
}

/**
 * Résumé d'œuvre culturelle nommée — pas une synthèse de document fourni.
 * @param {string} query
 * @param {unknown[]} [attachments]
 * @returns {boolean}
 */
/**
 * Demande de takeaway conversationnel (« quel résumé on peut en tirer ? »).
 * @param {string} query
 * @returns {boolean}
 */
export function isConversationTakeawaySummaryRequest(query = "") {
  const q = normalizeQuery(query);
  if (!q) return false;
  if (CONVERSATION_TAKEAWAY_SUMMARY_RE.test(q)) return true;
  if (/^quel\s+(?:resume|resumé|résumé|synthese|synthèse)\b/.test(q) && !CULTURAL_WORK_MARKER_RE.test(q)) {
    return true;
  }
  return false;
}

export function isCulturalContentSummaryRequest(query = "", attachments = []) {
  const q = normalizeQuery(query);
  if (!q || q.length < 12) return false;
  if (attachments?.length > 0) return false;
  if (suppressesCulturalSummaryForConceptExplain(query)) return false;
  if (DOCUMENT_ANCHOR_RE.test(q)) return false;
  if (extractPastedSourceText(query)) return false;
  // Takeaway de fil (« quel résumé en tirer ») ≠ résumé d’œuvre culturelle
  if (isConversationTakeawaySummaryRequest(query)) return false;
  if (!CULTURAL_SUMMARY_SHELL_RE.test(q)) return false;

  if (CULTURAL_WORK_MARKER_RE.test(q)) return true;

  const subject = extractCulturalSummarySubject(query);
  if (!subject || subject.length < 3) return false;
  // Sujets parasites extraits de « resume on peut en tirer »
  if (/^(?:on peut|en tirer|peut en|tirer|ca|ça|cela)\b/i.test(subject)) return false;
  return true;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function suppressesDocumentSynthesisForCulturalSummary(query = "") {
  return isCulturalContentSummaryRequest(query);
}
