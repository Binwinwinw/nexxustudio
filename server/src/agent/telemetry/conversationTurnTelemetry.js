/**
 * G46 — télémétrie classifieur de tour conversationnel.
 */

/**
 * @param {string} query
 * @param {ReturnType<import("../micro/classifiers/conversationTurnClassifier.js").classifyConversationTurnFamily>} classification
 * @param {{ pipelinePath?: string|null, phase?: string }} [ctx]
 */
export function recordConversationTurnTelemetry(query, classification, ctx = {}) {
  if (!classification) return;
  console.log(
    `[G46] turn_family=${classification.family} confidence=${classification.confidence} tier=${classification.tier} ` +
      `signals=${(classification.signals || []).join(",") || "none"} ` +
      `path=${ctx.pipelinePath || "unresolved"} phase=${ctx.phase || "classify"}`,
  );
}
