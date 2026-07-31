/**
 * ExecutionBrief stage — wiring pipeline (fail-open).
 * Après short-circuit, avant composer : Zephyr optionnel → brief validé → injection.
 */
import {
  buildZephyrTriggerSignals,
  shouldInvokeZephyrPreprocessor,
  bridgeSemanticOutputToExecutionBrief,
  formatExecutionBriefInjection,
  validateExecutionBrief,
} from '../policies/execution/index.js';

const STAGE_ENABLED = () => process.env.EXECUTION_BRIEF_ENABLED !== '0';
const ZEPHYR_ENABLED = () => process.env.EXECUTION_BRIEF_ZEPHYR !== '0';

/**
 * @typedef {Object} ExecutionBriefStageResult
 * @property {object|null} brief
 * @property {string} injection
 * @property {object} telemetry
 */

/**
 * @param {object} [input]
 * @param {string} [input.query]
 * @param {Array} [input.history]
 * @param {object|null} [input.shortCircuit]
 * @returns {Promise<ExecutionBriefStageResult|null>}
 */
export async function resolveExecutionBriefStage(input = {}) {
  if (!STAGE_ENABLED()) return null;

  const query = String(input.query || '').trim();
  if (!query) return null;

  const shortCircuit = input.shortCircuit || null;
  const shortCircuitTerminal =
    Boolean(shortCircuit?.reply) &&
    !shortCircuit?.deferToLlm &&
    !shortCircuit?.deferToFullPipeline;

  const signals = buildZephyrTriggerSignals(query, {
    short_circuit_matched: shortCircuitTerminal,
    deterministic_family_resolved: Boolean(input.deterministic_family_resolved),
    ambiguity_level: input.ambiguity_level || 'low',
  });

  if (!shouldInvokeZephyrPreprocessor(signals)) {
    return null;
  }

  const telemetry = {
    stage: 'execution_brief',
    invoked: true,
    zephyr_attempted: false,
    zephyr_ok: false,
    trigger_id: null,
    template_id: null,
    recommended_actor: null,
    rigor_level: null,
    latency_ms: 0,
    fail_open: false,
    error: null,
  };

  const started = performance.now();
  let semanticOutput = null;

  if (ZEPHYR_ENABLED()) {
    telemetry.zephyr_attempted = true;
    try {
      const { runSemanticPreProcessing } = await import('../stages/semanticPreProcessor.js');
      semanticOutput = await runSemanticPreProcessing(query, input.history || []);
      telemetry.zephyr_ok = Boolean(semanticOutput);
    } catch (err) {
      telemetry.fail_open = true;
      telemetry.error = err.message;
      console.warn(`[ExecutionBrief] Zephyr fail-open: ${err.message}`);
    }
  }

  const brief = bridgeSemanticOutputToExecutionBrief(semanticOutput, signals, query);
  const validated = validateExecutionBrief(brief) || brief;

  telemetry.trigger_id = validated.context?.trigger_id || null;
  telemetry.template_id = validated.template_id || null;
  telemetry.recommended_actor = validated.recommended_actor || null;
  telemetry.rigor_level = validated.rigor_level || null;
  telemetry.latency_ms = Math.round(performance.now() - started);

  const injection = formatExecutionBriefInjection(validated);

  return {
    brief: validated,
    injection,
    telemetry,
  };
}

/**
 * @param {object} packet
 * @param {ExecutionBriefStageResult|null} stageResult
 */
export function attachExecutionBriefToPacket(packet, stageResult) {
  if (!packet || !stageResult?.brief) return packet;
  packet.meta = packet.meta || {};
  packet.meta.execution_brief = stageResult.brief;
  packet.meta.execution_brief_injection = stageResult.injection;
  packet.meta.execution_brief_telemetry = stageResult.telemetry;
  return packet;
}

/**
 * @param {object} turnTelemetry
 * @param {ExecutionBriefStageResult|null} stageResult
 */
export function recordExecutionBriefTelemetry(turnTelemetry, stageResult) {
  if (!turnTelemetry || !stageResult?.telemetry) return;
  const t = stageResult.telemetry;
  turnTelemetry.setMetric?.('execution_brief_invoked', t.invoked);
  turnTelemetry.setMetric?.('execution_brief_trigger_id', t.trigger_id);
  turnTelemetry.setMetric?.('execution_brief_template_id', t.template_id);
  turnTelemetry.setMetric?.('execution_brief_recommended_actor', t.recommended_actor);
  turnTelemetry.setMetric?.('execution_brief_rigor_level', t.rigor_level);
  turnTelemetry.setMetric?.('execution_brief_zephyr_ok', t.zephyr_ok);
  turnTelemetry.setMetric?.('execution_brief_fail_open', t.fail_open);
  turnTelemetry.setMetric?.('execution_brief_latency_ms', t.latency_ms);
}
