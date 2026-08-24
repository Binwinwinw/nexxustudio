/**
 * NEXXUS AGENT ROLE POLICY
 * Centralized mapping of specialized models to agentic roles.
 *
 * T1/T2 : uniquement via resolveWarmupExperimentPlan() (getters models.js).
 * T3 : IDs figés — hors chantier experiment.
 *
 * T1 = warmup, social, tri léger, synthèse courte.
 * T2 = reasoner différé, jamais résident au boot.
 * Timeout ≠ escalade qualité (voir getFallbackModel vs getEscalationModel).
 */

import {
  getActiveTier1ChatModel,
  getReasonerModel,
  isTier2Enabled,
} from "../../../config/models.js";

export const MODEL_NATURE = Object.freeze({
  THINKER: "thinking", // Modèles avec raisonnement interne (<think>)
  ACTOR: "acting", // Modèles directs, orientés exécution/code
  SOCIAL: "social", // Modèles conversationnels
});

const NATURE_MAP = {
  "deepseek-r1": MODEL_NATURE.THINKER,
  gemma4: MODEL_NATURE.THINKER,
  granite: MODEL_NATURE.THINKER,
  "qwen-coder": MODEL_NATURE.ACTOR,
  "qwen2.5-coder": MODEL_NATURE.ACTOR,
  ornith: MODEL_NATURE.ACTOR,
  "qwen3.5": MODEL_NATURE.SOCIAL,
  zephyr: MODEL_NATURE.SOCIAL,
};

export function getModelNature(modelName) {
  const m = String(modelName).toLowerCase();
  for (const [key, nature] of Object.entries(NATURE_MAP)) {
    if (m.includes(key)) return nature;
  }
  return MODEL_NATURE.SOCIAL;
}

export const AGENT_ROLES = Object.freeze({
  get CHAT() {
    return getActiveTier1ChatModel();
  },
  get SOCIAL() {
    return getActiveTier1ChatModel();
  },
  VOX: "nexxus-vox:latest",

  get ORCHESTRATOR() {
    return getReasonerModel();
  },
  get PLANNER() {
    return getReasonerModel();
  },
  get CHAT_REASONER() {
    return getReasonerModel();
  },
  TRANSLATOR: "qwen3.5:9b",

  BUILDER: "qwen2.5-coder:7b",
  ELITE_CODER: "qwen2.5-coder:7b",
  get FORGE_REASONER() {
    return getReasonerModel();
  },
  get MASTER_ARCHITECT() {
    return getReasonerModel();
  },
  get SECURITY_AUDITOR() {
    return getReasonerModel();
  },

  VISION: "gemma4:12b",
  OCR: "glm-ocr:q8_0",
  get ZEPHYR() {
    return getActiveTier1ChatModel();
  },

  get WEB_SEARCHER() {
    return getActiveTier1ChatModel();
  },

  get SEMANTIC_ROUTER() {
    return getActiveTier1ChatModel();
  },
});

/** Alias historique : ZEPHYR n'est plus un modèle servi. */
const OBSOLETE_LIGHT_JSON_MODEL_RE = /^zephyr(?::|$)/i;

/**
 * JSON léger T1 (préprocesseur, tri, mini-délibération).
 * Ignore un override env/call-site encore collé sur zephyr.
 */
export function resolveLightJsonModel(envOverride) {
  const override = String(envOverride || "").trim();
  if (override && !OBSOLETE_LIGHT_JSON_MODEL_RE.test(override)) {
    return override;
  }
  return getActiveTier1ChatModel();
}

const HEAVY_MODELS = [
  "gemma4:26b",
  "gemma4:31b",
  AGENT_ROLES.NEMOTRON_MATH,
  AGENT_ROLES.SECURITY_AUDITOR,
  AGENT_ROLES.MASTER_ARCHITECT,
];

function isAirLLMEnabled() {
  return process.env.USE_AIRLLM === "true";
}

function getPreferredHeavyModel() {
  const requested = String(process.env.MAX_HEAVY_MODEL || "").toLowerCase();
  return HEAVY_MODELS.includes(requested)
    ? requested
    : AGENT_ROLES.FORGE_REASONER;
}

/**
 * Maps a phase or expert key to a specific model role.
 */
export function getModelForRole(roleOrKey, phase = "DISCOVERY") {
  const r = String(roleOrKey).toLowerCase();
  const isForgeMode = [
    "READY_FOR_FORGE",
    "FORGE_RUNNING",
    "FORGE_DONE",
  ].includes(phase);

  if (r.includes("pm") || r.includes("mentor") || r.includes("assistant")) {
    return phase === "DISCOVERY"
      ? AGENT_ROLES.SOCIAL
      : AGENT_ROLES.CHAT_REASONER;
  }

  if (r.includes("security") || r.includes("souveraineté")) {
    return AGENT_ROLES.SECURITY_AUDITOR;
  }

  if (r.includes("architect")) {
    return AGENT_ROLES.MASTER_ARCHITECT;
  }

  if (r.includes("analyst") || r.includes("auditeur")) {
    return isForgeMode ? AGENT_ROLES.FORGE_REASONER : AGENT_ROLES.CHAT_REASONER;
  }

  if (
    r.includes("web_search") ||
    r.includes("web search") ||
    r.includes("web_research")
  ) {
    return AGENT_ROLES.WEB_SEARCHER;
  }

  if (r.includes("developer")) {
    return isForgeMode ? AGENT_ROLES.ELITE_CODER : AGENT_ROLES.BUILDER;
  }

  if (r.includes("qa")) {
    return AGENT_ROLES.BUILDER;
  }

  if (isForgeMode) return AGENT_ROLES.BUILDER;

  return AGENT_ROLES.SOCIAL;
}

/**
 * Fallback échec (timeout / indispo) — jamais une escalade qualité.
 * T2 fail → T1. T1 fail → null (G4, pas de swap silencieux).
 */
export function getFallbackModel(primaryModel) {
  const t1 = getActiveTier1ChatModel();
  const t2 = getReasonerModel();
  if (!primaryModel || t2 === t1) return null;
  if (primaryModel === t2) return t1;
  return null;
}

/**
 * Escalade capacité T1 → T2. Distinct du fallback.
 * Timeout n'est PAS une escalade. Ne pas appeler depuis le catch d'échec.
 */
export function getEscalationModel(currentModel) {
  if (!isTier2Enabled()) return null;
  const t1 = getActiveTier1ChatModel();
  const t2 = getReasonerModel();
  if (!t2 || t2 === t1) return null;
  if (currentModel === t1) return t2;
  return null;
}

/**
 * Budget discret 3–10 = reasoner T2 différé.
 * Les valeurs >> 10 (ex. budgets.execution en ms) ne sont PAS une escalade.
 */
export function shouldUseDeferredReasoner(reasoningBudget) {
  const budget = Number(reasoningBudget);
  return Number.isFinite(budget) && budget >= 3 && budget <= 10;
}
