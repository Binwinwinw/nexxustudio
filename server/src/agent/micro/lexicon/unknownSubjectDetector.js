/**
 * Détecte les sujets extraits mais absents du lexique statique — candidats à observation.
 */
import { SUBJECT_RESOLUTION_MODES } from "../classifiers/subjectUnderstanding.js";
import { extractCandidateSubject } from "../classifiers/subjectUnderstanding.js";
import { getPromotedLexiconMap } from "./lexiconLearningStore.js";

function stripLeadingArticle(normalized = "") {
  return String(normalized || "")
    .replace(/^(le|la|les|l)\s+/, "")
    .trim();
}

export function isPromotedLexiconKey(canonicalKey = "") {
  const promoted = getPromotedLexiconMap();
  return Boolean(promoted[canonicalKey]);
}

/**
 * @param {{
 *   query?: string,
 *   parsed?: { rawSubject?: string, kind?: string },
 *   subject?: object,
 *   hasStaticLexiconEntry?: (key: string) => boolean,
 * }} context
 */
export function detectUnknownSubjectObservation(context = {}) {
  const { query = "", parsed = {}, subject = {}, hasStaticLexiconEntry } = context;
  if (!subject?.label) return null;

  if (subject.resolutionMode === SUBJECT_RESOLUTION_MODES.LEXICON && subject.known) {
    return null;
  }

  const rawSubject = parsed.rawSubject || subject.label;
  const { normalized } = extractCandidateSubject(rawSubject);
  const canonicalKey = stripLeadingArticle(normalized);
  if (!canonicalKey || canonicalKey.length < 3) return null;

  if (typeof hasStaticLexiconEntry === "function" && hasStaticLexiconEntry(canonicalKey)) {
    return null;
  }
  if (isPromotedLexiconKey(canonicalKey)) {
    return null;
  }

  return {
    query,
    rawSubject,
    canonicalKey,
    label: subject.label,
    subjectShape: subject.subjectShape || null,
    category: subject.category || null,
    resolutionMode: subject.resolutionMode || null,
    definition: subject.definition || null,
    intentKind: parsed.kind || "recognition",
    known: Boolean(subject.known),
  };
}
