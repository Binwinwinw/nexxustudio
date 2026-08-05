/**
 * Registre gouverné des connecteurs v1 — source de vérité exécutable.
 *
 * Doctrine : intent → slots → coverage → connector → delivery
 * Phase A : résolution pure + tests — pas de câblage runtime prod.
 */
import {
  FAMILY_DELIVERY_MODES,
  resolveIntentFamilyFromRegistry,
} from "../intent/intentFamilyRegistry.js";
import { resolveKnowledgeEnrichmentPolicy } from "../routing/knowledgeEnrichmentPolicy.js";

export const CONNECTOR_REGISTRY_V1 = "connector_registry_v1";

export const CONNECTOR_KINDS = Object.freeze({
  LOCAL: "local",
  INTERNAL: "internal",
  EXTERNAL: "external",
});

export const CONNECTOR_OPT_IN = Object.freeze({
  NONE: "none",
  IMPLICIT: "implicit",
  EXPLICIT: "explicit",
});

export const EXPERT_TASK_TYPES = Object.freeze({
  EXPERT_TASK: "expert_task",
  FACTUAL_LIGHT: "factual_light",
  NORMAL: "normal_conversation",
  UNKNOWN: "unknown",
});

export const REQUESTED_CAPABILITIES = Object.freeze({
  CODE_ANALYSIS: "code_analysis",
  DOCUMENT_ANALYSIS: "document_analysis",
  WEB_RESEARCH: "web_research",
  FORGE_BUILD: "forge_build",
  CONVERSATION: "conversation",
  UNKNOWN: "unknown",
});

export const CONNECTOR_REASON_CODES = Object.freeze({
  FORGE_PRODUCTION_RUN: "forge_production_run",
  GOVERNED_DIRECT_ANSWER: "governed_direct_answer",
  SHORT_CIRCUIT_DETERMINISTIC: "short_circuit_deterministic_reply",
  PEDAGOGICAL_KB_DETERMINISTIC: "pedagogical_kb_deterministic",
  FAMILY_DEFER_FULL_PIPELINE: "family_defer_full_pipeline",
  ADMIN_PROCEDURE_REQUIRES_WEB: "admin_procedure_requires_web_enrichment",
  LOCAL_GENERATIVE_SHORT_CIRCUIT: "local_generative_short_circuit",
  LOCAL_GENERATIVE_FAMILY: "local_generative_family_match",
  ENRICHMENT_REQUIRES_WEB: "enrichment_requires_web_research",
  DEFAULT_ORCHESTRATOR: "default_orchestrator_fallback",
  WEB_CHAIN_SUPPRESSED: "web_chain_suppressed",
  EXPERT_ATTACHMENT_ORCHESTRATOR: "expert_attachment_orchestrator",
});

/**
 * Ordre global de résolution v1.
 * @type {readonly string[]}
 */
export const CONNECTOR_RESOLUTION_ORDER_V1 = Object.freeze([
  "local_deterministic",
  "local_generative",
  "knowledge_hub_rag",
  "session_work_memory",
  "forge_runtime",
  "expert_web_search",
  "full_pipeline_orchestrator",
]);

/**
 * @typedef {Object} ConnectorResolutionReason
 * @property {string} code
 * @property {string} message
 */

/**
 * @typedef {Object} CanonicalConnectorCase
 * @property {string} label
 * @property {string} query
 * @property {string} expectedPrimaryConnectorId
 * @property {string[]} [expectedChain]
 * @property {string|null} [intentFamilyId]
 * @property {Partial<ConnectorResolutionContext>} [contextOverrides]
 */

/**
 * @typedef {Object} ConnectorResolutionContext
 * @property {string} query
 * @property {import("./intentFamilyRegistry.js").IntentFamilyEntry|null} [intentFamily]
 * @property {object|null} [shortCircuit]
 * @property {ReturnType<typeof resolveKnowledgeEnrichmentPolicy>|null} [enrichment]
 * @property {object|null} [coverage]
 * @property {{ type?: string, topic?: object }|null} [governedContext]
 * @property {boolean} [hasAttachments]
 * @property {boolean} [forgeProduction]
 * @property {boolean} [webEnabled]
 * @property {string|null} [expertTaskType]
 * @property {string|null} [requestedCapability]
 * @property {string|null} [userConfirmedConnectorId]
 * @property {boolean} [explicitWebRequest]
 */

