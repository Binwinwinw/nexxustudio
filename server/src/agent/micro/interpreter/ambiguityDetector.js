/**
 * P4 — Détection d'ambiguïtés (sujet, référence, signal insuffisant).
 */
import { sanitizeQuery } from "../normalization/querySanitizer.js";

export const AMBIGUITY_TYPES = {
  MISSING_SUBJECT: "missing_subject",
  VAGUE_REFERENCE: "vague_reference",
  LOW_SIGNAL: "low_signal",
  CONFLICTING_HYPOTHESES: "conflicting_hypotheses",
};

const VAGUE_REFERENCE_PATTERN = /\b(ca|cela|ce truc|this|that thing|quelque chose)\b/;

const FAMILIARITY_SHELL_PATTERN =
  /\b(tu connais|connais tu|tu peux me dire|peux tu me dire|tu sais ce que c est)\b/;

const HELP_WITHOUT_SUBJECT_PATTERN =
  /\b(tu peux|peux tu).{0,24}(me dire|m expliquer|expliquer)\b/;

export function detectAmbiguities(input = {}) {
  const { normalized = "", hypotheses = [], contextSubjectLabel = null } = input;
  const ambiguities = [];

  if (!normalized || normalized.length < 3) {
    ambiguities.push({ type: AMBIGUITY_TYPES.LOW_SIGNAL, detail: "query_too_short" });
  }

  if (VAGUE_REFERENCE_PATTERN.test(normalized) && !contextSubjectLabel) {
    // « cette capacité » / confirmation de capacité = anaphore métier, pas un sujet manquant.
    const capabilityAnaphora =
      /\b(?:cette|ces)\s+capacit/.test(normalized) ||
      /\b(?:donc|alors).{0,40}(?:tu as|tu peux|voudrait dire).{0,40}capacit/.test(
        normalized,
      );
    if (!capabilityAnaphora) {
      ambiguities.push({ type: AMBIGUITY_TYPES.VAGUE_REFERENCE, detail: "unresolved_pronoun" });
    }
  }

  const familiarityLike = FAMILIARITY_SHELL_PATTERN.test(normalized);
  const hasSubject = hypotheses.some(
    (h) => h.intent === "familiarity" && h.rawSubject && h.rawSubject.length >= 2,
  );

  if (familiarityLike && !hasSubject) {
    ambiguities.push({ type: AMBIGUITY_TYPES.MISSING_SUBJECT, detail: "familiarity_without_subject" });
  }

  if (HELP_WITHOUT_SUBJECT_PATTERN.test(normalized) && !hasSubject) {
    ambiguities.push({ type: AMBIGUITY_TYPES.MISSING_SUBJECT, detail: "help_without_subject" });
  }

  if (
    hypotheses.length >= 2 &&
    hypotheses[0].intent === hypotheses[1].intent &&
    hypotheses[0].rawSubject !== hypotheses[1].rawSubject &&
    Math.abs(hypotheses[0].confidence - hypotheses[1].confidence) < 0.12
  ) {
    ambiguities.push({
      type: AMBIGUITY_TYPES.CONFLICTING_HYPOTHESES,
      detail: "competing_subjects",
    });
  }

  return ambiguities;
}

export function hasBlockingAmbiguity(ambiguities = []) {
  return ambiguities.some(
    (a) =>
      a.type === AMBIGUITY_TYPES.MISSING_SUBJECT ||
      a.type === AMBIGUITY_TYPES.VAGUE_REFERENCE ||
      a.type === AMBIGUITY_TYPES.LOW_SIGNAL,
  );
}

export function normalizeForAmbiguityProbe(text = "") {
  return sanitizeQuery(text);
}
