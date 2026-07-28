import { resolveSubjectIntelligence } from "./subjectIntelligenceLayer.js";
import { evaluateAmbiguityContract, AMBIGUITY_CONTRACT_RULE } from "./subjectAmbiguityContract.js";
import { resolveMiniResearch } from "./miniResearchGate.js";
import {
  applySessionMemoryToState,
  extractAndRememberProjectAnchor,
  rememberResolvedSubject,
} from "./subjectSessionMemory.js";
import { SUBJECT_CONFIDENCE } from "./subjectConfidence.js";
import { SUBJECT_NATURES } from "./subjectIntelligenceLayer.js";
import { sessionProjectEntityId } from "./subjectEntityIds.js";
import { resolveDeliberationPolicy } from "./subjectDeliberationPolicy.js";
import { classifyConversationTurn } from "../classifiers/conversationTurnType.js";

/**
 * État du monde interprété — couche pure, sans décision métier ni texte utilisateur.
 * @param {{ query?: string, extractedSubject?: string|null, sessionId?: string|null, sessionContext?: object }} input
 */
export function buildSubjectInterpretedState(input = {}) {
  const sessionId = input.sessionId ?? null;
  const turn =
    input.turn ||
    classifyConversationTurn(input.query || "", { history: input.history || [] });

  const projectAnchor =
    turn.disableSubjectCarryOver
      ? null
      : extractAndRememberProjectAnchor(input.query || "", sessionId);

  let state = resolveSubjectIntelligence({ ...input, turn });

  if (projectAnchor && state.canonical === projectAnchor.canonical) {
    state = {
      ...state,
      nature: SUBJECT_NATURES.INTERNAL_STUDIO,
      resolvedEntityId: projectAnchor.resolvedEntityId,
      confidence: SUBJECT_CONFIDENCE.HIGH,
      ambiguous: false,
      source: "project_anchor",
    };
  }

  if (!turn.disableSubjectCarryOver) {
    state = applySessionMemoryToState(state, sessionId);
  }

  if (
    state.resolvedEntityId &&
    state.confidence === SUBJECT_CONFIDENCE.HIGH &&
    !state.ambiguous &&
    !turn.disableSubjectCarryOver
  ) {
    rememberResolvedSubject(sessionId, {
      resolvedEntityId: state.resolvedEntityId,
      canonical: state.canonical,
      target: state.target,
      label: state.entity?.label ?? state.target,
      nature: state.nature,
      confidence: state.confidence,
    });
  }

  const ambiguity = evaluateAmbiguityContract(state);
  const research = {
    candidates: state.candidates?.length ? state.candidates : state.entity ? [state.entity] : [],
    confidence: state.confidence,
    nature: state.nature,
    usage: state.usage,
    ambiguous: state.ambiguous,
    needsAsyncWebLookup:
      state.confidence === SUBJECT_CONFIDENCE.LOW &&
      state.nature === SUBJECT_NATURES.UNRESOLVED_PROPER,
    resolution: state,
    sources: [{ type: "local", confidence: state.confidence }],
  };

  const policy = resolveDeliberationPolicy({ state, ambiguity }, input.query || "");

  return {
    state,
    ambiguity,
    research,
    contract: AMBIGUITY_CONTRACT_RULE,
    projectAnchor,
    policy,
    turn,
  };
}

/**
 * Attache resolvedEntityId si manquant (projet session).
 * @param {object} state
 */
export function ensureResolvedEntityId(state) {
  if (state.resolvedEntityId) return state.resolvedEntityId;
  if (state.nature === SUBJECT_NATURES.INTERNAL_STUDIO && state.canonical) {
    if (state.entity?.resolvedEntityId) return state.entity.resolvedEntityId;
    if (state.source === "session_project_match" || state.source === "project_anchor") {
      return sessionProjectEntityId(state.canonical);
    }
  }
  return state.entity?.resolvedEntityId ?? null;
}
