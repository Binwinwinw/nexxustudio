/**
 * NEXXUS AGENT ROLE POLICY
 * Centralized mapping of specialized models to agentic roles.
 *
 * RÈGLE FONDAMENTALE DE SÉPARATION :
 * - MODE CHAT  : ornith:9b (chat social, synthèse légère, raisonnement runtime).
 * - MODE FORGE : reasoner = Tier 1 chat ; BUILDER selon l'expert.
 */

import { MODEL_CONFIG } from "../../../config/models.js";

const REASONER_MODEL = MODEL_CONFIG.TIER_1.model;
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
  // TIER 1 — TOUR DE CONTRÔLE (Persona & Rapid Chat)
  CHAT: "ornith:9b",
  SOCIAL: "ornith:9b",
  VOX: "nexxus-vox:latest",

  // REASONER — aligné Tier 1 (plus de couloir Tier 2 R1)
  ORCHESTRATOR: REASONER_MODEL,
  PLANNER: REASONER_MODEL,
  CHAT_REASONER: REASONER_MODEL,
  TRANSLATOR: "qwen3.5:9b",

  // TIER 3 — LA FORGE (Expert Coder)
  BUILDER: "qwen2.5-coder:7b",
  ELITE_CODER: "qwen2.5-coder:7b",
  FORGE_REASONER: REASONER_MODEL,
  MASTER_ARCHITECT: REASONER_MODEL,
  SECURITY_AUDITOR: REASONER_MODEL,

  // SPÉCIALISTES
  VISION: "gemma4:12b",
  OCR: "glm-ocr:q8_0",
  ZEPHYR: "zephyr:latest",

  // WEB RESEARCH (V1 — duck-duck-scrape, sans LLM dédié)
  WEB_SEARCHER: "ornith:9b", // Synthèse légère des sources web

  // SEMANTIC ROUTER (JSON)
  SEMANTIC_ROUTER: "zephyr:latest",
});

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

  // 1. PM / Mentor / Assistant -> Raisonnement agile en DISCOVERY (9b), Analytique ensuite (8b)
  if (r.includes("pm") || r.includes("mentor") || r.includes("assistant")) {
    return phase === "DISCOVERY"
      ? AGENT_ROLES.SOCIAL
      : AGENT_ROLES.CHAT_REASONER;
  }

  // 2. Gestion du raisonnement par zone technique profonde
  if (r.includes("security") || r.includes("souveraineté")) {
    return AGENT_ROLES.SECURITY_AUDITOR;
  }

  if (r.includes("architect")) {
    return AGENT_ROLES.MASTER_ARCHITECT;
  }

  if (r.includes("analyst") || r.includes("auditeur")) {
    return isForgeMode ? AGENT_ROLES.FORGE_REASONER : AGENT_ROLES.CHAT_REASONER;
  }

  // Web Search Expert
  if (
    r.includes("web_search") ||
    r.includes("web search") ||
    r.includes("web_research")
  ) {
    return AGENT_ROLES.WEB_SEARCHER;
  }

  // 3. Experts techniques -> Gamme Builder / Elite
  if (r.includes("developer")) {
    return isForgeMode ? AGENT_ROLES.ELITE_CODER : AGENT_ROLES.BUILDER;
  }

  if (r.includes("qa")) {
    return AGENT_ROLES.BUILDER;
  }

  // 4. Par défaut par phase
  if (isForgeMode) return AGENT_ROLES.BUILDER;

  return AGENT_ROLES.SOCIAL;
}

/**
 * Returns a lighter fallback model if the primary one fails.
 */
export function getFallbackModel(primaryModel) {
  const fallbacks = {
    [AGENT_ROLES.FORGE_REASONER]: AGENT_ROLES.CHAT_REASONER,
    [AGENT_ROLES.CHAT_REASONER]: AGENT_ROLES.SOCIAL,
    [AGENT_ROLES.ORCHESTRATOR]: AGENT_ROLES.CHAT,
  };
  return fallbacks[primaryModel] || null;
}
