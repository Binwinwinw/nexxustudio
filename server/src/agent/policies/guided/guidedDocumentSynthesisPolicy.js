/**
 * G32.3 — contrat GUIDED_DOCUMENT_SYNTHESIS et télémétrie slots.
 */
import {
  DOCUMENT_SYNTHESIS_REQUIRED_SLOTS,
  getMissingDocumentSynthesisSlots,
  isDocumentSynthesisSegment,
} from "../documentSynthesisCompositePolicy.js";
import { hasDocumentSynthesisShell } from "../documentSynthesisPolicy.js";
import { isMetaCapabilitiesIntent } from "../metaCapabilitiesPolicy.js";
import { stripHttpUrlSpans } from "../../../../../shared/generatorFirstPolicy.js";
import { extractLocalFileReference } from "../../utils/localFileUriIntentGuards.js";
import { extractSummaryUrl } from "../summaryContractRouter.js";

export const GUIDED_DOCUMENT_SYNTHESIS_RULE = "guided_document_synthesis_g32_3";

export const GUIDED_SYNTHESIS_LENGTH_LIMITS = Object.freeze({
  short: 400,
  medium: 800,
});

/**
 * @param {string} query
 * @param {{ meta?: object }} [packet]
 * @returns {boolean}
 */
export function isGuidedDocumentSynthesisRequest(query = "", packet = {}) {
  if (isMetaCapabilitiesIntent(query)) return false;

  // Toute cible web (https ou domaine nu) → WEB_SUMMARY / fetch, pas GUIDED (skipWebSearch).
  if (
    extractSummaryUrl(query) &&
    !extractLocalFileReference(stripHttpUrlSpans(query))
  ) {
    return false;
  }

  const understanding = packet?.meta?.query_understanding;
  if (understanding?.responseStrategy === "guided_synthesis") {
    return understanding?.primaryDomain === "document_synthesis";
  }

  if (!isDocumentSynthesisSegment(query) && !hasDocumentSynthesisShell(query)) {
    return false;
  }

  return getMissingDocumentSynthesisSlots(query, [], []).length === 0;
}

/**
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").understandQuery>} understanding
 * @returns {string|null}
 */
export function resolveGuidedDocumentSynthesisIntentContractId(understanding) {
  if (
    understanding?.primaryDomain === "document_synthesis" &&
    understanding?.responseStrategy === "guided_synthesis"
  ) {
    return "GUIDED_DOCUMENT_SYNTHESIS";
  }
  return null;
}

/**
 * @param {object} contract
 * @param {{ length?: string|null }} [slots]
 * @returns {{ maxTokens: number, temperature: number }}
 */
export function resolveGuidedSynthesisExecutionLimits(contract = {}, slots = {}) {
  const routing = contract?.routing || {};
  const length = slots.length === "short" ? "short" : "medium";
  return {
    maxTokens:
      routing.synthesisMaxTokens?.[length] ??
      GUIDED_SYNTHESIS_LENGTH_LIMITS[length] ??
      GUIDED_SYNTHESIS_LENGTH_LIMITS.medium,
    temperature: routing.synthesisTemperature ?? 0.2,
  };
}

/**
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").understandQuery>} understanding
 * @returns {object|null}
 */
export function buildDocumentSynthesisSlotTelemetry(understanding) {
  const intent = understanding?.intents?.find(
    (item) => item.domain === "document_synthesis" && !item.absorbable,
  );
  if (!intent) return null;

  return {
    policy_match_reason: `${intent.familyId}/${intent.path}`,
    domain_confidence: intent.task?.sourceType ? "high" : "medium",
    required_slots: [...DOCUMENT_SYNTHESIS_REQUIRED_SLOTS],
    missing_slots: intent.task?.missingSlots || [],
    synthesis_length: intent.task?.slots?.length || null,
    synthesis_focus: intent.task?.slots?.focus || null,
    synthesis_source_type: intent.task?.slots?.sourceType || null,
  };
}
