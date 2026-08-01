/**
 * Culture générale — demandes où Nexxus doit répondre comme une personne qui sait,
 * pas comme un moteur de mots-clés ni un questionnaire à 2 phrases.
 */
import {
  normalizeFamiliarityQuery,
  parseFamiliarityQuery,
  isPureSubjectFamiliarityQuery,
  inferSubjectCategory,
  SUBJECT_CATEGORIES,
  inferPlaceSubtype,
  PLACE_SUBTYPES,
  resolveKnownOrUnknownSubject,
} from "./familiarityIntentGuards.js";
import { hasExplicitDecisionCriterion } from "../micro/replies/directArbitrationComposerContract.js";
import { classifySelectiveDecisionIntent } from "./selectiveDecisionIntentGuards.js";
import { isAdminProcedureRequest } from "./adminProcedureIntentGuards.js";
import { isPhaticSocialCheckinIntent } from "../policies/social/index.js";
import { isRecipeKnowledgeRequest, extractRecipeSubject } from "./recipeKnowledgeIntentGuards.js";
import { isHowToRequestShell } from "./howToRequestIntentGuards.js";
import {
  extractPrimaryKnowledgeSubject,
  classifyKnowledgeDomain,
  hasCompoundKnowledgeAsk,
  KNOWLEDGE_DOMAINS,
} from "./queryEntityUnderstanding.js";
import {
  extractCulturalSummarySubject,
  isCulturalContentSummaryRequest,
} from "../policies/summary/index.js";
import { isLightCulturalRecognitionRequest } from "../policies/pedagogical/index.js";

export const GENERAL_KNOWLEDGE_ROUTING_RULE =
  "general_knowledge_generous_human_response";

const KNOWLEDGE_SHELL_PATTERN =
  /\b(?:connais|connaisse|connaitre|sais|savez|peux tu|tu peux|donne|donne moi|detaille|détailler|detailler|explique|decris|décris|parle moi|parle-moi|dis moi|dis-moi)\b/i;

