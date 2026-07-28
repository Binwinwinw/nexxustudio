/**
 * Bridge fail-open — TelemetryObservability ↔ pipeline agent.
 */
import TelemetryObservability from '../../ops/telemetry-observability.js';
import conversationHealth from './conversationHealth.js';
import { getLastPipelineMode } from './pipelineTelemetry.js';

let instance = null;
let initPromise = null;
let lastPersistAt = 0;

export function resetTelemetryObservabilityBridgeForTests() {
  instance = null;
  initPromise = null;
  lastPersistAt = 0;
}

export function bindTelemetryObservabilityForTests(telemetry) {
  instance = telemetry;
  initPromise = Promise.resolve(telemetry);
}

const PERSIST_INTERVAL_MS = 5 * 60 * 1000;
const PERSIST_METRIC_THRESHOLD = 10;

export async function getTelemetryObservability() {
  if (instance) return instance;
  if (!initPromise) {
    initPromise = new TelemetryObservability()
      .initialize()
      .then((telemetry) => {
        instance = telemetry;
        return telemetry;
      })
      .catch((error) => {
        initPromise = null;
        console.warn('[TelemetryBridge] init failed:', error.message);
        return null;
      });
  }
  return initPromise;
}

export function createPipelineTelemetryContext(query = '') {
  return {
    query,
    startedAt: Date.now(),
    intent: null,
    skillId: null,
    mode: null,
    success: false,
    error: null,
    flushed: false,
  };
}

export function markPipelineTurn(ctx, mode, success, errorMessage = null) {
  if (!ctx) return;
  ctx.mode = mode;
  ctx.success = success;
  if (errorMessage) {
    ctx.error = { name: 'PipelineError', message: errorMessage };
  }
}

export async function capturePipelineIntentTelemetry(ctx, query, intent, options = {}) {
  if (!ctx) return;
  ctx.intent = intent;

  try {
    const skillLoader = (await import('../utils/skillLoader.js')).default;
    const skillId = await skillLoader.identifyRelevantSkill(query, {
      intentContractId: options.intentContractId || null,
    });
    ctx.skillId = skillId || null;

    const telemetry = await getTelemetryObservability();
    if (!telemetry) return;

    telemetry.recordSkillTrigger('skill-intent-routing', query, true, 1.0);
    if (skillId) {
      telemetry.recordSkillTrigger(skillId, query, true, null);
    }
  } catch (error) {
    console.warn('[TelemetryBridge] intent telemetry failed:', error.message);
  }
}

export async function flushPipelineTelemetry(ctx) {
  if (!ctx || ctx.flushed) return;
  ctx.flushed = true;

  try {
    const telemetry = await getTelemetryObservability();
    if (!telemetry) return;

    const mode = ctx.mode || getLastPipelineMode();
    const outcome = ctx.error ? 'error' : ctx.success ? 'success' : 'unknown';

    telemetry.recordAgentDecision(
      'orchestrator',
      { outcome, mode, error: ctx.error?.name || null },
      {
        intent: ctx.intent,
        skillId: ctx.skillId,
        latencyMs: Date.now() - ctx.startedAt,
      },
    );

    if (ctx.error) {
      telemetry.recordError(
        ctx.error.name || 'PipelineError',
        ctx.error.message || 'Unknown pipeline error',
        {
          stage: 'agentPipeline',
          intent: ctx.intent,
          skillId: ctx.skillId,
        },
      );
    }

    if (ctx.success) {
      const health = conversationHealth.snapshot();
      telemetry.recordConversationHealth(health.globalScore / 100, [
        `mode:${mode}`,
        `fallbackRate:${health.today.fallbackRatePct}`,
      ]);
    }
  } catch (error) {
    console.warn('[TelemetryBridge] flush failed:', error.message);
  }
}

export async function recordComposerTelemetry({
  outcome = 'success',
  skillId = null,
  latencyMs = 0,
  responseLength = 0,
  error = null,
  path = 'primary',
} = {}) {
  try {
    const telemetry = await getTelemetryObservability();
    if (!telemetry) return;

    if (outcome === 'error' && error) {
      telemetry.recordError(error.name || 'RenderError', error.message, {
        stage: 'finalRenderer',
        skillId,
        path,
      });
    }

    telemetry.recordAgentDecision(
      'finalRenderer',
      {
        outcome,
        responseLength,
        path,
        error: error?.name || null,
      },
      {
        skillId,
        latencyMs,
      },
    );
  } catch (bridgeError) {
    console.warn('[TelemetryBridge] composer telemetry failed:', bridgeError.message);
  }
}

export async function maybePersistTelemetry(force = false) {
  try {
    const telemetry = await getTelemetryObservability();
    if (!telemetry) return;

    const pending =
      telemetry.sessionMetrics.length + telemetry.agentMetrics.length;
    const elapsed = Date.now() - lastPersistAt;

    if (
      force ||
      pending >= PERSIST_METRIC_THRESHOLD ||
      (pending > 0 && elapsed >= PERSIST_INTERVAL_MS)
    ) {
      await telemetry.persist();
      lastPersistAt = Date.now();
    }
  } catch (error) {
    console.warn('[TelemetryBridge] persist failed:', error.message);
  }
}

export { TelemetryObservability };
