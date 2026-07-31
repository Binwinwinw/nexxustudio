/**
 * G31.4 — validation post-search recommandation produit (récence, budget).
 */
import { GUIDED_PRODUCT_WEB_MAX_SOURCES } from "./guidedProductRecommendationPolicy.js";

const RECENT_YEAR_RE = /\b(202[4-9]|203\d)\b/;

const OUTDATED_SMARTPHONE_RE =
  /\b(?:iphone\s*(?:1[0-5](?:\s*pro)?|se\s*(?:2020|2022)?)|galaxy\s*s2[0-3]|s23\s*ultra|pixel\s*[0-7](?:\s*pro)?)\b/i;

const FLAGSHIP_PRICE_RE = /\b(?:1\s?\d{3}|2\s?000)\s*(?:€|euros?)\b/i;

/** Pages tutoriel / procédure — pas comparatif produit. */
const PROCEDURAL_SOURCE_RE =
  /\b(?:comment (?:changer|installer|remplacer|monter|d[eé]monter)|tutoriel|guide pratique|[eé]tapes? (?:pour|de)|installation|brancher|connecter|d[eé]monter|remplacer (?:une|ta|votre)|changer (?:une|ta|votre) carte)\b/i;

/** Signaux comparatif / modèle / prix exploitables (génériques). */
const PRODUCT_COMPARISON_SOURCE_RE =
  /\b(?:comparatif|meilleur(?:e)?s?|rapport qualit[eé]|qualit[eé][\s/-]*prix|benchmark|\bvs\b|versus|\d{2,4}\s*€|prix|mod[eè]le|tarif)\b/i;

const GPU_SOURCE_RE =
  /\b(?:rtx|gtx|rx\s*\d{3,4}|radeon|geforce|carte\s+graphique)\b/i;

const SSD_SOURCE_RE =
  /\b(?:ssd|nvme|m\.?2|disque\s*(?:dur|ssd)|stockage)\b/i;

export const PRODUCT_RECO_SOURCE_RELEVANCE_RULE =
  "product_reco_source_relevance_g31_5";

/**
 * @param {{ title?: string, snippet?: string, description?: string, url?: string }} source
 * @param {string} [query]
 * @returns {number}
 */
export function scoreProductRecoSourceRelevance(source = {}, query = "") {
  const blob = `${source.title || ""} ${source.snippet || source.description || ""} ${source.url || ""}`;
  const q = String(query || "");
  let score = 0;
  if (PROCEDURAL_SOURCE_RE.test(blob)) score -= 2;
  if (PRODUCT_COMPARISON_SOURCE_RE.test(blob)) score += 2;
  if (/\b(?:€|euros?|prix|tarif)\b/i.test(blob)) score += 1;

  const wantsSsd = /\b(?:ssd|nvme|m\.?2|disque)\b/i.test(q);
  const wantsGpu =
    /\b(?:rtx|gtx|rx\s*\d|carte\s+graphique|gpu)\b/i.test(q) && !wantsSsd;

  if (wantsSsd) {
    if (SSD_SOURCE_RE.test(blob)) score += 2;
    if (GPU_SOURCE_RE.test(blob) && !SSD_SOURCE_RE.test(blob)) score -= 3;
  } else if (wantsGpu) {
    if (GPU_SOURCE_RE.test(blob)) score += 1;
  }

  return score;
}

/**
 * @param {Array<object>} sources
 * @param {string} [query]
 * @returns {{
 *   sufficient: boolean,
 *   proceduralOnly: boolean,
 *   reason: string,
 *   sources: Array<{ url?: string, title?: string, relevance: number }>,
 * }}
 */
export function assessProductRecoWebSources(sources = [], query = "") {
  const scored = (sources || []).map((source) => ({
    url: source.url,
    title: source.title,
    relevance: scoreProductRecoSourceRelevance(source, query),
  }));

  if (scored.length === 0) {
    return {
      sufficient: false,
      proceduralOnly: true,
      reason: "no_sources",
      sources: scored,
    };
  }

  const productRelevant = scored.filter((s) => s.relevance >= 2);
  const proceduralOnly = scored.every((s) => s.relevance <= 0);
  const offTopicGpuForSsd =
    /\b(?:ssd|nvme|m\.?2|disque)\b/i.test(query) &&
    scored.every(
      (s) =>
        scoreProductRecoSourceRelevance(
          { title: s.title, url: s.url },
          query,
        ) < 2,
    ) &&
    (sources || []).some((src) =>
      GPU_SOURCE_RE.test(
        `${src.title || ""} ${src.snippet || src.description || ""}`,
      ),
    );

  return {
    sufficient: productRelevant.length >= 1,
    proceduralOnly,
    reason:
      productRelevant.length >= 1
        ? "ok"
        : offTopicGpuForSsd
          ? "off_topic_sources"
          : proceduralOnly
            ? "procedural_guides_only"
            : "weak_product_signals",
    sources: scored,
  };
}

/**
 * @param {string} query
 * @param {{ reason?: string, proceduralOnly?: boolean }} [assessment]
 * @returns {string}
 */
