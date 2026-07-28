/**
 * PlacementPlan P0 — snapshot doctrine Ollama (résident / lazy / prefetch / never).
 * Lecture seule : n'altère pas l'éviction ni ensureModel.
 *
 * Raffinements design :
 * - class = durable (session/matrice) ; intentHint = opportuniste (tour)
 * - observedProcessor / observedSizeGb depuis ollama /api/ps
 * - actions futures incluent deferred ≠ refuse
 * - keep_alive critique → voie REST Ollama (pas SDK OpenAI)
 */
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import {
  getBootProfile,
  getActiveTier1ChatModel,
  isTier2Enabled,
  MODEL_CONFIG,
} from "../../config/models.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MATRIX_PATH = path.resolve(
  __dirname,
  "../../../config/warmup.matrix.json",
);

export const PLACEMENT_PLAN_VERSION = "1.0.0";

/** Classes durables (plan / session). */
export const PLACEMENT_CLASSES = Object.freeze({
  RESIDENT: "resident",
  LAZY: "lazy",
  PREFETCH: "prefetch",
  NEVER: "never",
});

/**
 * Hint temporaire de tour — ne modifie pas `class`.
 * @typedef {'prefetch'|'defer'|null} PlacementIntentHint
 */

/**
 * Actions de décision (P1+) — deferred ≠ refuse.
 */
export const PLACEMENT_ACTIONS = Object.freeze({
  HIT: "hit",
  PREFETCH: "prefetch",
  RELOAD: "reload",
  EVICT_THEN_LOAD: "evict_then_load",
  DEFERRED: "deferred",
  REFUSE: "refuse",
});

/** Opérations critiques de placement : REST Ollama uniquement. */
export const PLACEMENT_KEEPALIVE_TRANSPORT = "ollama_rest";

const DOCTRINE_VRAM_GB = 8;
const RESERVE_GB = 0.5;

const NEVER_MODELS = Object.freeze([
  "qwen2.5-coder:14b",
  "deepseek-r1:8b",
  "deepseek-r1:14b",
  "qwen3-coder:30b",
]);

/**
 * @param {object} [matrix]
 * @returns {Promise<object>}
 */
export async function loadWarmupMatrix(matrixPath = DEFAULT_MATRIX_PATH) {
  return fs.readJson(matrixPath);
}

/**
 * @param {object} modelInput
 * @param {string} profile
 */
function resolveMatrixModel(modelInput, profile) {
  const base =
    typeof modelInput === "string"
      ? { id: modelInput }
      : { ...modelInput };
  const overrides = base.profiles?.[profile] || {};
  const merged = { ...base, ...overrides };
  return {
    id: merged.id || base.id,
    skip: merged.skip === true,
    role: merged.role || base.role || null,
    vramGb: Number(merged.vram_gb ?? base.vram_gb ?? 0) || 0,
    priority: Number(merged.priority ?? base.priority ?? 3) || 3,
  };
}

/**
 * Infère GPU / CPU / mixte depuis une entrée /api/ps.
 * @param {{ size?: number, size_vram?: number, processor?: string }} entry
 * @returns {'gpu'|'cpu'|'mixed'|'unknown'}
 */
export function inferObservedProcessor(entry = {}) {
  const explicit = String(entry.processor || "").toLowerCase();
  if (explicit.includes("cpu") && explicit.includes("gpu")) return "mixed";
  if (/\bgpu\b/.test(explicit) && !/\bcpu\b/.test(explicit)) return "gpu";
  if (/\bcpu\b/.test(explicit) && !/\bgpu\b/.test(explicit)) return "cpu";

  const size = Number(entry.size) || 0;
  const sizeVram = Number(entry.size_vram) || 0;
  if (size <= 0 && sizeVram <= 0) return "unknown";
  if (sizeVram <= 0) return "cpu";
  if (size > 0 && sizeVram >= size * 0.9) return "gpu";
  if (sizeVram > 0 && sizeVram < size * 0.9) return "mixed";
  return "unknown";
}

/**
 * @param {Array<object>} [psModels] — sortie ollama /api/ps .models
 * @returns {Map<string, { observedProcessor: string, observedSizeGb: number|null }>}
 */
export function indexActiveObservations(psModels = []) {
  const map = new Map();
  for (const entry of psModels || []) {
    const id = entry?.name || entry?.model;
    if (!id) continue;
    const size = Number(entry.size) || 0;
    map.set(id, {
      observedProcessor: inferObservedProcessor(entry),
      observedSizeGb: size > 0 ? Number((size / 1e9).toFixed(3)) : null,
    });
  }
  return map;
}

/**
 * @param {string} className
 * @param {number} priority
 */
function resolveKeepAlive(className, priority) {
  if (className === PLACEMENT_CLASSES.RESIDENT || priority === 1) return "-1";
  if (priority === 2) return "15m";
  return "5m";
}

