/**
 * Fraîcheur des connaissances — relative à la date du jour (pas d'année figée).
 * Détecte les sujets mouvants par NATURE (marque/modèle/prix), pas par domaine tech figé.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { classifySelectiveDecisionIntent } from "../../utils/selectiveDecisionIntentGuards.js";
import {
  wasWebSearchSkippedByContract,
  wasWebSearchAttempted,
} from "../explicitWebSearchRequestPolicy.js";
import { isWebSearchThreadMaintenanceMessage } from "./webSearchThreadContinuityPolicy.js";

export const KNOWLEDGE_FRESHNESS_RULE = "temporal_freshness_relative_to_today";

const FRESHNESS_MARKER_PATTERN =
  /\b(?:dernier|derniere|dernière|derniers|dernieres|dernières|actuel|actuelle|actuels|actuelles|recent|récent|récente|récemment|en ce moment|nouveau|nouvelle|nouveaux|nouvelles|sorti|sortie|version|mise a jour|mise à jour|prix|tarif|disponibilite|disponibilité|comparatif|comparer|versus|\bvs\b|meilleur|meilleure|flagship|generation|génération|20\d{2})\b/i;

/** Produits / biens à cycle de versions (tous domaines, pas seulement tech). */
const VERSIONED_PRODUCT_CONTEXT_PATTERN =
  /\b(?:iphone|ipad|galaxy|samsung|apple|pixel|smartphone|android|ios|gpu|nvidia|amd|tesla|voiture|vehicule|véhicule|chaussure|chaussures|basket|baskets|sneaker|sneakers|running|trail|lunette|lunettes|monture|sous[- ]?vetement|sous[- ]?vêtement|lingerie|boxer|soutien[- ]?gorge|montre|rolex|omega|vetement|vêtement|mode|cosmetique|cosmétique|parfum|marque|modele|modèle|nike|adidas|asics|hoka|puma|reebok|new balance|ray[- ]?ban|oakley|windows \d+|macos|logiciel|firmware|loi|reglement|regulation|bourse|cours|inflation)\b/i;

/** Sujets culturels / catégoriels stables (pas de refresh forcé sans marqueur temporel). */
const STABLE_TOPIC_PATTERN =
  /\b(?:recette|bourguignon|carbonara|histoire de france|moyen age|moyen âge|definition de|qu est ce que la photosynthese|photosynthèse|theoreme|théorème)\b/i;

const STABLE_CATEGORY_TOPIC_PATTERN =
  /\b(?:c est quoi|qu est ce que|definition|définition|categories|catégories|types de|monture ovale|monture ronde|running vs trail|trail vs marche|comparatif de styles|comparatif des styles)\b/i;

/**
 * @param {Date|string|number} [now]
 * @returns {Date}
 */
