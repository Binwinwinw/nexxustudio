/**
 * P2 — Validation post-compose FACTUAL_RESEARCH (sections + citations).
 */
import {
  FACTUAL_RESEARCH_MIN_SOURCES,
  buildFactualResearchNoSourcesReply,
  countFactualResearchSources,
  isFactualResearchSourcedReportPath,
  scoreFactualResearchRecency,
} from "./factualResearchDeliverablePolicy.js";
import {
  buildWebEvidenceGroundedFallback,
  ensureExplicitWebSourceLinks,
  extractWebSourcesFromPacket,
} from "./webEvidenceFidelityValidator.js";

const SECTION_CHECKS = [
  { id: "resume", re: /#{1,3}\s*r[eé]sum[eé](?:\s+ex[eé]cutif)?/i },
  { id: "marche", re: /#{1,3}\s*analyse\s+de\s+march[eé]/i },
  { id: "concurrence", re: /#{1,3}\s*analyse\s+concurrentielle/i },
  { id: "opportunites", re: /#{1,3}\s*opportunit[eé]s(?:\s+de\s+croissance)?/i },
  { id: "sources", re: /#{1,3}\s*sources\b|\*\*sources\*\*/i },
];

const BRIDGED_DISCLAIMER_RE =
  /\b(?:je n['']?ai pas pu v[eé]rifier|connaissances?\s+de\s+base|comparaison\s+qualitative|qui peuvent avoir [eé]volu[eé])\b/i;

const CITATION_RE =
  /\[\d+\]|https?:\/\/\S+|\[web:\d+\]|\*\*sources\*\*|#{1,3}\s*sources\b/i;

/**
 * @param {string} text
 * @returns {{ present: string[], missing: string[] }}
 */
export function detectFactualResearchSections(text = "") {
  const raw = String(text || "");
  const present = [];
  const missing = [];
  for (const row of SECTION_CHECKS) {
    if (row.re.test(raw)) present.push(row.id);
    else missing.push(row.id);
  }
  return { present, missing };
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function detectsFactualResearchCitations(text = "") {
  return CITATION_RE.test(String(text || ""));
}

/**
 * @param {string} text
 * @param {object} packet
 * @param {{ query?: string }} [options]
 * @returns {{
 *   valid: boolean,
 *   issues: string[],
 *   sanitized: string,
 *   sourceCount: number,
 *   sections: { present: string[], missing: string[] },
 *   recency: { recentCount: number, total: number, ratio: number },
 * }}
 */
export function validateFactualResearchReply(
  text = "",
  packet = {},
  { query = "" } = {},
) {
  const q = query || packet.user_query || "";
  const sourceCount = countFactualResearchSources(packet);
  const sources = extractWebSourcesFromPacket(packet);
  const recency = scoreFactualResearchRecency(sources);
  const sections = detectFactualResearchSections(text);
  let sanitized = String(text || "").trim();
  const issues = [];

  if (!isFactualResearchSourcedReportPath(q, packet)) {
    return {
      valid: true,
      issues,
      sanitized,
      sourceCount,
      sections,
      recency,
    };
  }

  if (sourceCount === 0) {
    issues.push("no_sources");
    sanitized = buildFactualResearchNoSourcesReply(
      q,
      packet?.meta?.web_failure_mode || null,
    );
    return {
      valid: false,
      issues,
      sanitized,
      sourceCount,
      sections,
      recency,
    };
  }

  if (sourceCount < FACTUAL_RESEARCH_MIN_SOURCES) {
    issues.push("below_min_sources");
  }

  if (sections.missing.length > 0) {
    issues.push(`missing_sections:${sections.missing.join(",")}`);
  }

  if (!detectsFactualResearchCitations(sanitized)) {
    issues.push("missing_citations");
  }

  if (BRIDGED_DISCLAIMER_RE.test(sanitized) && sourceCount > 0) {
    issues.push("bridged_disclaimer_with_evidence");
    sanitized = sanitized
      .replace(BRIDGED_DISCLAIMER_RE, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  if (issues.includes("missing_citations") || sections.missing.includes("sources")) {
    sanitized = ensureExplicitWebSourceLinks(sanitized, packet, { force: true });
  }

  if (
    sections.missing.filter((id) => id !== "sources").length >= 3 &&
    sourceCount >= FACTUAL_RESEARCH_MIN_SOURCES
  ) {
    issues.push("structure_collapsed");
    sanitized = buildWebEvidenceGroundedFallback(packet, q);
    sanitized = ensureExplicitWebSourceLinks(sanitized, packet, { force: true });
  }

  const finalSections = detectFactualResearchSections(sanitized);
  const hasCitations = detectsFactualResearchCitations(sanitized);
  const stillBridged =
    BRIDGED_DISCLAIMER_RE.test(sanitized) && sourceCount > 0;
  const valid =
    sourceCount >= FACTUAL_RESEARCH_MIN_SOURCES &&
    hasCitations &&
    finalSections.missing.length <= 1 &&
    !stillBridged;

  return {
    valid,
    issues,
    sanitized,
    sourceCount,
    sections: finalSections,
    recency,
  };
}
