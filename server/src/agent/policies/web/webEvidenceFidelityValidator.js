/**
 * Garde-fou fidélité — interdit de nier des preuves web, et d'exposer
 * un packet interne (buildRawSummary) comme réponse visible.
 */
import { isExplicitWebSearchRequest } from "../routing/explicitWebSearchRequestPolicy.js";

export const WEB_EVIDENCE_FIDELITY_RULE = "web_evidence_fidelity_v1";
export const WEB_EVIDENCE_NO_RAW_DUMP_RULE = "web_evidence_no_raw_dump_v1";

const DENIAL_RE =
  /\b(?:je n['']?ai pas trouv(?:é|e)|pas (?:de )?trace|aucun(?:e)? (?:projet|d[eé]p[oô]t|repo)|open[- ]source notable|rien trouv(?:é|e)|donn[eé]es insuffisantes|plusieurs hypoth[eè]ses)\b/i;

const RAW_WEB_DUMP_RE =
  /R[eé]sultats de recherche pour\s*:|\[Source\s+\d+\][^\n]*\nURL:\s*https?:\/\//i;

const USER_REQUESTED_ENGLISH_RE =
  /\b(?:en anglais|in english|english please|r[eé]ponds en anglais|answer in english)\b/i;

const FR_FUNCTION_RE =
  /\b(?:le|la|les|un|une|des|est|sont|pour|avec|dans|que|qui|ce|cette|sur|aux|du|une|pas|mais|donc|alors|voici|synth[eè]se)\b/gi;

const EN_FUNCTION_RE =
  /\b(?:the|is|are|based|which|provides|although|designed|while|staying|computer|distribution|desktop|environment|default)\b/gi;

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
 * Packet interne buildRawSummary — jamais une réponse utilisateur.
 * @param {string} text
 * @returns {boolean}
 */
