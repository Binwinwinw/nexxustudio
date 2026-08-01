/**
 * Garde-fous contre les réponses d'accueil génériques sur des demandes de travail substantielles.
 */
import { normalizeText } from "./normalizationGuards.js";
import responseThinkingCleaner from "./responseThinkingCleaner.js";
import { requiresGenerousComposerResponse } from "../policies/practicalAdviceRoutingGuard.js";
import { isSimpleFactualQuestion } from "../policies/justIntentDetectionPolicy.js";
import {
  getFamiliarityDeterministicReply,
  isFamiliarityIntent,
  parseFamiliarityQuery,
} from "./familiarityIntentGuards.js";
import {
  resolveLocalSimpleFactualAnswer,
  buildSimpleFactualDirectFallback,
  enforceSimpleFactualDirectness,
} from "../micro/replies/simpleFactualComposer.js";
import {
  buildDebugDiagnosticDirectFallback,
  enforceDebugDiagnosticDirectness,
} from "../micro/replies/debugDiagnosticComposer.js";
import { isDebugDiagnosticRequest } from "./debugDiagnosticIntentGuards.js";
import {
  buildMathExplainRecoveryMessage,
  isMathExplainRequest,
  resolveMathExplainLocalFallback,
  resolveMathSimpleShortCircuit,
  resolveMathRootShortCircuit,
  resolveMathPercentShortCircuit,
  resolveMathGeometryShortCircuit,
} from "../policies/math/index.js";
import { resolveQueryCompositeShortCircuit } from "../policies/conversationQueryUnderstanding.js";
import {
  buildDocumentSynthesisRecoveryMessage,
  hasDocumentSynthesisShell,
  resolveDocumentSynthesisBypassReply,
} from "../policies/document/index.js";
import {
  buildFamiliarityDomainOverviewRecoveryMessage,
  isFamiliarityDomainOverviewSatisfiable,
  buildSubjectReferenceResumeRecoveryMessage,
} from "../policies/familiarity/index.js";
import {
  buildCurrentWebFactRecoveryMessage,
  isCurrentWebFactRequest,
} from "../policies/currentWebFactPolicy.js";
import {
  buildWeatherCurrentRecoveryMessage,
  isWeatherCurrentRequest,
} from "../policies/weatherCurrentRequestPolicy.js";
import {
  buildPedagogySoftOverviewRecoveryMessage,
  isPedagogySoftOverviewSatisfiable,
} from "../policies/pedagogical/index.js";
import {
  buildPromptForArtifactRecoveryMessage,
  isPromptForArtifactSatisfiable,
} from "../policies/delivery/index.js";
import { isSubjectReferenceAvailabilityRequest } from "../micro/continuity/sessionSubjectReferenceGuards.js";
import { isGeneralKnowledgeRequest } from "./generalKnowledgeIntentGuards.js";
import { isPedagogicalOverviewRequest } from "./pedagogicalOverviewIntentGuards.js";
import { isConversationSocialOnlyQuery } from "../policies/conversationIntentFrame.js";
import { isKnownSocialPattern } from "../policies/social/index.js";
import { suppressesSocialForInformationSeeking } from "./informationSeekingIntentGuards.js";
import {
  buildConversationContinuityContext,
  isSubstantiveContinuityAcceptance,
  isConversationContinuityFollowup,
} from "../micro/continuity/conversationContinuityContext.js";
import { assessConversationTopicShift } from "../micro/continuity/topicShiftGuard.js";

export const GENERIC_READY_GREETING =
  "Tout est prêt. Sur quoi travaillons-nous ? 😄";

export function isGenericReadyGreeting(text = "") {
  return String(text).includes("Tout est prêt. Sur quoi travaillons-nous");
}

/**
 * Détecte une intention de travail claire (livrable, contraintes, format).
 */
