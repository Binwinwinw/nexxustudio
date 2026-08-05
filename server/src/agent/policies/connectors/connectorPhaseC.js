/**
 * Phase C — autorité partielle du connectorRegistry sur forcedExpertKey (web).
 * Vague 1 : admin + learning paths ; vague 2 : compare_choose (sur-enrichissement legacy).
 */
import {
  mapConnectorToForcedExpertKey,
  resolveConnectorChain,
} from "./connectorRegistry.js";
import {
  buildPipelineConnectorContext,
  connectorPlanImpliesWeb,
} from "./connectorPlanTelemetry.js";
import { resolveIntentFamilyFromRegistry } from "../intent/intentFamilyRegistry.js";

export const CONNECTOR_PHASE_C_RULE = "connector_phase_c_web_authority_v1";

/**
 * Familles où le registre remplace le legacy pour expert_web_search.
 * @type {ReadonlySet<string>}
 */
export const CONNECTOR_PHASE_C_WEB_AUTHORITY_FAMILIES_V1 = new Set([
  "admin_procedure",
  "technical_learning_path",
  "career_learning_path",
  "compare_choose",
]);

/**
 * @param {string|null|undefined} familyId
 * @returns {boolean}
 */
export function isConnectorPhaseCWebAuthorityFamily(familyId = "") {
  return CONNECTOR_PHASE_C_WEB_AUTHORITY_FAMILIES_V1.has(String(familyId || ""));
}

/**
 * @param {import("./connectorPlanTelemetry.js").buildPipelineConnectorContext extends Function ? Parameters<typeof buildPipelineConnectorContext>[0] : never} params
 * @returns {string|null}
 */
export function resolveForcedExpertKeyFromConnectorPlan(params = {}) {
  const ctx = buildPipelineConnectorContext(params);
  const plan = resolveConnectorChain(ctx);
  if (!connectorPlanImpliesWeb(plan)) return null;
  return mapConnectorToForcedExpertKey("expert_web_search");
}

/**
 * @param {{
 *   query?: string,
 *   shortCircuit?: object|null,
 *   legacyKey?: string|null,
 *   effectiveForcedExpertKey?: string|null,
 *   initialForcedExpertKey?: string|null,
 *   hasAttachments?: boolean,
 *   isForgeProductionRun?: boolean,
 *   intentTriage?: object|null,
 *   wantsAnalysis?: boolean,
 *   deferToFullPipelineActive?: boolean,
 *   orchestratorGate?: boolean,
 *   enrichment?: object|null,
 * }} params
 * @returns {{
 *   key: string|null,
 *   applied: boolean,
 *   source: "legacy"|"connector_registry",
 *   reasonCode: string|null,
 *   planPrimary: string|null,
 * }}
 */
export function applyConnectorPhaseCWebKey(params = {}) {
  const ctx = buildPipelineConnectorContext(params);
  const familyId = ctx.intentFamily?.id ?? null;
  const legacyKey =
    params.legacyKey ??
    params.effectiveForcedExpertKey ??
    params.initialForcedExpertKey ??
    null;

  if (!isConnectorPhaseCWebAuthorityFamily(familyId)) {
    return {
      key: legacyKey,
      applied: false,
      source: "legacy",
      reasonCode: null,
      planPrimary: null,
    };
  }

  const plan = resolveConnectorChain(ctx);
  const registryKey = connectorPlanImpliesWeb(plan)
    ? mapConnectorToForcedExpertKey("expert_web_search")
    : null;

  return {
    key: registryKey,
    applied: true,
    source: "connector_registry",
    reasonCode: plan.reason?.code ?? null,
    planPrimary: plan.primary?.id ?? null,
  };
}

/**
 * @param {{
 *   hook?: string,
 *   familyId?: string|null,
 *   result: ReturnType<typeof applyConnectorPhaseCWebKey>,
 * }} payload
 */
export function logConnectorPhaseCApplication({
  hook = "unknown",
  familyId = null,
  query = "",
  result,
}) {
  if (!result.applied) return;
  const family =
    familyId ?? resolveIntentFamilyFromRegistry(query)?.id ?? "none";
  console.log(
    `[CONNECTOR][phase_c:${hook}] family=${family} ` +
      `webKey=${result.key || "none"} primary=${result.planPrimary || "none"} ` +
      `reason=${result.reasonCode || "none"}`,
  );
}
