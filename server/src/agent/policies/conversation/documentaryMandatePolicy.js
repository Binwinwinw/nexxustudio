/**
 * Mandat documentaire court — sibling de activeGoal dans sessionWorkMemory.
 * Autorité : path first-act + priorState. Pas de prose, pas de lastRoutingResult.
 */
import { extractCreateGoalFromText } from "./activeGoalPolicy.js";
import { assessConversationTopicShift } from "../../micro/continuity/topicShiftGuard.js";

export const DOCUMENTARY_MANDATE_PATH = "documentary_deliverable_first_act";
export const DOCUMENTARY_MANDATE_KIND = "documentary_deliverable";

const INVALIDATING_SHIFT_REASONS = new Set([
  "strong_new_task",
  "task_domain_reset",
]);

export function isDocumentaryFirstActPath(path = "") {
  return path === DOCUMENTARY_MANDATE_PATH;
}

export function buildDocumentaryMandate() {
  return {
    kind: DOCUMENTARY_MANDATE_KIND,
    source: DOCUMENTARY_MANDATE_PATH,
  };
}

export function readDocumentaryMandate(priorState = null) {
  const mandate = priorState?.documentaryMandate;
  if (!mandate || mandate.source !== DOCUMENTARY_MANDATE_PATH) return null;
  return mandate;
}

/**
 * Frontière de commit : créer, conserver, remplacer ou invalider.
 * Ne route rien. Ne consomme pas le mandat.
 */
export function resolveDocumentaryMandateForCommit({
  shortCircuit = null,
  query = "",
  history = [],
  priorState = null,
} = {}) {
  if (isDocumentaryFirstActPath(shortCircuit?.path)) {
    return buildDocumentaryMandate();
  }

  const current = readDocumentaryMandate(priorState);
  if (!current) return null;

  if (extractCreateGoalFromText(query)) return null;

  const shift = assessConversationTopicShift(query, history);
  if (
    shift.detected === true &&
    INVALIDATING_SHIFT_REASONS.has(shift.reason)
  ) {
    return null;
  }

  return current;
}
