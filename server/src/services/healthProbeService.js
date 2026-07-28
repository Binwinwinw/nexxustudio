/**
 * Sondes santé K8s-style — live / startup / ready (M1-S2).
 */
import {
  getActiveTier1ChatModel,
  getBootProfile,
  getReasonerModel,
  MODEL_CONFIG,
} from '../config/models.js';

const STARTUP_COMPLETE_PHASES = new Set(['ready', 'partial_ready']);

/**
 * @param {object} ctx
 * @param {number} ctx.uptimeSeconds
 * @param {string} ctx.bootTraceId
 */
export function evaluateLive({ uptimeSeconds = 0, bootTraceId = null }) {
  return {
    probe: 'live',
    ok: true,
    httpStatus: 200,
    status: 'live',
    uptime_s: Math.round(uptimeSeconds),
    trace_id: bootTraceId,
  };
}

/**
 * Startup terminé = routeur prêt + warmup sorti des phases de chargement initial.
 * @param {object} ctx
 */
export function evaluateStartup({
  routerReady = false,
  warmupPhase = 'idle',
  warmupIsReady = false,
  bootTraceId = null,
}) {
  const warmupStarted =
    warmupPhase !== 'idle' || warmupIsReady || routerReady;
  const warmupComplete =
    STARTUP_COMPLETE_PHASES.has(warmupPhase) || warmupIsReady;

  const ok = routerReady && warmupComplete;
  const reasons = [];
  if (!routerReady) reasons.push('router_not_ready');
  if (!warmupComplete) reasons.push(`warmup_phase_${warmupPhase}`);

  return {
    probe: 'startup',
    ok,
    httpStatus: ok ? 200 : 503,
    status: ok ? 'started' : 'starting',
    router_ready: routerReady,
    warmup_phase: warmupPhase,
    warmup_is_ready: warmupIsReady,
    reasons,
    trace_id: bootTraceId,
  };
}

/**
 * Ready = dépendances critiques pour servir du trafic chat.
 * @param {object} ctx
 */
export function evaluateReady({
  routerReady = false,
  warmupIsReady = false,
  warmupPhase = 'idle',
  warmupModels = {},
  knowledgeHubReady = false,
  bootTraceId = null,
  bootProfile = getBootProfile(),
}) {
  const tier1ChatModel = getActiveTier1ChatModel(bootProfile);
  const tier1EmbedModel = MODEL_CONFIG.TIER_1.embeddings;
  const tier1ChatReady =
    warmupModels[tier1ChatModel] === 'ready' ||
    warmupModels[MODEL_CONFIG.TIER_1.model] === 'ready';
  const tier1EmbedReady =
    warmupModels[tier1EmbedModel] === 'ready' ||
    warmupModels[tier1EmbedModel] === 'lazy';

  const criticalOk =
    routerReady && warmupIsReady && tier1ChatReady && tier1EmbedReady;

  const reasons = [];
  if (!routerReady) reasons.push('router_not_ready');
  if (!warmupIsReady) reasons.push('warmup_not_ready');
  if (!tier1ChatReady) reasons.push(`model_${tier1ChatModel.replace(/[:.]/g, '_')}_not_ready`);
  if (!tier1EmbedReady) reasons.push('model_embed_not_ready');

  return {
    probe: 'ready',
    ok: criticalOk,
    httpStatus: criticalOk ? 200 : 503,
    status: criticalOk ? 'ready' : 'not_ready',
    router_ready: routerReady,
    warmup_phase: warmupPhase,
    warmup_is_ready: warmupIsReady,
    knowledge_hub: knowledgeHubReady ? 'ready' : 'degraded',
    boot_profile: bootProfile,
    models: {
      chat: warmupModels[tier1ChatModel] || warmupModels[MODEL_CONFIG.TIER_1.model] || 'unknown',
      chat_model: tier1ChatModel,
      embed: warmupModels[tier1EmbedModel] || 'unknown',
      reasoner: warmupModels[tier1ChatModel] || warmupModels[getReasonerModel(bootProfile)] || 'lazy',
    },
    reasons,
    trace_id: bootTraceId,
  };
}

/**
 * @param {object} evaluation — sortie evaluate*
 */
export function toHealthPayload(evaluation, extra = {}) {
  return {
    status: evaluation.status,
    probe: evaluation.probe,
    trace_id: evaluation.trace_id,
    ...evaluation,
    ...extra,
    timestamp: new Date().toISOString(),
  };
}

export default {
  evaluateLive,
  evaluateStartup,
  evaluateReady,
  toHealthPayload,
};
