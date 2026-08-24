/**
 * Références au contexte de session — « tu te rappelles de X », « reprends ce qu'on disait sur X ».
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import {
  isTranslationDerivedRequest,
  extractTargetLanguage,
} from "./translationIntentGuards.js";

const SUBJECT_RECALL_SHELL_RE =
  /\b(?:tu\s+te\s+rappelles?|tu\s+te\s+souviens?|te\s+rappelles?[- ]?tu|te\s+souviens?[- ]?tu)\s+(?:de|du|des|d'|sur)\s+(?:la |le |les |l')?([^?.!,]{2,80})/i;

const RESUME_SUBJECT_SHELL_RE =
  /\b(?:reprends?|reprendre|reviens? sur|retour sur|continue sur)\s+(?:ce qu['']?on (?:disait|parlait|évoquait|a dit) (?:sur |de |du |d'|concernant )?|(?:la |le |les |l')?)([^?.!,]{2,80})/i;

const PREVIOUS_MESSAGE_SHELL_RE =
  /\b(?:la\s+phrase\s+pr[ée]c[ée]dente|le\s+message\s+pr[ée]c[ée]dent|derni[èe]re\s+phrase|dernier\s+message)\b/i;

/** @typedef {"subject_recall"|"resume_subject"|"previous_message"|"previous_translation"} ContextReferenceType */

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * @param {string} query
 * @returns {ContextReferenceType|null}
 */
export function detectContextReferenceType(query = "") {
  const q = normalizeQuery(query);
  if (!q) return null;
  if (isTranslationDerivedRequest(query) || PREVIOUS_MESSAGE_SHELL_RE.test(q)) {
    return extractTargetLanguage(query) ? "previous_translation" : "previous_message";
  }
  if (SUBJECT_RECALL_SHELL_RE.test(q)) return "subject_recall";
  if (RESUME_SUBJECT_SHELL_RE.test(q)) return "resume_subject";
  return null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isContextReferenceRequest(query = "") {
  return Boolean(detectContextReferenceType(query));
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractContextReferenceTarget(query = "") {
  const q = String(query || "").trim();
  const recall = q.match(SUBJECT_RECALL_SHELL_RE);
  if (recall?.[1]) {
    return String(recall[1])
      .replace(/\s*\?.*$/, "")
      .trim();
  }
  const resume = q.match(RESUME_SUBJECT_SHELL_RE);
  if (resume?.[1]) {
    return String(resume[1])
      .replace(/\s*\?.*$/, "")
      .trim();
  }
  if (isTranslationDerivedRequest(query) || PREVIOUS_MESSAGE_SHELL_RE.test(q)) {
    return extractTargetLanguage(query) || "previous_message";
  }
  return null;
}

/**
 * @param {string} target
 * @returns {string}
 */
export function buildContextReferenceNotFoundMessage(target = "") {
  const label = String(target || "ce sujet").trim();
  return `Nous n'avons pas parlé de ${label} dans la conversation actuelle. Redonne-moi le contexte et je reprends.`;
}

/**
 * Prime sur clarification générique / refus répété.
 * @param {string} query
 * @returns {boolean}
 */
export function suppressesGenericClarificationForContextReference(query = "") {
  return isContextReferenceRequest(query);
}
