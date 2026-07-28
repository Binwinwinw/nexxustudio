/**
 * Bridge MakersChecker ↔ pipeline (orchestrateur + renderer).
 * Fail-open par défaut ; MAKERS_CHECKER_STRICT=true pour fail-closed consensus.
 */
import MakersChecker from '../../verification/makersChecker.js';
import { getTelemetryObservability } from '../telemetry/telemetryObservabilityBridge.js';
import { getComposerObservabilityContext } from '../config/intentContractRegistry.js';
import { RESPONSE_MODES } from '../config/modeResponseContracts.js';

let makersCheckerInstance = null;

export function isMakersCheckerDisabled() {
  return process.env.MAKERS_CHECKER_DISABLED === 'true';
}

export function getMakersChecker() {
  if (!makersCheckerInstance) {
    makersCheckerInstance = new MakersChecker({
      consensusThreshold: 0.85,
      fallbackToPrimary: process.env.MAKERS_CHECKER_STRICT !== 'true',
    });
  }
  return makersCheckerInstance;
}

export function resetMakersCheckerForTests() {
  makersCheckerInstance = null;
}

export function resolvePacketType(packet = {}) {
  const obs = getComposerObservabilityContext(packet);
  if (obs.expectedResponseMode === RESPONSE_MODES.CRITICAL) {
    return 'CRITICAL';
  }
  if (packet.mode === 'EPISTEMIC') {
    return 'EPISTEMIC';
  }
  return packet.mode || 'OPERATIONAL';
}

