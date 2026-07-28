import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import ollama from '../llm/ollama.js';
import { recordBootstrapEvent } from './bootstrapDiagnostics.js';
import {
  getBootProfile,
  getActiveTier1ChatModel,
  shouldWarmTier2AtBoot,
  isTier2Enabled,
  getReasonerModel,
  MODEL_CONFIG,
  listTier3ExpertModels,
} from '../config/models.js';
import { buildPlacementPlan } from '../llm/placement/placementPlan.js';
import vramManager from '../agent/utils/vramManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MATRIX_PATH = path.resolve(__dirname, '../../config/warmup.matrix.json');

const TIER2_MODEL = MODEL_CONFIG.TIER_2.model;

/**
 * warmupStatus - État global du préchauffage (v3.7 réactif)
 */
export const warmupStatus = {
  phase: 'idle',
  models: {},
  latency: {
    total: 0,
    tiers: {},
  },
  isReady: false,
  tier2_deferred: false,
  /** Snapshot PlacementPlan P0 (lecture seule). */
  placementPlan: null,
};

let matrixConfig = null;
let tier2WarmupPromise = null;
let tier2TrafficScheduled = false;

function normalizeModelConfig(modelInput, profile = 'reactive') {
  const baseModel = typeof modelInput === 'string'
    ? { id: modelInput, mode: 'single' }
    : { ...modelInput };

  const profileOverrides = baseModel.profiles?.[profile] || {};
  const merged = {
    ...baseModel,
    ...profileOverrides,
  };

  if (merged.skip === true) {
    merged._skip = true;
  }

  return merged;
}

async function primeModel(modelInput, settings, profile = 'reactive') {
  const modelObj = normalizeModelConfig(modelInput, profile);
  const { id: modelId, mode = 'single' } = modelObj;
  const { ping, sense } = settings.priming;

  const options = {
    num_ctx: ping.num_ctx || 2048,
    keep_alive: ping.keep_alive || '30m',
  };

  if (!modelId.includes('embed')) {
    await ollama.ensureModel(modelId);
  }

  if (modelId.includes('embed')) {
    await ollama.getEmbedding(ping.prompt, modelId);
    return;
  }

  const initialPrompt = mode === 'single' ? sense.prompt : ping.prompt;
  const initialPredict = mode === 'single' ? sense.num_predict : ping.num_predict;

  await ollama.chat([{ role: 'user', content: initialPrompt }], modelId, {
    num_predict: initialPredict,
    ...options,
  });

  if (mode === 'double') {
    await ollama.chat([{ role: 'user', content: sense.prompt }], modelId, {
      num_predict: sense.num_predict,
      ...options,
    });
  }
}

async function runTier(tierId, tierConfig, settings, profile = 'reactive') {
  const start = Date.now();
  const results = [];

  for (const modelInput of tierConfig.models) {
    const modelObj = normalizeModelConfig(modelInput, profile);
    if (modelObj._skip) {
      results.push({ model: modelObj.id, status: 'skipped', profile });
      continue;
    }
    const modelId = modelObj.id;
    warmupStatus.models[modelId] = 'warming';

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), tierConfig.timeout),
    );

    try {
      await Promise.race([primeModel(modelObj, settings, profile), timeoutPromise]);
      warmupStatus.models[modelId] = 'ready';
      results.push({ model: modelId, status: 'ready' });
    } catch (err) {
      const status = err.message === 'TIMEOUT' ? 'timeout' : 'failed';
      warmupStatus.models[modelId] = status;
      const isHardFailure = !(modelObj.best_effort && status === 'timeout');
      if (modelObj.best_effort && status === 'timeout') {
        console.log(
          `[Warmup][${tierId.toUpperCase()}] ℹ️ Warmup best-effort incomplete for ${modelId}; model may still become available on first request.`,
        );
      } else {
        console.warn(`[Warmup][${tierId.toUpperCase()}] ⚠️ ${modelId} ${status}:`, err.message);
      }
      if (isHardFailure) {
        recordBootstrapEvent('warmup.model.failed', {
          status: 'error',
          phase: warmupStatus.phase,
          model: modelId,
          message: `${tierId}: ${modelId} ${status} — ${err.message}`,
        });
      }
      results.push({ model: modelId, status, best_effort: Boolean(modelObj.best_effort) });
    }
  }

  warmupStatus.latency.tiers[tierId] = Date.now() - start;
  return results;
}

