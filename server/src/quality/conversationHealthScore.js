export {
  computeHealthScore,
  evaluateQualityGate,
  QUALITY_GATE_THRESHOLDS,
} from '../agent/telemetry/conversationHealthScore.js';

import { evaluateQualityGate } from '../agent/telemetry/conversationHealthScore.js';

/**
 * Score santé normalisé 0–1 pour rapports quality gate.
 * @param {object} metrics
 */
export function conversationHealthScore(metrics = {}) {
  return evaluateQualityGate(metrics).score / 100;
}