/**
 * @typedef {Object} ConnectorEntry
 * @property {string} id
 * @property {string} promise
 * @property {string} kind
 * @property {string} optIn
 * @property {number} resolveOrder
 * @property {string} executorModule
 * @property {string[]} signals
 * @property {string[]} mustExclude
 * @property {(ctx: ConnectorResolutionContext) => boolean} eligible
 * @property {string|null} fallbackConnectorId
 * @property {CanonicalConnectorCase[]} canonicalQueries
 */

const EXPLICIT_WEB_RE =
  /\b(?:web|internet|recherche web|sources?(?:\s+officielles?)?|cherche(?:r)?\s+en\s+ligne)\b/i;

/** @type {ConnectorEntry[]} */
export const CONNECTORS_V1 = [
  {
    id: "local_deterministic",
    promise: "Réponse locale immédiate — KB déterministe ou short-circuit avec reply.",
    kind: CONNECTOR_KINDS.LOCAL,
    optIn: CONNECTOR_OPT_IN.NONE,
    resolveOrder: 10,
    executorModule: "micro/replies/pedagogicalOverviewComposer.js",
    signals: ["pedagogical_overview_deterministic", "shortCircuit.reply"],
    mustExclude: ["deferToLlm sans reply"],
    eligible: (ctx) =>
      Boolean(ctx.shortCircuit?.reply && !ctx.shortCircuit?.deferToLlm) ||
      ctx.shortCircuit?.path === "pedagogical_overview_deterministic",
    fallbackConnectorId: "local_generative",
    canonicalQueries: [
      {
        label: "fractions 6e KB",
        query:
          "que dois apprendre un élève de 6eme sur les fractions simples ?",
        expectedPrimaryConnectorId: "local_deterministic",
        expectedChain: [],
        intentFamilyId: "pedagogical_overview",
        contextOverrides: {
          shortCircuit: {
            path: "pedagogical_overview_deterministic",
            reply: "socle fractions 6e",
          },
        },
      },
    ],
  },
  {
    id: "local_generative",
    promise: "simpleFast + composers locaux (familles LOCAL_GENERATIVE).",
    kind: CONNECTOR_KINDS.LOCAL,
    optIn: CONNECTOR_OPT_IN.NONE,
    resolveOrder: 20,
    executorModule: "paths/simpleFastPath.js",
    signals: ["deferToLlm", "LOCAL_GENERATIVE"],
    mustExclude: ["deferToFullPipeline"],
    eligible: (ctx) =>
      Boolean(ctx.shortCircuit?.deferToLlm) ||
      ctx.intentFamily?.deliveryMode === FAMILY_DELIVERY_MODES.LOCAL_GENERATIVE,
    fallbackConnectorId: "full_pipeline_orchestrator",
    canonicalQueries: [
      {
        label: "fiches JSX",
        query:
          "je veux créer des fiches de connaissances afin maitriser le jsx et ses regles",
        expectedPrimaryConnectorId: "local_generative",
        expectedChain: [],
        intentFamilyId: "technical_learning_path",
      },
      {
        label: "explique Redis",
        query: "explique Redis",
        expectedPrimaryConnectorId: "local_generative",
        expectedChain: [],
        intentFamilyId: "technical_overview",
      },
    ],
  },
  {
    id: "knowledge_hub_rag",
    promise: "Réponse directe gouvernée depuis le Knowledge Hub / Chroma.",
    kind: CONNECTOR_KINDS.INTERNAL,
    optIn: CONNECTOR_OPT_IN.IMPLICIT,
    resolveOrder: 30,
    executorModule: "knowledge/knowledgeService.js",
    signals: ["governedContext.direct_answer"],
    mustExclude: ["expert_task"],
    eligible: (ctx) =>
      ctx.governedContext?.type === "direct_answer" &&
      ctx.expertTaskType !== EXPERT_TASK_TYPES.EXPERT_TASK,
    fallbackConnectorId: "full_pipeline_orchestrator",
    canonicalQueries: [
      {
        label: "KB direct answer",
        query: "qu est ce que la citadelle nexxus",
        expectedPrimaryConnectorId: "knowledge_hub_rag",
        expectedChain: [],
        contextOverrides: {
          governedContext: { type: "direct_answer", topic: { id: "citadelle" } },
        },
      },
    ],
  },
  {
    id: "session_work_memory",
    promise: "Continuité session / session work memory (tour courant).",
    kind: CONNECTOR_KINDS.INTERNAL,
    optIn: CONNECTOR_OPT_IN.NONE,
    resolveOrder: 40,
    executorModule: "memory/session-work-memory.js",
    signals: ["continuity", "anaphora"],
    mustExclude: [],
    eligible: () => false,
    fallbackConnectorId: null,
    canonicalQueries: [],
  },
  {
    id: "forge_runtime",
    promise: "Exécution Forge — shell, artifacts, code (gate privilégiée).",
    kind: CONNECTOR_KINDS.INTERNAL,
    optIn: CONNECTOR_OPT_IN.EXPLICIT,
    resolveOrder: 50,
    executorModule: "forge/forgeProductionPipeline.js",
    signals: ["forgeProduction", "forge_build"],
    mustExclude: [],
    eligible: (ctx) =>
      Boolean(ctx.forgeProduction) ||
      ctx.requestedCapability === REQUESTED_CAPABILITIES.FORGE_BUILD,
    fallbackConnectorId: null,
    canonicalQueries: [
      {
        label: "forge production",
        query: "construis le module auth",
        expectedPrimaryConnectorId: "forge_runtime",
        expectedChain: [],
        contextOverrides: { forgeProduction: true },
      },
    ],
  },
  {
    id: "expert_web_search",
    promise: "Recherche web externe — preuves et fraîcheur.",
    kind: CONNECTOR_KINDS.EXTERNAL,
    optIn: CONNECTOR_OPT_IN.IMPLICIT,
    resolveOrder: 60,
    executorModule: "agents/expertWebSearch.js",
    signals: ["preferWebResearch", "enrichment", "admin_procedure"],
    mustExclude: ["attachment_expert_task_without_explicit_web"],
    eligible: (ctx) => wantsWebResearch(ctx) && !isWebChainBlocked(ctx),
    fallbackConnectorId: null,
    canonicalQueries: [],
  },
  {
    id: "full_pipeline_orchestrator",
    promise: "Orchestrateur souverain — pipeline complet multi-stages.",
    kind: CONNECTOR_KINDS.INTERNAL,
    optIn: CONNECTOR_OPT_IN.NONE,
    resolveOrder: 70,
    executorModule: "orchestrator/SovereignOrchestrator.js",
    signals: ["deferToFullPipeline", "compare_choose", "default"],
    mustExclude: [],
    eligible: () => true,
    fallbackConnectorId: null,
    canonicalQueries: [
      {
        label: "compare Redis",
        query: "Redis vs Memcached que choisir pour un cache session",
        expectedPrimaryConnectorId: "full_pipeline_orchestrator",
        expectedChain: [],
        intentFamilyId: "compare_choose",
      },
      {
        label: "admin impôts",
        query: "comment déclarer mes impôts en ligne",
        expectedPrimaryConnectorId: "full_pipeline_orchestrator",
        expectedChain: ["expert_web_search"],
        intentFamilyId: "admin_procedure",
      },
      {
        label: "entité fraîche",
        query: "prix action Tesla aujourd hui",
        expectedPrimaryConnectorId: "full_pipeline_orchestrator",
        expectedChain: ["expert_web_search"],
      },
      {
        label: "attachment expert sans web",
        query: "analyse ce fichier et corrige le bug",
        expectedPrimaryConnectorId: "full_pipeline_orchestrator",
        expectedChain: [],
        contextOverrides: {
          hasAttachments: true,
          expertTaskType: EXPERT_TASK_TYPES.EXPERT_TASK,
          requestedCapability: REQUESTED_CAPABILITIES.CODE_ANALYSIS,
        },
      },
    ],
  },
];

