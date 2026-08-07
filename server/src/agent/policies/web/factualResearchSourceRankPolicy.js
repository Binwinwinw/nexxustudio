/**
 * P4/P5 — Ranking sources FACTUAL_RESEARCH : boost sectoriel, demote blogs légers.
 */
import { FACTUAL_RESEARCH_MIN_SOURCES } from "./factualResearchDeliverablePolicy.js";

export const FACTUAL_RESEARCH_SECTOR_BOOST = 0.92;
export const FACTUAL_RESEARCH_LIGHT_CAP = 0.35;

/** Boost large (presse / instituts / open-access FR). */
const SECTOR_DOMAIN_RE =
  /(?:^|\.)(?:arcom\.fr|cnc\.fr|tv\.fr|bpifrance\.fr|nielsen\.com|mordorintelligence\.com|statista\.com|statistiques\.developpement-durable\.gouv\.fr|insee\.fr|hadopi\.fr|spire\.science|oecd\.org|imf\.org|worldbank\.org|reuters\.com|bloomberg\.com|ft\.com|lesechos\.fr|latribune\.fr)(?:\/|$)/i;

/** Open-access prioritaire P7. */
const OPEN_ACCESS_DOMAIN_RE =
  /(?:^|\.)(?:arcom\.fr|cnc\.fr|tv\.fr|bpifrance\.fr|insee\.fr|hadopi\.fr|[a-z0-9-]+\.gouv\.fr)(?:\/|$)/i;

/** Sectoriel « dur » (gate retry / aveu métriques P5). */
const HARD_SECTOR_DOMAIN_RE =
  /(?:^|\.)(?:arcom\.fr|cnc\.fr|nielsen\.com|mordorintelligence\.com|statista\.com|tv\.fr|bpifrance\.fr)(?:\/|$)/i;

/** Paywalls / rapports commerciaux (demote P7 — pas de scraping). */
const PAYWALL_DOMAIN_RE =
  /(?:^|\.)(?:mordorintelligence\.com|statista\.com|gartner\.com|forrester\.com|idc\.com|emarketer\.com)(?:\/|$)/i;

const LIGHT_ENTERTAINMENT_RE =
  /(?:quelle[- ]?serie|quelleseriecesoir|govf|go[- ]?vf|allocine|imdb\.com\/title|streamingcommunity|filmstreaming|serie[- ]?streaming|ce[- ]?soir|netflixable|senscritique\.com\/serie)/i;

/** Blogs / niches légères (culture streaming, plateformes promo). */
const LIGHT_BLOG_RE =
  /(?:culture[- ]?series\.fr|fuplayvideo\.fr|fuplay|capitainecomment\.fr|actualites[- ]?culturelles\.fr|justwatch\.com|blog[-.]|medium\.com|substack\.com)/i;

const KEY_FIGURE_EVIDENCE_RE =
  /(?:\d+(?:[.,]\d+)?\s*%|\b(?:milliards?|millions?|mds?|M€|Md€|CAGR|TCAC)\b|\b(?:parts?\s+de\s+march[eé]|market\s+size|taille\s+du\s+march[eé]|croissance\s+annuelle)\b|\b\d+(?:[.,]\d+)?\s*(?:milliards?|millions?|euros?|€|USD|\$)\b)/i;

export const FACTUAL_RESEARCH_METRICS_ADMISSION =
  "Limites : aucune métrique chiffrée disponible dans les sources consultées ; ce rapport repose sur des signaux qualitatifs.";

export const FACTUAL_RESEARCH_SECTOR_SITES_QUERY =
  "streaming SVOD France (site:arcom.fr OR site:cnc.fr OR site:nielsen.com) filetype:pdf";

export const FACTUAL_RESEARCH_OPEN_ACCESS_QUERY =
  "streaming SVOD France (site:arcom.fr OR site:cnc.fr OR site:tv.fr OR site:bpifrance.fr) filetype:pdf open access";

export const FACTUAL_RESEARCH_MARKET_SIZE_EN_QUERY =
  "market size independent film streaming France 2025 2026 report";

export const FACTUAL_RESEARCH_OPEN_ACCESS_BOOST = 0.95;
export const FACTUAL_RESEARCH_PAYWALL_CAP = 0.4;

/**
 * @param {{ url?: string, title?: string, snippet?: string }} source
 * @returns {boolean}
 */
export function isSectorReportSource(source = {}) {
  return SECTOR_DOMAIN_RE.test(String(source.url || ""));
}

/**
 * @param {{ url?: string }} source
 * @returns {boolean}
 */
export function isHardSectorSource(source = {}) {
  return HARD_SECTOR_DOMAIN_RE.test(String(source.url || ""));
}

/**
 * @param {{ url?: string }} source
 * @returns {boolean}
 */
export function isOpenAccessSource(source = {}) {
  return OPEN_ACCESS_DOMAIN_RE.test(String(source.url || ""));
}

/**
 * @param {{ url?: string }} source
 * @returns {boolean}
 */
export function isPaywallReportSource(source = {}) {
  return PAYWALL_DOMAIN_RE.test(String(source.url || ""));
}

