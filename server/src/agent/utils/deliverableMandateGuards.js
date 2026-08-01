/**
 * Mandat livrable — clarify_then_build légitime uniquement si action + ambiguïté réelle.
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { isExploratoryTopicIntent } from "./exploratoryConversationGuards.js";
import { isMetaAssistantBehaviorRequest } from "./metaAssistantBehaviorGuards.js";
import { isMetaConversationIntent } from "./metaConversationIntentGuards.js";
import { isHowToRequestShell } from "./howToRequestIntentGuards.js";
import { isKnownSocialPattern } from "../policies/social/index.js";

const DELIVERABLE_ACTION_RE =
  /\b(?:fais|faire|crée|cree|creer|génère|genere|prepare|prépare|organise|produis|produire|rédige|redige|construis|élabore|elabore|planifie|livre|fournis|écris|ecris|developpe|développe)\b/i;

const DELIVERABLE_FORMAT_RE =
  /\b(?:plan|rapport|document|pdf|slides|présentation|presentation|cours structuré|cours structure|programme|livrable|artefact|page html|fichier)\b/i;

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasDeliverableActionVerb(query = "") {
  return DELIVERABLE_ACTION_RE.test(normalizeFamiliarityQuery(query));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasDeliverableFormatHint(query = "") {
  return DELIVERABLE_FORMAT_RE.test(normalizeFamiliarityQuery(query));
}

/**
 * @param {string} query
 * @param {object} [evaluation]
 * @returns {boolean}
 */
export function shouldAllowClarifyThenBuild(query = "", evaluation = {}) {
  if (isKnownSocialPattern(query)) return false;
  if (isMetaAssistantBehaviorRequest(query)) return false;
  if (isMetaConversationIntent(query)) return false;
  if (isExploratoryTopicIntent(query)) return false;
  if (isHowToRequestShell(query)) return false;

  const q = normalizeFamiliarityQuery(query);
  const explainIntent =
    evaluation.intent === "explain" ||
    (evaluation.domain === "general" && evaluation.intent !== "create");

  if (explainIntent && !hasDeliverableActionVerb(q)) {
    return false;
  }

  if (hasDeliverableActionVerb(q) || hasDeliverableFormatHint(q)) {
    return true;
  }

  return false;
}