export const CONNECTOR_BY_ID = Object.freeze(
  Object.fromEntries(CONNECTORS_V1.map((entry) => [entry.id, entry])),
);

/**
 * @param {Partial<ConnectorResolutionContext>} [partial]
 * @returns {ConnectorResolutionContext}
 */
export function buildConnectorResolutionContext(partial = {}) {
  const query = String(partial.query || "");
  const explicitWebRequest =
    partial.explicitWebRequest ??
    EXPLICIT_WEB_RE.test(query);

  return {
    query,
    intentFamily:
      partial.intentFamily !== undefined
        ? partial.intentFamily
        : resolveIntentFamilyFromRegistry(query),
    shortCircuit: partial.shortCircuit ?? null,
    enrichment:
      partial.enrichment !== undefined
        ? partial.enrichment
        : resolveKnowledgeEnrichmentPolicy(query),
    coverage: partial.coverage ?? null,
    governedContext: partial.governedContext ?? null,
    hasAttachments: Boolean(partial.hasAttachments),
    forgeProduction: Boolean(partial.forgeProduction),
    webEnabled: partial.webEnabled !== false,
    expertTaskType: partial.expertTaskType ?? null,
    requestedCapability: partial.requestedCapability ?? null,
    userConfirmedConnectorId: partial.userConfirmedConnectorId ?? null,
    explicitWebRequest,
  };
}