/**
 * @param {{ url?: string, title?: string, snippet?: string }} source
 * @returns {boolean}
 */
export function isLightEntertainmentSource(source = {}) {
  const blob = `${source.url || ""} ${source.title || ""} ${source.snippet || ""}`;
  return LIGHT_ENTERTAINMENT_RE.test(blob) || LIGHT_BLOG_RE.test(blob);
}

/**
 * Majorité paywalls parmi les sources retenues (>50%).
 * @param {Array<object>} sources
 * @returns {boolean}
 */
export function sourcesAreMajorityPaywall(sources = []) {
  const list = Array.isArray(sources) ? sources.filter(Boolean) : [];
  if (list.length === 0) return false;
  const n = list.filter((s) => isPaywallReportSource(s)).length;
  return n > list.length / 2;
}

/**
 * @param {Array<{ url?: string }>} sources
 * @returns {boolean}
 */
export function sourcesHaveHardSector(sources = []) {
  return (Array.isArray(sources) ? sources : []).some((s) => isHardSectorSource(s));
}

/**
 * Majorité blogs / divertissement léger parmi les sources retenues.
 * @param {Array<object>} sources
 * @returns {boolean}
 */
export function sourcesAreMajorityLight(sources = []) {
  const list = Array.isArray(sources) ? sources.filter(Boolean) : [];
  if (list.length === 0) return false;
  const lightN = list.filter((s) => isLightEntertainmentSource(s)).length;
  return lightN > list.length / 2;
}

/**
 * @param {Array<{ url?: string, title?: string, snippet?: string }>} sources
 * @returns {boolean}
 */
export function evidenceHasKeyFigures(sources = []) {
  const list = Array.isArray(sources) ? sources : [];
  return list.some((s) =>
    KEY_FIGURE_EVIDENCE_RE.test(`${s.title || ""} ${s.snippet || ""} ${s.excerpt || ""}`),
  );
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function replyHasKeyFigures(text = "") {
  return KEY_FIGURE_EVIDENCE_RE.test(String(text || ""));
}

/**
 * Re-score + sort ; drop soft des demoted si assez de sources solides.
 * @param {Array<object>} sources
 * @param {{ maxResults?: number }} [options]
 * @returns {{ sources: Array<object>, demotedDropped: number, boosted: number, majorityLight: boolean, hardSector: boolean }}
 */
export function rankFactualResearchSources(sources = [], options = {}) {
  const maxResults = options.maxResults || 10;
  const list = Array.isArray(sources) ? sources.filter(Boolean) : [];
  let boosted = 0;

  const rescored = list.map((s) => {
    const next = { ...s };
    let conf = Number(next.confidence);
    if (!Number.isFinite(conf)) conf = 0.6;

    if (isOpenAccessSource(next)) {
      conf = Math.max(conf, FACTUAL_RESEARCH_OPEN_ACCESS_BOOST);
      boosted += 1;
      next.factual_rank = "open_access";
    } else if (isPaywallReportSource(next)) {
      // P7 — demote paywall avant boost « hard sector » (Mordor/Statista)
      conf = Math.min(conf, FACTUAL_RESEARCH_PAYWALL_CAP);
      next.factual_rank = "paywall";
    } else if (isHardSectorSource(next) || isSectorReportSource(next)) {
      conf = Math.max(conf, FACTUAL_RESEARCH_SECTOR_BOOST);
      boosted += 1;
      next.factual_rank = isHardSectorSource(next) ? "hard_sector" : "sector";
    } else if (isLightEntertainmentSource(next)) {
      conf = Math.min(conf, FACTUAL_RESEARCH_LIGHT_CAP);
      next.factual_rank = "light";
    } else {
      next.factual_rank = "standard";
    }

    next.confidence = Math.round(conf * 100) / 100;
    return next;
  });

  rescored.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  const weak = new Set(["light", "paywall"]);
  const solid = rescored.filter((s) => !weak.has(s.factual_rank));
  const demoted = rescored.filter((s) => weak.has(s.factual_rank));

  let kept;
  let demotedDropped = 0;
  if (solid.length >= FACTUAL_RESEARCH_MIN_SOURCES) {
    kept = solid.slice(0, maxResults);
    demotedDropped = demoted.length;
  } else {
    kept = [...solid, ...demoted].slice(0, maxResults);
  }

  return {
    sources: kept,
    demotedDropped,
    boosted,
    majorityLight: sourcesAreMajorityLight(kept),
    majorityPaywall: sourcesAreMajorityPaywall(kept),
    hardSector: sourcesHaveHardSector(kept),
  };
}

/**
 * Fusionne deux listes de sources (URL unique), puis rank.
 * @param {Array<object>} primary
 * @param {Array<object>} secondary
 * @param {{ maxResults?: number }} [options]
 */
export function mergeAndRankFactualResearchSources(
  primary = [],
  secondary = [],
  options = {},
) {
  const seen = new Set();
  const merged = [];
  for (const s of [...(primary || []), ...(secondary || [])]) {
    const url = String(s?.url || "").trim().toLowerCase();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    merged.push(s);
  }
  return rankFactualResearchSources(merged, options);
}