export function isSubstantiveWorkRequest(query = "") {
  const q = normalizeText(query);
  if (!q) return false;

  const actionVerbs =
    /(génère|genere|écris|ecris|crée|créer|cree|implémente|implemente|développe|developpe|programme|construis|fabrique|produis|livre|fournis|donne-moi|donne moi|élabore|elabore|réalise|realise|code)/i;
  const deliverable =
    /(code|fichier|script|fonction|classe|module|composant|html|css|json|api|algorithme|programme|livrable|artefact|snippet|exemple complet|application|appli|projet)/i;
  const formatHint =
    /(format|commenté|commente|en français|en francais|markdown|typescript|javascript|python|java|react|vue|vite|niveau|contrainte|spécification|specification)/i;

  const signalCount = [actionVerbs.test(q), deliverable.test(q), formatHint.test(q)].filter(
    Boolean,
  ).length;

  if (q.length >= 120 && signalCount >= 1) return true;
  if (q.length >= 60 && signalCount >= 2) return true;
  if (q.length >= 40 && signalCount >= 3) return true;

  return false;
}

export function buildSubstantiveRecoveryMessage(query = "", reason = "empty_output") {
  const snippet = normalizeText(query).slice(0, 120);
  return (
    "Je n'ai pas pu finaliser une réponse exploitable pour cette demande technique " +
    `(${reason}). ` +
    (snippet
      ? `Demande détectée : « ${snippet}${query.length > 120 ? "…" : ""} ». `
      : "") +
    "Le moteur a renvoyé une sortie vide ou filtrée. Réessayez en précisant objectif, contraintes et format attendu, ou relancez le tour."
  );
}

export function buildInformationRecoveryMessage(query = "", reason = "empty_output") {
  const snippet = normalizeText(query).slice(0, 120);
  return (
    "Je n'ai pas pu finaliser une réponse pour cette question " +
    `(${reason}). ` +
    (snippet
      ? `Tu demandais : « ${snippet}${query.length > 120 ? "…" : ""} ». `
      : "") +
    "Réessaie ou précise l'angle qui t'intéresse (géographie, histoire, contexte, etc.)."
  );
}

export function isSocialOrEmptyQuery(query = "") {
  const q = normalizeText(query).trim();
  if (!q || q.length < 3) return true;
  return /^(salut|bonjour|hello|coucou|hey|bonsoir|merci|ok|yo|yop|yépa|yepa|bien)\b/i.test(q);
}

/**
 * Small talk / check-in sans demande métier — ne doit pas partir en simple_factual_lookup.
 * @param {string} query
 * @returns {boolean}
 */
export function isCasualSocialCheckInQuery(query = "") {
  if (isKnownSocialPattern(query)) return true;
  if (isSubstantiveWorkRequest(query)) return false;
  if (suppressesSocialForInformationSeeking(query)) return false;
  return isConversationSocialOnlyQuery(query);
}

export function isInformationSeekingRequest(query = "") {
  if (!query || !String(query).trim()) return false;
  if (isSubstantiveWorkRequest(query)) return true;
  if (isSimpleFactualQuestion(query)) return true;
  if (isFamiliarityIntent(query)) return true;
  if (isCurrentWebFactRequest(query)) return true;
  if (isSubjectReferenceAvailabilityRequest(query)) return true;
  if (parseFamiliarityQuery(query)) return true;
  if (isGeneralKnowledgeRequest(query)) return true;
  if (isPedagogicalOverviewRequest(query)) return true;
  if (requiresGenerousComposerResponse(query)) return true;
  return false;
}

/**
 * Fiches locales (familiarité, factuel) — premier recours hiérarchisé avant greeting.
 */
export function resolveLocalDeterministicFallback(query = "") {
  const familiarity = getFamiliarityDeterministicReply(query);
  if (familiarity) return familiarity;
  const factual = resolveLocalSimpleFactualAnswer(query);
  if (factual) return factual;
  return "";
}

