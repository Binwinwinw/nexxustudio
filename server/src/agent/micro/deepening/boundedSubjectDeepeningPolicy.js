/**
 * P3 — Politique d'approfondissement borné.
 * Doctrine : le LLM ne densifie que les sujets encore trop génériques après résolution locale.
 */
import {
  SUBJECT_RESOLUTION_MODES,
  SUBJECT_SHAPES,
} from "../classifiers/subjectUnderstanding.js";
import {
  buildConversationContinuityContext,
  CONTINUITY_TURN_PHASES,
  isShortFollowupText,
} from "../continuity/conversationContinuityContext.js";
import {
  buildFamiliarityFollowupApercuReply,
  resolveSubjectFromLabel,
} from "../../utils/familiarityIntentGuards.js";

export const SUBJECT_DEEPENING_RULE = "generic_topic_deepening_only";

export const SUBJECT_DEEPENING_PATH = "subject_deepening_bounded_llm";

export function isSubjectDeepeningLlmEnabled() {
  const flag = process.env.SUBJECT_DEEPENING_LLM;
  if (flag === "0" || flag === "false") return false;
  return true;
}

export function needsBoundedSubjectDeepening(subject = {}) {
  if (!subject?.label) return false;
  if (subject.resolutionMode === SUBJECT_RESOLUTION_MODES.LEXICON) return false;
  if (subject.resolutionMode === SUBJECT_RESOLUTION_MODES.INFERRED) return false;
  if (subject.resolutionMode === SUBJECT_RESOLUTION_MODES.GENERIC) return true;
  return subject.subjectShape === SUBJECT_SHAPES.GENERIC;
}

/**
 * @param {string} query
 * @param {Array<{ role: string, content: string }>} history
 * @returns {{ subject: object, fallbackReply: string, path: string }|null}
 */
export function evaluateBoundedSubjectDeepening(query = "", history = []) {
  const { state } = buildConversationContinuityContext(history);
  if (!state?.awaitingUserConfirmation) return null;
  if (state.turnPhase !== CONTINUITY_TURN_PHASES.FAMILIARITY_APERCU_PENDING) return null;
  if (!isShortFollowupText(query)) return null;

  const subject = resolveSubjectFromLabel(state.activeSubjectLabel || "");
  if (!subject || !needsBoundedSubjectDeepening(subject)) return null;

  const fallbackReply = buildFamiliarityFollowupApercuReply(subject);
  if (!fallbackReply) return null;

  return {
    subject,
    fallbackReply,
    path: SUBJECT_DEEPENING_PATH,
  };
}
