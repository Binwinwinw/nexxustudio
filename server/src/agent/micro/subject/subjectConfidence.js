/** Niveaux de confiance pour la résolution de sujet (discrète → routage gate / ton). */
export const SUBJECT_CONFIDENCE = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

const SOURCE_CONFIDENCE = {
  internal_registry_exact: SUBJECT_CONFIDENCE.HIGH,
  session_project_match: SUBJECT_CONFIDENCE.HIGH,
  public_registry_exact: SUBJECT_CONFIDENCE.HIGH,
  public_registry_fuzzy: SUBJECT_CONFIDENCE.MEDIUM,
  graph_public_exact: SUBJECT_CONFIDENCE.HIGH,
  graph_public_fuzzy: SUBJECT_CONFIDENCE.MEDIUM,
  graph_ambiguous: SUBJECT_CONFIDENCE.MEDIUM,
  graph_internal_exact: SUBJECT_CONFIDENCE.HIGH,
  graph_internal_fuzzy: SUBJECT_CONFIDENCE.MEDIUM,
  graph_session_project: SUBJECT_CONFIDENCE.HIGH,
  lexicon: SUBJECT_CONFIDENCE.MEDIUM,
  ambiguous_registry: SUBJECT_CONFIDENCE.MEDIUM,
  inferred_shape: SUBJECT_CONFIDENCE.LOW,
  proper_name_unresolved: SUBJECT_CONFIDENCE.LOW,
  query_markers_internal: SUBJECT_CONFIDENCE.MEDIUM,
  generic: SUBJECT_CONFIDENCE.LOW,
};

/**
 * @param {string} source
 * @param {{ ambiguous?: boolean }} [hints]
 * @returns {"high"|"medium"|"low"}
 */
export function confidenceFromSource(source, hints = {}) {
  if (hints.ambiguous) return SUBJECT_CONFIDENCE.MEDIUM;
  return SOURCE_CONFIDENCE[source] || SUBJECT_CONFIDENCE.LOW;
}

/**
 * @param {"high"|"medium"|"low"} confidence
 * @returns {boolean}
 */
export function shouldAffirmResolution(confidence) {
  return confidence === SUBJECT_CONFIDENCE.HIGH;
}

/** @deprecated Utiliser subjectAmbiguityContract + subjectIntentRouter */
export function shouldBlockGenericProcedure(resolution = {}) {
  const { nature, ambiguous, confidence } = resolution;
  if (nature === "internal_studio_operation") return false;
  if (nature === "unresolved_proper_name") return true;
  if (ambiguous) return true;
  return nature === "public_known_entity" && confidence !== SUBJECT_CONFIDENCE.LOW;
}