/**
 * @param {ConnectorResolutionContext} ctx
 * @returns {boolean}
 */
export function isWebChainBlocked(ctx) {
  if (!ctx.webEnabled) return true;
  return (
    Boolean(ctx.hasAttachments) &&
    ctx.expertTaskType === EXPERT_TASK_TYPES.EXPERT_TASK &&
    !ctx.explicitWebRequest
  );
}

/**
 * @param {ConnectorResolutionContext} ctx
 * @returns {boolean}
 */
export function wantsWebResearch(ctx) {
  if (ctx.intentFamily?.preferWebResearch === false) {
    return false;
  }
  return Boolean(
    ctx.enrichment?.preferWebResearch ||
      ctx.intentFamily?.preferWebResearch ||
      ctx.shortCircuit?.preferWebResearch,
  );
}

/**
 * @param {ConnectorResolutionContext} ctx
 * @returns {boolean}
 */
export function isExpertAttachmentOrchestrator(ctx) {
  return (
    Boolean(ctx.hasAttachments) &&
    ctx.expertTaskType === EXPERT_TASK_TYPES.EXPERT_TASK &&
    (ctx.requestedCapability === REQUESTED_CAPABILITIES.CODE_ANALYSIS ||
      ctx.requestedCapability === REQUESTED_CAPABILITIES.DOCUMENT_ANALYSIS)
  );
}

/**
 * @param {ConnectorResolutionContext} ctx
 * @returns {string[]}
 */
export function buildWebConnectorChain(ctx) {
  if (!wantsWebResearch(ctx) || isWebChainBlocked(ctx)) {
    return [];
  }
  return ["expert_web_search"];
}

/**
 * @param {string} connectorId
 * @returns {ConnectorEntry|null}
 */
export function getConnectorById(connectorId = "") {
  return CONNECTOR_BY_ID[connectorId] ?? null;
}

/**
 * @param {string} connectorId
 * @returns {string|null}
 */
export function mapConnectorToForcedExpertKey(connectorId = "") {
  if (connectorId === "expert_web_search") return "expert_web_search";
  return null;
}

/**
 * @param {ConnectorEntry} primary
 * @param {ConnectorEntry[]} chain
 * @param {ConnectorResolutionReason} reason
 * @returns {{ primary: ConnectorEntry, chain: ConnectorEntry[], reason: ConnectorResolutionReason }}
 */
function buildConnectorPlan(primary, chain, reason) {
  return { primary, chain, reason };
}

/**
 * @param {string} code
 * @param {string} message
 * @returns {ConnectorResolutionReason}
 */
function connectorReason(code, message) {
  return { code, message };
}