export function buildOrchestratorPrimaryDecision(packet, rawResponse = '') {
  const text = String(rawResponse || '');
  const sources = (packet.evidence || []).map((entry, index) => ({
    id: entry.source || `evidence-${index + 1}`,
    excerpt: entry.excerpt,
    relevance: entry.relevance,
  }));

  return {
    score: sources.length > 0 ? 0.92 : 0.85,
    containsFactualClaims:
      packet.mode === 'EPISTEMIC' ||
      sources.length > 0 ||
      /\b(est|sont|doit|confirme|selon)\b/i.test(text),
    sources,
    text: text.slice(0, 4000),
    containsExternalUrls: /https?:\/\//i.test(text),
    containsCodeExecution: /\beval\s*\(|exec\s*\(/i.test(text),
    requiresValidation: resolvePacketType(packet) === 'CRITICAL',
  };
}

export function buildRendererPrimaryDecision(packet, renderedText = '') {
  const text = String(renderedText || '');
  const sources = (packet.evidence || []).map((entry, index) => ({
    id: entry.source || `evidence-${index + 1}`,
    excerpt: entry.excerpt,
  }));

  return {
    score: 0.9,
    containsFactualClaims:
      packet.mode === 'EPISTEMIC' ||
      sources.length > 0 ||
      /\b(est|sont|doit|confirme|selon)\b/i.test(text),
    sources,
    citations: sources.map((source) => ({ id: source.id, verifiable: true })),
    text: text.slice(0, 4000),
    containsExternalUrls: /https?:\/\//i.test(text),
    containsCodeExecution: /\beval\s*\(|exec\s*\(/i.test(text),
  };
}

export function shouldValidateOrchestratorPacket(packet, rawResponse = '') {
  if (isMakersCheckerDisabled()) {
    return false;
  }

  const packetType = resolvePacketType(packet);
  if (packetType === 'CRITICAL') {
    return true;
  }
  if (packet.risk_level === 'high') {
    return true;
  }
  if (packet.mode === 'EPISTEMIC' && String(rawResponse || '').length > 80) {
    return true;
  }
  return Boolean(packet.meta?.requiresValidation);
}

export function shouldValidateRendererOutput(packet, composerOptions = {}) {
  if (isMakersCheckerDisabled()) {
    return false;
  }

  const obs = getComposerObservabilityContext(packet);
  if (obs.expectedResponseMode === RESPONSE_MODES.CRITICAL) {
    return true;
  }
  if (composerOptions.useFactual) {
    return true;
  }
  if (packet.mode === 'EPISTEMIC' && (packet.evidence || []).length > 0) {
    return true;
  }

  return false;
}

export async function recordMakersCheckerTelemetry(validation, meta = {}) {
  try {
    const telemetry = await getTelemetryObservability();
    if (!telemetry) {
      return;
    }

    telemetry.recordAgentDecision(
      'makers-checker',
      {
        outcome: validation.outcome,
        consensus: validation.consensus,
        verified: validation.verified,
        latencyMs: validation.latencyMs,
      },
      meta,
    );

    if (validation.outcome === 'blocked') {
      telemetry.recordError(
        'MakersCheckerBlocked',
        validation.error || 'Décision bloquée',
        {
          consensus: validation.consensus,
          ...meta,
        },
      );
    }

    if (validation.outcome === 'fallback-primary' && validation.warning) {
      telemetry.recordError('MakersCheckerLowConsensus', validation.warning, {
        consensus: validation.consensus,
        ...meta,
      });
    }
  } catch (error) {
    console.warn('[MakersCheckerBridge] telemetry failed:', error.message);
  }
}

export async function runOrchestratorMakersCheckerValidation(
  packet,
  rawResponse,
  onStep = null,
) {
  if (!shouldValidateOrchestratorPacket(packet, rawResponse)) {
    return null;
  }

  const makersChecker = getMakersChecker();
  const packetType = resolvePacketType(packet);
  const primaryDecision = buildOrchestratorPrimaryDecision(packet, rawResponse);

  const validation = await makersChecker.validateDecision(primaryDecision, {
    skillAccuracy: packet.meta?.skillAccuracy ?? 0.88,
    sourceReliability: (packet.evidence || []).length > 0 ? 0.92 : 0.85,
  });

  await recordMakersCheckerTelemetry(validation, {
    primaryAgent: 'orchestrator',
    checkerAgent: 'verifier',
    packetType,
  });

  packet.meta = packet.meta || {};
  packet.meta.makers_checker = {
    outcome: validation.outcome,
    consensus: validation.consensus,
    verified: validation.verified,
    latencyMs: validation.latencyMs,
  };

  if (validation.outcome === 'blocked') {
    if (onStep) {
      onStep(`🛑 Makers-Checker : décision bloquée (${validation.error})`);
    }
    const error = new Error(`Makers-Checker bloqué : ${validation.error}`);
    error.code = 'MAKERS_CHECKER_BLOCKED';
    throw error;
  }

  if (validation.outcome === 'fallback-primary' && validation.warning) {
    console.warn(`⚠️ Makers-Checker : ${validation.warning}`);
    if (onStep) {
      onStep('⚠️ Makers-Checker : consensus bas — poursuite avec avertissement.');
    }
  }

  return validation;
}

export async function validateRendererWithMakersChecker(
  packet,
  primaryRender,
  composerOptions = {},
  observability = {},
) {
  if (!primaryRender || !shouldValidateRendererOutput(packet, composerOptions)) {
    return { validation: null, blocked: false, report: null };
  }

  const makersChecker = getMakersChecker();
  const primaryDecision = buildRendererPrimaryDecision(packet, primaryRender);

  const validation = await makersChecker.validateDecision(primaryDecision, {
    skillAccuracy: packet.meta?.skillAccuracy ?? 0.88,
    sourceReliability: (packet.evidence || []).length > 0 ? 0.9 : 0.85,
  });

  await recordMakersCheckerTelemetry(validation, {
    latencyMs: validation.latencyMs,
    skillId: observability.intentContractId || null,
    stage: 'finalRenderer',
  });

  let report = null;
  if (validation.outcome === 'confirmed' || validation.outcome === 'fallback-primary') {
    report = makersChecker.generateReport(validation);
    packet.meta = packet.meta || {};
    packet.meta.makers_checker_render = {
      outcome: validation.outcome,
      consensus: validation.consensus,
      verified: validation.verified,
      report,
    };
  }

  if (validation.outcome === 'fallback-primary' && validation.warning) {
    console.warn(`⚠️ Makers-Checker (renderer) : ${validation.warning}`);
  }

  return {
    validation,
    blocked: validation.outcome === 'blocked',
    report,
  };
}
