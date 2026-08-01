/**
 * Familiarité — consomme Subject Intelligence Layer (état → router → builder).
 */
import {
  isFamiliarityIntent,
  isFamiliarityDomainOverviewRequest,
  isPureSubjectFamiliarityQuery,
  parseFamiliarityQuery,
  resolveKnownOrUnknownSubject,
  buildFamiliarityBodyForSubject,
  getFamiliarityDeterministicReply,
} from "../../utils/familiarityIntentGuards.js";
import {
  hasStaticLexiconEntry,
} from "../../utils/familiarityIntentGuards.js";
import { observeLexiconLearning } from "../lexicon/lexiconLearningOrchestrator.js";
import { buildSubjectInterpretedState } from "../subject/subjectInterpretedState.js";
import {
  planFamiliaritySubjectIntent,
  SUBJECT_ROUTER_ACTIONS,
} from "../subject/subjectIntentRouter.js";
import { buildSubjectClarificationReply } from "../subject/subjectResponseBuilder.js";
import { DETERMINISTIC_ROUTES } from "../subject/subjectRoutingHints.js";
import { SUBJECT_CONFIDENCE } from "../subject/subjectConfidence.js";
import { shouldAffirmResolution } from "../subject/subjectConfidence.js";
import { isGeneralKnowledgeRequest } from "../../utils/generalKnowledgeIntentGuards.js";
import { isInformationSeekingWithTarget } from "../../utils/informationSeekingIntentGuards.js";
import { isTranslationRequest } from "../../utils/translationIntentGuards.js";
import {
  resolveSubjectTyping,
  buildSubjectTypeClarifyReply,
} from "../../policies/qualification/subjectTypingPolicy.js";

/**
 * Fusionne résolution SIL + lexique familiarité.
 * @param {object} parsed
 * @param {object} state
 */
export function mergeFamiliaritySubject(parsed = {}, state = {}) {
  const base = resolveKnownOrUnknownSubject(parsed.rawSubject || "");
  const entity = state.entity;
  if (!entity?.label && !entity?.definition) {
    return base;
  }
  return {
    ...base,
    known: true,
    label: entity.label || base.label,
    definition: entity.definition || base.definition,
    category: base.category,
    placeSubtype: base.placeSubtype ?? null,
    personSubtype: base.personSubtype ?? null,
  };
}

/**
 * @param {string} body
 * @param {{ sessionContinuity?: boolean, confidence?: string, label?: string }} meta
 */
export function applyFamiliarityPresentation(body = "", meta = {}) {
  let text = String(body || "").trim();
  const label = meta.label;

  if (meta.sessionContinuity && label) {
    text = [
      `Tu fais suite à **${label}**, déjà ancré dans cette session.`,
      "",
      text,
    ].join("\n");
  } else if (
    meta.confidence &&
    meta.confidence !== SUBJECT_CONFIDENCE.HIGH &&
    !shouldAffirmResolution(meta.confidence) &&
    label
  ) {
    text = text.replace(
      /^Oui, je connais /i,
      `Oui — **${label}** semble être le sujet visé ; je connais `,
    );
  }

  return text;
}

/**
 * @param {object} interpreted
 * @param {object} parsed
 * @param {object} plan
 */
export function buildFamiliaritySurfaceReply(interpreted = {}, parsed = {}, plan = {}) {
  const state = interpreted.state || {};
  const subject = mergeFamiliaritySubject(parsed, state);
  const body = buildFamiliarityBodyForSubject(subject, parsed);
  return applyFamiliarityPresentation(body, {
    sessionContinuity: plan.sessionContinuity,
    confidence: plan.confidence ?? state.confidence,
    label: subject.label || state.target,
  });
}

function recordLexiconObservation(query, parsed, subject, options = {}) {
  if (options.lexiconLearning === false) return;
  try {
    observeLexiconLearning({
      query,
      parsed,
      subject,
      sessionId: options.sessionId,
      hasStaticLexiconEntry,
    });
  } catch {
    /* fail-closed */
  }
}

/**
 * @param {string} query
 * @param {{ sessionId?: string|null, sessionContext?: object, lexiconLearning?: boolean }} [options]
 * @returns {string|null}
 */
export function buildFamiliarityReply(query = "", options = {}) {
  if (isTranslationRequest(query)) return null;
  if (isInformationSeekingWithTarget(query)) return null;
  if (isGeneralKnowledgeRequest(query)) return null;
  if (!isFamiliarityIntent(query)) return null;

  const parsed = parseFamiliarityQuery(query);
  if (!parsed || !isPureSubjectFamiliarityQuery(query, parsed)) return null;

  if (isFamiliarityDomainOverviewRequest(query)) {
    const domainReply = getFamiliarityDeterministicReply(query, options);
    if (domainReply) {
      recordLexiconObservation(
        query,
        parsed,
        mergeFamiliaritySubject(parsed, null),
        options,
      );
      return domainReply;
    }
  }

  const subjectTyping = resolveSubjectTyping(parsed.rawSubject);
  if (subjectTyping.requires_subject_disambiguation) {
    const clarify = buildSubjectTypeClarifyReply(subjectTyping);
    if (clarify) return clarify;
  }

  const interpreted = buildSubjectInterpretedState({
    query,
    extractedSubject: parsed.rawSubject,
    sessionId: options.sessionId,
    sessionContext: options.sessionContext,
  });

  const plan = planFamiliaritySubjectIntent(interpreted, parsed, query);

  if (
    plan.action === SUBJECT_ROUTER_ACTIONS.CLARIFY ||
    plan.action === SUBJECT_ROUTER_ACTIONS.DISAMBIGUATE
  ) {
    const clarification = buildSubjectClarificationReply(
      interpreted.state,
      interpreted.ambiguity,
      { routeHint: plan.routeHint },
    );
    if (clarification) {
      recordLexiconObservation(query, parsed, mergeFamiliaritySubject(parsed, interpreted.state), options);
      return clarification;
    }
  }

  if (
    plan.action === SUBJECT_ROUTER_ACTIONS.ROUTE_DETERMINISTIC &&
    plan.routeHint === DETERMINISTIC_ROUTES.FAMILIARITY_SURFACE
  ) {
    const reply = buildFamiliaritySurfaceReply(interpreted, parsed, plan);
    if (reply) {
      recordLexiconObservation(query, parsed, mergeFamiliaritySubject(parsed, interpreted.state), options);
      return reply;
    }
  }

  return getFamiliarityDeterministicReply(query, options);
}

/** @deprecated alias */
export { getFamiliarityDeterministicReply };