/**
 * @param {ConnectorResolutionContext} ctx
 * @returns {{ primary: ConnectorEntry, chain: ConnectorEntry[], reason: ConnectorResolutionReason }}
 */
export function resolveConnectorChain(ctx = {}) {
  const normalized = buildConnectorResolutionContext(ctx);
  const webChainIds = buildWebConnectorChain(normalized);
  const webChain = webChainIds
    .map((id) => getConnectorById(id))
    .filter(Boolean);

  if (normalized.forgeProduction) {
    return buildConnectorPlan(
      getConnectorById("forge_runtime"),
      [],
      connectorReason(
        CONNECTOR_REASON_CODES.FORGE_PRODUCTION_RUN,
        "Tour Forge production — exécution privilégiée sans orchestrateur général.",
      ),
    );
  }

  if (
    normalized.governedContext?.type === "direct_answer" &&
    normalized.expertTaskType !== EXPERT_TASK_TYPES.EXPERT_TASK
  ) {
    return buildConnectorPlan(
      getConnectorById("knowledge_hub_rag"),
      [],
      connectorReason(
        CONNECTOR_REASON_CODES.GOVERNED_DIRECT_ANSWER,
        "Réponse directe gouvernée depuis le Knowledge Hub.",
      ),
    );
  }

  if (
    normalized.shortCircuit?.reply &&
    !normalized.shortCircuit?.deferToLlm
  ) {
    return buildConnectorPlan(
      getConnectorById("local_deterministic"),
      [],
      connectorReason(
        CONNECTOR_REASON_CODES.SHORT_CIRCUIT_DETERMINISTIC,
        "Short-circuit déterministe avec reply locale prête.",
      ),
    );
  }

  if (normalized.shortCircuit?.path === "pedagogical_overview_deterministic") {
    return buildConnectorPlan(
      getConnectorById("local_deterministic"),
      [],
      connectorReason(
        CONNECTOR_REASON_CODES.PEDAGOGICAL_KB_DETERMINISTIC,
        "Fiche pédagogique KB locale — rendu déterministe.",
      ),
    );
  }

  if (isExpertAttachmentOrchestrator(normalized)) {
    return buildConnectorPlan(
      getConnectorById("full_pipeline_orchestrator"),
      buildWebConnectorChain(normalized)
        .map((id) => getConnectorById(id))
        .filter(Boolean),
      connectorReason(
        isWebChainBlocked(normalized)
          ? CONNECTOR_REASON_CODES.WEB_CHAIN_SUPPRESSED
          : CONNECTOR_REASON_CODES.EXPERT_ATTACHMENT_ORCHESTRATOR,
        isWebChainBlocked(normalized)
          ? "Pièce jointe expert — orchestrateur sans recherche web implicite."
          : "Pièce jointe expert — orchestrateur souverain.",
      ),
    );
  }

  if (
    normalized.shortCircuit?.deferToFullPipeline ||
    normalized.intentFamily?.deferToFullPipeline
  ) {
    const reasonCode =
      normalized.intentFamily?.id === "admin_procedure"
        ? CONNECTOR_REASON_CODES.ADMIN_PROCEDURE_REQUIRES_WEB
        : CONNECTOR_REASON_CODES.FAMILY_DEFER_FULL_PIPELINE;

    const message =
      normalized.intentFamily?.id === "admin_procedure"
        ? "Procédure administrative — pipeline complet avec enrichissement web officiel."
        : "Famille en defer full pipeline — orchestrateur souverain.";

    return buildConnectorPlan(
      getConnectorById("full_pipeline_orchestrator"),
      webChain,
      connectorReason(reasonCode, message),
    );
  }

  if (
    normalized.shortCircuit?.deferToLlm ||
    normalized.intentFamily?.deliveryMode ===
      FAMILY_DELIVERY_MODES.LOCAL_GENERATIVE
  ) {
    const suppressed =
      wantsWebResearch(normalized) && isWebChainBlocked(normalized);
    return buildConnectorPlan(
      getConnectorById("local_generative"),
      webChain,
      connectorReason(
        normalized.shortCircuit?.deferToLlm
          ? CONNECTOR_REASON_CODES.LOCAL_GENERATIVE_SHORT_CIRCUIT
          : CONNECTOR_REASON_CODES.LOCAL_GENERATIVE_FAMILY,
        suppressed
          ? "simpleFast local — chaîne web supprimée (pièce jointe + expert_task)."
          : "Composer local generative — simpleFast prioritaire.",
      ),
    );
  }

  if (wantsWebResearch(normalized)) {
    return buildConnectorPlan(
      getConnectorById("full_pipeline_orchestrator"),
      webChain,
      connectorReason(
        isWebChainBlocked(normalized)
          ? CONNECTOR_REASON_CODES.WEB_CHAIN_SUPPRESSED
          : CONNECTOR_REASON_CODES.ENRICHMENT_REQUIRES_WEB,
        isWebChainBlocked(normalized)
          ? "Orchestrateur par défaut — enrichissement web bloqué par garde-fou attachment."
          : "Enrichissement web requis — orchestrateur avec recherche externe.",
      ),
    );
  }

  return buildConnectorPlan(
    getConnectorById("full_pipeline_orchestrator"),
    [],
    connectorReason(
      CONNECTOR_REASON_CODES.DEFAULT_ORCHESTRATOR,
      "Aucun connecteur local prioritaire — orchestrateur souverain par défaut.",
    ),
  );
}

