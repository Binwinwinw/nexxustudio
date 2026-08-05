/**
 * Nexxus — agent unique de traitement de requête et génération de réponse.
 *
 * Doctrine :
 * - Nexxus = une unité logique (comprendre → évaluer → chercher si besoin → répondre).
 * - Les modules internes (policies, experts, validators) sont des **capacités**, pas des décideurs.
 * - Le composer (finalRendererAgent) est la **bouche** de l'agent, pas un arbitre tardif.
 *
 * Cycle cognitif factorisé (source de vérité) :
 *   intent_assessment → evidence_requirement → retrieval_decision → response_commitment
 */
import {
  understandQuery,
  buildRequestWorkup,
  buildCognitiveCycle,
  applyWorkupRetrievalGate,
  COGNITIVE_CYCLE_RULE,
} from "./policies/conversation/conversationQueryUnderstanding.js";

export const NEXXUS_AGENT_RULE = "nexxus_single_agent_cycle_v1";

/** @deprecated Préférer NEXXUS_AGENT_RULE */
export const NEXXUS_AGENT_CYCLE_RULE = NEXXUS_AGENT_RULE;

export { COGNITIVE_CYCLE_RULE };

/** Étape 1 — comprendre la demande (structure, domaines, contraintes). */
export const understandRequest = understandQuery;

/** Étape 2 — évaluer intention + besoin de preuve → 4 blocs factorisés. */
export const assessIntentAndEvidenceNeed = buildRequestWorkup;

export { buildCognitiveCycle, applyWorkupRetrievalGate as decideRetrieval };

/** Étape 3 — décider retrieval + capacités outillées. */
export const decideRetrievalOrAction = applyWorkupRetrievalGate;

/**
 * Phases amont du tour agent (avant capacités externes).
 *
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {{ attachments?: unknown[], intentContractId?: string|null }} [options]
 */
export function runAgentUnderstandingPhase(query = "", history = [], options = {}) {
  const understanding = understandQuery(query, history, {
    attachments: options.attachments,
  });
  const cognitiveCycle = buildRequestWorkup(query, understanding, {
    intentContractId: options.intentContractId || null,
    attachments: options.attachments,
    forgeProduction: options.forgeProduction === true,
  });
  return { understanding, cognitiveCycle };
}

/**
 * Rôles des composants dans le modèle agent unique.
 * @readonly
 */
export const NEXXUS_COMPONENT_ROLES = Object.freeze({
  /** Décide — cerveau agent */
  AGENT_CORE: "agent_core",
  /** Exécute — web, mémoire, fichiers */
  CAPABILITY: "capability",
  /** Rend — bouche agent (pas de re-qualification) */
  MOUTH: "mouth",
  /** À migrer — décide encore en parallèle */
  LEGACY_DECIDER: "legacy_decider",
});
