/**
 * P4 — Politique clarification : répondre, confirmer, ou clarifier (fail-closed).
 */
import { buildClarificationQuestion } from "../replies/clarificationBuilder.js";
import { hasBlockingAmbiguity, AMBIGUITY_TYPES } from "./ambiguityDetector.js";
import { INTERPRETER_INTENTS } from "./intentHypothesisBuilder.js";

export const INTERPRETER_ACTIONS = {
  RESPOND: "respond",
  CONFIRM: "confirm",
  CLARIFY: "clarify",
  ROUTE: "route",
};

export const INTERPRETER_CONFIDENCE = {
  HIGH: 0.78,
  MEDIUM: 0.55,
};

/** Doctrine P4 : reformuler implicitement si fragile ; clarifier si ambigu après normalisation. */
export const REQUEST_INTERPRETER_RULE = "fragile_reformulate_ambiguous_clarify";

/**
 * @param {{
 *   best?: object|null,
 *   ambiguities?: object[],
 *   hypotheses?: object[],
 *   canonical?: string|null,
 * }} ctx
 */
export function decideInterpreterAction(ctx = {}) {
  const { best = null, ambiguities = [], canonical = null } = ctx;

  if (hasBlockingAmbiguity(ambiguities)) {
    const vague = ambiguities.some((a) => a.type === AMBIGUITY_TYPES.VAGUE_REFERENCE);
    const missing = ambiguities.some((a) => a.type === AMBIGUITY_TYPES.MISSING_SUBJECT);
    return {
      action: INTERPRETER_ACTIONS.CLARIFY,
      reply: vague || missing
        ? "Tu parles de quel sujet exactement ?"
        : buildClarificationQuestion({ kind: "generic" }),
      confidence: best?.confidence ?? 0,
    };
  }

  if (!best) {
    return {
      action: INTERPRETER_ACTIONS.ROUTE,
      reply: null,
      confidence: 0,
    };
  }

  if (best.confidence >= INTERPRETER_CONFIDENCE.HIGH) {
    const canonicalQuery =
      canonical ||
      (best.intent === INTERPRETER_INTENTS.FAMILIARITY
        ? `tu connais ${best.rawSubject}`
        : best.sourceQuery);

    return {
      action: INTERPRETER_ACTIONS.RESPOND,
      reply: null,
      canonicalQuery,
      confidence: best.confidence,
      hypothesis: best,
    };
  }

  if (
    best.confidence >= INTERPRETER_CONFIDENCE.MEDIUM &&
    best.intent === INTERPRETER_INTENTS.FAMILIARITY &&
    best.subjectLabel
  ) {
    return {
      action: INTERPRETER_ACTIONS.CONFIRM,
      reply: `Tu parles de ${best.subjectLabel} ?`,
      pendingSubjectLabel: best.subjectLabel,
      confidence: best.confidence,
      hypothesis: best,
    };
  }

  return {
    action: INTERPRETER_ACTIONS.CLARIFY,
    reply: buildClarificationQuestion({ kind: "familiarity_unknown" }),
    confidence: best.confidence,
  };
}