export function resolveReferenceDate(now = new Date()) {
  if (now instanceof Date && !Number.isNaN(now.getTime())) return now;
  const parsed = new Date(now);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * @param {Date} date
 * @param {string} [locale='fr-FR']
 */
export function formatReferenceDateFr(date = new Date(), locale = "fr-FR") {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * @param {string} query
 */
export function isStableCategoryKnowledge(query = "") {
  const q = normalizeFamiliarityQuery(query);
  return STABLE_CATEGORY_TOPIC_PATTERN.test(q) && !FRESHNESS_MARKER_PATTERN.test(q);
}

/**
 * Score de risque de fraîcheur 0 (stable) → 1 (très mouvant).
 * @param {string} query
 */
export function scoreKnowledgeFreshnessRisk(query = "", _options = {}) {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return 0;

  if (isWebSearchThreadMaintenanceMessage(query)) return 0.05;

  if (isStableCategoryKnowledge(query)) return 0.1;

  if (STABLE_TOPIC_PATTERN.test(q) && !FRESHNESS_MARKER_PATTERN.test(q)) {
    return 0.08;
  }

  let score = 0;
  const hasFreshnessMarker = FRESHNESS_MARKER_PATTERN.test(q);
  const hasVersionedProduct = VERSIONED_PRODUCT_CONTEXT_PATTERN.test(q);
  const hasComparative = /\b(?:comparatif|comparer|versus|\bvs\b)\b/.test(q);

  if (hasFreshnessMarker) score += 0.42;
  if (hasVersionedProduct) score += 0.28;
  if (hasComparative) score += 0.22;

  const selective = classifySelectiveDecisionIntent(query);
  if (selective.detected) score += 0.22;

  if (hasFreshnessMarker && (hasComparative || hasVersionedProduct)) score += 0.12;
  if (/\b(?:dernier|derniere|dernière|actuel|actuelle|nouveau|nouvelle)\b/.test(q)) {
    score += 0.1;
  }

  return Math.min(1, Math.round(score * 100) / 100);
}

/**
 * @param {object} packet
 */
export function hasSuccessfulWebGrounding(packet = {}) {
  if (packet?.meta?.web_failure_mode) return false;
  const outputs = Array.isArray(packet?.expert_outputs) ? packet.expert_outputs : [];
  const web = outputs.find((o) => o?.stage === "web_research");
  const content = String(web?.content || "").trim();
  if (content.length < 80) return false;
  return packet?.meta?.resolution_path === "web_fallback" || content.length >= 80;
}

/**
 * Mode fallback bridé : refresh tenté mais sources absentes.
 * Pas de « je n'ai pas pu vérifier » si la web search n'a jamais été tentée.
 * @param {string} query
 * @param {object} [packet]
 */
export function requiresBridgedFreshnessFallback(query = "", packet = {}) {
  const assessment = assessKnowledgeFreshnessRisk(query);
  if (!assessment.isFreshnessSensitive) return false;
  if (wasWebSearchSkippedByContract(packet)) return false;
  if (!wasWebSearchAttempted(packet) && !hasSuccessfulWebGrounding(packet)) {
    return false;
  }
  return !hasSuccessfulWebGrounding(packet);
}

/**
 * @param {string} query
 * @param {{ now?: Date|string|number, webSourcesCount?: number }} [options]
 */
export function assessKnowledgeFreshnessRisk(query = "", options = {}) {
  const referenceDate = resolveReferenceDate(options.now);
  const riskScore = scoreKnowledgeFreshnessRisk(query, options);
  const q = normalizeFamiliarityQuery(query);

  const isFreshnessSensitive = riskScore >= 0.45;
  const preferWebRefresh = isFreshnessSensitive && (options.webSourcesCount ?? 0) === 0;
  const temporalDisclosureRequired = riskScore >= 0.35;

  let reason = "stable_or_low_volatility";
  if (preferWebRefresh) reason = "volatile_topic_needs_web_refresh";
  else if (isFreshnessSensitive) reason = "freshness_sensitive_disclosure_only";
  else if (STABLE_TOPIC_PATTERN.test(q)) reason = "stable_topic";
  else if (isStableCategoryKnowledge(query)) reason = "stable_category_topic";

  return {
    rule: KNOWLEDGE_FRESHNESS_RULE,
    riskScore,
    isFreshnessSensitive,
    preferWebRefresh,
    temporalDisclosureRequired,
    referenceDateIso: referenceDate.toISOString(),
    referenceDateLabel: formatReferenceDateFr(referenceDate),
    reason,
  };
}

/**
 * Extrait la date la plus récente des sources web du packet.
 * @param {object} packet
 */
export function extractWebVerificationLabel(packet = {}) {
  const outputs = Array.isArray(packet?.expert_outputs) ? packet.expert_outputs : [];
  const web = outputs.find((o) => o?.stage === "web_research");
  if (!web?.content) return null;

  const isoMatches = String(web.content).match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (isoMatches.length === 0) {
    return packet?.meta?.web_consulted_at
      ? formatReferenceDateFr(resolveReferenceDate(packet.meta.web_consulted_at))
      : null;
  }

  const latest = isoMatches
    .map((d) => resolveReferenceDate(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return latest ? formatReferenceDateFr(latest) : null;
}
