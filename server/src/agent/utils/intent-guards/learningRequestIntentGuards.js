/**
 * Shell « apprentissage de X » — parcours progressif, distinct de la recherche d'info.
 * Ex. : « pour un apprentissage du poker que me conseillerais-tu ? »
 *
 * Coexistence :
 * - information_seeking : « je cherche des infos sur X » → explain / factuel
 * - learning_request : ancre apprentissage + cible → learn / plan
 * - compare_choose : « que me conseillerais-tu » seul ou entre options → arbitrage
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import {
  isInformationSeekingShell,
  isInformationSeekingWithTarget,
} from "./informationSeekingIntentGuards.js";

const TECH_DOMAIN_RE =
  /\b(?:jvm|jsx|bytecode|garbage collector|gc|runtime|nodejs|node\.?js|javascript|typescript|python|java|kotlin|rust|go|golang|react|vue|angular|express|expressjs|fastify|fastifyjs|docker|kubernetes|k8s|redis|postgres|postgresql|mysql|mongodb|graphql|rest|api|linux|git|sql|nosql|devops|ci\/cd|terraform|aws|azure|gcp|llm|rag|embedding|microservice|nginx|kafka|websocket|oauth|jwt|spring|hibernate|innodb|compiler|interpreteur|interpréteur|architecture logicielle|design pattern|algorithmique|reseau|réseau|tcp|http|css|html|tailwind|tailwindcss|webpack|vite|bash|shell|zsh|powershell|sh\b|langage bash)\b/i;

/** Ancre forte : l'utilisateur demande un parcours, pas un article. */
const LEARNING_REQUEST_STRONG_SHELL_RE =
  /\b(?:apprentissage (?:de |du |des |d'|sur )|(?:je veux|j'aimerais|j aimerais|besoin d(?:e|'|)?)\s+apprendre|plan (?:d'|de |pour )?apprentissage|parcours (?:d'|de |pour )?apprentissage|feuille de route (?:pour |de )?apprendre|me former (?:a |à |en |sur |au )|structurer mon apprentissage|organiser mon apprentissage)\b/i;

/** Ancre faible — exige un signal de progression ou de conseil pédagogique. */
const LEARNING_REQUEST_WEAK_ANCHOR_RE =
  /\b(?:apprendre|apprentissage|me former|formation|monter en niveau|progresser|debuter|débuter|initiation|premiers pas|par ou commencer|comment commencer)\b/i;

const LEARNING_PROGRESSION_SIGNAL_RE =
  /\b(?:plan|parcours|feuille de route|progression|etapes|étapes|semaine|jalons|roadmap|syllabus|curriculum|programme|etape par etape|étape par étape|que me conseill|que me recommand|par quoi commencer|par ou commencer)\b/i;

const LEARNING_TARGET_PATTERNS = [
  /\bapprentissage (?:de |du |des |d'|sur )(?:le |la |les |l')?([^?.!,]{2,80})/i,
  /\b(?:je veux|j'aimerais|j aimerais|besoin d(?:e|'|)?)\s+apprendre (?:le |la |les |l')?([^?.!,]{2,80})/i,
  /\bme former (?:a |à |en |sur |au )(?:le |la |les |l')?([^?.!,]{2,80})/i,
  /\bplan (?:d'|de |pour )?apprentissage (?:de |du |des |d'|sur )(?:le |la |les |l')?([^?.!,]{2,80})/i,
  /\bparcours (?:d'|de |pour )?apprentissage (?:de |du |des |d'|sur )(?:le |la |les |l')?([^?.!,]{2,80})/i,
  /\bapprendre (?:le |la |les |l')?([^?.!,]{2,80})/i,
];

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

function cleanLearningTarget(raw = "") {
  return String(raw || "")
    .replace(/\s+(?:et|ou|avec|pour|que|qui)\b.*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractLearningRequestTarget(query = "") {
  const q = normalizeQuery(query);
  if (!q) return null;

  for (const pattern of LEARNING_TARGET_PATTERNS) {
    const match = q.match(pattern);
    const raw = cleanLearningTarget(match?.[1]);
    if (raw.length >= 2) return raw;
  }

  return null;
}

/**
 * Shell apprentissage sans exiger la cible (frame conversationnel).
 * @param {string} query
 * @returns {boolean}
 */
export function isLearningRequestShell(query = "") {
  const q = normalizeQuery(query);
  if (!q) return false;

  if (isInformationSeekingWithTarget(query) && !LEARNING_REQUEST_STRONG_SHELL_RE.test(q)) {
    return false;
  }

  if (LEARNING_REQUEST_STRONG_SHELL_RE.test(q)) return true;

  if (/\bapprendre\b/i.test(q) && extractLearningRequestTarget(query)) return true;

  return (
    LEARNING_REQUEST_WEAK_ANCHOR_RE.test(q) && LEARNING_PROGRESSION_SIGNAL_RE.test(q)
  );
}

/**
 * Demande de parcours d'apprentissage avec sujet explicite.
 * @param {string} query
 * @returns {boolean}
 */
export function isLearningRequestWithTarget(query = "") {
  if (!isLearningRequestShell(query)) return false;
  return Boolean(extractLearningRequestTarget(query));
}

/**
 * learning_request(X) avec X dans le registre technique → pont vers TLP.
 * @param {string} query
 * @returns {boolean}
 */
export function isLearningRequestForTechnicalDomain(query = "") {
  if (!isLearningRequestWithTarget(query)) return false;
  const target = extractLearningRequestTarget(query) || "";
  return TECH_DOMAIN_RE.test(target) || TECH_DOMAIN_RE.test(normalizeQuery(query));
}

/**
 * Prime sur compare_choose quand l'ancre est un parcours, pas un arbitrage produit.
 * @param {string} query
 * @returns {boolean}
 */
export function suppressesCompareChooseForLearningRequest(query = "") {
  return isLearningRequestWithTarget(query);
}

/**
 * Info-seeking pur sans ancre apprentissage — ne pas confondre avec learning_request.
 * @param {string} query
 * @returns {boolean}
 */
export function isPureInformationSeekingNotLearningRequest(query = "") {
  return isInformationSeekingShell(query) && !LEARNING_REQUEST_STRONG_SHELL_RE.test(normalizeQuery(query));
}
