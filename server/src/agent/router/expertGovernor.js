import ollama from '../../llm/ollama.js';
import thermalTelemetry from '../telemetry/thermalTelemetry.js';
import { computeThermalScore, computeFinalScore } from './expertScorer.js';

/**
 * [MODULE: expertGovernor]
 * Rôle: Application des règles de gouvernance et arbitrage final.
 */

export function evaluateCandidate(candidate, thermalStats) {
  const model = candidate.expert.model;
  const state = ollama.getThermalState(model);
  const stats = thermalStats[model] || { avgLoadTime: 15000 };
  const weights = ollama.modelWeights[model] || { priority: 3, base: 4 };
  
  const pressureGb = ollama.calculateVRAMPressure();
  const vramLimit = 20;
  const pressureRatio = pressureGb / vramLimit;
  const mode = ollama.currentGovernanceMode;
  const queueDepth = ollama.queueDepths?.get(model) || 0;

  const thermalScore = computeThermalScore({
    state,
    avgLoadTime: stats.avgLoadTime,
    mode,
    priority: weights.priority,
    pressureRatio
  });

  // Enregistrement des incidents de gouvernance
  if (thermalScore === -1.0) {
    if (mode === 'RESTRICTED') thermalTelemetry.recordRestricted();
  }

  const competence = candidate.score || 0.5;
  const finalScore = computeFinalScore({
    competence,
    thermalScore,
    queueDepth,
    state
  });

  return {
    ...candidate,
    finalScore,
    thermal: state,
    queue: queueDepth,
    avgLoad: stats.avgLoadTime,
    blocked: thermalScore <= -0.5,
    governance: {
      mode,
      pressureRatio,
      priority: weights.priority
    }
  };
}
