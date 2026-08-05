/**
 * Phase B — observation shadow du connectorRegistry (lecture seule, sans pilotage runtime).
 */
import { resolveKnowledgeEnrichmentPolicy } from "../routing/knowledgeEnrichmentPolicy.js";
import {
  EXPERT_TASK_TYPES,
  REQUESTED_CAPABILITIES,
  buildConnectorResolutionContext,
  resolveConnectorChain,
} from "./connectorRegistry.js";

/**
 * @param {{
 *   intentTriage?: { top_intent?: string }|null,
 *   wantsAnalysis?: boolean,
 *   hasAttachments?: boolean,
 *   isForgeProductionRun?: boolean,
 * }} params
 * @returns {string|null}
 */
export function resolveExpertTaskTypeFromPipeline({
  intentTriage = null,
  wantsAnalysis = false,
  hasAttachments = false,
} = {}) {
  const top = String(intentTriage?.top_intent || "");
  if (
    wantsAnalysis ||
    top === "code_generation" ||
    top.startsWith("code_") ||
    top === "document_analysis"
  ) {
    return EXPERT_TASK_TYPES.EXPERT_TASK;
  }
  if (top === "factual_light") {
    return EXPERT_TASK_TYPES.FACTUAL_LIGHT;
  }
  if (top === "normal_conversation" || top === "social") {
    return EXPERT_TASK_TYPES.NORMAL;
  }
  return EXPERT_TASK_TYPES.UNKNOWN;
}

/**
 * @param {{
 *   intentTriage?: { top_intent?: string }|null,
 *   wantsAnalysis?: boolean,
 *   hasAttachments?: boolean,
 *   isForgeProductionRun?: boolean,
 * }} params
 * @returns {string|null}
 */
export function resolveRequestedCapabilityFromPipeline({
  intentTriage = null,
  wantsAnalysis = false,
  hasAttachments = false,
  isForgeProductionRun = false,
} = {}) {
  if (isForgeProductionRun) {
    return REQUESTED_CAPABILITIES.FORGE_BUILD;
  }
  if (hasAttachments && wantsAnalysis) {
    return REQUESTED_CAPABILITIES.DOCUMENT_ANALYSIS;
  }
  const top = String(intentTriage?.top_intent || "");
  if (wantsAnalysis || top.startsWith("code_") || top === "code_generation") {
    return REQUESTED_CAPABILITIES.CODE_ANALYSIS;
  }
  return REQUESTED_CAPABILITIES.CONVERSATION;
}

/**
 * @param {{
 *   query?: string,
 *   shortCircuit?: object|null,
 *   enrichment?: ReturnType<typeof resolveKnowledgeEnrichmentPolicy>|null,
 *   hasAttachments?: boolean,
 *   forgeProduction?: boolean,
 *   webEnabled?: boolean,
 *   expertTaskType?: string|null,
 *   requestedCapability?: string|null,
 *   userConfirmedConnectorId?: string|null,
 *   intentTriage?: { top_intent?: string }|null,
 *   wantsAnalysis?: boolean,
 *   isForgeProductionRun?: boolean,
 * }} params
 */
export function buildPipelineConnectorContext(params = {}) {
  const hasAttachments = Boolean(params.hasAttachments);
  const expertTaskType =
    params.expertTaskType ??
    resolveExpertTaskTypeFromPipeline({
      intentTriage: params.intentTriage,
      wantsAnalysis: params.wantsAnalysis,
      hasAttachments,
    });
  const requestedCapability =
    params.requestedCapability ??
    resolveRequestedCapabilityFromPipeline({
      intentTriage: params.intentTriage,
      wantsAnalysis: params.wantsAnalysis,
      hasAttachments,
      isForgeProductionRun: params.isForgeProductionRun ?? params.forgeProduction,
    });

  return buildConnectorResolutionContext({
    query: params.query,
    shortCircuit: params.shortCircuit ?? null,
    enrichment:
      params.enrichment !== undefined
        ? params.enrichment
        : resolveKnowledgeEnrichmentPolicy(params.query || ""),
    hasAttachments,
    forgeProduction: Boolean(params.forgeProduction ?? params.isForgeProductionRun),
    webEnabled: params.webEnabled !== false,
    expertTaskType,
    requestedCapability,
    userConfirmedConnectorId: params.userConfirmedConnectorId ?? null,
  });
}

/**
 * Reproduit la logique legacy de forcedExpertKey (Phase B — comparaison shadow).
 * @param {{
 *   query?: string,
 *   shortCircuit?: object|null,
 *   effectiveForcedExpertKey?: string|null,
 *   initialForcedExpertKey?: string|null,
 *   enrichment?: ReturnType<typeof resolveKnowledgeEnrichmentPolicy>|null,
 *   deferToFullPipelineActive?: boolean,
 *   orchestratorGate?: boolean,
 * }} params
 * @returns {string|null}
 */
