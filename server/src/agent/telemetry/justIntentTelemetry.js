/**
 * Télémétrie JUST_INTENT_DETECTION_V1.
 */
import { evaluateJustIntent } from "../policies/intent/justIntentDetectionPolicy.js";
import {
  evaluateClarificationDecision,
  isAvoidableClarification,
  normalizeQueryForClarificationGate,
} from "../policies/routing/clarificationDecisionPolicy.js";
import { JUST_INTENT_THRESHOLDS } from "../policies/intent/justIntentThresholds.js";
import { recordIntentTriageClarification } from "../classifiers/intentTriageFeedbackRecorder.js";

export const JUST_INTENT_TELEMETRY_EVENT = "just_intent_detection";
export const CLARIFICATION_GATE_TELEMETRY_EVENT = "clarification_gate";

/**
 * @param {string} query
 * @param {{ clarificationUsed?: boolean }} [outcome]
 */
export function buildJustIntentTelemetryEvent(query = "", outcome = {}) {
  const evaluation = evaluateJustIntent(query);
  const clarificationDecision = evaluateClarificationDecision(query, evaluation);
  const normalized = normalizeQueryForClarificationGate(query) || "";

  return {
    event: JUST_INTENT_TELEMETRY_EVENT,
    contract: evaluation.contract,
    timestamp: new Date().toISOString(),
    domain: evaluation.domain,
    action: evaluation.action,
    deliverable: evaluation.deliverable,
    strategy: evaluation.strategy,
    domain_label: evaluation.domainLabel,
    action_label: evaluation.actionLabel,
    deliverable_label: evaluation.deliverableLabel,
    can_build_directly: evaluation.canBuildDirectly,
    clarification_count: evaluation.clarificationQuestions?.length ?? 0,
    clarification_used: Boolean(outcome.clarificationUsed),
    clarification_source: outcome.clarificationSource || null,
    clarification_triage_suppressed: Boolean(outcome.triageSuppressed),
    clarification_decision: clarificationDecision.decision,
    clarification_decision_reason: clarificationDecision.reason,
    clarification_avoidable: isAvoidableClarification(
      clarificationDecision,
      outcome,
    ),
    confidence: evaluation.confidence,
    verification_level: evaluation.verification?.level ?? "none",
    code_intent_kind: evaluation.codeIntentKind,
    html_profile: evaluation.htmlProfile,
    signals: evaluation.signals,
    query_preview: String(query || "").slice(0, 120),
    query_length: normalized.length,
    thresholds: { ...JUST_INTENT_THRESHOLDS },
  };
}

/**
 * Télémétrie unifiée — émission clarification gate (lot 1).
 * @param {string} query
 * @param {ReturnType<import('../policies/routing/clarificationDecisionPolicy.js').resolveClarificationGate>} gate
 * @param {{
 *   sessionId?: string|null,
 *   justIntent?: object,
 *   intentTriage?: object|null,
 * }} ctx
 */
export function recordClarificationGateEvent(query = "", gate = {}, ctx = {}) {
  const { sessionId = null, intentTriage = null } = ctx;
  const outcome = {
    clarificationUsed: true,
    clarificationSource: gate.source,
    triageSuppressed: gate.triageSuppressed,
  };
  const event = {
    ...buildJustIntentTelemetryEvent(query, outcome),
    event: CLARIFICATION_GATE_TELEMETRY_EVENT,
    clarification_gate_source: gate.source,
    clarification_gate_contract: gate.contract,
    pipeline_path: gate.pipelinePath,
  };

  console.warn(
    `[ClarificationGate] decision=${gate.decision?.decision} source=${gate.source} ` +
      `avoidable=${gate.decision?.avoidableClarification} triage_suppressed=${gate.triageSuppressed}`,
  );
  console.log(`[ClarificationGate] ${JSON.stringify(event)}`);

  if (intentTriage) {
    recordIntentTriageClarification({
      query,
      triage: intentTriage,
      sessionId,
      source: gate.source || "clarification_gate",
    });
  }

  return event;
}

/**
 * @param {string} query
 * @param {Parameters<typeof buildJustIntentTelemetryEvent>[1]} [outcome]
 */
export function recordJustIntentTelemetry(query = "", outcome = {}) {
  const event = buildJustIntentTelemetryEvent(query, outcome);
  console.log(`[JUST_INTENT] ${JSON.stringify(event)}`);
  return event;
}
