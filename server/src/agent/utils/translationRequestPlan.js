/**
 * Décomposition translation_request — 1 texte source × N langues cibles.
 * Prépare requestUnits homogènes et le mode d'exécution (batch / single).
 */
import {
  LANGUAGE_NAME_FROM_CODE,
  buildTranslationEffectiveQuery,
  extractTargetLanguages,
  extractTranslationPayload,
  extractTranslationSourceFromHistory,
  extractTranslationStyle,
  isTranslationDerivedRequest,
  isTranslationPipelineReady,
  usesPreviousOutputAsTranslationSource,
} from "./translationIntentGuards.js";

export const TRANSLATION_REQUEST_PLAN_RULE = "translation_request_plan_v1";

export const TRANSLATION_EXECUTION_MODES = Object.freeze({
  SINGLE: "single",
  BATCH: "batch",
});

export const TRANSLATION_PLAN_MODES = Object.freeze({
  SINGLE_TARGET: "single_target",
  MULTI_TARGET_BATCH: "multi_target_batch",
});

/**
 * @param {string[]} targetLanguages
 * @returns {string}
 */
export function buildMultiTargetOutputFormatSpec(targetLanguages = []) {
  const lines = targetLanguages.map((code) => {
    const label = LANGUAGE_NAME_FROM_CODE[code] || code;
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
    return `**${capitalized} :** [traduction]`;
  });
  return (
    "FORMAT DE SORTIE OBLIGATOIRE (une section par langue, rien d'autre) :\n" +
    lines.join("\n")
  );
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
export function buildTranslationRequestPlan(query = "", history = []) {
  const derived = isTranslationDerivedRequest(query);
  const targetLanguages = extractTargetLanguages(query);
  const sourceText = String(
    (derived ? extractTranslationSourceFromHistory(history) : null) ||
      extractTranslationPayload(query) ||
      "",
  ).trim();
  const multiTarget = targetLanguages.length > 1;
  const ready = isTranslationPipelineReady(query, history);

  /** @type {Array<{ id: string, kind: 'translate', targetLanguage: string, targetLanguageLabel: string, sourceText: string }>} */
  const requestUnits = targetLanguages.map((code, index) => ({
    id: `translate_${code}_${index}`,
    kind: "translate",
    targetLanguage: code,
    targetLanguageLabel: LANGUAGE_NAME_FROM_CODE[code] || code,
    sourceText,
  }));

  const mode = multiTarget
    ? TRANSLATION_PLAN_MODES.MULTI_TARGET_BATCH
    : TRANSLATION_PLAN_MODES.SINGLE_TARGET;

  const executionMode = multiTarget
    ? TRANSLATION_EXECUTION_MODES.BATCH
    : TRANSLATION_EXECUTION_MODES.SINGLE;

  let effectiveQuery = buildTranslationEffectiveQuery(query, sourceText);
  if (multiTarget && sourceText) {
    effectiveQuery = [
      effectiveQuery,
      buildMultiTargetOutputFormatSpec(targetLanguages),
    ].join("\n\n");
  }

  return {
    rule: TRANSLATION_REQUEST_PLAN_RULE,
    ready,
    multiTarget,
    targetLanguages,
    targetLanguageCount: targetLanguages.length,
    mode,
    executionMode,
    text: sourceText,
    textPresent: Boolean(sourceText),
    style: extractTranslationStyle(query),
    derived,
    previousOutputAsSource: usesPreviousOutputAsTranslationSource(query),
    requestUnits,
    effectiveQuery,
    outputFormatSpec: multiTarget
      ? buildMultiTargetOutputFormatSpec(targetLanguages)
      : null,
  };
}

/**
 * @param {ReturnType<typeof buildTranslationRequestPlan>} plan
 * @returns {string}
 */
export function buildTranslationReflectiveHint(plan) {
  if (!plan?.ready) return "";
  if (plan.multiTarget) {
    return [
      "CONSIGNE TRADUCTION MULTI-CIBLES : 1 texte source, N langues.",
      `Unités : ${plan.requestUnits.map((u) => u.targetLanguageLabel).join(", ")}.`,
      "Livre chaque traduction avec son étiquette — pas de clarification, pas de refus.",
      plan.outputFormatSpec,
    ].join("\n");
  }
  return "CONSIGNE TRADUCTION : livre uniquement la traduction demandée, sans commentaire ni clarification.";
}

/**
 * @param {string} text
 * @param {string[]} targetLanguages
 * @returns {boolean}
 */
export function validateMultiTargetTranslationOutput(
  text = "",
  targetLanguages = [],
) {
  const body = String(text || "").trim();
  if (!body || targetLanguages.length < 2) return true;
  const hits = targetLanguages.filter((code) => {
    const label = LANGUAGE_NAME_FROM_CODE[code] || code;
    return new RegExp(`\\b${label}\\b`, "i").test(body);
  });
  return hits.length >= Math.min(2, targetLanguages.length);
}