export function deriveLegacyForcedExpertKey({
  query = "",
  shortCircuit = null,
  effectiveForcedExpertKey = null,
  initialForcedExpertKey = null,
  enrichment = null,
  deferToFullPipelineActive = false,
  orchestratorGate = false,
} = {}) {
  if (effectiveForcedExpertKey) return effectiveForcedExpertKey;
  if (initialForcedExpertKey) return initialForcedExpertKey;

  const enrich = enrichment ?? resolveKnowledgeEnrichmentPolicy(query);

  if (
    deferToFullPipelineActive &&
    (enrich.preferWebResearch || shortCircuit?.preferWebResearch)
  ) {
    return "expert_web_search";
  }

  if (orchestratorGate && enrich.preferWebResearch) {
    return "expert_web_search";
  }

  return null;
}

/**
 * @param {{ primary?: { id?: string }, chain?: Array<{ id?: string }> }} plan
 * @returns {boolean}
 */
export function connectorPlanImpliesWeb(plan = {}) {
  if (plan.primary?.id === "expert_web_search") return true;
  return (plan.chain || []).some((entry) => entry.id === "expert_web_search");
}

/**
 * Phase B — alignement web legacy vs plan registre.
 * @param {{ primary?: { id?: string }, chain?: Array<{ id?: string }> }} plan
 * @param {string|null} legacyForcedExpertKey
 * @returns {boolean}
 */
export function connectorPlanMatchesLegacy(plan, legacyForcedExpertKey = null) {
  const planWeb = connectorPlanImpliesWeb(plan);
  const legacyWeb = legacyForcedExpertKey === "expert_web_search";
  return planWeb === legacyWeb;
}

/**
 * @param {import("../telemetry/turnTelemetry.js").default} turnTelemetry
 * @param {{
 *   plan: ReturnType<typeof resolveConnectorChain>,
 *   legacyForcedExpertKey?: string|null,
 *   effectiveForcedExpertKey?: string|null,
 *   hook?: string,
 * }} payload
 */
export function recordConnectorPlanObservation(
  turnTelemetry,
  {
    plan,
    legacyForcedExpertKey = null,
    effectiveForcedExpertKey = null,
    hook = "unknown",
  },
) {
  const chainIds = (plan.chain || []).map((entry) => entry.id);
  const matchesLegacy = connectorPlanMatchesLegacy(
    plan,
    legacyForcedExpertKey,
  );

  turnTelemetry.recordEvent("connector.plan.shadow", {
    status: "ok",
    hook,
    primary: plan.primary?.id || null,
    chain: chainIds.join(","),
    reason_code: plan.reason?.code || null,
    reason_message: plan.reason?.message || null,
    effective_forced_expert_key: effectiveForcedExpertKey || null,
    legacy_forced_expert_key: legacyForcedExpertKey || null,
    connector_plan_matches_legacy: matchesLegacy,
  });

  console.log(
    `[CONNECTOR][shadow:${hook}] primary=${plan.primary?.id || "none"} ` +
      `chain=[${chainIds.join(", ")}] reason=${plan.reason?.code || "none"} ` +
      `legacyKey=${legacyForcedExpertKey || "none"} ` +
      `effectiveKey=${effectiveForcedExpertKey || "none"} match=${matchesLegacy}`,
  );

  return { matchesLegacy, chainIds };
}

/**
 * @param {object} params
 * @returns {{ plan: ReturnType<typeof resolveConnectorChain>, legacyForcedExpertKey: string|null, observation: ReturnType<typeof recordConnectorPlanObservation> }}
 */
export function observeConnectorPlanShadow(params = {}) {
  const ctx = buildPipelineConnectorContext(params);
  const plan = resolveConnectorChain(ctx);
  const legacyForcedExpertKey = deriveLegacyForcedExpertKey({
    query: params.query,
    shortCircuit: params.shortCircuit ?? null,
    effectiveForcedExpertKey: params.effectiveForcedExpertKey ?? null,
    initialForcedExpertKey: params.initialForcedExpertKey ?? null,
    enrichment: ctx.enrichment,
    deferToFullPipelineActive: Boolean(params.deferToFullPipelineActive),
    orchestratorGate: Boolean(params.orchestratorGate),
  });

  const observation = recordConnectorPlanObservation(params.turnTelemetry, {
    plan,
    legacyForcedExpertKey,
    effectiveForcedExpertKey: params.effectiveForcedExpertKey ?? null,
    hook: params.hook || "unknown",
  });

  return { plan, legacyForcedExpertKey, observation };
}