/**
 * @param {ConnectorResolutionContext} [ctx]
 * @returns {string|null}
 */
export function resolvePrimaryConnectorId(ctx = {}) {
  return resolveConnectorChain(ctx).primary?.id ?? null;
}

/**
 * Matrice plate — une ligne par requête canonique du registre connecteurs.
 * @returns {Array<CanonicalConnectorCase & { connectorId: string }>}
 */
export function getConnectorCanonicalMatrixV1() {
  const rows = [];
  for (const connector of CONNECTORS_V1) {
    for (const canonical of connector.canonicalQueries) {
      rows.push({
        connectorId: connector.id,
        ...canonical,
      });
    }
  }
  return rows;
}

/**
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateConnectorRegistryV1() {
  const errors = [];
  const ids = new Set();
  const orders = new Set();

  for (const connector of CONNECTORS_V1) {
    if (ids.has(connector.id)) {
      errors.push(`duplicate connector id: ${connector.id}`);
    }
    ids.add(connector.id);

    if (orders.has(connector.resolveOrder)) {
      errors.push(`duplicate resolveOrder: ${connector.resolveOrder}`);
    }
    orders.add(connector.resolveOrder);

    if (typeof connector.eligible !== "function") {
      errors.push(`connector ${connector.id}: eligible is not a function`);
    }

    if (
      connector.fallbackConnectorId &&
      !CONNECTOR_BY_ID[connector.fallbackConnectorId]
    ) {
      errors.push(
        `connector ${connector.id}: unknown fallback ${connector.fallbackConnectorId}`,
      );
    }
  }

  const orderIds = CONNECTOR_RESOLUTION_ORDER_V1;
  const registryIds = [...CONNECTORS_V1]
    .sort((a, b) => a.resolveOrder - b.resolveOrder)
    .map((c) => c.id);

  if (orderIds.join("|") !== registryIds.join("|")) {
    errors.push(
      "CONNECTOR_RESOLUTION_ORDER_V1 diverges from registry resolveOrder",
    );
  }

  for (const row of getConnectorCanonicalMatrixV1()) {
    const ctx = buildConnectorResolutionContext({
      query: row.query,
      ...(row.contextOverrides || {}),
    });
    const plan = resolveConnectorChain(ctx);
    if (plan.primary?.id !== row.expectedPrimaryConnectorId) {
      errors.push(
        `canonical « ${row.label} »: expected primary ${row.expectedPrimaryConnectorId}, got ${plan.primary?.id}`,
      );
    }
    const chainIds = plan.chain.map((c) => c.id);
    const expectedChain = row.expectedChain || [];
    if (chainIds.join("|") !== expectedChain.join("|")) {
      errors.push(
        `canonical « ${row.label} »: expected chain [${expectedChain.join(", ")}], got [${chainIds.join(", ")}]`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}
