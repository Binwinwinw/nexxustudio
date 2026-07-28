import {
  REFUSAL_SUFFICIENCY_FORMULA,
  REFUSAL_SUFFICIENCY_RULE,
} from "../rules/refusalSufficiencyRule.js";
import {
  canProvideSafeGenericProcedure,
  isExploitableProcedureIntent,
  isGloballyUnanswerableIntent,
} from "../../utils/procedureIntentGuards.js";
import { buildProcedureDeterministicReply } from "../replies/procedureReplyBuilder.js";

/**
 * @param {string} query
 * @returns {{
 *   branch: 'answer_first'|'refuse'|'defer',
 *   reply: string|null,
 *   rule: string,
 *   formula: string,
 *   reason: string|null,
 * }}
 */
export function evaluateRefusalSufficiency(query = "") {
  const q = String(query || "").trim();

  if (isGloballyUnanswerableIntent(q)) {
    return {
      branch: "refuse",
      reply: null,
      rule: REFUSAL_SUFFICIENCY_RULE,
      formula: REFUSAL_SUFFICIENCY_FORMULA,
      reason: "globally_unanswerable",
    };
  }

  if (isExploitableProcedureIntent(q) && canProvideSafeGenericProcedure(q)) {
    return {
      branch: "answer_first",
      reply: buildProcedureDeterministicReply(q),
      rule: REFUSAL_SUFFICIENCY_RULE,
      formula: REFUSAL_SUFFICIENCY_FORMULA,
      reason: "exploitable_procedure_intent",
    };
  }

  return {
    branch: "defer",
    reply: null,
    rule: REFUSAL_SUFFICIENCY_RULE,
    formula: REFUSAL_SUFFICIENCY_FORMULA,
    reason: null,
  };
}
