/**
 * Garde-fou fidélité — interdit de nier des preuves web présentes dans le paquet.
 */
import responseThinkingCleaner from "../utils/responseThinkingCleaner.js";
import { isExplicitWebSearchRequest } from "./explicitWebSearchRequestPolicy.js";

export const WEB_EVIDENCE_FIDELITY_RULE = "web_evidence_fidelity_v1";

const DENIAL_RE =
  /\b(?:je n['']?ai pas trouv(?:é|e)|pas (?:de )?trace|aucun(?:e)? (?:projet|d[eé]p[oô]t|repo)|open[- ]source notable|rien trouv(?:é|e)|donn[eé]es insuffisantes|plusieurs hypoth[eè]ses)\b/i;

/**
 * @param {object} packet
 * @returns {Array<{ url?: string, excerpt?: string }>}
 */
export function extractWebSourcesFromPacket(packet = {}) {
  const fromEvidence = (packet.evidence || [])
    .filter((item) => item?.source || item?.excerpt)
    .map((item) => ({
      url: item.source,
      excerpt: item.excerpt,
    }));

  if (fromEvidence.length > 0) return fromEvidence;

  const webOutput = (packet.expert_outputs || []).find(
    (output) => output?.stage === "web_research" && output?.content,
  );
  if (webOutput?.content) {
    return [{ excerpt: String(webOutput.content).slice(0, 2000) }];
  }

  return [];
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function detectsWebEvidenceDenial(text = "") {
  return DENIAL_RE.test(String(text || ""));
}

/**
 * @param {object} packet
 * @param {string} [query]
 * @returns {string}
 */
export function buildWebEvidenceGroundedFallback(packet = {}, query = "") {
  const synthesis = (packet.expert_outputs || [])
    .filter((output) => output?.stage === "web_research" && output?.content)
    .map((output) =>
      responseThinkingCleaner.clean(String(output.content || "")).trim(),
    )
    .join("\n\n")
    .trim();

  if (synthesis) {
    return (
      "Voici ce que les sources web consultées indiquent :\n\n" +
      synthesis.slice(0, 3500) +
      "\n\n_Ce résumé s'appuie sur la recherche web de ce tour ; certains détails peuvent rester à vérifier sur la source principale._"
    );
  }

  const sources = extractWebSourcesFromPacket(packet);
  const bullets = sources
    .slice(0, 3)
    .map((source) => {
      const label = source.url || "source web";
      const excerpt = source.excerpt ? ` — ${source.excerpt.slice(0, 180)}` : "";
      return `- ${label}${excerpt}`;
    })
    .join("\n");

  return (
    `J'ai consulté des sources web pour « ${String(query || packet.user_query || "").slice(0, 120)} », mais la synthèse automatique est incomplète.\n\n` +
    `Éléments repérés :\n${bullets || "- (contenu non structuré)"}\n\n` +
    "Je peux approfondir un aspect précis (utilité, installation, architecture) si tu veux."
  );
}

/**
 * @param {string} text
 * @param {object} packet
 * @returns {{
 *   valid: boolean,
 *   issues: string[],
 *   sanitized: string,
 *   sourceCount: number,
 * }}
 */
export function validateWebEvidenceFidelityReply(text = "", packet = {}) {
  const sources = extractWebSourcesFromPacket(packet);
  const sourceCount = sources.length;
  let sanitized = String(text || "").trim();
  const issues = [];

  if (sourceCount === 0) {
    return { valid: true, issues, sanitized, sourceCount };
  }

  if (!detectsWebEvidenceDenial(sanitized)) {
    return { valid: true, issues, sanitized, sourceCount };
  }

  issues.push("denies_web_sources_when_present");
  sanitized = buildWebEvidenceGroundedFallback(
    packet,
    packet.user_query || "",
  );

  return {
    valid: false,
    issues,
    sanitized,
    sourceCount,
  };
}

/**
 * Si la requête demande explicitement le web (« sur la toile trouve… ») et que
 * le paquet a des URLs, force une section **Sources** cliquables.
 * @param {string} text
 * @param {object} packet
 * @param {{ force?: boolean }} [options]
 * @returns {string}
 */
export function ensureExplicitWebSourceLinks(
  text = "",
  packet = {},
  { force = false } = {},
) {
  const query = String(packet?.user_query || packet?.query || "");
  const wantsLinks =
    force ||
    isExplicitWebSearchRequest(query) ||
    /\b(?:sources?|liens?|urls?|cite|citation)\b/i.test(query);

  if (!wantsLinks) return String(text || "").trim();

  const sources = extractWebSourcesFromPacket(packet).filter((s) =>
    /^https?:\/\//i.test(String(s.url || "")),
  );
  if (sources.length === 0) return String(text || "").trim();

  let out = String(text || "").trim();
  const missing = sources.filter(
    (s) => !out.includes(String(s.url)),
  );
  if (missing.length === 0) return out;

  const bullets = missing
    .slice(0, 5)
    .map((s) => {
      const title = String(s.excerpt || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
      return title
        ? `- [${title}](${s.url})`
        : `- ${s.url}`;
    })
    .join("\n");

  if (/\*\*Sources\*\*/i.test(out)) {
    return `${out.trim()}\n${bullets}`;
  }
  return `${out.trim()}\n\n**Sources**\n${bullets}`;
}
