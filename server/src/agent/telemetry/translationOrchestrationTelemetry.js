/**
 * Telemetry — translation_request orchestration.
 */
import {
  bucketTranslationTextLength,
  extractTargetLanguage,
  extractTargetLanguages,
  extractTranslationPayload,
  extractTranslationSourceFromHistory,
  extractTranslationStyle,
  hasTranslationText,
  isMultiTargetTranslationRequest,
  isTranslationDerivedRequest,
  isTranslationPipelineReady,
  isTranslationRequest,
  isTranslationShell,
  requiresTranslationClarification,
  usesPreviousOutputAsTranslationSource,
} from "../utils/translationIntentGuards.js";
import { buildTranslationRequestPlan } from "../utils/translationRequestPlan.js";

export const TRANSLATION_ORCHESTRATION_EVENT = "translation_orchestration";

/**
 * @param {string} query
 * @param {{ pipelinePath?: string|null, phase?: string, history?: Array<{ role?: string, content?: string }>, plan?: ReturnType<typeof buildTranslationRequestPlan>|null }} [ctx]
 */
export function buildTranslationOrchestrationEvent(query = "", ctx = {}) {
  const history = ctx.history || [];
  const plan = ctx.plan || buildTranslationRequestPlan(query, history);
  const payload =
    plan.text ||
    extractTranslationPayload(query) ||
    (usesPreviousOutputAsTranslationSource(query)
      ? extractTranslationSourceFromHistory(history)
      : null);
  const derived = usesPreviousOutputAsTranslationSource(query);
  const targetLanguages = plan.targetLanguages?.length
    ? plan.targetLanguages
    : extractTargetLanguages(query);

  return {
    event: TRANSLATION_ORCHESTRATION_EVENT,
    timestamp: new Date().toISOString(),
    phase: ctx.phase || "route",
    shell_recognized: isTranslationShell(query) || derived,
    translation_request: isTranslationRequest(query),
    translation_ready: plan.ready ?? isTranslationPipelineReady(query, history),
    translation_derived: derived,
    translation_multi_target: plan.multiTarget ?? isMultiTargetTranslationRequest(query),
    previous_output_as_source: derived && Boolean(payload),
    requires_clarification: requiresTranslationClarification(query, history),
    target_language: extractTargetLanguage(query),
    target_languages: targetLanguages,
    target_language_count: targetLanguages.length,
    execution_mode: plan.executionMode || (targetLanguages.length > 1 ? "batch" : "single"),
    plan_mode: plan.mode || null,
    request_unit_count: plan.requestUnits?.length ?? targetLanguages.length,
    source_language_detected: "auto",
    text_present: plan.textPresent ?? hasTranslationText(query),
    text_length_bucket: payload ? bucketTranslationTextLength(payload) : null,
    style_requested: extractTranslationStyle(query),
    pipeline_path: ctx.pipelinePath ?? null,
    prefer_web_research: false,
    query_preview: String(query || "").slice(0, 120),
  };
}

/**
 * @param {string} query
 * @param {{ pipelinePath?: string|null, phase?: string, history?: Array<{ role?: string, content?: string }>, plan?: object|null }} [ctx]
 */
export function recordTranslationOrchestrationTelemetry(query = "", ctx = {}) {
  if (!isTranslationRequest(query) && !isTranslationDerivedRequest(query)) return null;
  const event = buildTranslationOrchestrationEvent(query, ctx);
  console.log(`[TRANSLATION_ORCH] ${JSON.stringify(event)}`);
  return event;
}
