/**
 * Gate RAG — confiance insuffisante → fallback épistémique canonique.
 */
import { INSUFFICIENT_SIGNAL_REFUSAL } from '../agent/config/modeResponseContracts.js';
import { isExploitableProcedureIntent } from '../agent/utils/procedureIntentGuards.js';
import { buildProcedureDeterministicReply } from '../agent/micro/replies/procedureReplyBuilder.js';
import {
  CONFIDENCE_THRESHOLDS,
  generateConfidenceReport,
} from './confidenceThresholds.js';

/**
 * @param {object} retrieval — sortie HybridRetrieval.search()
 * @param {object} [options]
 */
export function applyRagConfidenceGate(retrieval, options = {}) {
  const confidence = retrieval?.confidence;
  const results = retrieval?.results ?? [];
  const query = retrieval?.query ?? options.query ?? '';

  if (!confidence || confidence.level !== 'reject') {
    return {
      type: 'proceed',
      results,
      confidence,
      confidenceReport: generateConfidenceReport(confidence, results, query),
    };
  }

  if (isExploitableProcedureIntent(query)) {
    const procedureReply = buildProcedureDeterministicReply(query);
    return {
      type: 'proceed',
      results: [],
      confidence,
      procedureFallback: true,
      groundedHint: procedureReply,
      confidenceReport: generateConfidenceReport(confidence, results, query),
    };
  }

  return {
    type: 'epistemic_refusal',
    message: options.refusalMessage ?? INSUFFICIENT_SIGNAL_REFUSAL,
    confidence: confidence.score,
    reason: confidence.reason,
    suggestion:
      options.suggestion ??
      'Précise ta demande ou fournis plus de contexte documentaire.',
    confidenceReport: generateConfidenceReport(confidence, results, query),
    threshold:
      options.threshold ?? CONFIDENCE_THRESHOLDS.MINIMUM_CONFIDENCE,
  };
}

export default applyRagConfidenceGate;