export function isRawWebEvidenceDump(text = "") {
  return RAW_WEB_DUMP_RE.test(String(text || ""));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function userRequestedEnglish(query = "") {
  return USER_REQUESTED_ENGLISH_RE.test(String(query || ""));
}

/**
 * Réponse web presque uniquement anglaise alors que le tour est FR.
 * ponytail: heuristique de fonction words, pas un détecteur de langue.
 * @param {string} text
 * @param {string} [query]
 * @returns {boolean}
 */
export function looksUntranslatedEnglishWebReply(text = "", query = "") {
  if (userRequestedEnglish(query)) return false;
  const raw = String(text || "");
  if (isRawWebEvidenceDump(raw)) return true;
  const enHits = (raw.match(EN_FUNCTION_RE) || []).length;
  const frHits = (raw.match(FR_FUNCTION_RE) || []).length;
  return enHits >= 6 && frHits <= 2;
}

/**
 * @param {object} packet
 * @returns {Array<{ url: string, title: string, excerpt: string }>}
 */
export function extractStructuredWebSources(packet = {}) {
  const fromEvidence = (packet.evidence || [])
    .filter((item) => /^https?:\/\//i.test(String(item?.source || "")))
    .map((item) => ({
      url: String(item.source).trim(),
      title: String(item.title || "").trim(),
      excerpt: String(item.excerpt || item.snippet || "")
        .replace(/\s+/g, " ")
        .trim(),
    }));
  if (fromEvidence.length > 0) return fromEvidence;

  const webOutput = (packet.expert_outputs || []).find(
    (output) => output?.stage === "web_research" && output?.content,
  );
  if (!webOutput?.content) return [];

  const rows = [];
  for (const line of String(webOutput.content).split(/\n/)) {
    const match = line.match(/https?:\/\/\S+/i);
    if (!match) continue;
    const url = match[0].replace(/[),.;]+$/, "");
    const title = line
      .replace(match[0], "")
      .replace(/^\[Source\s+\d+\]\s*/i, "")
      .replace(/^URL:\s*/i, "")
      .replace(/^[-*•]\s*/, "")
      .trim()
      .slice(0, 120);
    rows.push({ url, title, excerpt: "" });
  }
  return rows;
}

function hostLabel(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function inferSubjectLabel(query = "", sources = []) {
  const title = String(sources[0]?.title || "")
    .replace(/\s+[—–|-]\s+Wikipedia.*$/i, "")
    .trim();
  if (title.length >= 2 && title.length <= 80) return title;
  const q = String(query || "").replace(/\s+/g, " ").trim();
  const match = q.match(
    /\b(?:sur|concernant|à propos de|a propos de)\s+(?:la |le |les |l')?([^?.!,]{2,60})/i,
  );
  return String(match?.[1] || q || "ce sujet").slice(0, 60);
}

/**
 * Synthèse courte sourcée. Jamais le packet buildRawSummary.
 * @param {object} packet
 * @param {string} [query]
 * @returns {string}
 */
export function buildWebEvidenceGroundedFallback(packet = {}, query = "") {
  const q = String(query || packet.user_query || "").replace(/\s+/g, " ").trim();
  const sources = extractStructuredWebSources(packet);
  const english = userRequestedEnglish(q);
  const label = inferSubjectLabel(q, sources);
  const hosts = [...new Set(sources.map((s) => hostLabel(s.url)).filter(Boolean))]
    .slice(0, 3)
    .join(", ");

  if (sources.length === 0) {
    return english
      ? `I consulted the web for “${q.slice(0, 120)}”, but I could not write a reliable summary. Retry, or say what you want (overview, versions, install).`
      : `J'ai consulté le web pour « ${q.slice(0, 120)} », mais je n'ai pas pu rédiger une synthèse fiable. Réessaie, ou précise ce que tu veux (présentation, versions, installation).`;
  }

  const lead = english
    ? `${label}: ${sources.length} web source(s) consulted (${hosts}). Short sourced summary — not a raw search dump. Details are in the links below.`
    : `${label} : ${sources.length} source(s) web consultée(s) (${hosts}). Synthèse courte sourcée — pas la liste brute des résultats. Détails dans les liens ci-dessous.`;

  const citations = sources
    .slice(0, 5)
    .map((s, i) => `${i + 1}. ${s.title || hostLabel(s.url)} — ${s.url}`)
    .join("\n");

  return `${lead}\n\n**Sources**\n${citations}`;
}

/**
 * Filet livraison : dump SERP / anglais non demandé → synthèse FR sourcée.
 * @param {string} text
 * @param {object} packet
 * @returns {string}
 */
export function resolveVisibleWebDelivery(text = "", packet = {}) {
  const raw = String(text || "").trim();
  const query = packet?.user_query || packet?.query || "";
  const hasWeb =
    (packet?.evidence || []).some((e) => /^https?:\/\//i.test(String(e?.source || ""))) ||
    (packet?.expert_outputs || []).some(
      (o) => o?.stage === "web_research" && String(o?.content || "").trim().length > 20,
    ) ||
    Boolean(packet?.meta?.web_consulted_at);

  if (!hasWeb) return raw;
  if (
    isRawWebEvidenceDump(raw) ||
    looksUntranslatedEnglishWebReply(raw, query)
  ) {
    return buildWebEvidenceGroundedFallback(packet, query);
  }
  return raw;
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

  const query = packet.user_query || packet.query || "";
  if (
    isRawWebEvidenceDump(sanitized) ||
    looksUntranslatedEnglishWebReply(sanitized, query)
  ) {
    issues.push(
      isRawWebEvidenceDump(sanitized)
        ? "raw_web_evidence_dump"
        : "untranslated_english_web_reply",
    );
    sanitized = buildWebEvidenceGroundedFallback(packet, query);
  }

  if (detectsWebEvidenceDenial(sanitized)) {
    issues.push("denies_web_sources_when_present");
    sanitized = buildWebEvidenceGroundedFallback(packet, query);
  }

  if (issues.length === 0) {
    return { valid: true, issues, sanitized, sourceCount };
  }

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
