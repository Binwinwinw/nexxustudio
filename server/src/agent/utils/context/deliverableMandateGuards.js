/**
 * Mandat livrable — clarify_then_build légitime uniquement si action + ambiguïté réelle.
 */
import { normalizeFamiliarityQuery } from "../intent-guards/familiarityIntentGuards.js";
import { isExploratoryTopicIntent } from "../conversation/exploratoryConversationGuards.js";
import { isMetaAssistantBehaviorRequest } from "../intent-guards/metaAssistantBehaviorGuards.js";
import { isMetaConversationIntent } from "../intent-guards/metaConversationIntentGuards.js";
import { isHowToRequestShell } from "../intent-guards/howToRequestIntentGuards.js";
import { isExplicitTextCreationRequest } from "../intent-guards/informationSeekingIntentGuards.js";
import { isKnownSocialPattern } from "../../policies/social/index.js";

const DELIVERABLE_ACTION_RE =
  /\b(?:fais|faire|crée|cree|creer|génère|genere|prepare|prépare|organise|produis|produire|rédige|redige|construis|élabore|elabore|planifie|livre|fournis|écris|ecris|developpe|développe)\b/i;

const DELIVERABLE_FORMAT_RE =
  /\b(?:plan|rapport|document|pdf|slides|présentation|presentation|cours structuré|cours structure|programme|livrable|artefact|page html|fichier)\b/i;

/** Livrable documentaire/pédagogique nommé — seulement en combo action + sujet. */
const NAMED_DOCUMENTARY_DELIVERABLE_RE = /\b(?:fiches?|documentation)\b/i;

const TOPIC_LINKER_RE =
  /\b(?:à propos de|a propos de|au sujet de|concernant|sur)\s+/i;

const GENERIC_TOPIC_RE =
  /^(?:ça|ca|cela|ceci|truc|trucs|machin|quelque chose|un truc|des trucs|quoi)(?:\s*[?.!]*)?$/i;

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
 * Livrable documentaire nommé (formats existants + fiches/documentation).
 * Ne pas utiliser seul : uniquement via hasExplicitDeliverableAndSubject.
 */
export function hasNamedDocumentaryDeliverable(query = "") {
  const q = normalizeFamiliarityQuery(query);
  return hasDeliverableFormatHint(q) || NAMED_DOCUMENTARY_DELIVERABLE_RE.test(q);
}

/**
 * Sujet/objet après linker (à propos de / sur / concernant), non générique.
 */
export function hasExploitableNamedTopic(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!TOPIC_LINKER_RE.test(q)) return false;
  const match = q.match(
    /\b(?:à propos de|a propos de|au sujet de|concernant|sur)\s+(.+)$/i,
  );
  const topic = String(match?.[1] || "")
    .replace(/[?.!,;:]+$/g, "")
    .trim();
  if (!topic || GENERIC_TOPIC_RE.test(topic)) return false;
  if (/^(?:le|la|les|un|une|des|l|d|du|de)\s*$/i.test(topic)) return false;
  const content = topic
    .split(/\s+/)
    .filter((w) => !/^(?:le|la|les|un|une|des|l|d|du|de|la)$/i.test(w));
  return content.length >= 1 && content.join("").replace(/['’]/g, "").length >= 2;
}

/**
 * Intention de production + livrable nommé + sujet nommé.
 * Combinatoire : aucun signal isolé ne suffit.
 * Accents : sanitizeQuery via normalizeFamiliarityQuery retire les diacritiques ;
 * les linkers matchent ensuite la forme normalisée (ex. « a propos de »).
 * Sans sujet exploitable → combo volontairement inactive (V1). Un autre guard
 * routing peut vider le piste. Voir résidu PATCH-SIMPLE-FAST-EXPLICIT-DELIVERABLE-REFUSAL-BLOCK-V1.
 */
export function hasExplicitDeliverableAndSubject(query = "") {
  const q = normalizeFamiliarityQuery(query);
  return (
    hasDeliverableActionVerb(q) &&
    hasNamedDocumentaryDeliverable(q) &&
    hasExploitableNamedTopic(q)
  );
}

/**
 * @param {string} query
 * @param {object} [evaluation]
 * @returns {boolean}
 */
export function shouldAllowClarifyThenBuild(query = "", evaluation = {}) {
  if (isKnownSocialPattern(query)) return false;
  if (
    isExplicitTextCreationRequest(query, {
      history: evaluation.history || evaluation.conversationHistory || [],
    })
  ) {
    return false;
  }
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
