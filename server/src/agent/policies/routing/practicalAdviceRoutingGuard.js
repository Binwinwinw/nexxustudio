/**
 * Routage par charge décisionnelle — évite multi_segment / SIMPLE_FAST tronqué
 * au profit du pipeline complet (orchestrateur / composer non tronqué).
 */
import { requiresFullPipelineForDecision } from "../../utils/selectiveDecisionIntentGuards.js";
import { isGeneralKnowledgeRequest } from "../../utils/generalKnowledgeIntentGuards.js";

export const PRACTICAL_ADVICE_FULL_PIPELINE_RULE =
  "defer_selective_decision_to_full_pipeline_not_simple_fast";

const FULL_PIPELINE_DEFER_PATHS = new Set([
  "anaphora_reference_carryover",
  "general_knowledge_full_pipeline",
  "general_knowledge_continuity_carryover",
  "recipe_knowledge_full_pipeline",
  "information_seeking_full_pipeline",
  "information_seeking_escalation",
  "attachment_task_full_pipeline",
]);

/**
 * @param {string} query
 * @returns {boolean}
 */
export function requiresGenerousComposerResponse(query = "") {
  return requiresFullPipelineForDecision(query) || isGeneralKnowledgeRequest(query);
}

export function isPracticalAdviceFullPipelineQuery(query = "") {
  return requiresGenerousComposerResponse(query);
}

/** @deprecated alias */
export const isSelectiveDecisionFullPipelineQuery = isPracticalAdviceFullPipelineQuery;

/**
 * @param {string} query
 * @returns {boolean} true = ne pas court-circuiter via multi_segment_composite
 */
export function shouldBypassMultiSegmentShortCircuit(query = "") {
  return requiresGenerousComposerResponse(query);
}

/**
 * @param {{ path?: string, deferToLlm?: boolean, deferToFullPipeline?: boolean }} [shortCircuit]
 * @param {string} [query]
 * @returns {boolean}
 */
export function shouldDeferShortCircuitToFullPipeline(shortCircuit = null, query = "") {
  if (!shortCircuit) return false;
  if (shortCircuit.lexiconExplainLight) return false;
  if (shortCircuit.deferToFullPipeline) return true;
  if (
    shortCircuit.pedagogicalOverview &&
    !shortCircuit.deferToFullPipeline
  ) {
    return false;
  }
  if (shortCircuit.beginnerTopicOverview) {
    return false;
  }
  if (shortCircuit.pedagogySoftOverview) {
    return false;
  }
  if (shortCircuit.careerLearningPath) {
    return false;
  }
  if (shortCircuit.technicalLearningPath) {
    return false;
  }
  if (shortCircuit.technicalOverview) {
    return false;
  }
  if (shortCircuit.debugDiagnostic) {
    return false;
  }
  if (shortCircuit.compareChoose) {
    return true;
  }
  if (shortCircuit.adminProcedure) {
    return true;
  }
  if (
    shortCircuit.deferToLlm &&
    FULL_PIPELINE_DEFER_PATHS.has(shortCircuit.path)
  ) {
    return true;
  }
  if (shortCircuit.deferToLlm && requiresFullPipelineForDecision(query)) {
    return true;
  }
  return false;
}
