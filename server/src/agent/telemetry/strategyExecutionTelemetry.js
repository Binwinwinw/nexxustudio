/**
 * G31 — observabilité stratégie déclarée vs exécutée.
 */
import { EXECUTION_STRATEGIES } from "../../../../shared/justIntentCatalog.js";

/**
 * @param {{
 *   justIntent?: { strategy?: string|null },
 *   clarificationGate?: {
 *     shouldClarify?: boolean,
 *     decision?: { reason?: string|null },
 *   },
 *   queryUnderstanding?: {
 *     responseStrategy?: string|null,
 *     primaryDomain?: string|null,
 *   },
 * }} ctx
 * @returns {{
 *   strategy_declared: string|null,
 *   strategy_effective: string|null,
 *   strategy_override_reason: string|null,
 * }}
 */
export function resolveStrategyExecution(ctx = {}) {
  const declared = ctx.justIntent?.strategy || null;
  let effective = declared;
  let overrideReason = null;

  const gate = ctx.clarificationGate;
  const understanding = ctx.queryUnderstanding;

  if (understanding?.primaryDomain === "compare_choose") {
    effective = understanding.responseStrategy || effective;
    if (effective !== declared) {
      overrideReason = "query_understanding_compare_choose";
    }
  }

  if (understanding?.primaryDomain === "document_synthesis") {
    effective = understanding.responseStrategy || effective;
    if (effective !== declared && !overrideReason) {
      overrideReason = "query_understanding_document_synthesis";
    }
  }

  if (gate?.shouldClarify) {
    effective = "partial_clarify";
    overrideReason = gate.decision?.reason || "clarification_gate";
  } else if (
    declared === EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD &&
    gate?.decision?.reason
  ) {
    effective = EXECUTION_STRATEGIES.BUILD_V1;
    overrideReason = gate.decision.reason;
  } else if (
    understanding?.responseStrategy &&
    understanding.responseStrategy !== declared &&
    !overrideReason
  ) {
    effective = understanding.responseStrategy;
    overrideReason = "query_understanding_g29";
  }

  return {
    strategy_declared: declared,
    strategy_effective: effective,
    strategy_override_reason: overrideReason,
  };
}
