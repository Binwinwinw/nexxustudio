/**
 * Demande d'information recette complète — « connais-tu la recette de X ».
 * Doctrine : réponse utile et détaillée, pas liste de mots-clés ni 2 phrases.
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { hasExplicitDecisionCriterion } from "../micro/replies/directArbitrationComposerContract.js";
import { classifySelectiveDecisionIntent } from "./selectiveDecisionIntentGuards.js";

export const RECIPE_KNOWLEDGE_ROUTING_RULE =
  "recipe_knowledge_request_generous_composer";

const RECIPE_MARKER = /\brecette\b/i;

const KNOWLEDGE_SHELL_PATTERN =
  /\b(?:connais|connaisse|connaitre|sais|savez|peux tu|tu peux|donne|donne moi|detaille|détailler|detailler|explique|decris|décris)\b/i;

const RECIPE_OF_PATTERN = /\brecette\s+(?:de|du|des|d')\b/i;

const HOW_TO_RECIPE_PATTERN =
  /\bcomment\s+(?:faire|preparer|préparer|cuire)\b/i;

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractRecipeSubject(query = "") {
  const q = normalizeQuery(query);
  if (!q) return null;

  const patterns = [
    /\brecette\s+(?:de|du|des|d')\s+(?:la |le |les |l')?([^?.!]+)/i,
    /\b(?:connais|connaisse|sais)\s+(?:tu\s+)?(?:la |le |l')?recette\s+(?:de|du|des|d')\s+(?:la |le |les |l')?([^?.!]+)/i,
    /\bcomment\s+(?:faire|preparer|préparer|cuire)\s+(?:la |le |l')?([^?.!]+)/i,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    const raw = String(match?.[1] || "").trim();
    if (raw.length >= 3) {
      return raw.replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

/**
 * Demande directe de recette (pas un comparatif / arbitrage).
 * @param {string} query
 * @returns {boolean}
 */
export function isRecipeKnowledgeRequest(query = "") {
  const q = normalizeQuery(query);
  if (!q || !RECIPE_MARKER.test(q)) return false;

  const selective = classifySelectiveDecisionIntent(query);
  if (selective.detected && hasExplicitDecisionCriterion(query)) {
    return false;
  }

  if (
    selective.detected &&
    /\b(?:parmi|plus rapide|plus simple|meilleur|choisir|comparer)\b/.test(q)
  ) {
    return false;
  }

  return (
    (KNOWLEDGE_SHELL_PATTERN.test(q) && RECIPE_OF_PATTERN.test(q)) ||
    (KNOWLEDGE_SHELL_PATTERN.test(q) && RECIPE_MARKER.test(q)) ||
    (HOW_TO_RECIPE_PATTERN.test(q) && RECIPE_MARKER.test(q)) ||
    RECIPE_OF_PATTERN.test(q)
  );
}
