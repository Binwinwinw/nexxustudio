/**
 * Comparatif / choix / recommandation — charge décisionnelle gouvernée.
 * Ex. : « Redis vs Memcached », « quelle carte graphique choisir », « le plus rapide parmi… »
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import {
  classifySelectiveDecisionIntent,
  SELECTIVE_DECISION_TASKS,
} from "./selectiveDecisionIntentGuards.js";
import {
  extractExplicitDecisionCriterion,
  hasExplicitDecisionCriterion,
} from "../micro/replies/directArbitrationComposerContract.js";
import { isGreetingOrIntroduction } from "../config/modeResponseContracts.js";
import { isBeginnerTopicOverviewRequest } from "./beginnerTopicOverviewIntentGuards.js";
import { isPedagogicalOverviewRequest } from "./pedagogicalOverviewIntentGuards.js";
import { isTechnicalOverviewRequest } from "./technicalOverviewIntentGuards.js";
import { isDebugDiagnosticRequest } from "./debugDiagnosticIntentGuards.js";
import { isExploitableProcedureIntent } from "./procedureIntentGuards.js";
import { suppressesCompareChooseForLearningRequest } from "./learningRequestIntentGuards.js";
import { suppressesCompareChooseForOpenPrompt } from "../policies/meta/openPromptContinuityPolicy.js";

export const COMPARE_CHOOSE_ROUTING_RULE =
  "compare_choose_full_pipeline_generative";

export { SELECTIVE_DECISION_TASKS };

const SIMPLE_FACTUAL_PATTERN =
  /^(?:quelle heure|quel jour|quelle date|quelle heure est il|il est quelle heure|on est en quelle annee|on est en quelle année|nous sommes en quelle annee|nous sommes en quelle année)\b/;

const TECH_DOMAIN_RE =
  /\b(?:redis|kubernetes|k8s|docker|mysql|postgres|postgresql|mongodb|memcached|nginx|react|vue|angular|node\.?js|python|java|typescript|javascript|sql|nosql|kafka|graphql|rest|api|microservice|terraform|aws|azure|gcp|llm|rag)\b/i;

const CULINARY_DOMAIN_RE =
  /\b(?:recette|plat|pates|pâtes|cuisine|mijote|mijoter|carbonara|pesto|bourguignon)\b/i;

const PRODUCT_DOMAIN_RE =
  /\b(?:carte graphique|gpu|rtx|gtx|nvidia|amd|processeur|cpu|carte m[eè]re|ram|ssd|nvme|m\.?2|disque\s*(?:dur|ssd)|stockage|vehicule|véhicule|voiture|chaussure|running|montre|smartphone|iphone|macbook|achat|acheter)\b/i;

const OPTIONS_VS_RE =
  /\b([^?,;]{2,40}?)\s+(?:vs|versus)\s+([^?,;]{2,40})\b/i;

const OPTIONS_OU_RE =
  /\b(?:entre|ou)\s+([^?,;]{2,40}?)\s+(?:et|ou)\s+([^?,;]{2,40})\b/i;

/**
 * @typedef {'comparative'|'recommendation'|'arbitration'|'ranking'|'constrained_choice'} CompareTask
 * @typedef {'tech'|'culinary'|'product'|'general'} CompareDomain
 * @typedef {'high'|'medium'|'low'} SlotConfidence
 *
 * @typedef {Object} CompareChooseSlots
 * @property {'compare_choose'} intent
 * @property {CompareTask|null} primaryTask
 * @property {CompareTask[]} tasks
 * @property {string[]} options
 * @property {{ id: string, label: string }|null} criterion
 * @property {CompareDomain} domain
 * @property {boolean} directArbitration
 * @property {SlotConfidence} confidence
 */

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

function isSimpleFactualLookup(query = "") {
  const q = normalizeQuery(query);
  if (!q) return false;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 14) return false;
  return SIMPLE_FACTUAL_PATTERN.test(q);
}

function cleanCompareOption(part = "") {
  return String(part || "")
    .replace(/\s+(?:que|pour|dans|sur|with|for|afin|afin de)\b.*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} query
 * @returns {string[]}
 */
export function extractCompareOptions(query = "") {
  const q = normalizeQuery(query);
  if (!q) return [];

  const vsMatch = q.match(OPTIONS_VS_RE);
  if (vsMatch) {
    return [vsMatch[1], vsMatch[2]]
      .map((part) => cleanCompareOption(part))
      .filter((part) => part.length >= 2);
  }

  const ouMatch = q.match(OPTIONS_OU_RE);
  if (ouMatch) {
    return [ouMatch[1], ouMatch[2]]
      .map((part) => cleanCompareOption(part))
      .filter((part) => part.length >= 2);
  }

  return [];
}

/**
 * @param {string} query
 * @returns {CompareDomain}
 */
export function extractCompareDomain(query = "") {
  const q = normalizeQuery(query);
  if (TECH_DOMAIN_RE.test(q)) return "tech";
  if (CULINARY_DOMAIN_RE.test(q)) return "culinary";
  if (PRODUCT_DOMAIN_RE.test(q)) return "product";
  return "general";
}

/**
 * @param {string} query
 * @returns {CompareChooseSlots|null}
 */
export function parseCompareChoose(query = "") {
  const classification = classifySelectiveDecisionIntent(query);
  if (!classification.detected) return null;

  const options = extractCompareOptions(query);
  const criterion = extractExplicitDecisionCriterion(query);
  const domain = extractCompareDomain(query);

  return {
    intent: "compare_choose",
    primaryTask: classification.primaryTask,
    tasks: classification.tasks,
    options,
    criterion,
    domain,
    directArbitration: hasExplicitDecisionCriterion(query),
    confidence:
      options.length >= 2 || criterion
        ? "high"
        : classification.tasks.length > 0
          ? "medium"
          : "low",
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isCompareChooseRequest(query = "", ctx = {}) {
  const q = normalizeQuery(query);
  if (!q || q.length < 8) return false;

  if (suppressesCompareChooseForOpenPrompt(query, ctx)) return false;

  if (isGreetingOrIntroduction(query)) return false;
  if (isSimpleFactualLookup(query)) return false;
  if (suppressesCompareChooseForLearningRequest(query)) return false;
  if (!classifySelectiveDecisionIntent(query).detected) return false;

  if (isBeginnerTopicOverviewRequest(query)) return false;
  if (isPedagogicalOverviewRequest(query)) return false;
  if (isTechnicalOverviewRequest(query)) return false;
  if (isDebugDiagnosticRequest(query)) return false;
  if (isExploitableProcedureIntent(query)) return false;

  return Boolean(parseCompareChoose(query));
}