function markTier3Lazy(config) {
  if (!config?.tiers?.tier3) return;
  for (const modelInput of config.tiers.tier3.models) {
    const modelId = typeof modelInput === 'string' ? modelInput : modelInput.id;
    if (modelId) warmupStatus.models[modelId] = 'lazy';
  }
}

function markTier2Deferred(config) {
  if (!isTier2Enabled()) {
    warmupStatus.tier2_deferred = false;
    return;
  }
  const tier2Models = config?.tiers?.tier2?.models || [];
  if (!tier2Models.length) {
    warmupStatus.tier2_deferred = false;
    return;
  }
  if (TIER2_MODEL) {
    warmupStatus.models[TIER2_MODEL] = 'deferred';
  }
  warmupStatus.tier2_deferred = true;
}

async function loadMatrixConfig() {
  if (matrixConfig) return matrixConfig;
  matrixConfig = await fs.readJson(MATRIX_PATH);
  return matrixConfig;
}

/**
 * Priming Tier 2 — différé (premier trafic ou intent raisonnement).
 * @param {string} [reason]
 */
export async function ensureTier2Warmup(reason = 'on_demand') {
  if (!isTier2Enabled()) {
    return { ok: true, status: 'disabled', reason };
  }

  const config = await loadMatrixConfig();
  const tier2Models = config?.tiers?.tier2?.models || [];
  if (!tier2Models.length) {
    return { ok: true, status: 'disabled', reason };
  }

  if (TIER2_MODEL && warmupStatus.models[TIER2_MODEL] === 'ready') {
    return { ok: true, status: 'ready', reason };
  }
  if (TIER2_MODEL && warmupStatus.models[TIER2_MODEL] === 'warming' && tier2WarmupPromise) {
    return tier2WarmupPromise;
  }

  const profile = getBootProfile();

  tier2WarmupPromise = (async () => {
    warmupStatus.phase = 'tier2_warming';
    warmupStatus.models[TIER2_MODEL] = 'warming';
    console.log(`[Warmup][TIER-2] 🧠 Priming différé (${TIER2_MODEL}) — reason=${reason}`);
    recordBootstrapEvent('warmup.tier2.deferred.start', {
      status: 'ok',
      phase: 'tier2_warming',
      message: reason,
    });

    const results = await runTier('tier2', config.tiers.tier2, config.settings, profile);
    const ready = results.some((entry) => entry.model === TIER2_MODEL && entry.status === 'ready');

    if (ready) {
      warmupStatus.tier2_deferred = false;
      warmupStatus.phase = 'ready';
      recordBootstrapEvent('warmup.tier2.deferred.complete', {
        status: 'ok',
        phase: 'ready',
        message: reason,
      });
      console.log(`[Warmup][TIER-2] ✅ ${TIER2_MODEL} prêt (${warmupStatus.latency.tiers.tier2 || '?'}ms).`);
      return { ok: true, status: 'ready', reason };
    }

    warmupStatus.phase = 'ready';
    return { ok: false, status: warmupStatus.models[TIER2_MODEL], reason };
  })().finally(() => {
    tier2WarmupPromise = null;
  });

  return tier2WarmupPromise;
}

/**
 * Lance le warm-up Tier 2 en arrière-plan au premier trafic (non bloquant).
 * @param {string} [reason]
 */
export function scheduleTier2Warmup(reason = 'first_traffic') {
  if (!isTier2Enabled()) return;
  if (shouldWarmTier2AtBoot()) return;
  if (TIER2_MODEL && warmupStatus.models[TIER2_MODEL] === 'ready') return;
  if (tier2TrafficScheduled) return;
  tier2TrafficScheduled = true;

  ensureTier2Warmup(reason).catch((error) => {
    console.warn(`[Warmup][TIER-2] Échec warm-up différé (${reason}):`, error.message);
  });
}

