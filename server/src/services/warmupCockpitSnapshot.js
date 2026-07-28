/**
 * Snapshot warm-up pour Cockpit — tempo Tier 1 / Tier 2 visible (doctrine reactive).
 */
import {
  getBootProfile,
  getActiveTier1ChatModel,
  getReasonerModel,
  isTier2Enabled,
  MODEL_CONFIG,
  listTier3ExpertModels,
} from '../config/models.js';
import { getBootstrapDiagnostics } from './bootstrapDiagnostics.js';
import { summarizePlacementForCockpit } from '../llm/placement/placementPlan.js';

const TIER2_LABELS = Object.freeze({
  disabled: 'Tier 2 désactivé — reasoner = Tier 1',
  deferred: 'Raisonnement en attente',
  idle: 'Raisonnement en attente',
  warming: 'Préparation raisonneur',
  ready: 'Raisonneur prêt',
  failed: 'Raisonneur indisponible',
  timeout: 'Raisonneur différé (timeout)',
  lazy: 'Non chargé',
  offline: 'Hors ligne',
});

const HEADLINE_BY_TIER2 = Object.freeze({
  ready: 'Système complet',
  warming: 'Préparation raisonneur',
});

/**
 * @param {object} warmupStatus
 */
export function getSystemHeadline(warmupStatus = {}) {
  const tier2State = resolveTier2State(warmupStatus);
  if (HEADLINE_BY_TIER2[tier2State]) {
    return HEADLINE_BY_TIER2[tier2State];
  }
  if (warmupStatus.isReady) {
    return 'Système prêt';
  }
  if (warmupStatus.phase === 'tier1_loading') {
    return 'Initialisation Tier 1';
  }
  if (warmupStatus.phase === 'partial_ready') {
    return 'Mode dégradé';
  }
  return 'Hors ligne';
}

/**
 * @param {object} warmupStatus
 */
export function resolveTier2State(warmupStatus = {}) {
  if (!isTier2Enabled()) {
    return 'disabled';
  }
  const tier2Model = MODEL_CONFIG.TIER_2.model;
  if (!tier2Model) return 'disabled';
  return warmupStatus.models?.[tier2Model] || 'deferred';
}

/**
 * @param {string} state
 */
export function getTier2DisplayLabel(state = 'disabled') {
  return TIER2_LABELS[state] || state;
}

/**
 * Construit la timeline boot → Tier 1 → Tier 2 depuis le journal bootstrap.
 * @param {object} warmupStatus
 */
export function buildWarmupTimeline(warmupStatus = {}) {
  const bootstrap = getBootstrapDiagnostics();
  const eventMap = new Map(
    bootstrap.events.map((entry) => [entry.event, entry]),
  );

  const tier1Ms = warmupStatus.latency?.tiers?.tier1 ?? null;
  const tier2Ms = warmupStatus.latency?.tiers?.tier2 ?? null;
  const tier2State = resolveTier2State(warmupStatus);

  const steps = [
    {
      id: 'boot',
      label: 'Boot process',
      status: eventMap.has('boot.start') ? 'done' : 'pending',
      timestamp: eventMap.get('boot.start')?.timestamp || null,
    },
    {
      id: 'tier1',
      label: 'Tier 1 — chat + embeddings',
      status: eventMap.has('warmup.tier1.complete') || warmupStatus.isReady ? 'done' : 'active',
      duration_ms: tier1Ms,
      timestamp: eventMap.get('warmup.tier1.complete')?.timestamp || null,
    },
    {
      id: 'system_ready',
      label: 'Système prêt (trafic)',
      status: warmupStatus.isReady ? 'done' : 'pending',
      timestamp: eventMap.get('warmup.ready')?.timestamp || null,
    },
  ];

  if (isTier2Enabled()) {
    steps.push({
      id: 'tier2',
      label: 'Tier 2 — raisonnement',
      status:
        tier2State === 'ready'
          ? 'done'
          : tier2State === 'warming'
            ? 'active'
            : tier2State === 'failed' || tier2State === 'timeout'
              ? 'error'
              : 'pending',
      duration_ms: tier2Ms,
      timestamp:
        eventMap.get('warmup.tier2.deferred.complete')?.timestamp ||
        eventMap.get('warmup.tier2.complete')?.timestamp ||
        null,
      sublabel: getTier2DisplayLabel(tier2State),
    });
  }

  return steps;
}

/**
 * @param {object} warmupStatus — warmupStatus global
 */
export function buildWarmupCockpitSnapshot(warmupStatus = {}) {
  const profile = getBootProfile();
  const tier1ChatModel = getActiveTier1ChatModel(profile);
  const tier1EmbedModel = MODEL_CONFIG.TIER_1.embeddings;
  const tier2State = resolveTier2State(warmupStatus);
  const reasonerModel = getReasonerModel(profile);
  const bootstrap = getBootstrapDiagnostics();

  const tier1ChatState =
    warmupStatus.models?.[tier1ChatModel] ||
    warmupStatus.models?.[MODEL_CONFIG.TIER_1.model] ||
    'offline';
  const tier1EmbedState = warmupStatus.models?.[tier1EmbedModel] || 'offline';

  return {
    boot_profile: profile,
    boot_trace_id: bootstrap.boot_trace_id,
    phase: warmupStatus.phase || 'idle',
    is_ready: Boolean(warmupStatus.isReady),
    headline: getSystemHeadline(warmupStatus),
    tier2_deferred: isTier2Enabled()
      ? (warmupStatus.tier2_deferred ?? tier2State === 'deferred')
      : false,
    latency_ms: {
      total: warmupStatus.latency?.total ?? 0,
      tier1: warmupStatus.latency?.tiers?.tier1 ?? null,
      tier2: warmupStatus.latency?.tiers?.tier2 ?? null,
    },
    tier1: {
      chat_model: tier1ChatModel,
      embed_model: tier1EmbedModel,
      chat_state: tier1ChatState,
      embed_state: tier1EmbedState,
      ready: tier1ChatState === 'ready' && ['ready', 'lazy'].includes(tier1EmbedState),
    },
    tier2: {
      model: isTier2Enabled() ? MODEL_CONFIG.TIER_2.model : reasonerModel,
      state: tier2State,
      label: getTier2DisplayLabel(tier2State),
      policy: isTier2Enabled()
        ? profile === 'aggressive'
          ? 'background_at_boot'
          : 'deferred_on_traffic_or_reasoning'
        : 'disabled_reasoner_on_tier1',
    },
    tier3: {
      policy: 'lazy_max_2_concurrent',
      experts: listTier3ExpertModels().map((model) => ({
        model,
        state: warmupStatus.models?.[model] || 'lazy',
      })),
    },
    placement: summarizePlacementForCockpit(warmupStatus.placementPlan || null),
    timeline: buildWarmupTimeline(warmupStatus),
  };
}

export default {
  buildWarmupCockpitSnapshot,
  buildWarmupTimeline,
  getSystemHeadline,
  getTier2DisplayLabel,
  resolveTier2State,
};
