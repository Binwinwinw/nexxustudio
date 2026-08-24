/**
 * P7.1 — Alignement sources ↔ brief (topic match) + gate streaming.
 */

export const FACTUAL_RESEARCH_TOPIC_MATCH_MIN = 3;

const STOP = new Set([
  "avec",
  "dans",
  "pour",
  "une",
  "des",
  "les",
  "sur",
  "par",
  "pas",
  "plus",
  "tout",
  "tous",
  "cette",
  "ces",
  "aux",
  "du",
  "de",
  "la",
  "le",
  "un",
  "et",
  "ou",
  "en",
  "au",
  "qui",
  "que",
  "quoi",
  "dont",
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "about",
  "your",
  "vous",
  "nous",
  "être",
  "etre",
  "avoir",
  "fait",
  "faire",
  "fais",
  "recherche",
  "rapport",
  "professionnel",
  "citations",
  "sources",
  "web",
  "pages",
  "maximum",
  "comprenant",
  "présenter",
  "presentation",
  "présentation",
  "identifier",
  "effectuer",
  "utiliser",
  "veuillez",
  "pouvez",
  "pourriez",
  "actuel",
  "actuelle",
  "clés",
  "cles",
  "forme",
  "sous",
  "tout",
  "focus",
  "juillet",
  "responsable",
  "marketing",
  "startup",
  "dossier",
  "fonds",
  "please",
  "could",
  "would",
  "using",
  "recent",
  "structured",
]);

/** Brief audiovisuel / SVOD → retries sector P5/P7 autorisés. */
const STREAMING_BRIEF_RE =
  /\b(?:streaming|svod|avod|vod|ott|netflix|disney\+|canal\+|audiovisuel|films?\s+ind[eé]pendants?|ind[eé]pendante?\s+film|s[eé]ries?\s+tv|plateformes?\s+(?:de\s+)?vid[eé]o)\b/i;

/** Tokens trop génériques seuls (faux positifs levées / presse). */
const WEAK_ALONE = new Set([
  "startup",
  "startups",
  "marche",
  "market",
  "france",
  "europe",
  "report",
  "etude",
  "actualites",
  "fonds",
  "series",
  "serie",
  "presentation",
  "dossier",
  "entreprise",
  "company",
  "growth",
  "croissance",
  "millions",
  "milliards",
  "capital",
  "risque",
  "tech",
  "focus",
  "juillet",
]);