const SUBSTANTIVE_ASK_PATTERN =
  /\b(?:recette|c'est quoi|c est quoi|qu'est ce que|qu est ce que|qu'est-ce que|definition|définition|histoire|origine|fonctionnement|caracteristiques|caractéristiques|en quoi consiste|a quoi sert|à quoi sert)\b/i;

const DOMAIN_MARKER_PATTERN =
  /\b(?:recette|plat|monument|cathedrale|cathédrale|basilique|musee|musée|vehicule|véhicule|voiture|montre|chaussure|basket|sneaker|pates|pâtes|mijote|mijoter|cuisine|architecte|construction)\b/i;

const CULINARY_ARTIFACT_PATTERN =
  /\b(?:bourguignon|carbonara|bolognaise|cacio e pepe|aglio e olio|pesto|ratatouille|tajine|couscous|paella|risotto|souffle|soufflé|quiche|tarte tatin|blanquette|cassoulet|gratin|ramen|sushi|curry|tiramisu|mousse au chocolat|cheesecake|macaron|eclair|éclair|clafoutis|crumble|profiterole)\b/i;

const LANDMARK_ARTIFACT_PATTERN =
  /\b(?:tour eiffel|sagrada familia|colisee|colisée|big ben|statue de la liberte|statue de la liberté|mont saint michel|versailles|louvre|arc de triomphe|notre dame|acropole|petra)\b/i;

const PRODUCT_ARTIFACT_PATTERN =
  /\b(?:model [0-9sxy]|tesla|porsche|ferrari|rolex|omega|nike|adidas|air max|yeezy|macbook|iphone|playstation|xbox)\b/i;

const AUTOMOTIVE_ARTIFACT_PATTERN =
  /\b(?:nissan|skyline|gtr|gt-?r|bmw|mercedes|audi|toyota|honda|ford|lamborghini|volkswagen|renault|peugeot|citroen)\b/i;

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

function isSelectiveDecisionBlocked(query = "") {
  const selective = classifySelectiveDecisionIntent(query);
  if (!selective.detected) return false;
  if (hasExplicitDecisionCriterion(query)) return true;
  return /\b(?:parmi|plus rapide|plus simple|meilleur|choisir|comparer|classement)\b/.test(
    normalizeQuery(query),
  );
}

/**
 * Sujet culturel concret (plat, monument, produit) — pas une familiarité pays/région brève.
 * @param {string} subject
 */
export function isCulturalArtifactSubject(subject = "") {
  const probe = normalizeQuery(subject);
  if (!probe || probe.length < 3) return false;

  if (
    CULINARY_ARTIFACT_PATTERN.test(probe) ||
    LANDMARK_ARTIFACT_PATTERN.test(probe) ||
    PRODUCT_ARTIFACT_PATTERN.test(probe) ||
    AUTOMOTIVE_ARTIFACT_PATTERN.test(probe)
  ) {
    return true;
  }

  if (classifyKnowledgeDomain("", probe) !== KNOWLEDGE_DOMAINS.UNKNOWN) {
    return true;
  }

  const category = inferSubjectCategory(probe, subject);
  if (category === SUBJECT_CATEGORIES.PLACE_INSTITUTION) {
    const subtype = inferPlaceSubtype(probe, category);
    return (
      subtype === PLACE_SUBTYPES.LANDMARK_SITE ||
      subtype === PLACE_SUBTYPES.INSTITUTION_MUSEUM ||
      subtype === PLACE_SUBTYPES.CITY_PLACE
    );
  }

  return DOMAIN_MARKER_PATTERN.test(probe);
}

/**
 * Familiarité pure pays/région — réponse brève conservée (« Tu connais l'Italie ? »).
 * @param {string} query
 */
export function isPureGeographicFamiliarity(query = "") {
  const parsed = parseFamiliarityQuery(query);
  if (!parsed || !isPureSubjectFamiliarityQuery(query, parsed)) return false;
  const subject = resolveKnownOrUnknownSubject(parsed.rawSubject);
  if (subject.category !== SUBJECT_CATEGORIES.PLACE_INSTITUTION) return false;
  return subject.placeSubtype === PLACE_SUBTYPES.COUNTRY_REGION;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractGeneralKnowledgeSubject(query = "") {
  const cultural = extractCulturalSummarySubject(query);
  if (cultural) return cultural;

  const primary = extractPrimaryKnowledgeSubject(query);
  if (primary) return primary;

  const recipeSubject = extractRecipeSubject(query);
  if (recipeSubject) return recipeSubject;

  const q = normalizeQuery(query);
  if (!q) return null;

  const whatPatterns = [
    /\b(?:c'est quoi|c est quoi|qu'est ce que|qu est ce que|qu'est-ce que)\s+(?:la |le |les |l')?([^?.!]+)/i,
    /\b(?:explique|decris|décris|parle moi de|parle-moi de|dis moi ce que tu sais sur|dis-moi ce que tu sais sur)\s+(?:la |le |les |l')?([^?.!]+)/i,
  ];
  for (const pattern of whatPatterns) {
    const match = q.match(pattern);
    const raw = String(match?.[1] || "").trim();
    if (raw.length >= 3) return raw.replace(/\s+/g, " ").trim();
  }

  const parsed = parseFamiliarityQuery(query);
  if (parsed?.rawSubject) {
    return String(parsed.rawSubject).replace(/\s+/g, " ").trim();
  }

  return null;
}

/**
 * Demande de culture générale substantielle — réponse humaine généreuse attendue.
 * @param {string} query
 * @returns {boolean}
 */
export function isGeneralKnowledgeRequest(query = "") {
  if (!query || isSelectiveDecisionBlocked(query)) return false;
  if (isLightCulturalRecognitionRequest(query)) return false;
  if (isPhaticSocialCheckinIntent(query)) return false;
  if (isCulturalContentSummaryRequest(query)) return true;
  if (isAdminProcedureRequest(query)) return false;
  if (isHowToRequestShell(query)) return false;
  if (isRecipeKnowledgeRequest(query)) return false;

  const q = normalizeQuery(query);
  if (!q) return false;

  if (isPureGeographicFamiliarity(query)) return false;

  if (hasCompoundKnowledgeAsk(query)) return true;

  const subject = extractGeneralKnowledgeSubject(query);

  if (SUBSTANTIVE_ASK_PATTERN.test(q) && subject) return true;
  if (KNOWLEDGE_SHELL_PATTERN.test(q) && DOMAIN_MARKER_PATTERN.test(q)) return true;

  if (KNOWLEDGE_SHELL_PATTERN.test(q) && subject && isCulturalArtifactSubject(subject)) {
    return true;
  }

  if (KNOWLEDGE_SHELL_PATTERN.test(q) && subject && !isPureSubjectFamiliarityQuery(query)) {
    return true;
  }

  return false;
}
