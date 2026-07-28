/**
 * G46.1 — acceptation d'une offre sociale précédente (ex. menu « code, doc, archi ou papoter »).
 * Relance ancrée dans la proposition assistant, pas une nouvelle demande métier.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { isSubstantiveWorkRequest } from "../../utils/genericGreetingGuards.js";

export const SOCIAL_ACCEPTANCE_OF_OFFER_RULE = "social_acceptance_of_offer_g46_1";

const ASSISTANT_SOCIAL_MENU_RE =
  /\b(?:code|doc|archi).{0,80}papot|papot(?:er|age).{0,80}(?:code|doc|archi)|simple papoter|exploration.{0,40}(?:debug|papot)|(?:debug|papot).{0,40}(?:exploration|ce soir)|mode exploration,?\s*debug,?\s*ou papotage\b/i;

const ACCEPT_PAPOTER_RE =
  /\b(?:(?:oui|ok|d['']accord|ben|bah|bon)[,.]?\s*)?(?:(?:on|tu)\s+(?:peut|peux|pourrait|pourrais|veux|voudrais|va|vais)\s+)?(?:papoter|discuter|bavarder|papotage)(?:\s+(?:alors|du coup|un peu|pour le moment|quand meme|quand même))?\b/i;

const BARE_ACCEPT_PAPOTER_RE =
  /^(?:papoter|discuter|bavarder)(?:\s+(?:alors|du coup|un peu))?\s*[?!.]*$/i;

const SUBSTANTIVE_PAPOTER_TOPIC_RE =
  /\b(?:papoter|discuter|bavarder)\s+(?:de|sur|avec|mon|ma|ton|ta|notre|leur|un|une|le|la|les)\b/i;

/**
 * @param {string} text
 */
function norm(text = "") {
  return normalizeFamiliarityQuery(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.*]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} assistantText
 * @returns {boolean}
 */
export function isAssistantSocialMenuOffer(assistantText = "") {
  return ASSISTANT_SOCIAL_MENU_RE.test(String(assistantText || ""));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isPapoterAcceptanceSurface(query = "") {
  const q = norm(query);
  if (!q || q.length < 6 || q.length > 120) return false;
  if (isSubstantiveWorkRequest(query)) return false;
  if (SUBSTANTIVE_PAPOTER_TOPIC_RE.test(q)) return false;
  return ACCEPT_PAPOTER_RE.test(q) || BARE_ACCEPT_PAPOTER_RE.test(q);
}

/**
 * @param {Array<{ role?: string, content?: string }>} history
 * @returns {string}
 */
function lastAssistantText(history = []) {
  const turns = Array.isArray(history) ? history : [];
  const last = [...turns]
    .reverse()
    .find((m) => m?.role === "assistant" || m?.role === "model");
  return String(last?.content || "");
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {boolean}
 */
export function isSocialAcceptanceOfOffer(query = "", history = []) {
  if (!isPapoterAcceptanceSurface(query)) return false;
  return isAssistantSocialMenuOffer(lastAssistantText(history));
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [ctx]
 * @returns {string}
 */
export function buildSocialAcceptanceOfOfferReply(query = "", ctx = {}) {
  void query;
  void ctx;
  return (
    "Oui, on peut papoter. " +
    "Je suis surtout utile sur dev, archi, LLM et doc, mais on peut aussi parler plus largement de ce qui t'intéresse. " +
    "On peut papoter de ce que tu construis dans La Citadelle, de comment j'évolue en ce moment, " +
    "ou d'un sujet tech/UX qui te tourne dans la tête. Tu penches vers quoi ?"
  );
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {{ path: string, reply: string, rule: string }|null}
 */
export function resolveSocialAcceptanceOfOfferShortCircuit(query = "", options = {}) {
  if (!isSocialAcceptanceOfOffer(query, options.history || [])) return null;
  return {
    path: "social_deterministic",
    reply: buildSocialAcceptanceOfOfferReply(query, options),
    rule: SOCIAL_ACCEPTANCE_OF_OFFER_RULE,
  };
}
