/**
 * P2 — Contrat livrable FACTUAL_RESEARCH / cluster web+citations+rapport.
 * 0 source ⇒ refus déterministe (pas de faux rapport chiffré).
 */
import { isWebCitationsStructuredReportCluster } from "../routing/explicitWebSearchRequestPolicy.js";
import { extractWebSourcesFromPacket } from "./webEvidenceFidelityValidator.js";

export const FACTUAL_RESEARCH_MIN_SOURCES = 3;
export const FACTUAL_RESEARCH_TARGET_SOURCES = 5;
export const FACTUAL_RESEARCH_WEB_MAX_SOURCES = 10;

const ZERO_SOURCE_FAILURE_MODES = new Set([
  "fallback_no_results",
  "vqd_retry_exhausted",
  "web_search_error",
  "search_error",
  "no_results_after_filtering",
  "web_search_unavailable",
]);

/**
 * @param {string} query
 * @param {object} [packet]
 * @returns {boolean}
 */
export function isFactualResearchSourcedReportPath(query = "", packet = {}) {
  if (packet?.meta?.intent_contract_id === "FACTUAL_RESEARCH") return true;
  if (isWebCitationsStructuredReportCluster(query)) return true;
  return false;
}

/**
 * @param {object} packet
 * @returns {number}
 */
export function countFactualResearchSources(packet = {}) {
  return extractWebSourcesFromPacket(packet).filter((s) =>
    /^https?:\/\//i.test(String(s.url || "")),
  ).length;
}

/**
 * @param {string} query
 * @param {object} packet
 * @returns {boolean}
 */
export function shouldRefuseFactualResearchWithoutSources(query = "", packet = {}) {
  if (!isFactualResearchSourcedReportPath(query, packet)) return false;
  if (countFactualResearchSources(packet) > 0) return false;
  const mode = packet?.meta?.web_failure_mode;
  return Boolean(mode && ZERO_SOURCE_FAILURE_MODES.has(mode));
}

/**
 * @param {string} [query]
 * @param {string|null} [failureMode]
 * @returns {string}
 */
export function buildFactualResearchNoSourcesReply(
  query = "",
  failureMode = null,
) {
  const topic = String(query || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const modeHint = failureMode ? ` (${failureMode})` : "";
  return [
    `Je n'ai pas trouvé de sources web récentes exploitables pour cette recherche${modeHint}.`,
    "",
    topic
      ? `Sujet demandé (extrait) : « ${topic}${String(query || "").length > 120 ? "…" : ""} ».`
      : null,
    "",
    "Je ne vais pas inventer un rapport chiffré ni des données « 2025-2026 » non vérifiées.",
    "",
    "Tu peux :",
    "1. Reformuler la recherche (sujet plus étroit, marché précis, région).",
    "2. Te concentrer sur un aspect (taille de marché, concurrents, levées Series A, tendances).",
    "",
    "Dis-moi laquelle tu préfères et je relance une recherche ciblée.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Soft récence : true si title/snippet/url porte 2025 ou 2026.
 * @param {{ url?: string, excerpt?: string, title?: string }} source
 * @returns {boolean}
 */
export function sourceLooksRecent2025Plus(source = {}) {
  const blob = `${source.url || ""} ${source.excerpt || ""} ${source.title || ""}`;
  return /\b202[5-9]\b/.test(blob);
}

/**
 * @param {Array<{ url?: string, excerpt?: string, title?: string }>} sources
 * @returns {{ recentCount: number, total: number, ratio: number }}
 */
export function scoreFactualResearchRecency(sources = []) {
  const list = Array.isArray(sources) ? sources : [];
  const recentCount = list.filter(sourceLooksRecent2025Plus).length;
  const total = list.length;
  return {
    recentCount,
    total,
    ratio: total > 0 ? recentCount / total : 0,
  };
}
