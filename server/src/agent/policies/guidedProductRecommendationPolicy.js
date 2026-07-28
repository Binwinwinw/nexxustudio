/**
 * G31.3 — contrat GUIDED_PRODUCT_RECOMMENDATION et télémétrie slots.
 */
import {
  isCompareChooseRequest,
  extractCompareDomain,
  parseCompareChoose,
} from "../utils/compareChooseIntentGuards.js";
import {
  hasExplicitWebProductRecoSignals,
  isFreshFactualCompareWithWebRequest,
} from "./explicitWebSearchRequestPolicy.js";
import {
  getMissingProductRecommendationSlots,
  PRODUCT_RECOMMENDATION_REQUIRED_SLOTS,
} from "./compareChooseCompositePolicy.js";

export const GUIDED_PRODUCT_RECOMMENDATION_RULE =
  "guided_product_recommendation_g31_3";

export const GUIDED_PRODUCT_WEB_MAX_SOURCES = 3;
export const GUIDED_PRODUCT_WEB_TIMEOUT_MS = 8_000;

const GPU_MODEL_RE =
  /\b(?:rtx|gtx|rx)\s*\d{3,4}(?:\s*(?:ti|super|xt|xtx))?\b/i;

const STORAGE_CAP_RE = /\b(\d+(?:[.,]\d+)?)\s*(?:t|tb|to|go|gb)\b/i;

/**
 * Catégorie produit pour la requête web — ne jamais forcer « carte graphique »
 * quand la demande porte sur autre chose (SSD, RAM, etc.).
 * @param {string} query
 * @returns {"gpu"|"smartphone"|"ssd"|"ram"|"generic"}
 */
export function detectGuidedProductCategory(query = "") {
  const q = String(query || "");
  if (/\b(?:ssd|nvme|m\.?2|disque\s*(?:dur|ssd)|stockage\s+ssd)\b/i.test(q)) {
    return "ssd";
  }
  if (/\b(?:smartphone|iphone|galaxy|pixel|t[eé]l[eé]phone)\b/i.test(q)) {
    return "smartphone";
  }
  if (
    GPU_MODEL_RE.test(q) ||
    /\b(?:carte\s+graphique|gpu|geforce|radeon)\b/i.test(q)
  ) {
    return "gpu";
  }
  if (/\b(?:ram|m[eé]moire\s+vive|ddr[45])\b/i.test(q)) {
    return "ram";
  }
  return "generic";
}

/**
 * Reformule la requête web pour viser comparatifs/prix, pas tutoriels d'installation.
 * @param {string} query
 * @returns {string}
 */
export function deriveGuidedProductWebSearchQuery(query = "") {
  const q = String(query || "").trim();
  const year = new Date().getFullYear();
  if (!q) return `comparatif produit prix ${year}`;

  const category = detectGuidedProductCategory(q);
  const gpu = q.match(GPU_MODEL_RE)?.[0] || null;
  const capacity = q.match(STORAGE_CAP_RE)?.[0] || null;

  if (category === "smartphone") {
    return `meilleur smartphone comparatif prix qualité ${year}`;
  }
  if (category === "gpu" || gpu) {
    const vram = q.match(/\b(\d+)\s*(?:go|gb)\b/i)?.[0] || null;
    const budget = q.match(/\b(?:moins\s+de\s+)?\d+[\s ]*(?:€|euros?)\b/i)?.[0] || null;
    return [
      gpu ? `carte graphique ${gpu}` : "carte graphique",
      vram,
      budget,
      "nvidia AMD",
      "comparatif prix",
      year,
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (category === "ssd") {
    return [
      "SSD NVMe",
      capacity,
      "comparatif prix",
      year,
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (category === "ram") {
    return `RAM DDR5 kit comparatif prix ${year}`;
  }

  // Générique : garder les termes produit de la requête, jamais un défaut GPU.
  const cleaned = q
    .replace(
      /\b(?:je\s+cherche|j['']aimerais|peux[- ]tu|pourrais[- ]tu|un|une|des|le|la|les|de|du|comparatif|comparer|prix|meilleur(?:e)?|rapport\s+qualit[eé][\s/-]*prix)\b/gi,
      " ",
    )
    .replace(/[?!.…,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const core = cleaned || "produit";
  return `${core} comparatif prix ${year}`;
}

/**
 * @param {string} query
 * @param {{ meta?: object }} [packet]
 * @returns {boolean}
 */
export function isGuidedProductRecommendationRequest(query = "", packet = {}) {
  const understanding = packet?.meta?.query_understanding;
  if (understanding?.primaryDomain === "social") return false;

  if (isFreshFactualCompareWithWebRequest(query)) {
    return true;
  }

  if (understanding?.responseStrategy === "guided_recommendation") {
    return understanding?.primaryDomain === "compare_choose";
  }

  if (!isCompareChooseRequest(query)) return false;

  const domain = extractCompareDomain(query);
  if (domain !== "product") return false;

  if (hasExplicitWebProductRecoSignals(query)) {
    return true;
  }

  return getMissingProductRecommendationSlots(query, domain).length === 0;
}

/**
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").understandQuery>} understanding
 * @returns {string|null}
 */
export function resolveGuidedProductIntentContractId(understanding) {
  if (
    understanding?.primaryDomain === "compare_choose" &&
    understanding?.responseStrategy === "guided_recommendation"
  ) {
    return "GUIDED_PRODUCT_RECOMMENDATION";
  }
  return null;
}

/**
 * @param {object} contract
 * @returns {{ maxResults: number, timeoutMs: number }}
 */
export function resolveGuidedProductWebSearchLimits(contract = {}) {
  const routing = contract?.routing || {};
  return {
    maxResults: routing.webSearchMaxSources ?? GUIDED_PRODUCT_WEB_MAX_SOURCES,
    timeoutMs: routing.webSearchTimeoutMs ?? GUIDED_PRODUCT_WEB_TIMEOUT_MS,
  };
}

/**
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").understandQuery>} understanding
 * @returns {object|null}
 */
export function buildQueryUnderstandingSlotTelemetry(understanding) {
  const intent = understanding?.intents?.find(
    (item) => item.domain === "compare_choose" && !item.absorbable,
  );
  if (!intent) return null;

  const domain = intent.task?.domain || parseCompareChoose(intent.segment)?.domain;
  const isProduct = domain === "product";

  return {
    policy_match_reason: `${intent.familyId}/${intent.path}`,
    domain_confidence: intent.task?.compareChoose?.confidence || "medium",
    required_slots: isProduct ? [...PRODUCT_RECOMMENDATION_REQUIRED_SLOTS] : [],
    missing_slots: isProduct ? intent.task?.missingSlots || [] : [],
  };
}