/**
 * warmupModels — Tier 1 au boot, ready ~5s, Tier 2 différé, Tier 3 lazy.
 */
export async function warmupModels() {
  const startTime = Date.now();
  const profile = getBootProfile();

  let config;
  try {
    config = await loadMatrixConfig();
  } catch (err) {
    console.error(`[Warmup] ❌ Impossible de charger warmup.matrix.json. Mode dégradé. ${err.message}`);
    warmupStatus.phase = 'partial_ready';
    recordBootstrapEvent('warmup.config.error', {
      status: 'error',
      phase: 'partial_ready',
      message: err.message,
    });
    return;
  }

  recordBootstrapEvent('warmup.start', {
    status: 'ok',
    phase: 'tier1_loading',
    message: `Profile ${profile}`,
  });
  console.log(
    `[Warmup] ⚡ Neural Matrix — profil ${profile.toUpperCase()} (Tier1 boot, Tier2 off, Tier3 lazy)`,
  );

  for (const tier of Object.values(config.tiers)) {
    for (const modelInput of tier.models) {
      const modelId = typeof modelInput === 'string' ? modelInput : modelInput.id;
      if (modelId && !warmupStatus.models[modelId]) {
        warmupStatus.models[modelId] = 'idle';
      }
    }
  }

  warmupStatus.phase = 'tier1_loading';
  console.log(`[Warmup][TIER-1] 🔥 Priming ${getActiveTier1ChatModel(profile)} + embeddings...`);
  const tier1Results = await runTier('tier1', config.tiers.tier1, config.settings, profile);
  const tier1HardFailure = tier1Results.some(
    (result) => result.status !== 'ready' && !result.best_effort,
  );

  markTier2Deferred(config);
  markTier3Lazy(config);

  // P0 PlacementPlan — snapshot inspectable, aucun changement d'éviction.
  // Observations via REST /api/ps (vramManager), pas le SDK OpenAI.
  try {
    const activePsModels = await vramManager.getActiveModels();
    warmupStatus.placementPlan = buildPlacementPlan({
      profile,
      matrix: config,
      activePsModels: Array.isArray(activePsModels) ? activePsModels : [],
    });
    recordBootstrapEvent('placement.plan.built', {
      status: 'ok',
      phase: warmupStatus.phase,
      message: `profile=${profile} models=${warmupStatus.placementPlan.models.length}`,
    });
  } catch (planErr) {
    console.warn(`[Warmup] PlacementPlan P0 indisponible: ${planErr.message}`);
    warmupStatus.placementPlan = null;
  }

  if (tier1HardFailure) {
    warmupStatus.phase = 'partial_ready';
    recordBootstrapEvent('warmup.tier1.degraded', {
      status: 'error',
      phase: 'partial_ready',
      message: 'Échec critique tier-1',
    });
  } else {
    recordBootstrapEvent('warmup.tier1.complete', {
      status: 'ok',
      phase: 'tier1_loading',
    });
  }

  warmupStatus.isReady = true;
  warmupStatus.phase = 'ready';
  warmupStatus.latency.total = Date.now() - startTime;

  recordBootstrapEvent('warmup.ready', {
    status: 'ok',
    phase: 'ready',
    message: `Essentiel Tier-1 terminé en ${warmupStatus.latency.total}ms — Tier2 désactivé`,
  });

  const reasoner = getReasonerModel(profile);
  console.log(
    `[Warmup] ✅ Ready for traffic (${warmupStatus.latency.total}ms) — Tier 2 désactivé — reasoner = Tier 1 (${reasoner}).`,
  );
  console.log(
    `[Warmup][TIER-3] ❄️ Experts lazy: ${listTier3ExpertModels().join(', ')}`,
  );

  if (shouldWarmTier2AtBoot() && config.tiers.tier2?.models?.length) {
    console.log('[Warmup][TIER-2] 🔥 Profil aggressive — priming Tier 2 en arrière-plan...');
    scheduleTier2Warmup('aggressive_boot');
  }
}

export default warmupModels;
