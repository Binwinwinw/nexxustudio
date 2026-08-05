/**
 * factualSanityGate — juge heuristique minimal (answer / clarify / abstain).
 * Couche plausibilité post-classification, avant simple_factual_lookup + LLM.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { isSimpleFactualQuestion } from "../../policies/intent/justIntentDetectionPolicy.js";
import { resolveAnaphoraReferenceShortCircuit } from "../continuity/anaphoraReferenceResolver.js";

export const FACTUAL_SANITY_DECISIONS = Object.freeze({
  PASS: "pass",
  CLARIFY: "clarify",
  ABSTAIN: "abstain",
});

const FACTUAL_GEO_QUESTION_RE =
  /\b(ou|où|dans quelle ville|dans quel pays|capitale|se trouve|situe|situé|localise|quelle est la|en quelle année|quand|combien)\b/i;

const FICTION_ENTITY_RE =
  /\b(poudlard|hogwarts|westeros|middle[- ]earth|terre du milieu|narnia|wakanda|panem|mordor|gotham|springfield fictif|royaume de westeros)\b/i;

const TYPO_TRAP_RE =
  /\b(tour de pizz|tour eiffel pizz|pizz\b.*\btour\b|\btour\b.*\bpizz\b)\b/i;

const BARE_ANAPHORA_RE =
  /^(?:ou|où)\s+se\s+trouve[- ]?ce\s*\??$/i;

const RULES = Object.freeze({
  FICTION_ENTITY: "fiction_entity",
  TYPO_OR_UNRECOGNIZED_LANDMARK: "typo_or_unrecognized_landmark",
  ANAPHORA_NO_ANTECEDENT: "anaphora_no_antecedent",
});

/**
 * @param {string} query
 * @returns {boolean}
 */
export function shouldRunFactualSanityGate(query = "") {
  if (isSimpleFactualQuestion(query)) return true;

  const q = normalizeFamiliarityQuery(query);
  if (!q) return false;

  return FICTION_ENTITY_RE.test(q) && FACTUAL_GEO_QUESTION_RE.test(q);
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role: string, content: string }> }} [options]
 * @returns {{
 *   decision: 'pass'|'clarify'|'abstain',
 *   reason: string|null,
 *   matchedRule: string|null,
 *   safeUserMessage: string|null,
 * }}
 */
export function evaluateFactualSanityGate(query = "", options = {}) {
  const q = normalizeFamiliarityQuery(query);
  const raw = String(query || "").trim();
  const history = options.history || [];

  if (!q) {
    return { decision: FACTUAL_SANITY_DECISIONS.PASS, reason: null, matchedRule: null, safeUserMessage: null };
  }

  if (FICTION_ENTITY_RE.test(q) && FACTUAL_GEO_QUESTION_RE.test(q)) {
    return {
      decision: FACTUAL_SANITY_DECISIONS.ABSTAIN,
      reason: "fictional_entity_in_factual_geo_question",
      matchedRule: RULES.FICTION_ENTITY,
      safeUserMessage:
        "Je ne reconnais pas ce repère comme un lieu réel. Tu parles d'un monument ou d'un lieu de fiction ?",
    };
  }

  if (BARE_ANAPHORA_RE.test(raw) || BARE_ANAPHORA_RE.test(q)) {
    const anaphora = resolveAnaphoraReferenceShortCircuit(query, history);
    if (!anaphora?.reply && !anaphora?.deferToLlm) {
      return {
        decision: FACTUAL_SANITY_DECISIONS.CLARIFY,
        reason: "location_anaphora_without_resolvable_antecedent",
        matchedRule: RULES.ANAPHORA_NO_ANTECEDENT,
        safeUserMessage: "Tu fais référence à quel lieu exactement ?",
      };
    }
  }

  if (TYPO_TRAP_RE.test(q)) {
    return {
      decision: FACTUAL_SANITY_DECISIONS.ABSTAIN,
      reason: "probable_landmark_typo_or_unrecognized_entity",
      matchedRule: RULES.TYPO_OR_UNRECOGNIZED_LANDMARK,
      safeUserMessage:
        "Je ne suis pas certain de quel monument tu parles. Tu veux dire la tour Eiffel ?",
    };
  }

  return {
    decision: FACTUAL_SANITY_DECISIONS.PASS,
    reason: null,
    matchedRule: null,
    safeUserMessage: null,
  };
}
