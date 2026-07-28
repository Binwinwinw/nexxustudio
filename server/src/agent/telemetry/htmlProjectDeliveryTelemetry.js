/**
 * Télémétrie HTML_PROJECT_DELIVERY_V1 — stratégie, profil, qualité, repli.
 */
import {
  evaluateHtmlProjectDelivery,
  isHtmlProjectDeliverable,
  isHtmlProjectQualityViolation,
  HTML_PROJECT_PROFILES,
} from "../policies/htmlProjectDeliveryPolicy.js";
import { HTML_PROJECT_THRESHOLDS } from "../policies/htmlProjectDeliveryThresholds.js";
import { normalizeFamiliarityQuery } from "../utils/familiarityIntentGuards.js";

export const HTML_PROJECT_TELEMETRY_EVENT = "html_project_delivery";

/** @type {import('../policies/htmlProjectDeliveryPolicy.js').HtmlProjectStrategy[]} */
const STRATEGIES = ["build_v1", "build_with_smart_defaults", "clarify_then_build"];

/**
 * Profil court pour logs (workshop | landing | …).
 * @param {string|null} profile
 */
export function shortenHtmlProjectProfile(profile = null) {
  if (!profile) return null;
  const map = {
    [HTML_PROJECT_PROFILES.WORKSHOP]: "workshop",
    [HTML_PROJECT_PROFILES.TEMPLATE]: "template",
    [HTML_PROJECT_PROFILES.LANDING]: "landing",
    [HTML_PROJECT_PROFILES.DASHBOARD]: "dashboard",
    [HTML_PROJECT_PROFILES.INFO_PAGE]: "info_page",
    [HTML_PROJECT_PROFILES.GENERIC]: "generic",
  };
  return map[profile] || profile.replace(/^html_/, "");
}

/**
 * @param {string} query
 * @param {{
 *   qualityViolation?: boolean|null,
 *   fallbackUsed?: boolean,
 *   retryUsed?: boolean,
 *   composerPath?: string|null,
 *   responseChars?: number|null,
 * }} [outcome]
 */
export function buildHtmlProjectTelemetryEvent(query = "", outcome = {}) {
  const evaluation = evaluateHtmlProjectDelivery(query);
  const normalized = normalizeFamiliarityQuery(query) || "";

  return {
    event: HTML_PROJECT_TELEMETRY_EVENT,
    contract: "HTML_PROJECT_DELIVERY_V1",
    timestamp: new Date().toISOString(),
    html_project_detected: evaluation.isHtmlProject,
    strategy: evaluation.isHtmlProject ? evaluation.strategy : null,
    profile: evaluation.isHtmlProject ? shortenHtmlProjectProfile(evaluation.profile) : null,
    profile_raw: evaluation.profile,
    can_build_directly: evaluation.canBuildDirectly,
    clarification_count: evaluation.clarificationQuestions?.length ?? 0,
    quality_violation:
      outcome.qualityViolation ?? (evaluation.isHtmlProject ? null : false),
    fallback_used: Boolean(outcome.fallbackUsed),
    retry_used: Boolean(outcome.retryUsed),
    composer_path: outcome.composerPath ?? null,
    response_chars: outcome.responseChars ?? null,
    query_preview: String(query || "").slice(0, 120),
    query_length: normalized.length,
    thresholds: { ...HTML_PROJECT_THRESHOLDS },
  };
}

/**
 * @param {string} query
 * @param {Parameters<typeof buildHtmlProjectTelemetryEvent>[1]} [outcome]
 */
export function recordHtmlProjectDeliveryTelemetry(query = "", outcome = {}) {
  if (!isHtmlProjectDeliverable(query) && !outcome.force) return null;

  const event = buildHtmlProjectTelemetryEvent(query, outcome);
  console.log(`[HTML_PROJECT_DELIVERY] ${JSON.stringify(event)}`);
  return event;
}

/**
 * Évalue qualité + émet télémétrie complète en fin de tour composer.
 * @param {string} query
 * @param {string} responseText
 * @param {{ retryUsed?: boolean, fallbackUsed?: boolean, composerPath?: string }} flags
 */
export function recordHtmlProjectComposerOutcome(
  query = "",
  responseText = "",
  flags = {},
) {
  if (!isHtmlProjectDeliverable(query)) return null;

  const evaluation = evaluateHtmlProjectDelivery(query);
  let qualityViolation = null;

  if (evaluation.strategy !== "clarify_then_build" && responseText) {
    qualityViolation = isHtmlProjectQualityViolation(query, responseText);
  }

  return recordHtmlProjectDeliveryTelemetry(query, {
    qualityViolation,
    fallbackUsed: flags.fallbackUsed,
    retryUsed: flags.retryUsed,
    composerPath: flags.composerPath || "composer",
    responseChars: String(responseText || "").length,
  });
}

export function getHtmlProjectThresholds() {
  return { ...HTML_PROJECT_THRESHOLDS };
}

export function isValidHtmlProjectStrategy(strategy) {
  return STRATEGIES.includes(strategy);
}
