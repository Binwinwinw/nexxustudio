/**
 * Mini-recherche — façade observable, async-ready. Pas de fusion opaque.
 */
import { buildSubjectInterpretedState } from "./subjectInterpretedState.js";
import { SUBJECT_CONFIDENCE } from "./subjectConfidence.js";

/**
 * @param {string} query
 * @param {object} [options]
 * @returns {{
 *   candidates: object[],
 *   confidence: string,
 *   nature: string,
 *   usage: string,
 *   ambiguous: boolean,
 *   needsAsyncWebLookup: boolean,
 *   resolution: object,
 *   sources: { type: string, confidence: string }[],
 * }}
 */
export function resolveMiniResearch(query = "", options = {}) {
  const interpreted = buildSubjectInterpretedState({ query, ...options });
  const { state, research } = interpreted;

  return {
    candidates: research.candidates,
    confidence: state.confidence,
    nature: state.nature,
    usage: state.usage,
    ambiguous: Boolean(state.ambiguous),
    needsAsyncWebLookup: research.needsAsyncWebLookup,
    resolution: state,
    sources: research.sources,
  };
}

/** @deprecated Utiliser resolveMiniResearch — le caller décide de la réponse */
export function runMiniResearchGate(query = "", options = {}) {
  const result = resolveMiniResearch(query, options);
  return {
    hit:
      result.needsAsyncWebLookup ||
      (result.ambiguous && result.confidence !== SUBJECT_CONFIDENCE.HIGH),
    candidates: result.candidates,
    confidence: result.confidence,
    resolution: result.resolution,
    needsAsyncWebLookup: result.needsAsyncWebLookup,
    source: result.sources[0]?.type || "local",
  };
}