export function buildProductSourcesInsufficientReply(
  query = "",
  assessment = {},
) {
  const reason = assessment.reason || "weak_product_signals";
  const wantsSsd = /\b(?:ssd|nvme|m\.?2|disque)\b/i.test(query);
  const intro =
    reason === "procedural_guides_only"
      ? wantsSsd
        ? "Les pages trouvées expliquent surtout l'installation, pas un **comparatif de prix SSD/NVMe**."
        : "Les pages que j'ai trouvées expliquent surtout **comment changer ou installer** le matériel, pas **quel modèle choisir** ni à quel prix."
      : reason === "off_topic_sources"
        ? "Les sources web de ce tour ne portent pas sur ton produit demandé — je ne m'en sers pas pour inventer un comparatif."
      : reason === "no_sources"
        ? "Je n'ai pas trouvé de sources web exploitables pour ce comparatif."
        : "Les sources web trouvées ne contiennent pas assez d'infos produit (modèles, prix, comparatif) pour une recommandation sérieuse.";

  const gpuMatch = String(query).match(
    /\b(?:rtx|gtx|rx)\s*\d{3,4}(?:\s*(?:ti|super|xt))?\b/i,
  );
  const offlineHint =
    !wantsSsd && gpuMatch
      ? `\n\nEn repères généraux (sans garantie sur les prix du moment, à vérifier chez un revendeur) : **RTX 4070 Super**, **RTX 4070 Ti** ou **RX 7800 XT** sont des upgrades plausibles depuis une ${gpuMatch[0].toUpperCase()} — selon budget NVIDIA vs AMD et consommation électrique.`
      : wantsSsd
        ? "\n\nPour un SSD NVMe 4 To, les prix bougent vite : indique un budget max et une interface (PCIe 4.0 / 5.0) et je relance une recherche web ciblée."
        : "";

  const refineHint = wantsSsd
    ? "Si tu veux, on affine (budget max, PCIe 4.0 vs 5.0, usage PC/console) et je relance."
    : "Si tu veux, on peut affiner la recherche (budget max, alimentation, résolution jeux) ou partir sur ces repères offline en les traitant comme indicatifs.";

  return (
    `${intro}\n\n` +
    "Je ne peux donc pas te livrer un comparatif **ancré sur le web** avec ce tour.\n\n" +
    refineHint +
    offlineHint
  );
}

/**
 * @param {{ title?: string, snippet?: string, description?: string }} source
 * @returns {number}
 */
export function scoreProductRecoSourceRecency(source = {}) {
  const blob = `${source.title || ""} ${source.snippet || source.description || ""}`;
  if (OUTDATED_SMARTPHONE_RE.test(blob)) return -2;
  if (RECENT_YEAR_RE.test(blob)) return 2;
  return 0;
}

/**
 * @param {Array<object>} sources
 * @param {{ budget?: number|null }} [slots]
 * @param {number} [maxSources]
 * @returns {{ sources: Array<object>, dropped: number, reasons: string[] }}
 */
export function filterProductRecoWebSources(
  sources = [],
  slots = {},
  maxSources = GUIDED_PRODUCT_WEB_MAX_SOURCES,
) {
  const reasons = [];
  const scored = sources.map((source) => ({
    ...source,
    recoScore: scoreProductRecoSourceRecency(source),
  }));

  const kept = scored
    .filter((source) => {
      if (source.recoScore < 0) {
        reasons.push(`outdated_source:${source.url || source.title || "unknown"}`);
        return false;
      }
      return true;
    })
    .sort((a, b) => b.recoScore - a.recoScore)
    .slice(0, maxSources);

  if (slots.budget && slots.budget <= 700) {
    const withoutFlagship = kept.filter((source) => {
      const blob = `${source.title || ""} ${source.snippet || source.description || ""}`;
      if (FLAGSHIP_PRICE_RE.test(blob) && /\b(?:ultra|pro\s*max|fold)\b/i.test(blob)) {
        reasons.push(`budget_mismatch_source:${source.url || source.title || "unknown"}`);
        return false;
      }
      return true;
    });
    return {
      sources: withoutFlagship,
      dropped: sources.length - withoutFlagship.length,
      reasons,
    };
  }

  return {
    sources: kept,
    dropped: sources.length - kept.length,
    reasons,
  };
}

/**
 * @param {string} text
 * @param {{ budget?: number|null, usage?: string|null }} [slots]
 * @returns {{
 *   valid: boolean,
 *   issues: string[],
 *   sanitized: string,
 * }}
 */
export function validateProductRecommendationReply(text = "", slots = {}) {
  const issues = [];
  let sanitized = String(text || "").trim();

  if (OUTDATED_SMARTPHONE_RE.test(sanitized)) {
    issues.push("outdated_model_mentioned");
    sanitized = sanitized.replace(OUTDATED_SMARTPHONE_RE, "[modèle obsolète — filtré]");
  }

  if (slots.budget && slots.budget <= 700 && FLAGSHIP_PRICE_RE.test(sanitized)) {
    issues.push("budget_incoherent_mention");
  }

  if (issues.includes("outdated_model_mentioned")) {
    sanitized +=
      "\n\n_Note : certains modèles cités ont été écartés car trop anciens pour une reco 2026._";
  }

  return {
    valid: issues.length === 0,
    issues,
    sanitized,
  };
}

/**
 * @param {Array<object>} sources
 * @param {{ budget?: number|null, usage?: string|null }} [slots]
 * @param {number} [maxSources]
 * @returns {{ packet: object, audit: object }}
 */
export function applyProductRecoValidationToWebPacket(
  webPacket = {},
  slots = {},
  maxSources = GUIDED_PRODUCT_WEB_MAX_SOURCES,
) {
  const filtered = filterProductRecoWebSources(
    webPacket.sources || [],
    slots,
    maxSources,
  );

  return {
    packet: {
      ...webPacket,
      sources: filtered.sources,
      meta: {
        ...(webPacket.meta || {}),
        product_reco_validation: {
          dropped: filtered.dropped,
          reasons: filtered.reasons,
        },
      },
    },
    audit: filtered,
  };
}
