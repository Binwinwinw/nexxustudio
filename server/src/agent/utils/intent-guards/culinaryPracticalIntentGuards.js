/**
 * @deprecated Préférer selectiveDecisionIntentGuards — conservé pour tests culinaires ciblés.
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { requiresFullPipelineForDecision } from "./selectiveDecisionIntentGuards.js";

export const CULINARY_PRACTICAL_ADVICE_RULE =
  "culinary_practical_advice_full_pipeline";

const CULINARY_DOMAIN_PATTERN =
  /\b(recette|recettes|cuisine|plat|plats|pates|pâtes|spaghetti|risotto|pesto|carbonara|amatriciana|cuire|cuisiner|preparer|préparer|ingredient|ingrédient|ingredients|ingrédients)\b/i;

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isCulinaryPracticalAdviceQuery(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || !CULINARY_DOMAIN_PATTERN.test(q)) return false;
  return requiresFullPipelineForDecision(query);
}
