/**
 * Politique d'enrichissement unifiée — culture générale + fraîcheur temporelle.
 */
import { resolveGeneralKnowledgeEnrichmentPolicy } from "./generalKnowledgeEnrichmentPolicy.js";
import { resolveInformationSeekingEnrichmentPolicy } from "./informationSeekingOrchestrationPolicy.js";
import { assessKnowledgeFreshnessRisk } from "./knowledgeFreshnessPolicy.js";
import {
  isCurrentWebFactRequest,
  parseCurrentWebFactTask,
} from "./currentWebFactPolicy.js";
import { isAdminProcedureRequest } from "../utils/adminProcedureIntentGuards.js";

export const KNOWLEDGE_ENRICHMENT_RULE = "unified_knowledge_and_freshness_enrichment";

/**
 * @param {string} query
 * @param {{ now?: Date|string|number, webSourcesCount?: number }} [options]
 */
export function resolveKnowledgeEnrichmentPolicy(query = "", options = {}) {
  if (isCurrentWebFactRequest(query)) {
    const parsed = parseCurrentWebFactTask(query);
    const domain =
      parsed.factType === "traffic" ? "traffic_current" : "weather_current";
    return {
      preferWebResearch: true,
      domain,
      subject: parsed.subject,
      reason: `${domain}_request_needs_live_data`,
      webQuery: parsed.webQuery,
      freshness: assessKnowledgeFreshnessRisk(query, options),
      general: resolveGeneralKnowledgeEnrichmentPolicy(query),
    };
  }

  if (isAdminProcedureRequest(query)) {
    return {
      preferWebResearch: true,
      domain: "admin_procedure",
      subject: null,
      reason: "official_administrative_procedure",
      freshness: assessKnowledgeFreshnessRisk(query, options),
      general: resolveGeneralKnowledgeEnrichmentPolicy(query),
    };
  }

  const freshness = assessKnowledgeFreshnessRisk(query, options);
  const infoSeek = resolveInformationSeekingEnrichmentPolicy(query, options.orchestrationCtx);
  const general = resolveGeneralKnowledgeEnrichmentPolicy(query);

  const preferWebResearch =
    freshness.preferWebRefresh ||
    infoSeek.preferWebResearch ||
    general.preferWebResearch;

  let reason = general.reason || freshness.reason;
  if (infoSeek.applicable && infoSeek.reason) {
    reason = infoSeek.reason;
  } else if (freshness.preferWebRefresh && general.preferWebResearch) {
    reason = "freshness_and_general_knowledge";
  } else if (freshness.preferWebRefresh) {
    reason = freshness.reason;
  }

  return {
    preferWebResearch,
    domain: infoSeek.applicable ? infoSeek.domain : general.domain,
    subject: infoSeek.subject || general.subject || null,
    reason,
    webQuery: infoSeek.webQuery || null,
    informationSeeking: infoSeek.applicable ? infoSeek.orchestration : null,
    freshness,
    general,
  };
}