function fold(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Stem léger FR/EN pour indépendant(e)s ↔ independants. */
function stemish(t = "") {
  return fold(t)
    .replace(/(iques|ique|ments|ment|tions|tion|euses|eurs|euses|ives|ifs)$/g, "")
    .replace(/(antes|ants|entes|ents|ées|ees|és|es|s)$/g, "");
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isStreamingFactualBrief(query = "") {
  return STREAMING_BRIEF_RE.test(String(query || ""));
}

/**
 * Keywords thématiques du brief (hors stop-words).
 * @param {string} query
 * @returns {string[]}
 */
export function extractFactualTopicKeywords(query = "") {
  const raw = fold(query);
  const tokens = raw.match(/[a-z0-9][a-z0-9-]{1,}/g) || [];
  const out = [];
  const seen = new Set();
  for (const t of tokens) {
    if (STOP.has(t)) continue;
    if (/^\d{4}$/.test(t)) continue; // années : trop bruyantes
    if (t.length < 3 && !["iot", "ai", "eu", "fr", "uk"].includes(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 14) break;
  }
  return out;
}

function keywordHitsBlob(blob, keyword) {
  if (blob.includes(keyword)) return true;
  const sk = stemish(keyword);
  if (sk.length < 4) return false;
  return blob.split(/[^a-z0-9]+/).some((w) => {
    const sw = stemish(w);
    if (sw.length < 4) return false;
    return sw === sk || sw.startsWith(sk) || sk.startsWith(sw);
  });
}

/**
 * @param {{ url?: string, title?: string, snippet?: string, excerpt?: string }} source
 * @param {string[]} keywords
 * @returns {boolean}
 */
export function sourceMatchesTopic(source = {}, keywords = []) {
  if (!keywords.length) return false;
  const blob = fold(
    `${source.url || ""} ${source.title || ""} ${source.snippet || ""} ${source.excerpt || ""}`,
  );
  // Domaines sectoriels streaming connus ↔ brief qui les cite via SVOD/streaming
  if (
    /(?:arcom\.fr|cnc\.fr|tv\.fr)/i.test(String(source.url || "")) &&
    keywords.some((k) =>
      ["streaming", "svod", "avod", "audiovisuel", "films", "film"].includes(k),
    )
  ) {
    return true;
  }
  let hits = 0;
  let strongHit = false;
  for (const k of keywords) {
    if (!keywordHitsBlob(blob, k)) continue;
    hits += 1;
    if (!WEAK_ALONE.has(k) && (k.length >= 5 || ["iot", "ai", "eu"].includes(k))) {
      strongHit = true;
    }
  }
  return hits >= 2 || (hits >= 1 && strongHit);
}

/**
 * @param {Array<object>} sources
 * @param {string[]} keywords
 * @returns {number}
 */
export function countSourcesTopicMatch(sources = [], keywords = []) {
  return (Array.isArray(sources) ? sources : []).filter((s) =>
    sourceMatchesTopic(s, keywords),
  ).length;
}

/**
 * @param {string} query
 * @param {Array<object>} sources
 * @returns {{ keywords: string[], matchCount: number, weak: boolean }}
 */
export function assessFactualSourcesTopicMatch(query = "", sources = []) {
  const keywords = extractFactualTopicKeywords(query);
  const matchCount = countSourcesTopicMatch(sources, keywords);
  return {
    keywords,
    matchCount,
    weak: matchCount < FACTUAL_RESEARCH_TOPIC_MATCH_MIN,
  };
}

/**
 * Query retry topic : brief + PDF + institutions génériques (OR).
 * @param {string} query
 * @returns {string}
 */
export function deriveFactualResearchTopicRetryWebQuery(query = "") {
  const keywords = extractFactualTopicKeywords(query);
  const prefer = keywords
    .filter(
      (k) =>
        !/^(serie|series|leve|levee|presentation|juillet|2025|2026|pages?)$/i.test(
          k,
        ),
    )
    .slice(0, 8);
  const topic =
    prefer.length > 0
      ? prefer.join(" ")
      : String(query || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 60);
  // filetype:pdf tôt — budget 140 chars (VQD)
  const institutional = "(site:europa.eu OR site:oecd.org OR site:fao.org)";
  return `${topic} filetype:pdf ${institutional}`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

/**
 * Thèmes d'opportunités dérivés du brief (pas hardcode SVOD).
 * @param {string} query
 * @param {string[]} [keywords]
 * @returns {Array<{ title: string, hint: string }>}
 */
export function buildOpportunityThemesFromBrief(query = "", keywords = []) {
  const ks =
    keywords.length > 0 ? keywords : extractFactualTopicKeywords(query);
  const top = ks.slice(0, 6);
  if (top.length === 0) {
    return [
      { title: "Différenciation produit", hint: "proposition de valeur" },
      { title: "Fenêtre marché", hint: "segment adressable" },
      { title: "Preuve traction", hint: "signaux demandés par les investisseurs" },
    ];
  }
  const a = top[0] || "marché";
  const b = top[1] || top[0];
  const c = top[2] || top[0];
  return [
    {
      title: `Différenciation ${a}`,
      hint: top.slice(0, 3).join(" / "),
    },
    {
      title: `Fenêtre ${b}`,
      hint: `adoption / positionnement autour de ${b}`,
    },
    {
      title: `Traction ${c}`,
      hint: `preuves exploitables liées à ${c}`,
    },
  ];
}
