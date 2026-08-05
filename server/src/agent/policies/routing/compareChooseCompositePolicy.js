/**
 * G31.1 — compare_choose / product_recommendation dans le registre G29.
 * G31.2 — slots minimums (budget, usage) pour reco produit.
 */
import {
  isCompareChooseRequest,
  parseCompareChoose,
  extractCompareDomain,
} from "../../utils/compareChooseIntentGuards.js";
import {
  hasExplicitWebProductRecoSignals,
  isHardwareProductCompareQuery,
} from "./explicitWebSearchRequestPolicy.js";
import { RESPONSE_STRATEGIES } from "../conversation/queryUnderstandingDomainRegistry.js";
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";

export const COMPARE_CHOOSE_COMPOSITE_RULE = "compare_choose_composite_g31_1";

export const COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY =
  "je veux acheter un nouveau smartphone, que me conseilles-tu ?";

/** Upgrade GPU avec contexte machine — budget optionnel (critère qualité/prix suffit). */
export const HARDWARE_UPGRADE_GUIDED_QUERY =
  "j'ai une GIGABYTES rtx 4060 8GB donc le projet c'est de changer de carte graphique avec le meilleure rapport qualité/prix qu'est-ce que tu pourrais me conseiller ????";

export const PRODUCT_RECOMMENDATION_REQUIRED_SLOTS = Object.freeze([
  "budget",
  "usage",
]);

const BUDGET_AMOUNT_RE =
  /\b(?:budget|moins de|max|maximum|jusqu['']?a|jusqu['']?à|environ|vers|autour de)\s*(?:de\s+)?(\d{2,5})\s*(?:€|euros?|eur)\b/i;

const BUDGET_INLINE_RE = /\b(\d{2,5})\s*(?:€|euros?|eur)\b/i;

const GPU_OR_CURRENT_PRODUCT_RE =
  /\b(?:rtx|gtx|rx)\s*\d{3,4}(?:\s*(?:ti|super|xt|xtx))?\b/i;

const QUALITY_PRICE_CRITERION_RE =
  /\b(?:rapport\s+qualit[eé][\s/-]*prix|qualit[eé][\s/-]*prix|meilleur\s+rapport|bon\s+rapport)\b/i;

const HARDWARE_UPGRADE_INTENT_RE =
  /\b(?:changer|upgrade|remplacer|passer\s+(?:sur|a|à)|conseill(?:er|es|e)|recommand(?:er|es|e))\b/i;

const USAGE_PATTERNS = Object.freeze([
  { id: "photo", re: /\b(?:photo|photographie|appareil photo|selfie)\b/i },
  { id: "gaming", re: /\b(?:jeu|jeux|gaming|gamer|rtx|gpu|carte graphique)\b/i },
  { id: "pro", re: /\b(?:pro|professionnel|travail|bureau|productivite|productivité)\b/i },
  { id: "video", re: /\b(?:video|vidéo|streaming|netflix|youtube)\b/i },
  { id: "autonomie", re: /\b(?:autonomie|batterie|endurance)\b/i },
  { id: "social", re: /\b(?:reseaux|reseau|réseaux|réseau|instagram|tiktok|snap)\b/i },
]);

const OS_PREFERENCE_RE =
  /\b(?:android|ios|iphone|apple|samsung|google pixel|pixel)\b/i;

/**
 * @param {string} query
 * @returns {{ budget: number|null, usage: string|null, osPreference: string|null }}
 */
export function extractProductRecommendationSlots(query = "") {
  const q = normalizeFamiliarityQuery(query);
  const budgetMatch = q.match(BUDGET_AMOUNT_RE) || q.match(BUDGET_INLINE_RE);
  const budget = budgetMatch ? Number(budgetMatch[1]) : null;

  let usage = null;
  for (const pattern of USAGE_PATTERNS) {
    if (pattern.re.test(q)) {
      usage = pattern.id;
      break;
    }
  }

  let osPreference = null;
  const osMatch = q.match(OS_PREFERENCE_RE);
  if (osMatch) {
    const token = osMatch[0].toLowerCase();
    if (token.includes("iphone") || token === "ios" || token === "apple") {
      osPreference = "ios";
    } else if (token.includes("android") || token.includes("samsung") || token.includes("pixel")) {
      osPreference = "android";
    } else {
      osPreference = token;
    }
  }

  return { budget, usage, osPreference };
}

/**
 * Upgrade matériel déjà cadré : produit actuel / GPU + usage + critère valeur.
 * Le budget chiffré n'est pas bloquant — le cycle passe en guided_recommendation + web.
 * @param {string} query
 * @param {{ budget: number|null, usage: string|null }} [slots]
 * @returns {boolean}
 */