function pickRecoverableCandidate(...sources) {
  for (const source of sources) {
    const cleaned = responseThinkingCleaner.clean(String(source || "")).trim();
    if (
      cleaned.length > 20 &&
      !isGenericReadyGreeting(cleaned) &&
      !responseThinkingCleaner.hasEscapedThinking(cleaned)
    ) {
      return cleaned;
    }
  }
  return "";
}

/**
 * Remplace le fallback d'accueil quand la demande utilisateur exige un vrai livrable.
 */
export function resolvePipelineFallback({
  query = "",
  history = [],
  rawResponse = "",
  expertOutputs = [],
  quickAnswer = "",
  reason = "empty_output",
  attachments = [],
} = {}) {
  const fromStream = recoverVisibleFromFullResponse(rawResponse);
  if (fromStream) return fromStream;

  const recovered = pickRecoverableCandidate(
    rawResponse,
    ...(Array.isArray(expertOutputs) ? expertOutputs.map((o) => o?.content) : []),
    quickAnswer,
  );
  if (recovered) return recovered;

  const localDeterministic = resolveLocalDeterministicFallback(query);
  if (localDeterministic) {
    console.warn(
      `[PipelineFallback] local_deterministic reason=${reason} queryLen=${String(query).length}`,
    );
    return localDeterministic;
  }

  if (isSimpleFactualQuestion(query)) {
    const factualDirect = buildSimpleFactualDirectFallback(query);
    console.warn(
      `[PipelineFallback] simple_factual_direct reason=${reason} queryLen=${String(query).length}`,
    );
    return enforceSimpleFactualDirectness(factualDirect, query);
  }

  if (isDebugDiagnosticRequest(query)) {
    const diagnosticDirect = buildDebugDiagnosticDirectFallback(query);
    console.warn(
      `[PipelineFallback] debug_diagnostic_direct reason=${reason} queryLen=${String(query).length}`,
    );
    return enforceDebugDiagnosticDirectness(diagnosticDirect, query);
  }

  const queryComposite = resolveQueryCompositeShortCircuit(query)?.reply;
  if (queryComposite) {
    console.warn(
      `[PipelineFallback] query_composite_deterministic reason=${reason} queryLen=${String(query).length}`,
    );
    return queryComposite;
  }

  const mathFactorize = resolveMathSimpleShortCircuit(query)?.reply;
  if (mathFactorize) {
    console.warn(
      `[PipelineFallback] math_simple_deterministic reason=${reason} queryLen=${String(query).length}`,
    );
    return mathFactorize;
  }

  const mathRoot = resolveMathRootShortCircuit(query)?.reply;
  if (mathRoot) {
    console.warn(
      `[PipelineFallback] math_root_deterministic reason=${reason} queryLen=${String(query).length}`,
    );
    return mathRoot;
  }

  const mathGeometry = resolveMathGeometryShortCircuit(query)?.reply;
  if (mathGeometry) {
    console.warn(
      `[PipelineFallback] math_geometry_deterministic reason=${reason} queryLen=${String(query).length}`,
    );
    return mathGeometry;
  }

  const mathExplain = resolveMathExplainLocalFallback(query);
  if (mathExplain) {
    console.warn(
      `[PipelineFallback] math_explain_deterministic reason=${reason} queryLen=${String(query).length}`,
    );
    return mathExplain;
  }

  const mathPercent = resolveMathPercentShortCircuit(query)?.reply;
  if (mathPercent) {
    console.warn(
      `[PipelineFallback] math_percent_deterministic reason=${reason} queryLen=${String(query).length}`,
    );
    return mathPercent;
  }

  const docSynth = resolveDocumentSynthesisBypassReply(query, history, attachments);
  if (docSynth) {
    console.warn(
      `[PipelineFallback] document_synthesis reason=${reason} queryLen=${String(query).length}`,
    );
    return docSynth;
  }

  if (isPedagogySoftOverviewSatisfiable(query)) {
    console.warn(
      `[PipelineFallback] pedagogy_soft_overview reason=${reason} queryLen=${String(query).length}`,
    );
    return buildPedagogySoftOverviewRecoveryMessage(query, reason);
  }

  if (isPromptForArtifactSatisfiable(query)) {
    console.warn(
      `[PipelineFallback] prompt_for_artifact_deterministic reason=${reason} queryLen=${String(query).length}`,
    );
    return buildPromptForArtifactRecoveryMessage(query, reason);
  }

  const topicShift = assessConversationTopicShift(query, history);
  const { state: continuityState } = buildConversationContinuityContext(history);
  if (
    !topicShift.detected &&
    (isConversationContinuityFollowup(query, history) ||
      isSubstantiveContinuityAcceptance(query, continuityState) ||
      continuityState?.awaitingUserConfirmation)
  ) {
    console.warn(
      `[PipelineFallback] continuity_followup_blocked_greeting reason=${reason} subject=${continuityState?.activeSubjectLabel || "?"}`,
    );
    return buildSubstantiveRecoveryMessage(query, reason);
  }

  if (isSubstantiveWorkRequest(query) || requiresGenerousComposerResponse(query)) {
    console.warn(
      `[PipelineFallback] substantive_request_blocked_greeting reason=${reason} queryLen=${String(query).length}`,
    );
    return buildSubstantiveRecoveryMessage(query, reason);
  }

  if (isInformationSeekingRequest(query)) {
    console.warn(
      `[PipelineFallback] information_request_blocked_greeting reason=${reason} queryLen=${String(query).length}`,
    );
    if (isMathExplainRequest(query)) {
      return buildMathExplainRecoveryMessage(query, reason);
    }
    if (hasDocumentSynthesisShell(query)) {
      return buildDocumentSynthesisRecoveryMessage(
        query,
        history,
        attachments,
        reason,
      );
    }
    if (isPromptForArtifactSatisfiable(query)) {
      return buildPromptForArtifactRecoveryMessage(query, reason);
    }
    if (isCurrentWebFactRequest(query)) {
      return buildCurrentWebFactRecoveryMessage(query, reason);
    }
    if (isFamiliarityDomainOverviewSatisfiable(query)) {
      return buildFamiliarityDomainOverviewRecoveryMessage(query, reason);
    }
    if (isSubjectReferenceAvailabilityRequest(query)) {
      return buildSubjectReferenceResumeRecoveryMessage(
        query,
        history,
        reason,
      );
    }
    return buildInformationRecoveryMessage(query, reason);
  }

  if (isSocialOrEmptyQuery(query)) {
    return GENERIC_READY_GREETING;
  }

  return buildInformationRecoveryMessage(query, reason);
}

/**
 * Tente de récupérer du contenu utile depuis la réponse brute streamée.
 */
export function recoverVisibleFromFullResponse(fullResponse = "") {
  const raw = String(fullResponse || "").trim();
  if (!raw) return "";

  const cleaned = responseThinkingCleaner.clean(raw).trim();
  if (
    cleaned.length > 40 &&
    !isGenericReadyGreeting(cleaned) &&
    !responseThinkingCleaner.hasEscapedThinking(cleaned)
  ) {
    if (/```[\s\S]*```/.test(cleaned)) return cleaned;
    if (/(function |class |const |import |export |def |#include|<!DOCTYPE)/i.test(cleaned)) {
      return cleaned;
    }
    if (/[àâäéèêëïîôùûüç]/i.test(cleaned) && cleaned.length > 80) {
      return cleaned;
    }
  }

  const markerMatch = raw.match(
    /(?:Réponse|Message|Final Response|Final Draft)\s*:?\s*([\s\S]+)$/i,
  );
  if (markerMatch?.[1]) {
    const candidate = responseThinkingCleaner.clean(markerMatch[1]).trim();
    if (candidate.length > 20 && !responseThinkingCleaner.hasEscapedThinking(candidate)) {
      return candidate;
    }
  }

  return "";
}
