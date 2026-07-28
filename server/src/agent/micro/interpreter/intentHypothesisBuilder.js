/**
 * P4 — Hypothèses d'intention (1–2 lectures probables, déterministes).
 */
import { parseFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { isIdeationIntent } from "../../utils/ideationIntentGuards.js";
import { resolveKnownOrUnknownSubject } from "../../utils/familiarityIntentGuards.js";
import { sanitizeQuery } from "../normalization/querySanitizer.js";

export const INTERPRETER_INTENTS = {
  FAMILIARITY: "familiarity",
  IDEATION: "ideation",
  UNKNOWN: "unknown",
};

/** Indices descriptifs → sujet probable (confiance moyenne). */
const DESCRIPTIVE_SUBJECT_HINTS = [
  {
    pattern: /\b(truc|jeu|sport|activite).{0,40}\bboules?\b|\bboules?.{0,40}(truc|jeu|sport)\b/,
    rawSubject: "la pétanque",
    label: "la pétanque",
    confidence: 0.62,
    reason: "descriptive_boules",
  },
  {
    pattern: /\b(fete|tradition).{0,20}\bnoel\b|\bnoel\b/,
    rawSubject: "noel",
    label: "la Noël",
    confidence: 0.82,
    reason: "descriptive_noel",
  },
];

function buildFamiliarityHypothesis(sourceQuery, parsed, confidence, reason) {
  const subject = resolveKnownOrUnknownSubject(parsed.rawSubject);
  return {
    intent: INTERPRETER_INTENTS.FAMILIARITY,
    kind: parsed.kind,
    rawSubject: parsed.rawSubject,
    subjectLabel: subject?.label || parsed.rawSubject,
    sourceQuery,
    confidence,
    reason,
  };
}

/**
 * @param {string} sourceQuery — requête à tester (canonical ou normalisée)
 * @param {number} confidenceBonus
 * @param {string} reason
 */
function hypothesisFromFamiliarityParse(sourceQuery, confidenceBonus = 0, reason = "direct_parse") {
  const parsed = parseFamiliarityQuery(sourceQuery);
  if (!parsed?.rawSubject) return null;
  const bare = sanitizeQuery(parsed.rawSubject);
  if (bare.length < 2) return null;
  if (/\b(ca|cela|ce truc|quelque chose)\b/.test(bare)) return null;

  let confidence = 0.72 + confidenceBonus;
  if (parsed.rawSubject.length >= 4) confidence += 0.06;
  if (reason.startsWith("canonical")) confidence += 0.08;

  return buildFamiliarityHypothesis(
    sourceQuery,
    parsed,
    Math.min(0.96, confidence),
    reason,
  );
}

function hypothesisFromDescriptiveHints(normalized = "") {
  for (const hint of DESCRIPTIVE_SUBJECT_HINTS) {
    if (!hint.pattern.test(normalized)) continue;
    const parsed = parseFamiliarityQuery(`tu connais ${hint.rawSubject}`);
    if (!parsed) continue;
    return buildFamiliarityHypothesis(
      normalized,
      parsed,
      hint.confidence,
      hint.reason,
    );
  }
  return null;
}

/**
 * @param {{
 *   raw?: string,
 *   normalized?: string,
 *   canonical?: string|null,
 *   contextSubjectLabel?: string|null,
 * }} input
 * @returns {object[]}
 */
export function buildIntentHypotheses(input = {}) {
  const hypotheses = [];
  const seen = new Set();

  const push = (h) => {
    if (!h) return;
    const key = `${h.intent}:${h.rawSubject}:${h.kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    hypotheses.push(h);
  };

  if (input.canonical) {
    push(hypothesisFromFamiliarityParse(input.canonical, 0.1, "canonical_rewrite"));
  }

  push(hypothesisFromFamiliarityParse(input.raw || "", 0, "direct_parse"));
  push(hypothesisFromFamiliarityParse(input.normalized || "", -0.05, "normalized_parse"));
  push(hypothesisFromDescriptiveHints(input.normalized || ""));

  if (input.contextSubjectLabel && /\b(ca|cela|ce truc|pour ca)\b/.test(input.normalized || "")) {
    const parsed = parseFamiliarityQuery(`tu connais ${input.contextSubjectLabel}`);
    if (parsed) {
      push(
        buildFamiliarityHypothesis(
          input.raw || "",
          parsed,
          0.68,
          "context_subject_reference",
        ),
      );
    }
  }

  if (isIdeationIntent(input.raw || "")) {
    push({
      intent: INTERPRETER_INTENTS.IDEATION,
      kind: "ideation",
      rawSubject: null,
      subjectLabel: null,
      sourceQuery: input.raw,
      confidence: 0.7,
      reason: "ideation_trigger",
    });
  }

  return hypotheses.sort((a, b) => b.confidence - a.confidence).slice(0, 2);
}

export function pickBestHypothesis(hypotheses = []) {
  return hypotheses[0] || null;
}