export function hasHardwareUpgradeRecommendationContext(query = "", slots = null) {
  if (!isHardwareProductCompareQuery(query)) return false;
  if (!HARDWARE_UPGRADE_INTENT_RE.test(query) && !isCompareChooseRequest(query)) {
    return false;
  }

  const resolved = slots || extractProductRecommendationSlots(query);
  const hasCurrentProduct = GPU_OR_CURRENT_PRODUCT_RE.test(query);
  const hasUsage = Boolean(resolved.usage);
  const hasCriterion =
    QUALITY_PRICE_CRITERION_RE.test(query) || Boolean(resolved.budget);

  // GPU actuel + (usage inféré ou critère qualité/prix) → assez pour recommander
  if (hasCurrentProduct && (hasUsage || hasCriterion)) return true;
  // Domaine hardware + usage + critère valeur (même sans modèle nommé)
  if (hasUsage && hasCriterion) return true;

  return false;
}

/**
 * @param {string} query
 * @param {string} [domain]
 * @returns {string[]}
 */
export function getMissingProductRecommendationSlots(query = "", domain = "product") {
  if (domain !== "product") return [];
  if (hasExplicitWebProductRecoSignals(query)) return [];
  const slots = extractProductRecommendationSlots(query);
  if (hasHardwareUpgradeRecommendationContext(query, slots)) return [];
  const missing = [];
  if (!slots.budget) missing.push("budget");
  if (!slots.usage) missing.push("usage");
  return missing;
}

/**
 * @param {string[]} missingSlots
 * @returns {string}
 */
export function buildProductRecommendationClarifyReply(missingSlots = []) {
  const questions = [];
  if (missingSlots.includes("budget")) {
    questions.push("Quel **budget** vises-tu (fourchette en €) ?");
  }
  if (missingSlots.includes("usage")) {
    questions.push(
      "Quel **usage principal** (photo, jeux, pro, autonomie, réseaux…) ?",
    );
  }
  if (!questions.length) {
    return (
      "Pour te recommander un smartphone pertinent, précise ton **budget** et ton **usage principal**."
    );
  }
  return (
    "Pour te recommander un smartphone adapté, j'ai besoin de :\n\n" +
    questions.map((item, index) => `${index + 1}. ${item}`).join("\n") +
    "\n\nRéponds en une phrase — je te propose ensuite 2–3 modèles récents avec justification."
  );
}

/**
 * @param {string} segment
 * @returns {boolean}
 */
export function isCompareChooseSegment(segment = "") {
  return isCompareChooseRequest(segment);
}

/**
 * @param {string} segment
 * @returns {{
 *   domain: string,
 *   familyId: string,
 *   path: string,
 *   label: string,
 *   reply: string|null,
 *   satisfiable: boolean,
 *   strategy: string,
 *   segment: string,
 *   priority: number,
 *   task?: object|null,
 * }|null}
 */
export function detectCompareChooseIntent(segment = "") {
  if (!isCompareChooseSegment(segment)) return null;

  const slots = parseCompareChoose(segment);
  const domain = slots?.domain || extractCompareDomain(segment);
  const missing = getMissingProductRecommendationSlots(segment, domain);

  if (missing.length > 0) {
    const reply = buildProductRecommendationClarifyReply(missing);
    return {
      domain: "compare_choose",
      familyId: "product_recommendation",
      path: "compare_choose_clarify",
      label: "Recommandation produit",
      reply,
      satisfiable: true,
      strategy: RESPONSE_STRATEGIES.PARTIAL_CLARIFY,
      segment,
      priority: 36,
      task: {
        slots: extractProductRecommendationSlots(segment),
        missingSlots: missing,
        domain,
        compareChoose: slots,
      },
    };
  }

  return {
    domain: "compare_choose",
    familyId: slots?.domain === "product" ? "product_recommendation" : "compare_choose",
    path: "compare_choose",
    label: "Comparatif / recommandation",
    reply: null,
    satisfiable: false,
    strategy: "guided_recommendation",
    segment,
    priority: 36,
    task: {
      slots: domain === "product" ? extractProductRecommendationSlots(segment) : null,
      missingSlots: [],
      domain,
      compareChoose: slots,
    },
  };
}

/**
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").understandQuery>} understanding
 * @returns {boolean}
 */
export function shouldClarifyProductRecommendation(understanding) {
  const intent = understanding?.intents?.find(
    (item) => item.domain === "compare_choose" && !item.absorbable,
  );
  return intent?.path === "compare_choose_clarify";
}
