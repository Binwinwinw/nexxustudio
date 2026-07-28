import crypto from "crypto";

export const WEB_CANDIDATE_POLICY_VERSION = "web_candidate_promotion_v1";

export const WEB_DOMAINS = [
  "cuisine_basique",
  "fait_historique",
  "definition_generale",
  "autre",
];

/**
 * Normalise une requête pour index / replays (P0 : heuristique locale).
 * @param {string} raw
 */
export function normalizeWebQuery(raw = "") {
  return String(raw)
    .toLowerCase()
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /^(peux tu|peux-tu|dis moi|explique moi|explique)\s+/,
      "",
    )
    .trim();
}

/**
 * @param {string} queryNormalized
 */
export function inferWebDomain(queryNormalized = "") {
  const q = queryNormalized;
  if (
    /\b(oeuf|oeufs|cuire|cuisine|recette|faire des|comment faire)\b/.test(q)
  ) {
    return "cuisine_basique";
  }
  if (
    /\b(siecle|annee|guerre|roi|reine|histoire|empire|revolution)\b/.test(q)
  ) {
    return "fait_historique";
  }
  if (/\b(qu est ce que|c est quoi|definition|signifie|veut dire)\b/.test(q)) {
    return "definition_generale";
  }
  return "autre";
}

/**
 * @param {string} queryNormalized
 */
export function inferCaseType(queryNormalized = "") {
  if (/\b(comment|faire|preparer|cuire)\b/.test(queryNormalized)) {
    return "how_to";
  }
  if (/\b(quand|date|annee)\b/.test(queryNormalized)) {
    return "when";
  }
  if (/\b(qu est ce|c est quoi|definition)\b/.test(queryNormalized)) {
    return "definition";
  }
  return "general";
}

/**
 * Score de consensus P0 : URLs distinctes + chevauchement lexical des snippets.
 * @param {Array<{ url?: string, snippet?: string }>} sources
 */
export function computeSourceConsensusScore(sources = []) {
  const list = Array.isArray(sources) ? sources.filter((s) => s?.url) : [];
  const urls = new Set(list.map((s) => String(s.url).trim()));
  if (urls.size === 0) return 0;
  if (urls.size === 1) return 0.4;

  const tokens = (text) =>
    String(text || "")
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);

  const snippets = list.map((s) => tokens(s.snippet).join(" "));
  let overlapPairs = 0;
  let pairCount = 0;
  for (let i = 0; i < snippets.length; i++) {
    for (let j = i + 1; j < snippets.length; j++) {
      pairCount++;
      const a = new Set(tokens(list[i].snippet));
      const b = new Set(tokens(list[j].snippet));
      if (!a.size || !b.size) continue;
      let shared = 0;
      for (const t of a) {
        if (b.has(t)) shared++;
      }
      const ratio = shared / Math.min(a.size, b.size);
      if (ratio >= 0.15) overlapPairs++;
    }
  }
  const overlapBonus =
    pairCount > 0 ? (overlapPairs / pairCount) * 0.25 : 0;
  return Math.min(1, 0.55 + overlapBonus);
}

export function buildCandidateId() {
  const iso = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const hash = crypto.randomBytes(3).toString("hex");
  return `ckf_${iso}_${hash}`;
}

export function buildEpisodeId() {
  return `wep_${Date.now()}_${crypto.randomBytes(2).toString("hex")}`;
}

/**
 * Similarité réponse P0 (replays cohérents).
 */
export function answersAreCoherent(a = "", b = "") {
  const na = normalizeWebQuery(a).slice(0, 400);
  const nb = normalizeWebQuery(b).slice(0, 400);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = new Set(na.split(" ").filter((w) => w.length > 3));
  const tb = new Set(nb.split(" ").filter((w) => w.length > 3));
  if (!ta.size || !tb.size) return false;
  let shared = 0;
  for (const w of ta) {
    if (tb.has(w)) shared++;
  }
  return shared / Math.min(ta.size, tb.size) >= 0.35;
}

export function mapWebSources(sources = []) {
  return sources.map((s) => ({
    url: s.url || "",
    title: s.title || "",
    snippet: s.snippet || "",
    trust_tier: "web_filtered",
  }));
}
