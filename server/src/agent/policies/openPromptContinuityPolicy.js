/**
 * G42 — open prompt / idéation vs compare_choose (suppression + continuité « non merci »).
 */
import { normalizeFamiliarityQuery } from "../utils/familiarityIntentGuards.js";
import { isIdeationIntent, getIdeationDeterministicReply } from "../utils/ideationIntentGuards.js";
import { classifySocialPattern } from "./socialPatternPolicy.js";
import {
  composeMannerReply,
  RESPONSE_MANNER_FAMILIES,
} from "./responseMannerPolicy.js";

export const OPEN_PROMPT_CONTINUITY_RULE = "open_prompt_continuity_g42";

const DECLINE_PREFIX_RE =
  /\b(?:non merci|non,?\s*merci|pas besoin|ca ira|ça ira|non c est bon|non c'est bon|non ca me va|non ça me va)\b/i;

const OPEN_NEXT_STEP_RE =
  /\b(?:qu['']?est[- ]ce que tu (?:pourrais|peux) proposer|que (?:pourrais|peux)[- ]?tu (?:me )?proposer|qu['']?est[- ]ce qu['']?on (?:peut |pourrait )?(?:faire|attaquer|bosser)|on attaque quoi|autre chose|d['']?autres?|la suite|par quoi on continue|on continue sur quoi|proposer d['']?attaquer)\b/i;

const BARE_PROPOSER_RE =
  /\b(?:tu |que tu )?(?:pourrais|peux|voudrais)\s+(?:me\s+)?proposer\b/i;

const OPTIONS_VS_RE =
  /\b([^?,;]{2,40}?)\s+(?:vs|versus)\s+([^?,;]{2,40})\b/i;

const REAL_COMPARE_SIGNAL_RE =
  /\b(?:vs|versus|entre .{2,40} et |ou bien|lequel|laquelle|meilleur(?:e)?\s+(?:smartphone|gpu|voiture|montre|macbook|iphone)|carte graphique|redis|memcached|compar(?:er|aison|atif)|parmi\b)/i;

/**
 * @param {string} query
 * @returns {string}
 */
function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isDeclineContinuationPrompt(query = "") {
  const q = normalizeQuery(query);
  if (!q) return false;
  if (!DECLINE_PREFIX_RE.test(q)) return false;
  return (
    OPEN_NEXT_STEP_RE.test(q) ||
    BARE_PROPOSER_RE.test(q) ||
    isIdeationIntent(query)
  );
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isOpenNextStepPrompt(query = "") {
  const q = normalizeQuery(query);
  if (!q || q.length < 12) return false;
  if (REAL_COMPARE_SIGNAL_RE.test(q)) return false;
  if (OPTIONS_VS_RE.test(q)) return false;

  if (OPEN_NEXT_STEP_RE.test(q)) return true;
  if (BARE_PROPOSER_RE.test(q) && !REAL_COMPARE_SIGNAL_RE.test(q)) return true;
  if (classifySocialPattern(query)?.patternName === "social/open_prompt") return true;

  return false;
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [ctx]
 * @returns {boolean}
 */
export function suppressesCompareChooseForOpenPrompt(query = "", ctx = {}) {
  if (isDeclineContinuationPrompt(query)) return true;
  if (isOpenNextStepPrompt(query)) return true;
  if (isIdeationIntent(query)) return true;
  if (classifySocialPattern(query)?.patternName === "social/open_prompt") {
    return true;
  }

  const q = normalizeQuery(query);
  if (BARE_PROPOSER_RE.test(q) && !REAL_COMPARE_SIGNAL_RE.test(q)) {
    return true;
  }

  return false;
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {string|null}
 */
export function buildDeclineContinuationReply(query = "", options = {}) {
  if (!isDeclineContinuationPrompt(query) && !isOpenNextStepPrompt(query)) {
    return null;
  }

  if (isDeclineContinuationPrompt(query)) {
    return composeMannerReply({
      family: RESPONSE_MANNER_FAMILIES.OPEN_PROMPT_NEXT_STEPS,
      history: options.history || [],
      salt: query,
    });
  }

  return getIdeationDeterministicReply(query);
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {{ path: string, reply: string, declineContinuation?: boolean, openPromptContinuity?: boolean }|null}
 */
export function resolveOpenPromptContinuityShortCircuit(query = "", options = {}) {
  const declineReply = buildDeclineContinuationReply(query, options);
  if (declineReply) {
    return {
      path: isDeclineContinuationPrompt(query)
        ? "open_prompt_continuity"
        : "ideation_deterministic",
      reply: declineReply,
      declineContinuation: isDeclineContinuationPrompt(query),
      openPromptContinuity: true,
    };
  }

  if (isIdeationIntent(query)) {
    const ideationReply = getIdeationDeterministicReply(query);
    if (ideationReply) {
      return {
        path: "ideation_deterministic",
        reply: ideationReply,
        openPromptContinuity: true,
      };
    }
  }

  return null;
}