/**
 * @param {object} opts
 * @param {string} [opts.profile]
 * @param {object} [opts.matrix] — warmup.matrix.json déjà chargé
 * @param {object} [opts.usageStats] — réservé P2 (hot-set)
 * @param {Record<string, Partial<object>>} [opts.overrides]
 * @param {Record<string, 'prefetch'|'defer'>} [opts.intentHints] — tour courant, non durable
 * @param {Array<object>} [opts.activePsModels] — ollama /api/ps models
 * @param {number} [opts.maxLoadedModels]
 * @param {number} [opts.maxVramGb]
 */
export function buildPlacementPlan(opts = {}) {
  const profile = getBootProfile(opts.profile);
  const matrix = opts.matrix || null;
  const observations = indexActiveObservations(opts.activePsModels || []);
  const intentHints = opts.intentHints || {};
  const overrides = opts.overrides || {};

  const doctrine = matrix?.doctrine || {};
  const envMaxLoaded = parseInt(
    process.env.OLLAMA_MAX_LOADED_MODELS || "2",
    10,
  );
  const maxLoadedModels =
    opts.maxLoadedModels != null
      ? opts.maxLoadedModels
      : Number.isFinite(envMaxLoaded) && envMaxLoaded > 0
        ? envMaxLoaded
        : 2;
  const maxVramGb =
    opts.maxVramGb != null
      ? opts.maxVramGb
      : Number(doctrine.max_vram_gb) ||
        MODEL_CONFIG.MAX_VRAM_GB ||
        DOCTRINE_VRAM_GB;

  /** @type {Map<string, object>} */
  const byId = new Map();

  const upsert = (placement) => {
    const prev = byId.get(placement.modelId);
    if (!prev) {
      byId.set(placement.modelId, placement);
      return;
    }
    // Priorité de classe : never > resident > prefetch > lazy
    const rank = {
      [PLACEMENT_CLASSES.NEVER]: 4,
      [PLACEMENT_CLASSES.RESIDENT]: 3,
      [PLACEMENT_CLASSES.PREFETCH]: 2,
      [PLACEMENT_CLASSES.LAZY]: 1,
    };
    if ((rank[placement.class] || 0) >= (rank[prev.class] || 0)) {
      byId.set(placement.modelId, { ...prev, ...placement });
    }
  };

  const attachObservation = (placement) => {
    const obs = observations.get(placement.modelId);
    return {
      ...placement,
      intentHint: intentHints[placement.modelId] || null,
      observedProcessor: obs?.observedProcessor ?? null,
      observedSizeGb: obs?.observedSizeGb ?? null,
      keepAliveTransport: PLACEMENT_KEEPALIVE_TRANSPORT,
    };
  };

  // --- Tier 1 resident (chat actif + embeddings) ---
  const tier1Chat = getActiveTier1ChatModel(profile);
  const tier1Embed = MODEL_CONFIG.TIER_1.embeddings;

  upsert({
    modelId: tier1Chat,
    class: PLACEMENT_CLASSES.RESIDENT,
    tier: 1,
    role: "chat",
    vramGb: MODEL_CONFIG.TIER_1.vram_gb,
    priority: 1,
    sticky: true,
    keepAlive: "-1",
    reason: "matrix.tier1.chat",
    source: "matrix",
  });
  upsert({
    modelId: tier1Embed,
    class: PLACEMENT_CLASSES.RESIDENT,
    tier: 1,
    role: "embeddings",
    vramGb: 0.3,
    priority: 1,
    sticky: true,
    keepAlive: "-1",
    reason: "matrix.tier1.embeddings",
    source: "matrix",
  });

  // --- Matrice : tiers 1–3 ---
  if (matrix?.tiers) {
    for (const [tierKey, tierConfig] of Object.entries(matrix.tiers)) {
      const tierNum = tierKey === "tier1" ? 1 : tierKey === "tier2" ? 2 : 3;
      for (const modelInput of tierConfig.models || []) {
        const resolved = resolveMatrixModel(modelInput, profile);
        if (!resolved.id) continue;

        // Tier1 chat déjà couvert via getActiveTier1ChatModel (évite doublon id matrice)
        if (tierNum === 1 && resolved.role === "chat") continue;
        if (tierNum === 1 && resolved.id === tier1Embed) continue;

        let cls = PLACEMENT_CLASSES.LAZY;
        let reason = `matrix.${tierKey}`;
        let sticky = false;

        if (tierNum === 1) {
          cls = PLACEMENT_CLASSES.RESIDENT;
          sticky = true;
          reason = "matrix.tier1";
        } else if (tierNum === 2) {
          if (!isTier2Enabled()) continue;
          // aggressive : désir session de garder le reasoner chaud (prefetch durable)
          // reactive/fast : lazy + état warmup deferred (cockpit)
          if (profile === "aggressive" && !resolved.skip) {
            cls = PLACEMENT_CLASSES.PREFETCH;
            reason = "matrix.tier2.aggressive";
          } else {
            cls = PLACEMENT_CLASSES.LAZY;
            reason = "matrix.tier2.deferred_boot";
          }
        } else {
          cls = PLACEMENT_CLASSES.LAZY;
          reason = "matrix.tier3.lazy";
        }

        upsert({
          modelId: resolved.id,
          class: cls,
          tier: tierNum,
          role: resolved.role,
          vramGb: resolved.vramGb,
          priority: resolved.priority,
          sticky,
          keepAlive: resolveKeepAlive(cls, resolved.priority),
          reason,
          source: "matrix",
        });
      }
    }
  } else {
    // Fallback sans matrice : Tier2/3 depuis models.js
    if (isTier2Enabled() && MODEL_CONFIG.TIER_2.model) {
      upsert({
        modelId: MODEL_CONFIG.TIER_2.model,
        class:
          profile === "aggressive"
            ? PLACEMENT_CLASSES.PREFETCH
            : PLACEMENT_CLASSES.LAZY,
        tier: 2,
        role: "reasoner",
        vramGb: MODEL_CONFIG.TIER_2.vram_gb,
        priority: 2,
        sticky: false,
        keepAlive: "15m",
        reason: "models.js.tier2",
        source: "matrix",
      });
    }
    for (const [role, entry] of Object.entries(MODEL_CONFIG.TIER_3_EXPERTS)) {
      upsert({
        modelId: entry.model,
        class: PLACEMENT_CLASSES.LAZY,
        tier: 3,
        role,
        vramGb: entry.vram_gb,
        priority: 3,
        sticky: false,
        keepAlive: "5m",
        reason: "models.js.tier3",
        source: "matrix",
      });
    }
  }

  // --- Never (hors doctrine quotidienne) ---
  for (const modelId of NEVER_MODELS) {
    upsert({
      modelId,
      class: PLACEMENT_CLASSES.NEVER,
      tier: 3,
      role: null,
      vramGb: 0,
      priority: 3,
      sticky: false,
      keepAlive: "0",
      reason: "doctrine.never_daily",
      source: "matrix",
    });
  }

  // --- Overrides explicites (class durable uniquement) ---
  for (const [modelId, patch] of Object.entries(overrides)) {
    const prev = byId.get(modelId) || {
      modelId,
      tier: 3,
      role: null,
      vramGb: 0,
      priority: 3,
      sticky: false,
    };
    upsert({
      ...prev,
      ...patch,
      modelId,
      source: "override",
      reason: patch.reason || "override",
      keepAlive:
        patch.keepAlive ||
        resolveKeepAlive(
          patch.class || prev.class || PLACEMENT_CLASSES.LAZY,
          patch.priority || prev.priority || 3,
        ),
    });
  }

  // usageStats réservé P2 — ne change pas encore les classes
  void opts.usageStats;

  const models = [...byId.values()].map(attachObservation);

  return {
    version: PLACEMENT_PLAN_VERSION,
    profile,
    budget: {
      maxLoadedModels,
      maxVramGb,
      reserveGb: RESERVE_GB,
      doctrineVramGb: DOCTRINE_VRAM_GB,
    },
    models,
    honesty: {
      silentDowngradeAllowed: false,
      declareSwap: true,
      declareUnavailable: true,
      keepAliveTransport: PLACEMENT_KEEPALIVE_TRANSPORT,
    },
    computedAt: new Date().toISOString(),
    usageWindow: {
      turns: 0,
      since: null,
      note: "P0: usage store non branché",
    },
  };
}

