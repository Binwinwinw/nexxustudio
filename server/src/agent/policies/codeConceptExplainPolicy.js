/**
 * G40 — explain concept technique vs code_generation / summary/known_entity.
 * « rôle de import », « résumé du rôle de div » → explication, pas œuvre culturelle ni livraison code.
 */
import { normalizeFamiliarityQuery } from "../utils/familiarityIntentGuards.js";

const CONCEPT_ROLE_SHELL_RE =
  /\b(?:resume|resumé|résumé|synthese|synthèse|summary)\s+(?:du|de\s+la|de\s+l|d)?\s*(?:role|rôle)\b/i;

const ROLE_OF_CONCEPT_RE =
  /\b(?:role|rôle)\s+(?:de|d['']|des|du)\s+/i;

// sanitizeQuery retire les apostrophes → « qu'est-ce qu'une » = « qu est ce qu une »
const CONCEPT_EXPLAIN_SHELL_RE =
  /\b(?:explique|expliquer|a quoi sert|à quoi sert|qu est ce que|qu est ce qu (?:un|une)|qu['']est[- ]ce que|qu['']est[- ]ce qu['']?(?:un|une)|c est quoi|c['']est quoi|definition|définition|definir|définir)\b/i;

const PROGRAMMING_FILE_CONTEXT_RE =
  /\b(?:fichier|fichiers|script|module|syntaxe|instruction|mot[- ]clé|mot cle|balise|élément|element|tag)\s+(?:python|javascript|typescript|html|css|java|php|\.py|\.js|\.html|\.css)\b/i;

const IN_PROGRAMMING_FILE_RE =
  /\bdans\s+un\s+fichier\s+(?:python|javascript|typescript|html|\.py|\.js)\b/i;

const PROGRAMMING_LANG_RE =
  /\b(?:python|javascript|typescript|html|css|java|php|\.py\b|\.js\b|\.html\b|\bjs\b)\b/i;

const SYNTAX_CONCEPT_TOKEN_RE =
  /\b(?:import|from|async|await|def|class|const|let|var|function|fonction|return|yield|div|span|nav|header|footer|section|article|main|aside|ul|ol|li|p|a|img|form|input|button|select|option|textarea|label|table|tr|td|th|thead|tbody|try|except|raise|with|lambda|interface|type|enum|struct|package|namespace|using|include|require)\b/i;

/** Concepts process / ingénierie (spec, ADR…) — hors syntaxe langage. */
const PROCESS_CONCEPT_TOKEN_RE =
  /\b(?:mini[- ]?specs?|specifications?|specs?|adrs?|rfcs?|backlog|user\s*stor(?:y|ies)|definition of done|\bdod\b)\b/i;

const DEV_PROCESS_CONTEXT_RE =
  /\b(?:langage de d[eé]veloppement|d[eé]veloppement(?:\s+logiciel)?|software|ing[eé]nierie|m[eé]thodologie|projet (?:tech|logiciel)|doctrine|contrat de sortie)\b/i;

const CONCEPT_COMPARE_RE =
  /\b(?:difference|différence|différences)\s+entre\b/i;

const CODE_DELIVERY_VERB_RE =
  /\b(?:genere|génère|genère|ecris|écris|ecrire|écrire|cree|crée|creer|créer|developpe|développe|implemente|implémente|code complet|livre le code|donne le code|produis le code|ecris moi|écris moi)\b/i;

const WORK_CULTURAL_MARKER_RE =
  /\b(?:film|films|movie|livre|livres|book|roman|serie|series|série|séries|album|documentaire|episode|épisode|chanson)\b/i;

/**
 * @param {string} query
 * @returns {string}
 */
function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * Demande d'explication d'un concept / syntaxe / rôle — pas génération de code ni résumé d'œuvre.
 * @param {string} query
 * @returns {boolean}
 */
export function isCodeConceptExplainRequest(query = "") {
  const q = normalizeQuery(query);
  if (!q || q.length < 15) return false;

  if (WORK_CULTURAL_MARKER_RE.test(q)) return false;
  if (CODE_DELIVERY_VERB_RE.test(q)) return false;

  const programmingContext =
    PROGRAMMING_FILE_CONTEXT_RE.test(q) ||
    IN_PROGRAMMING_FILE_RE.test(q) ||
    (PROGRAMMING_LANG_RE.test(q) && SYNTAX_CONCEPT_TOKEN_RE.test(q));

  if (CONCEPT_ROLE_SHELL_RE.test(q) && (programmingContext || SYNTAX_CONCEPT_TOKEN_RE.test(q))) {
    return true;
  }

  if (ROLE_OF_CONCEPT_RE.test(q) && (programmingContext || SYNTAX_CONCEPT_TOKEN_RE.test(q))) {
    return true;
  }

  if (
    CONCEPT_EXPLAIN_SHELL_RE.test(q) &&
    SYNTAX_CONCEPT_TOKEN_RE.test(q) &&
    (programmingContext || PROGRAMMING_LANG_RE.test(q))
  ) {
    return true;
  }

  // « qu'est-ce qu'une spec / mini-spec » (contexte dév optionnel mais non requis)
  if (CONCEPT_EXPLAIN_SHELL_RE.test(q) && PROCESS_CONCEPT_TOKEN_RE.test(q)) {
    return true;
  }

  // Filet : deux définitions process dans la même phrase (« … une spec … un mini-spec »)
  if (
    PROCESS_CONCEPT_TOKEN_RE.test(q) &&
    DEV_PROCESS_CONTEXT_RE.test(q) &&
    /\b(?:qu est ce|c est quoi|definition|definition|explique)\b/i.test(q)
  ) {
    return true;
  }

  if (
    /\b(?:resume|resumé|résumé)\b/i.test(q) &&
    SYNTAX_CONCEPT_TOKEN_RE.test(q) &&
    programmingContext
  ) {
    return true;
  }

  if (
    CONCEPT_COMPARE_RE.test(q) &&
    SYNTAX_CONCEPT_TOKEN_RE.test(q) &&
    (programmingContext || PROGRAMMING_LANG_RE.test(q))
  ) {
    return true;
  }

  return false;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function suppressesCulturalSummaryForConceptExplain(query = "") {
  return isCodeConceptExplainRequest(query);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function suppressesCodeGenerationForConceptExplain(query = "") {
  return isCodeConceptExplainRequest(query);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isCodeConceptExplainTriageSignal(query = "") {
  return isCodeConceptExplainRequest(query);
}
