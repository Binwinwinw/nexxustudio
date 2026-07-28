import { SUBJECT_NATURES } from "./subjectIntelligenceLayer.js";
import { resolveDeterministicRouteHint, DETERMINISTIC_ROUTES } from "./subjectRoutingHints.js";
import { assertDirectAnswerAllowed } from "./subjectAmbiguityContract.js";
import { isForgeProjectScopingQuery } from "./forgeProjectScoping.js";
import { shouldBypassForgeSubjectClarification } from "../../utils/queryEntityUnderstanding.js";
import { isGeneralKnowledgeRequest } from "../../utils/generalKnowledgeIntentGuards.js";

export const SUBJECT_ROUTER_ACTIONS = {
  SKIP: "skip",
  CLARIFY: "clarify",
  DISAMBIGUATE: "disambiguate",
  ALLOW_PROCEDURE: "allow_procedure",
  ROUTE_DETERMINISTIC: "route_deterministic",
};

/**
 * Plan d'action procédure — consomme uniquement l'état interprété (pas de NLP ici).
 * @param {{
 *   state: object,
 *   ambiguity: object,
 *   studioProcedure: boolean,
 *   formWithSubject: boolean,
 *   query?: string,
 * }} input
 */
export function planProcedureIntent(input = {}) {
  const { state, ambiguity, studioProcedure, formWithSubject, query = "" } = input;

  if (!studioProcedure && !formWithSubject) {
    return { action: SUBJECT_ROUTER_ACTIONS.SKIP, routeHint: null };
  }

  if (isForgeProjectScopingQuery(query)) {
    return {
      action: SUBJECT_ROUTER_ACTIONS.ALLOW_PROCEDURE,
      routeHint: DETERMINISTIC_ROUTES.FORGE_PROJECT_SCOPING_READY,
      kind: "forge_project_scoping_ready",
      blockInstallClarification: true,
    };
  }

  if (state.nature === SUBJECT_NATURES.COMPOSITE_MIXED) {
    return {
      action: SUBJECT_ROUTER_ACTIONS.CLARIFY,
      routeHint: DETERMINISTIC_ROUTES.SUBJECT_CLARIFY,
      reason: "composite_mixed_domain",
    };
  }

  if (state.nature === SUBJECT_NATURES.INTERNAL_STUDIO) {
    const routeHint = resolveDeterministicRouteHint(state);
    return {
      action: SUBJECT_ROUTER_ACTIONS.ALLOW_PROCEDURE,
      routeHint: routeHint || DETERMINISTIC_ROUTES.FORGE_PROCEDURE,
    };
  }

  const directGuard = assertDirectAnswerAllowed(state, ambiguity);
  if (!directGuard.ok) {
    return {
      action:
        ambiguity.candidateCount > 1
          ? SUBJECT_ROUTER_ACTIONS.DISAMBIGUATE
          : SUBJECT_ROUTER_ACTIONS.CLARIFY,
      routeHint: DETERMINISTIC_ROUTES.SUBJECT_DISAMBIGUATE,
      reason: directGuard.requiredAction,
    };
  }

  if (state.nature === SUBJECT_NATURES.PUBLIC_KNOWN) {
    const routeHint = resolveDeterministicRouteHint(state);
    return {
      action: SUBJECT_ROUTER_ACTIONS.ROUTE_DETERMINISTIC,
      routeHint: routeHint || DETERMINISTIC_ROUTES.SUBJECT_CLARIFY,
      fallbackAction: SUBJECT_ROUTER_ACTIONS.CLARIFY,
    };
  }

  if (state.nature === SUBJECT_NATURES.UNRESOLVED_PROPER) {
    return {
      action: SUBJECT_ROUTER_ACTIONS.CLARIFY,
      routeHint: DETERMINISTIC_ROUTES.SUBJECT_CLARIFY,
    };
  }

  return {
    action: SUBJECT_ROUTER_ACTIONS.ALLOW_PROCEDURE,
    routeHint: DETERMINISTIC_ROUTES.STUDIO_PROCEDURE,
  };
}

/**
 * Pour familiarité / QA — même contrat d'ambiguïté.
 * @param {object} state
 * @param {object} ambiguity
 */