/**
 * @param {ReturnType<typeof buildPlacementPlan>} plan
 * @param {string} className
 */
export function listModelIdsByClass(plan, className) {
  return (plan?.models || [])
    .filter((m) => m.class === className)
    .map((m) => m.modelId)
    .sort();
}

/**
 * Résumé cockpit (P0).
 * @param {ReturnType<typeof buildPlacementPlan>|null} plan
 */
export function summarizePlacementForCockpit(plan = null) {
  if (!plan) return null;
  return {
    version: plan.version,
    profile: plan.profile,
    budget: plan.budget,
    resident: listModelIdsByClass(plan, PLACEMENT_CLASSES.RESIDENT),
    lazy: listModelIdsByClass(plan, PLACEMENT_CLASSES.LAZY),
    prefetch: listModelIdsByClass(plan, PLACEMENT_CLASSES.PREFETCH),
    never: listModelIdsByClass(plan, PLACEMENT_CLASSES.NEVER),
    honesty: plan.honesty,
    computedAt: plan.computedAt,
    modelCount: plan.models?.length || 0,
  };
}

/**
 * buildPlacementPlan async avec chargement matrice si besoin.
 * @param {object} [opts]
 */
export async function buildPlacementPlanFromDisk(opts = {}) {
  const matrix = opts.matrix || (await loadWarmupMatrix(opts.matrixPath));
  return buildPlacementPlan({ ...opts, matrix });
}

export default {
  buildPlacementPlan,
  buildPlacementPlanFromDisk,
  loadWarmupMatrix,
  listModelIdsByClass,
  summarizePlacementForCockpit,
  indexActiveObservations,
  inferObservedProcessor,
  PLACEMENT_CLASSES,
  PLACEMENT_ACTIONS,
  PLACEMENT_KEEPALIVE_TRANSPORT,
};
