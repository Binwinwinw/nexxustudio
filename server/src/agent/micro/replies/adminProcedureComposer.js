/**
 * Composer — procédures administratives (pipeline complet + web/RAG).
 */
import {
  isAdminProcedureRequest,
  parseAdminProcedure,
} from "../../utils/adminProcedureIntentGuards.js";
import {
  resolveAdminProcedureCoverage,
  buildAdminProcedureWebGroundedAddon,
} from "../../policies/qualification/adminProcedureCoveragePolicy.js";

export const ADMIN_PROCEDURE_COMPOSER_RULE =
  "admin_procedure_web_rag_grounded";

/**
 * @param {string} query
 * @returns {string}
 */
export function buildAdminProcedureSystemAddon(query = "") {
  const slots = parseAdminProcedure(query);
  if (!slots) {
    return buildAdminProcedureWebGroundedAddon(
      {
        intent: "admin_procedure",
        topic: null,
        topicLabel: "la démarche demandée",
        domain: "general_admin",
        jurisdiction: "unknown",
        freshnessRisk: "medium",
        requiresOfficialSource: true,
        confidence: "low",
      },
      resolveAdminProcedureCoverage(query),
    );
  }

  const coverage = resolveAdminProcedureCoverage(query, slots);
  return buildAdminProcedureWebGroundedAddon(slots, coverage);
}

/**
 * @param {string} query
 * @returns {{ path: string, deferToLlm: boolean, deferToFullPipeline: boolean, reflectiveHint: string, adminProcedure: boolean, preferWebResearch: boolean, slots?: import("../../utils/adminProcedureIntentGuards.js").AdminProcedureSlots, coverage?: ReturnType<typeof resolveAdminProcedureCoverage> }|null}
 */
export function resolveAdminProcedureShortCircuit(query = "") {
  if (!isAdminProcedureRequest(query)) return null;

  const slots = parseAdminProcedure(query);
  const coverage = resolveAdminProcedureCoverage(query, slots);

  return {
    path: "admin_procedure",
    deferToLlm: true,
    deferToFullPipeline: true,
    reflectiveHint: buildAdminProcedureSystemAddon(query),
    adminProcedure: true,
    preferWebResearch: coverage.preferWebResearch,
    slots,
    coverage,
  };
}
