/**
 * Politique d'enrichissement culture générale — recherche web optionnelle
 * quand la fiche locale est absente mais le sujet est clair.
 */
import { isGeneralKnowledgeRequest } from "../../utils/generalKnowledgeIntentGuards.js";
import { resolveQueryEntityUnderstanding } from "../../utils/queryEntityUnderstanding.js";
import { resolveLocalGeneralKnowledgeDetail } from "../../micro/replies/generalKnowledgeComposerContract.js";

export const GENERAL_KNOWLEDGE_ENRICHMENT_RULE =
  "prefer_web_research_when_local_fiche_missing";

const FACTUAL_DEPTH_PATTERN =
  /\b(?:annee|année|premier|premiere|origine|histoire|depuis|modele|modèle|quand|combien|caracteristiques|caractéristiques|specs|spécifications)\b/i;

/**
 * @param {string} query
 * @returns {{
 *   preferWebResearch: boolean,
 *   domain: string,
 *   subject: string|null,
 *   reason: string|null,
 * }}
 */
export function resolveGeneralKnowledgeEnrichmentPolicy(query = "") {
  if (!isGeneralKnowledgeRequest(query)) {
    return { preferWebResearch: false, domain: "unknown", subject: null, reason: null };
  }

  if (resolveLocalGeneralKnowledgeDetail(query)) {
    return {
      preferWebResearch: false,
      domain: "local_fiche",
      subject: null,
      reason: "local_fiche_hit",
    };
  }

  const understanding = resolveQueryEntityUnderstanding(query);
  const needsFactualDepth =
    FACTUAL_DEPTH_PATTERN.test(query) || understanding.hasCompoundAsk;

  const preferWebResearch =
    understanding.domain !== "unknown" &&
    understanding.ambiguityScore < 0.4 &&
    (needsFactualDepth || understanding.primarySubject);

  return {
    preferWebResearch,
    domain: understanding.domain,
    subject: understanding.primarySubject,
    reason: preferWebResearch ? "clear_entity_needs_external_facts" : "llm_only_sufficient",
  };
}
