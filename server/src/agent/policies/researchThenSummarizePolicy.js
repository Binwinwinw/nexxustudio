/**
 * Research-then-summarize — « va te renseigner sur X / GitHub puis résume ».
 * Distinct de document_synthesis (texte collé / PJ) et de summary/known_entity.
 */
import { normalizeFamiliarityQuery } from "../utils/familiarityIntentGuards.js";
import { hasTextAttachments } from "../utils/conversationGuards.js";

export const RESEARCH_THEN_SUMMARIZE_RULE = "research_then_summarize_v1";

export const RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY =
  'j\'ai entendu parler d\'un dépôt github dont le nom est "caveman" vas te renseigner là dessus et fait moi un résumé consistant sur son utilité et sa conception';

const RESEARCH_SIGNAL_RE =
  /\b(?:vas?\s+te\s+renseigner|va\s+(?:voir|chercher|checker)|renseigne[- ]?(?:toi|moi|nous)|cherche(?:z|r)?\s+(?:sur|moi)|vas?\s+(?:sur|voir)\s+(?:le\s+)?(?:web|internet|github)|renseigne[- ]?toi\s+(?:là|la)\s+dessus|là[- ]dessus|la[- ]dessus)\b/i;

const SUMMARIZE_SIGNAL_RE =
  /\b(?:r[eé]sum[eé]|r[eé]sumer|synth[eè]se|synth[eé]tiser|fais[- ]?moi\s+un\s+r[eé]sum|fait\s+moi\s+un\s+r[eé]sum|un\s+r[eé]sum[eé]\s+consistant)\b/i;

const EXTERNAL_SOURCE_RE =
  /\b(?:github|d[eé]p[oô]t|repo(?:sitory)?|gitlab|site\s+web|url|https?:\/\/)\b/i;

const GITHUB_NAMED_REPO_RE =
  /\b(?:d[eé]p[oô]t|repo(?:sitory)?|projet)\s+github\b[^?.!]{0,60}?\b(?:nom(?:m[eé])?\s+est|appel[eé]|s['']appelle)\s+["«']?([a-z0-9][a-z0-9_.-]{1,60})["»']?/i;

const GITHUB_QUOTED_NAME_RE =
  /\bgithub\b[^?.!]{0,40}?["«]([a-z0-9][a-z0-9_.-]{1,60})["»]/i;

/**
 * @param {string} query
 * @returns {string}
 */
function normalize(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * Cible externe extractible (repo GitHub nommé, etc.).
 * @param {string} query
 * @returns {string|null}
 */
export function extractResearchThenSummarizeTarget(query = "") {
  const raw = String(query || "");
  const named = raw.match(GITHUB_NAMED_REPO_RE) || raw.match(GITHUB_QUOTED_NAME_RE);
  if (named?.[1]) return named[1].trim();

  const q = normalize(query);
  const laDessus = /\b(?:là|la)[- ]dessus\b/.test(q);
  if (laDessus && /\bcaveman\b/i.test(raw)) return "caveman";

  const loose = raw.match(/["«']([a-z0-9][a-z0-9_.-]{1,60})["»']/i);
  if (loose?.[1] && EXTERNAL_SOURCE_RE.test(q)) return loose[1].trim();

  return null;
}

/**
 * Demande : aller chercher une source externe puis synthétiser (pas un texte fourni).
 * @param {string} query
 * @param {{ attachments?: unknown[] }} [options]
 * @returns {boolean}
 */
export function isResearchThenSummarizeRequest(query = "", options = {}) {
  if (hasTextAttachments(options.attachments || [])) return false;

  const q = normalize(query);
  if (!q) return false;
  if (!SUMMARIZE_SIGNAL_RE.test(q)) return false;
  if (!RESEARCH_SIGNAL_RE.test(q)) return false;
  return (
    EXTERNAL_SOURCE_RE.test(q) || Boolean(extractResearchThenSummarizeTarget(query))
  );
}

/**
 * Query web dérivée pour le retrieval.
 * @param {string} query
 * @returns {string}
 */
export function deriveResearchThenSummarizeWebQuery(query = "") {
  const target = extractResearchThenSummarizeTarget(query);
  if (target && /\bgithub\b/i.test(query)) {
    return `github ${target} repository README utility design`;
  }
  if (target) return `${target} overview purpose design`;
  return String(query || "").slice(0, 160);
}

/**
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").understandQuery>} [understanding]
 * @param {string} [query]
 * @returns {string|null}
 */
export function resolveResearchThenSummarizeIntentContractId(
  understanding = null,
  query = "",
) {
  const q = String(query || "").trim();
  if (!q) return null;
  if (!isResearchThenSummarizeRequest(q)) return null;
  if (
    understanding?.primaryDomain === "info_seeking" ||
    understanding?.responseStrategy === "web_lookup" ||
    !understanding
  ) {
    return "RESEARCH_THEN_SUMMARIZE";
  }
  return "RESEARCH_THEN_SUMMARIZE";
}
