/**
 * Compréhension d'entité requête — classification domaine + score d'ambiguïté.
 * Évite les clarify-first « Forge / logiciel / jeu » quand le sujet est clair.
 */
import { normalizeFamiliarityQuery, parseFamiliarityQuery } from "./familiarityIntentGuards.js";
import { extractRecipeSubject } from "./recipeKnowledgeIntentGuards.js";

export const QUERY_ENTITY_UNDERSTANDING_RULE = "query_entity_domain_ambiguity_scoring";

export const KNOWLEDGE_DOMAINS = {
  AUTOMOTIVE: "automotive",
  CULINARY: "culinary",
  LANDMARK: "landmark",
  HOROLOGY: "horology",
  FOOTWEAR: "footwear",
  GENERAL: "general",
  UNKNOWN: "unknown",
};

const KNOWLEDGE_SHELL_PATTERN =
  /\b(?:connais|connaisse|connaitre|sais|savez|peux tu|tu peux)\b/i;

const COMPOUND_KNOWLEDGE_ASK_PATTERN =
  /\bet\s+(?:quelle|quel|quand|comment|pourquoi|c'est|c est|qu est)\b/i;

const FACTUAL_FOLLOWUP_PATTERN =
  /\b(?:annee|année|premier|premiere|origine|histoire|depuis|modele|modèle|quand|en quelle annee|en quelle année)\b/i;

const AUTOMOTIVE_PATTERN =
  /\b(?:nissan|skyline|gtr|gt-?r|bmw|mercedes|audi|toyota|honda|ford|porsche|ferrari|lamborghini|volkswagen|renault|peugeot|citroen|voiture|vehicule|véhicule|automobile|berline|coupe|coupé|supercar|hypercar)\b/i;

const CULINARY_PATTERN =
  /\b(?:recette|plat|cuisine|mijot|mijoter|bourguignon|carbonara|bolognaise|curry|magret|canard|tajine|couscous)\b/i;

const LANDMARK_PATTERN =
  /\b(?:tour eiffel|monument|cathedrale|cathédrale|basilique|musee|musée|colisee|colisée|sagrada|louvre|versailles)\b/i;

const HOROLOGY_PATTERN = /\b(?:rolex|omega|montre|horlogerie|chronographe)\b/i;
const FOOTWEAR_PATTERN = /\b(?:nike|adidas|chaussure|basket|sneaker|air max|yeezy)\b/i;
const TECH_BRAND_PATTERN =
  /\b(?:nothing\s*phone|nothing\s*tech|apple|samsung|google pixel|oneplus|xiaomi|huawei|marque)\b/i;

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

function stripLeadingArticle(text = "") {
  return String(text || "")
    .replace(/^(?:la |le |les |l'|un |une )/i, "")
    .trim();
}

/**
 * Extrait le sujet principal (avant une seconde question « et quelle… »).
 * @param {string} query
 * @returns {string|null}
 */
export function extractPrimaryKnowledgeSubject(query = "") {
  const recipeSubject = extractRecipeSubject(query);
  if (recipeSubject) return recipeSubject;

  const q = normalizeQuery(query);
  if (!q) return null;

  const compound = q.match(/^(.+?)\s+et\s+(?:quelle|quel|quand|comment|pourquoi|c'est|c est|qu est)\b/i);
  if (compound?.[1]) {
    const fromShell = extractFromFamiliarityShell(compound[1]);
    if (fromShell) return fromShell;
  }

  const whatMatch = q.match(
    /\b(?:c'est quoi|c est quoi|qu'est ce que|qu est ce que|qu'est-ce que)\s+(?:la |le |les |l')?([^?.!]+)/i,
  );
  if (whatMatch?.[1]) {
    return stripLeadingArticle(whatMatch[1].split(/\s+et\s+/i)[0]).trim();
  }

  const parsed = parseFamiliarityQuery(query);
  if (parsed?.rawSubject) {
    const primary = String(parsed.rawSubject)
      .split(/\s+et\s+(?:quelle|quel|quand|comment|pourquoi|c'est|c est|qu est)\b/i)[0]
      .trim();
    return stripLeadingArticle(primary) || null;
  }

  return null;
}

function extractFromFamiliarityShell(fragment = "") {
  const parsed = parseFamiliarityQuery(fragment);
  if (parsed?.rawSubject) {
    return stripLeadingArticle(parsed.rawSubject);
  }
  const match = String(fragment).match(
    /\b(?:connais|connaisse|sais)\s+(?:tu\s+)?(?:la |le |l')?(.+)/i,
  );
  if (match?.[1]) return stripLeadingArticle(match[1]);
  return null;
}

/**
 * @param {string} query
 * @param {string} [subject]
 * @returns {string}
 */
export function classifyKnowledgeDomain(query = "", subject = "") {
  const probe = `${normalizeQuery(query)} ${normalizeQuery(subject)}`.trim();

  if (AUTOMOTIVE_PATTERN.test(probe)) return KNOWLEDGE_DOMAINS.AUTOMOTIVE;
  if (CULINARY_PATTERN.test(probe)) return KNOWLEDGE_DOMAINS.CULINARY;
  if (LANDMARK_PATTERN.test(probe)) return KNOWLEDGE_DOMAINS.LANDMARK;
  if (HOROLOGY_PATTERN.test(probe)) return KNOWLEDGE_DOMAINS.HOROLOGY;
  if (FOOTWEAR_PATTERN.test(probe)) return KNOWLEDGE_DOMAINS.FOOTWEAR;
  if (TECH_BRAND_PATTERN.test(probe)) return KNOWLEDGE_DOMAINS.GENERAL;

  if (KNOWLEDGE_SHELL_PATTERN.test(probe) && subject) {
    return KNOWLEDGE_DOMAINS.GENERAL;
  }

  return KNOWLEDGE_DOMAINS.UNKNOWN;
}

/**
 * Score 0 = clair, 1 = très ambigu (clarification justifiée).
 * @param {string} query
 * @param {string} [subject]
 * @param {string} [domain]
 * @returns {number}
 */
export function scoreSubjectAmbiguity(query = "", subject = "", domain = KNOWLEDGE_DOMAINS.UNKNOWN) {
  if (!subject || subject.length < 2) return 0.85;

  const probe = `${normalizeQuery(query)} ${normalizeQuery(subject)}`;

  if (domain !== KNOWLEDGE_DOMAINS.UNKNOWN) {
    if (FACTUAL_FOLLOWUP_PATTERN.test(probe)) return 0.08;
    if (subject.split(/\s+/).length >= 2) return 0.1;
    return 0.18;
  }

  if (/^[a-z]{3,14}$/.test(normalizeQuery(subject))) return 0.72;

  return 0.45;
}

/**
 * Requête composée culture générale (« connais X et quelle est l'année… »).
 * @param {string} query
 */
export function hasCompoundKnowledgeAsk(query = "") {
  const q = normalizeQuery(query);
  return KNOWLEDGE_SHELL_PATTERN.test(q) && COMPOUND_KNOWLEDGE_ASK_PATTERN.test(q);
}

/**
 * @param {string} query
 */
export function resolveQueryEntityUnderstanding(query = "") {
  const primarySubject = extractPrimaryKnowledgeSubject(query);
  const domain = classifyKnowledgeDomain(query, primarySubject || "");
  const ambiguityScore = scoreSubjectAmbiguity(query, primarySubject || "", domain);

  return {
    primarySubject,
    domain,
    ambiguityScore,
    hasCompoundAsk: hasCompoundKnowledgeAsk(query),
    shouldClarifySubject: ambiguityScore >= 0.55,
    shouldBypassForgeClarification: ambiguityScore < 0.35 && domain !== KNOWLEDGE_DOMAINS.UNKNOWN,
  };
}

/**
 * @param {string} query
 */
export function shouldBypassForgeSubjectClarification(query = "") {
  const understanding = resolveQueryEntityUnderstanding(query);
  if (understanding.shouldBypassForgeClarification) return true;
  if (understanding.hasCompoundAsk && understanding.domain !== KNOWLEDGE_DOMAINS.UNKNOWN) {
    return true;
  }
  if (FACTUAL_FOLLOWUP_PATTERN.test(normalizeQuery(query)) && understanding.primarySubject) {
    return understanding.ambiguityScore < 0.5;
  }
  return false;
}
