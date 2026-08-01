/**
 * Shell « je cherche des informations sur X » — priorité factuelle/explicative sur le social.
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { isCurrentWebFactRequest } from "../policies/currentWebFactPolicy.js";
import {
  extractResearchThenSummarizeTarget,
  isResearchThenSummarizeRequest,
} from "../policies/researchThenSummarizePolicy.js";
import { isFormalLetterTemplateRequest } from "../policies/delivery/index.js";

const INFORMATION_SEEKING_SHELL_RE =
  /\b(?:je cherche|j cherche|chercher|je voudrais|j aimerais|j'aimerais|besoin d(?:e|'|)?\s*(?:infos?|informations?|renseignements?)|j ai besoin d(?:e|'|)?\s*(?:infos?|informations?|renseignements?)|tu peux me dire|peux[- ]?tu me dire|dis[- ]?moi ce que tu sais|explique[- ]?moi|m['']?expliquer|m['']?informer|informe[- ]?moi)\b/i;

/** Variante « quelles informations as-tu / aurais-tu … » (ex. King of Avalon). */
const INFORMATION_POSSESSION_SHELL_RE =
  /\b(?:quelles informations|quelle information)\s+(?:as[- ]?tu|aurais[- ]?tu|avez[- ]?vous|peux[- ]?tu|pourrais[- ]?tu)\b/i;

const INFORMATION_KNOWLEDGE_SHELL_RE =
  /\b(?:que sais[- ]?tu|que savez[- ]?vous|qu['']en sais[- ]?tu)\s+(?:sur|de |du |d'|concernant|a propos de|à propos de)\b/i;

/** Variante courte « infos sur X » (kimono, Trello, etc.). */
const INFORMATION_SHORT_INFOS_SHELL_RE =
  /\binfos?\s+(?:sur|concernant|a propos de|à propos de|au sujet de)\b/i;

const INFORMATION_TARGET_PATTERNS = [
  /\b(?:sur|concernant|a propos de|à propos de|au sujet de)\s+(?:la |le |les |l')?([^?.!,]{2,80})/i,
  /\b(?:infos?|informations?|renseignements?)\s+(?:sur|concernant|a propos de|à propos de)\s+(?:la |le |les |l')?([^?.!,]{2,80})/i,
  /\b(?:du |de |d'|sur )(?:jeu |la |le |les |l')?([^?.!,]{2,80})/i,
];

/** Sujet nommé (jeu, app…) — escalade si simple_factual LLM vide. */
const NICHE_INFORMATION_SUBJECT_RE =
  /\b(?:jeu|jeux|app|application|logiciel|mobile game|mmorpg|strategie|stratégie)\b/i;

/** Miroir learningRequestIntentGuards — évite import circulaire. */
const LEARNING_PREEMPT_INFO_SEEKING_RE =
  /\b(?:apprentissage (?:de |du |des |d'|sur )|plan (?:d'|de |pour )?apprentissage|parcours (?:d'|de |pour )?apprentissage|feuille de route (?:pour |de )?apprendre|me former (?:a |à |en |sur |au )|structurer mon apprentissage|organiser mon apprentissage)\b/i;

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractInformationSeekingTarget(query = "") {
  const researchTarget = extractResearchThenSummarizeTarget(query);
  if (researchTarget) return researchTarget;

  const q = normalizeQuery(query);
  if (!q) return null;

  for (const pattern of INFORMATION_TARGET_PATTERNS) {
    const match = q.match(pattern);
    const raw = String(match?.[1] || "")
      .replace(/\s+(?:et|ou|avec|pour)\b.*/i, "")
      .trim();
    if (raw.length >= 2) return raw;
  }

  return null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isInformationSeekingShell(query = "") {
  const q = normalizeQuery(query);
  if (!q) return false;
  return (
    INFORMATION_SEEKING_SHELL_RE.test(q) ||
    INFORMATION_POSSESSION_SHELL_RE.test(q) ||
    INFORMATION_KNOWLEDGE_SHELL_RE.test(q) ||
    INFORMATION_SHORT_INFOS_SHELL_RE.test(q)
  );
}

/**
 * Demande d'information avec cible explicite (ex. « infos sur Teams 365 »).
 * @param {string} query
 * @returns {boolean}
 */
export function isInformationSeekingWithTarget(query = "") {
  if (isFormalLetterTemplateRequest(query)) return false;
  if (isResearchThenSummarizeRequest(query)) {
    return Boolean(extractInformationSeekingTarget(query));
  }
  if (!isInformationSeekingShell(query)) return false;
  const q = normalizeQuery(query);
  if (LEARNING_PREEMPT_INFO_SEEKING_RE.test(q)) return false;
  return Boolean(extractInformationSeekingTarget(query));
}

/**
 * Recherche d'info ciblée — prime sur le social (composite greeting + info).
 * @param {string} query
 * @returns {boolean}
 */
export function suppressesSocialForInformationSeeking(query = "") {
  return isInformationSeekingWithTarget(query);
}

/**
 * Message générique post-échec couloir rapide — déclenche escalade web si info-seeking.
 * @param {string} text
 * @returns {boolean}
 */
export function isInformationSeekingRecoveryResponse(text = "") {
  return /je n'ai pas pu finaliser une r[eé]ponse/i.test(String(text || ""));
}

/**
 * Requête web ciblée pour expert_web_search (overview produit/jeu/app).
 * @param {string} query
 * @returns {string|null}
 */
export function buildInformationSeekingWebQuery(query = "") {
  if (!isInformationSeekingWithTarget(query)) return null;
  const target = extractInformationSeekingTarget(query) || "";
  if (!target) return null;

  const q = normalizeQuery(query);
  if (/\bjeu\b/i.test(q)) {
    return `${target} jeu stratégie overview site officiel gameplay`;
  }
  if (/\b(?:app|application|logiciel)\b/i.test(q)) {
    return `${target} application overview site officiel fonctionnalités`;
  }
  return `${target} overview informations`;
}

/**
 * Escalade orchestrateur/web après échec simple_factual sur sujet documenté.
 *
 * Condition exacte (v1.1.2) :
 *   fallbackReason === "empty_short_circuit_llm"
 *   ET ( isInformationSeekingWithTarget(query) OU sujet niche nommé )
 *   OU réponse utilisateur = template recovery post-échec
 *
 * @param {string} query
 * @param {string} [fallbackReason]
 * @param {string} [responseText]
 * @returns {boolean}
 */
export function shouldEscalateSimpleFactualToFullPipeline(
  query = "",
  fallbackReason = "",
  responseText = "",
) {
  const usedRecovery =
    fallbackReason === "empty_short_circuit_llm" ||
    isInformationSeekingRecoveryResponse(responseText);

  if (!usedRecovery) return false;
  if (isCurrentWebFactRequest(query)) return true;
  if (isInformationSeekingWithTarget(query)) return true;

  const q = normalizeQuery(query);
  const target = extractInformationSeekingTarget(query) || "";
  if (/\binformations?\b/i.test(q) && (NICHE_INFORMATION_SUBJECT_RE.test(q) || target.length >= 3)) {
    return true;
  }

  return false;
}