export function planGeneralSubjectIntent(state, ambiguity) {
  if (state.nature === SUBJECT_NATURES.COMPOSITE_MIXED) {
    return {
      action: SUBJECT_ROUTER_ACTIONS.CLARIFY,
      routeHint: DETERMINISTIC_ROUTES.SUBJECT_CLARIFY,
      reason: "composite_mixed_domain",
    };
  }

  const directGuard = assertDirectAnswerAllowed(state, ambiguity);
  if (!directGuard.ok) {
    return {
      action:
        ambiguity.candidateCount > 1
          ? SUBJECT_ROUTER_ACTIONS.DISAMBIGUATE
          : SUBJECT_ROUTER_ACTIONS.CLARIFY,
      routeHint: DETERMINISTIC_ROUTES.SUBJECT_DISAMBIGUATE,
    };
  }
  const routeHint = resolveDeterministicRouteHint(state);
  if (routeHint) {
    return { action: SUBJECT_ROUTER_ACTIONS.ROUTE_DETERMINISTIC, routeHint };
  }
  return { action: SUBJECT_ROUTER_ACTIONS.SKIP, routeHint: null };
}

/**
 * Routage familiarité — même contrat d'ambiguïté, surface dédiée.
 * @param {object} interpreted — buildSubjectInterpretedState()
 * @param {{ kind?: string, rawSubject?: string }} [parsed]
 */
export function planFamiliaritySubjectIntent(interpreted = {}, parsed = {}, query = "") {
  const state = interpreted.state || {};
  const ambiguity = interpreted.ambiguity || {};
  const effectiveQuery = query || parsed.rawSubject || state.target || "";

  if (
    isGeneralKnowledgeRequest(effectiveQuery) ||
    shouldBypassForgeSubjectClarification(effectiveQuery)
  ) {
    return {
      action: SUBJECT_ROUTER_ACTIONS.SKIP,
      routeHint: null,
      surface: "familiarity",
      reason: "general_knowledge_clear_entity",
    };
  }

  const directGuard = assertDirectAnswerAllowed(state, ambiguity);
  if (!directGuard.ok) {
    return {
      action:
        ambiguity.candidateCount > 1
          ? SUBJECT_ROUTER_ACTIONS.DISAMBIGUATE
          : SUBJECT_ROUTER_ACTIONS.CLARIFY,
      routeHint: DETERMINISTIC_ROUTES.SUBJECT_DISAMBIGUATE,
      surface: "familiarity",
      reason: directGuard.requiredAction,
    };
  }

  if (state.memoryRecall && (state.entity?.label || state.target)) {
    return {
      action: SUBJECT_ROUTER_ACTIONS.ROUTE_DETERMINISTIC,
      routeHint: DETERMINISTIC_ROUTES.FAMILIARITY_SURFACE,
      sessionContinuity: true,
      confidence: state.confidence,
    };
  }

  if (state.nature === SUBJECT_NATURES.COMPOSITE_MIXED) {
    return {
      action: SUBJECT_ROUTER_ACTIONS.CLARIFY,
      routeHint: DETERMINISTIC_ROUTES.SUBJECT_CLARIFY,
      surface: "familiarity",
      reason: "composite_mixed_domain",
    };
  }

  if (
    state.resolvedEntityId ||
    state.nature === SUBJECT_NATURES.PUBLIC_KNOWN ||
    state.entity?.label
  ) {
    return {
      action: SUBJECT_ROUTER_ACTIONS.ROUTE_DETERMINISTIC,
      routeHint: DETERMINISTIC_ROUTES.FAMILIARITY_SURFACE,
      confidence: state.confidence,
      parsedKind: parsed.kind,
    };
  }

  if (state.nature === SUBJECT_NATURES.UNRESOLVED_PROPER) {
    return {
      action: SUBJECT_ROUTER_ACTIONS.CLARIFY,
      routeHint: DETERMINISTIC_ROUTES.SUBJECT_CLARIFY,
      surface: "familiarity",
    };
  }

  const general = planGeneralSubjectIntent(state, ambiguity);
  if (general.action !== SUBJECT_ROUTER_ACTIONS.SKIP) {
    return { ...general, surface: "familiarity" };
  }

  return {
    action: SUBJECT_ROUTER_ACTIONS.ROUTE_DETERMINISTIC,
    routeHint: DETERMINISTIC_ROUTES.FAMILIARITY_SURFACE,
    confidence: state.confidence,
    parsedKind: parsed.kind,
    fallback: true,
  };
}
