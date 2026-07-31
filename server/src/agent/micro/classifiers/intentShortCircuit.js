/**
 * intentShortCircuit — délestage conversationnel déterministe avant LLM.
 *
 * Audit priorités P2 (G11–G19) — ordre critique :
 * 1. multi_unit (~L750) — prime sur multi_segment via shouldPreemptMultiSegment
 * 2. historical date (~L906) — avant external_calendar et datetime
 * 3. external_calendar (~L930) — exclut historical ; prime sur relative si événement astronomique
 * 4. relative datetime (~L950) — avant datetime social
 * 5. multi_segment_composite (~L1304) — dernier recours LLM composite
 */
import { RESPONSE_MODES } from "../../config/modeResponseContracts.js";
import { resolveConversationContinuityShortCircuit } from "../continuity/conversationContinuityContext.js";
import { resolveAnaphoraReferenceShortCircuit } from "../continuity/anaphoraReferenceResolver.js";
import {
  resolveOpenPromptContinuityShortCircuit,
  resolveMetaAssistantBehaviorShortCircuit,
  resolveComprehensionGroundingShortCircuit,
} from "../../policies/meta/index.js";
import {
  resolveGuidedChoiceShortCircuit,
  resolveGuidedCreationScopingShortCircuit,
} from "../../policies/guided/index.js";
import { buildArchitectureDesignReply } from "../replies/architectureDesignReplyBuilder.js";
import { buildFamiliarityReply } from "../replies/familiarityReplyBuilder.js";
import {
  resolveMetaConversationRoute,
  buildMetaReflectiveHint,
} from "../replies/metaConversationReplyBuilder.js";
import {
  interpretRequest,
  resolveEffectiveQuery,
  INTERPRETER_ACTIONS,
} from "../interpreter/requestInterpreter.js";
import { buildParseState } from "../parsing/responseSufficiencyEvaluator.js";
import { applyShortCircuitSufficiencyGate } from "../parsing/shortCircuitSufficiencyGate.js";
import {
  annotateShortCircuitCognitiveCycle,
  resolveReactAuditShortCircuitEmit,
  shouldBypassMultiSegmentShortCircuit,
  isResearchThenSummarizeRequest,
  decomposeRequest,
  isMultiUnitRequest,
  shouldPreemptMultiSegment,
  resolveInformationSeekingLightShortCircuit,
  resolveExplicitWebSearchHelpShortCircuit,
} from "../../policies/routing/index.js";
import {
  resolveMultiSegmentPlan,
  buildMultiSegmentSystemHint,
} from "../parsing/multiSegmentResponsePlan.js";
import { resolveProcedureShortCircuit } from "../replies/procedureReplyBuilder.js";
import { resolveLauncherGuideShortCircuit } from "../replies/launcherGuideBuilder.js";
import { resolveMetaFeedbackShortCircuit } from "../replies/metaFeedbackReplyBuilder.js";
import { resolveAssistantRepairShortCircuit } from "../replies/assistantRepairReplyBuilder.js";
import {
  isForgeProjectScopingQuery,
  resolveForgeHandoffBrief,
  buildForgeHandoffAckReply,
} from "../subject/forgeProjectScoping.js";
import { evaluateProcedureSubjectNatureGate } from "../subject/subjectNatureResolver.js";
import { isExploitableProcedureIntent } from "../../utils/procedureIntentGuards.js";
import { isProcedureFormWithResolvableSubject } from "../subject/subjectIntelligenceLayer.js";
import { isArchitectureDesignIntent } from "../../utils/architectureDesignIntentGuards.js";
import { classifyWebProjectScopingRequest } from "../../utils/webProjectScopingGuards.js";
import {
  resolveSocialCompositeShortCircuit,
  isKnownSocialPattern,
  resolveSocialPatternShortCircuit,
  resolveSocialChatContinuityShortCircuit,
} from "../../policies/social/index.js";
import {
  resolveCodeConceptExplainShortCircuit,
  shouldAllowMultiSegmentShortCircuit,
} from "../../policies/code/index.js";
import {
  composeMannerReply,
  RESPONSE_MANNER_FAMILIES,
  shouldDeferSocialRouting,
} from "../../policies/posture/index.js";
import { recordSocialPatternTelemetry } from "../../telemetry/socialPatternTelemetry.js";
import { isConversationMemoryRecallRequest } from "../../utils/conversationGuards.js";
import { resolveGeneralKnowledgeShortCircuit } from "../replies/generalKnowledgeComposerContract.js";
import {
  resolveSummaryContractShortCircuit,
  extractSummaryUrl,
  hasSummaryShell,
  hasWebPageSummaryIntent,
} from "../../policies/summary/index.js";
import {
  classifyAttachmentTask,
  shouldRouteAttachmentTaskToFullPipeline,
  buildAttachmentInterpretationSystemAddon,
} from "../../policies/attachment/index.js";
import { isAttachedVisionRequest } from "../../utils/conversationGuards.js";
import { resolveFormalLetterTemplateShortCircuit } from "../../policies/formalLetterTemplatePolicy.js";
import { resolvePedagogicalOverviewShortCircuit } from "../replies/pedagogicalOverviewComposer.js";
import { resolveBeginnerTopicOverviewShortCircuit } from "../replies/beginnerTopicOverviewComposer.js";
import { resolveCareerLearningPathShortCircuit } from "../replies/careerLearningPathComposer.js";
import { resolvePresentationOutlineShortCircuit } from "../replies/presentationOutlineComposer.js";
import { resolveTechnicalLearningPathShortCircuit } from "../replies/technicalLearningPathComposer.js";
import { resolveTechnicalOverviewShortCircuit } from "../replies/technicalOverviewComposer.js";
import { resolveDebugDiagnosticShortCircuit } from "../replies/debugDiagnosticComposer.js";
import { resolveCompareChooseShortCircuit } from "../replies/compareChooseComposer.js";
import { resolveAdminProcedureShortCircuit } from "../replies/adminProcedureComposer.js";
import { resolveSelfModificationRoute } from "../replies/selfModificationReplyBuilder.js";
import { isAcknowledgmentRequest } from "../../utils/acknowledgmentIntentGuards.js";
import {
  isSimpleFactualQuestion,
  resolveSimpleDeterministicFromFrame,
  applyPedagogicalCompositionAugment,
  resolveIntentComposition,
} from "../../policies/intent/index.js";
import {
  evaluateFactualSanityGate,
  shouldRunFactualSanityGate,
} from "../replies/factualSanityGate.js";
import { recordFactualSanityTelemetry } from "../../telemetry/factualSanityTelemetry.js";
import { isInformationSeekingWithTarget } from "../../utils/informationSeekingIntentGuards.js";
import {
  resolveSubjectTypingFromQuery,
  buildSubjectTypeClarifyReply,
  resolveSubjectTypeClarifyShortCircuit,
  resolveHowToShortCircuit,
  resolveAssistantUtteranceClarifyShortCircuit,
} from "../../policies/qualification/index.js";
import {
  buildTranslationClarifyReply,
  isTranslationPipelineReady,
  requiresTranslationClarification,
} from "../../utils/translationIntentGuards.js";
import { buildTranslationRequestPlan } from "../../utils/translationRequestPlan.js";
import {
  buildMultiUnitCompositeReply,
} from "../replies/multiUnitReplyBuilder.js";
import {
  resolveMathSimpleShortCircuit,
  resolveMathRootShortCircuit,
  resolveMathGeometryShortCircuit,
  resolveMathExplainShortCircuit,
  resolveMathPercentShortCircuit,
} from "../../policies/math/index.js";
import {
  resolveQueryCompositeShortCircuit,
  resolveConversationTurnFamilyShortCircuit,
  resolveExploratoryConversationShortCircuit,
} from "../../policies/conversation/index.js";
import { resolveDocumentSynthesisShortCircuit } from "../../policies/document/index.js";
import { resolveFamiliarityDomainOverviewShortCircuit } from "../../policies/familiarityDomainOverviewPolicy.js";
import {
  resolvePedagogySoftOverviewShortCircuit,
  resolveLexiconExplainShortCircuit,
  resolvePedagogicalStructuredExplainShortCircuit,
  resolvePedagogicalScheduledExplain,
} from "../../policies/pedagogical/index.js";
import { resolvePromptForArtifactShortCircuit } from "../../policies/promptForArtifactPolicy.js";
import { resolveSubjectReferenceResumeShortCircuit } from "../../policies/subjectReferenceResumePolicy.js";

function withPedagogicalComposition(query, reply) {
  if (!reply) return reply;
  const composition = resolveIntentComposition(query);
  return applyPedagogicalCompositionAugment(reply, composition);
}
import {
  classifyConversationTurnFamily,
  shouldSuppressTurnFamilyPath,
  CONVERSATION_TURN_FAMILIES,
} from "../classifiers/conversationTurnClassifier.js";
import { recordConversationTurnTelemetry } from "../../telemetry/conversationTurnTelemetry.js";
import { resolveCasualExplanationLightShortCircuit } from "../../policies/social/index.js";
import { resolveEpistemicUncertaintyShortCircuit } from "../../policies/epistemic/index.js";
import { resolveExistingSourceAnalysisShortCircuit } from "../../policies/existingSourceAnalysisPolicy.js";
import { resolveRepoAnalysisShortCircuit } from "../../policies/repoAnalysisPolicy.js";
import { isSubjectReferenceAvailabilityRequest } from "../../micro/continuity/sessionSubjectReferenceGuards.js";
import {
  resolveCurrentWebFactShortCircuit,
  resolveExternalCalendarLookupShortCircuit,
} from "../../policies/web/index.js";
import { shouldBypassLocalDatetimeShortCircuit } from "../../utils/externalCalendarLookupIntentGuards.js";
import { isUiNavigationRestructureFeedback } from "../../utils/uiNavigationFeedbackGuards.js";
import {
  isHistoricalDateQuestion,
  isRelativeOrFutureDatetimeQuestion,
  tryResolveDeterministicSimpleFactual,
} from "../replies/simpleFactualComposer.js";

/** @typedef {"social_deterministic"|"procedure_deterministic"|"launcher_guide_deterministic"|"launcher_guide_clarify"|"meta_feedback_deterministic"|"assistant_repair_deterministic"|"forge_project_scoping_ready"|"forge_handoff_ready"|"multi_segment_composite"|"multi_unit_deterministic"|"multi_unit_partial_clarify"|"query_composite_deterministic"|"math_composite_deterministic"|"math_simple_deterministic"|"math_root_deterministic"|"math_geometry_deterministic"|"math_explain_deterministic"|"math_percent_deterministic"|"document_synthesis_deterministic"|"document_synthesis_clarify"|"document_synthesis_llm"|"how_to_simple_local"|"how_to_clarify"|"how_to_complex_clarify"|"meta_conversation_deterministic"|"meta_conversation_reflective"|"self_modification_deterministic"|"anaphora_reference_deterministic"|"anaphora_reference_carryover"|"general_knowledge_deterministic"|"general_knowledge_full_pipeline"|"information_seeking_full_pipeline"|"translation_pipeline"|"translation_multi_target"|"translation_clarify"|"simple_factual_lookup"|"conversation_continuity_deterministic"|"familiarity_followup_deterministic"|"architecture_design_deterministic"|"ideation_deterministic"|"familiarity_deterministic"|"request_interpreter_clarify"|"request_interpreter_confirm"|"datetime_deterministic"} ShortCircuitPath */

function resolveSimpleDeterministicIntent(query) {
  return resolveSimpleDeterministicFromFrame(query);
}

const DEFAULT_SOCIAL_HEALTH_REPLY =
  "Ça va bien de mon côté. Tu veux avancer sur quoi aujourd'hui ?";

const DEFAULT_SOCIAL_GREETING_REPLY =
  "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?";

const DEFAULT_SOCIAL_RETRACTION_REPLY =
  "Pas de souci. Dis-moi quand tu veux reprendre — ou on repart de zéro si tu préfères.";

/**
 * Salutations, check-in, identité/date — réponse locale sans LLM.
 * @param {string} effectiveQuery
 * @param {(q: string) => string|undefined|null} [getDeterministicSocialResponse]
 * @returns {{
 *   path: ShortCircuitPath,
 *   mode: string,
 *   reply: string,
 *   step: string,
 *   enforce: { allowRefusal: boolean },
 * }|null}
 */
function buildSocialDeterministicShortCircuit(
  effectiveQuery,
  getDeterministicSocialResponse,
  options = {},
) {
  if (shouldBypassLocalDatetimeShortCircuit(effectiveQuery)) {
    return null;
  }

  if (isHistoricalDateQuestion(effectiveQuery)) {
    return null;
  }

  if (isRelativeOrFutureDatetimeQuestion(effectiveQuery)) {
    return null;
  }

  const socialCompositeHit = resolveSocialCompositeShortCircuit(effectiveQuery, {
    history: options.history || [],
  });
  if (socialCompositeHit?.reply) {
    return {
      path: socialCompositeHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: socialCompositeHit.reply,
      step: "⚡ Identité + capacités — réponse composée (G41.1)...",
      enforce: { allowRefusal: false },
      socialComposite: true,
      compositeKind: socialCompositeHit.compositeKind,
    };
  }

  const simpleIntent = resolveSimpleDeterministicIntent(effectiveQuery);
  if (!simpleIntent) return null;

  const identityReply =
    getDeterministicSocialResponse?.(effectiveQuery) ||
    composeMannerReply({
      family: RESPONSE_MANNER_FAMILIES.IDENTITY_WHO,
      salt: effectiveQuery,
    });

  if (
    simpleIntent.asksIdentity &&
    simpleIntent.asksTime &&
    simpleIntent.asksDate
  ) {
    const now = new Date();
    return {
      path: "social_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: `${identityReply} Il est ${now.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })} et nous sommes le ${now.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })}.`,
      step: "⚡🕒📅 Identité + date/heure — réponse déterministe composée...",
      enforce: { allowRefusal: false },
    };
  }

  if (simpleIntent.asksIdentity && simpleIntent.asksTime) {
    const now = new Date();
    return {
      path: "social_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: `${identityReply} Il est ${now.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })}.`,
      step: "⚡🕒 Identité + heure — réponse déterministe composée...",
      enforce: { allowRefusal: false },
    };
  }

  if (simpleIntent.asksIdentity && simpleIntent.asksDate) {
    const now = new Date();
    return {
      path: "social_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: `${identityReply} Nous sommes le ${now.toLocaleDateString(
        "fr-FR",
        {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        },
      )}.`,
      step: "⚡📅 Identité + date — réponse déterministe composée...",
      enforce: { allowRefusal: false },
    };
  }

  if (simpleIntent.asksTime && simpleIntent.asksDate) {
    const now = new Date();
    return {
      path: "datetime_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: `Il est ${now.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })} et nous sommes le ${now.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })}.`,
      step: "🕒📅 Date/heure — réponse déterministe...",
      enforce: { allowRefusal: false },
    };
  }

  if (simpleIntent.asksTime) {
    const now = new Date();
    return {
      path: "datetime_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: `Il est ${now.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })}.`,
      step: "🕒 Date/heure — réponse déterministe...",
      enforce: { allowRefusal: false },
    };
  }

  if (simpleIntent.asksDate) {
    const now = new Date();
    return {
      path: "datetime_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: `Nous sommes le ${now.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })}.`,
      step: "📅 Date/heure — réponse déterministe...",
      enforce: { allowRefusal: false },
    };
  }

  if (simpleIntent.asksIdentity) {
    return {
      path: "social_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: identityReply,
      step: "⚡ Identité assistant — réponse déterministe...",
      enforce: { allowRefusal: false },
    };
  }

  if (simpleIntent.asksStateOfHealth) {
    return {
      path: "social_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply:
        getDeterministicSocialResponse?.(effectiveQuery) ||
        DEFAULT_SOCIAL_HEALTH_REPLY,
      step: "⚡ État/Santé — réponse déterministe...",
      enforce: { allowRefusal: false },
    };
  }

  if (simpleIntent.isSocialRetraction) {
    return {
      path: "social_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply:
        getDeterministicSocialResponse?.(effectiveQuery) ||
        DEFAULT_SOCIAL_RETRACTION_REPLY,
      step: "⚡ Excuse / mauvais fil — réponse sociale déterministe...",
      enforce: { allowRefusal: false },
    };
  }

  if (simpleIntent.isGreeting) {
    return {
      path: "social_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply:
        getDeterministicSocialResponse?.(effectiveQuery) ||
        DEFAULT_SOCIAL_GREETING_REPLY,
      step: "⚡ Réponse sociale déterministe...",
      enforce: { allowRefusal: false },
    };
  }

  return null;
}

/**
 * Image jointe + décrire/OCR/transcrire → orchestrateur Vision (priorité sur papoter).
 * @param {string} effectiveQuery
 * @param {Array} attachments
 */
function buildAttachedVisionPipelineHit(effectiveQuery, attachments = []) {
  if (!isAttachedVisionRequest(effectiveQuery, attachments)) return null;
  return {
    path: "attached_vision_full_pipeline",
    mode: RESPONSE_MODES.DOCUMENT,
    reply: null,
    deferToLlm: true,
    deferToFullPipeline: true,
    attachedVision: true,
    forcedIntentContractId: "VISION_ATTACHED",
    reflectiveHint: [
      "[CONTRAT VISION PJ]",
      "Une image est jointe à ce tour.",
      "Décris ce qui est visible (scène, objets, texte OCR si lisible) en t'ancrant au briefing VisionAgent.",
      "Interdit de répondre par une fiche de capacités (formats, VisionAgent comme feature, allowlist upload).",
    ].join("\n"),
    step: "👁️ Image jointe — pipeline Vision...",
    enforce: { allowRefusal: false },
  };
}

/**
 * @param {string} query
 * @param {{
 *   wantsAnalysis?: boolean,
 *   history?: Array<{ role: string, content: string }>,
 *   getDeterministicSocialResponse?: (q: string) => string|undefined|null,
 * }} [options]
 * @returns {{
 *   path: ShortCircuitPath,
 *   mode: string,
 *   reply: string,
 *   step: string,
 *   enforce?: { allowRefusal: boolean },
 * }|null}
 */
export async function runConversationShortCircuit(query, options = {}) {
  const {
    wantsAnalysis = false,
    history = [],
    getDeterministicSocialResponse,
    forgeProduction = false,
  } = options;

  if (isAcknowledgmentRequest(query)) {
    return {
      path: "acknowledgment_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: "Oui, j'ai bien compris.",
      step: "✅ Acquittement explicite demandé — interception (SIL)...",
      enforce: { allowRefusal: false }
    };
  }

  if (wantsAnalysis) return null;

  if (forgeProduction) return null;

  if (
    isConversationMemoryRecallRequest(query) &&
    !isSubjectReferenceAvailabilityRequest(query)
  ) {
    return null;
  }

  const parseState = buildParseState(query);

  const interpretation = interpretRequest(query, {
    history,
    enabled: options.requestInterpreter !== false,
  });
  const effectiveQuery = resolveEffectiveQuery(query, interpretation);

  const turnClassification = classifyConversationTurnFamily(query, {
    history,
    priorState: options.priorState,
    attachments: options.attachments || [],
  });
  recordConversationTurnTelemetry(query, turnClassification, {
    phase: "short_circuit_entry",
  });

  const emit = (hit) => {
    const gated = applyShortCircuitSufficiencyGate(query, hit, parseState);
    return annotateShortCircuitCognitiveCycle(gated);
  };

  // Avant G46 idéation : « recherche sur internet » ≠ pistes projet RAG.
  // Inclut le follow-up sujet (« sur la mixtrack Pro 2 ») après clarify.
  const webHelpEarly = resolveExplicitWebSearchHelpShortCircuit(effectiveQuery, {
    history,
  });
  if (webHelpEarly?.reply) {
    return emit({
      path: webHelpEarly.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: webHelpEarly.reply,
      step: webHelpEarly.step || "🌐 Recherche web — clarification...",
      enforce: { allowRefusal: false },
      explicitWebSearchHelp: true,
    });
  }
  if (webHelpEarly?.deferToLlm) {
    return emit({
      path: webHelpEarly.path,
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      preferWebResearch: true,
      informationSeeking: true,
      webQueryOverride: webHelpEarly.webQuery,
      forcedIntentContractId: webHelpEarly.forcedIntentContractId || "FACTUAL_RESEARCH",
      reflectiveHint: webHelpEarly.reflectiveHint || null,
      step: webHelpEarly.step || "🔍 Recherche web — pipeline...",
      enforce: { allowRefusal: false },
      explicitWebSearchHelp: true,
    });
  }

  const g46FamilyHit = resolveConversationTurnFamilyShortCircuit(query, {
    history,
    priorState: options.priorState,
    classification: turnClassification,
    attachments: options.attachments || [],
  });
  if (g46FamilyHit?.reply) {
    recordConversationTurnTelemetry(query, turnClassification, {
      phase: "short_circuit_route",
      pipelinePath: g46FamilyHit.path,
    });
    return emit({
      path: g46FamilyHit.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: g46FamilyHit.reply,
      step: `🧭 G46 — famille ${g46FamilyHit.turnFamily} (${g46FamilyHit.turnFamilyTier})...`,
      enforce: { allowRefusal: false },
      turnFamily: g46FamilyHit.turnFamily,
      turnFamilyConfidence: g46FamilyHit.turnFamilyConfidence,
      turnFamilySignals: g46FamilyHit.turnFamilySignals,
      turnFamilySuppressions: g46FamilyHit.turnFamilySuppressions,
    });
  }

  const casualExplainHit = resolveCasualExplanationLightShortCircuit(query, {
    history,
    priorState: options.priorState,
  });
  if (casualExplainHit?.reply) {
    return emit({
      path: casualExplainHit.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: casualExplainHit.reply,
      step: `💬 G49 — relance fil (${casualExplainHit.threadTopic})...`,
      enforce: { allowRefusal: false },
      casualExplanationLight: true,
      threadTopic: casualExplainHit.threadTopic,
    });
  }

  const infoSeekingLightEarly = resolveInformationSeekingLightShortCircuit(
    effectiveQuery,
    { history },
  );
  if (infoSeekingLightEarly?.reply) {
    return emit({
      path: infoSeekingLightEarly.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: infoSeekingLightEarly.reply,
      step: `🔎 G49 — factoid culturel léger (${infoSeekingLightEarly.subKind})...`,
      enforce: { allowRefusal: false },
      informationSeekingLight: true,
      informationSeekingLightSubKind: infoSeekingLightEarly.subKind,
    });
  }

  // Open-prompt / check-in sociaux > idéation G46 (sinon clarify livrable à tort)
  // R5 — si mandat de travail déjà ancré, le social ne route pas (ton seulement plus tard)
  const knownSocialPattern = isKnownSocialPattern(effectiveQuery);
  const skipSocialForIdeation =
    !knownSocialPattern &&
    turnClassification.family === CONVERSATION_TURN_FAMILIES.IDEATION &&
    turnClassification.confidence >= 0.55;
  const skipSocialForWork = shouldDeferSocialRouting(effectiveQuery);

  const socialPatternHit =
    skipSocialForIdeation || skipSocialForWork
      ? null
      : resolveSocialPatternShortCircuit(effectiveQuery, { history });
  if (socialPatternHit?.reply) {
    recordSocialPatternTelemetry({
      query: effectiveQuery,
      patternName: socialPatternHit.patternName,
      blockedPaths: socialPatternHit.blockedPaths,
      phase: "short_circuit",
      pipelinePath: socialPatternHit.path,
    });
    return emit({
      path: socialPatternHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: socialPatternHit.reply,
      step: `⚡ Pattern social G35 — ${socialPatternHit.patternName}...`,
      // Réponses sociales déterministes : ne pas appliquer le plafond 6 lignes INSTANT.
      enforce: { allowRefusal: false, sectionedComposite: true },
      socialPatternMatched: true,
      socialPatternName: socialPatternHit.patternName,
    });
  }

  // Après panel open_prompt : « 4 » / mot d’option → guided_choice (pas COMPOSER inventé)
  const guidedChoiceHit = resolveGuidedChoiceShortCircuit(effectiveQuery, {
    history,
  });
  if (guidedChoiceHit?.reply) {
    return emit({
      path: guidedChoiceHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: guidedChoiceHit.reply,
      step: `🎯 Choix menu — ${guidedChoiceHit.choiceLabel}...`,
      enforce: { allowRefusal: false, sectionedComposite: true },
      guidedChoice: true,
      choiceId: guidedChoiceHit.choiceId,
      choiceKey: guidedChoiceHit.choiceKey,
    });
  }

  // Couche épistémique : inférer → clarifier ciblé → admettre → vérifier (avant clarify générique)
  const epistemicHit = resolveEpistemicUncertaintyShortCircuit(effectiveQuery, {
    history,
  });
  if (epistemicHit?.reply) {
    return emit({
      path: epistemicHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: epistemicHit.reply,
      step: epistemicHit.step,
      enforce: { allowRefusal: false },
      epistemicResolution: epistemicHit.epistemicResolution,
      culturalHypothesis: Boolean(epistemicHit.culturalHypothesis),
      socialChatContinuity: Boolean(epistemicHit.socialChatContinuity),
    });
  }
  if (epistemicHit?.deferToLlm) {
    return emit({
      path: epistemicHit.path,
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: Boolean(epistemicHit.deferToFullPipeline),
      preferWebResearch: Boolean(epistemicHit.preferWebResearch),
      reflectiveHint: epistemicHit.reflectiveHint,
      step: epistemicHit.step,
      enforce: { allowRefusal: false },
      epistemicResolution: epistemicHit.epistemicResolution,
    });
  }

  const metaBeforeSocialChat = resolveMetaConversationRoute(effectiveQuery, {
    history,
  });
  if (
    metaBeforeSocialChat?.tier === "reflective" &&
    metaBeforeSocialChat.subKind === "assistant_trust"
  ) {
    return emit({
      path: "meta_conversation_reflective",
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      deferToLlm: true,
      reflectiveHint: buildMetaReflectiveHint(
        metaBeforeSocialChat.subKind,
        effectiveQuery,
        { history },
      ),
      step: "ℹ️ Méta-conversation — assistant_trust (SGT, fil papoter)...",
      enforce: { allowRefusal: false },
      metaSubKind: metaBeforeSocialChat.subKind,
    });
  }
  if (metaBeforeSocialChat?.tier === "deterministic" && metaBeforeSocialChat.reply) {
    return emit({
      path: "meta_conversation_deterministic",
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: metaBeforeSocialChat.reply,
      step: `ℹ️ Méta-conversation — ${metaBeforeSocialChat.subKind} (fil papoter ouvert)...`,
      enforce: { allowRefusal: false },
      metaSubKind: metaBeforeSocialChat.subKind,
    });
  }

  const attachedVisionEarly = buildAttachedVisionPipelineHit(
    effectiveQuery,
    options.attachments || [],
  );
  if (attachedVisionEarly) {
    return emit(attachedVisionEarly);
  }

  // Après chat_invite / offre papoter : sujet court → exploration conversationnelle
  const socialChatHit = resolveSocialChatContinuityShortCircuit(effectiveQuery, {
    history,
    attachments: options.attachments || [],
  });
  if (socialChatHit?.reply) {
    return emit({
      path: socialChatHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: socialChatHit.reply,
      step: "💬 Continuité chat — réponse sociale...",
      enforce: { allowRefusal: false },
      socialChatContinuity: true,
      culturalHypothesis: Boolean(socialChatHit.culturalHypothesis),
    });
  }
  if (socialChatHit?.deferToLlm) {
    return emit({
      path: socialChatHit.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      deferToLlm: true,
      reflectiveHint: socialChatHit.reflectiveHint,
      continuityEffectiveQuery: socialChatHit.continuityEffectiveQuery,
      exploratoryConversation: true,
      socialChatContinuity: true,
      step: "💬 Continuité chat — sujet court après invitation à discuter...",
      enforce: { allowRefusal: false },
    });
  }

  const subjectTypeClarify = resolveSubjectTypeClarifyShortCircuit(effectiveQuery);
  if (subjectTypeClarify?.reply) {
    return emit({
      path: "subject_type_clarify",
      mode: RESPONSE_MODES.INSTANT,
      reply: subjectTypeClarify.reply,
      step: "❓ Précision du type de sujet (entité ambiguë)...",
      enforce: { allowRefusal: false },
      subjectTyping: subjectTypeClarify.typing,
    });
  }

  const selfModHit = resolveSelfModificationRoute(effectiveQuery);
  if (selfModHit?.reply) {
    return emit({
      path: "self_modification_deterministic",
      mode: RESPONSE_MODES.CRITICAL,
      reply: selfModHit.reply,
      step: "🛡️ Garde auto-modification — refus épistémique (SIL)...",
      enforce: { allowRefusal: false },
      selfModSubKind: selfModHit.subKind,
    });
  }

  const codeConceptHit = resolveCodeConceptExplainShortCircuit(effectiveQuery);
  if (codeConceptHit?.reply) {
    return emit({
      path: codeConceptHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: codeConceptHit.reply,
      deferToLlm: false,
      technicalOverview: Boolean(codeConceptHit.technicalOverview),
      codeConceptExplain: true,
      codeConceptExplainDriven: true,
      glossaryDirect: Boolean(codeConceptHit.glossaryDirect),
      conceptKey: codeConceptHit.conceptKey || null,
      explanationRegister: codeConceptHit.explanationRegister || null,
      step: codeConceptHit.step,
      enforce: {
        allowRefusal: false,
        ...(codeConceptHit.enforce || {}),
      },
    });
  }
  if (codeConceptHit?.deferToLlm) {
    return emit({
      path: codeConceptHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      technicalOverview: true,
      codeConceptExplain: true,
      codeConceptExplainDriven: true,
      reflectiveHint: codeConceptHit.reflectiveHint,
      step: codeConceptHit.step,
      enforce: { allowRefusal: false },
    });
  }

  // Image jointe — voir buildAttachedVisionPipelineHit (priorité avant papoter)
  const attachmentTaskBeforeReact = classifyAttachmentTask(
    effectiveQuery,
    options.attachments || [],
  );
  if (
    shouldRouteAttachmentTaskToFullPipeline(
      effectiveQuery,
      options.attachments || [],
    )
  ) {
    return emit({
      path: "attachment_task_full_pipeline",
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      attachmentTask: attachmentTaskBeforeReact.task,
      attachmentFileKind: attachmentTaskBeforeReact.fileKind,
      reflectiveHint: [
        buildAttachmentInterpretationSystemAddon({
          attachments: options.attachments || [],
        }),
        attachmentTaskBeforeReact.task === "security_audit"
          ? [
              "[CONTRAT AUDIT SÉCURITÉ PJ]",
              "React Doctor (G48) est hors scope : CLI repo React uniquement, pas HTML/PHP/JS isolé.",
              "Analyse le fichier joint (XSS, injection, secrets, auth, CSP, surfaces d'attaque).",
              "Ancre chaque finding sur des extraits visibles ; dis « non visible dans ce fichier » pour le runtime non fourni.",
            ].join("\n")
          : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
      step: `📎 PJ ${attachmentTaskBeforeReact.task} · ${attachmentTaskBeforeReact.fileKind} — pipeline file-aware...`,
      enforce: { allowRefusal: false },
    });
  }

  if (isUiNavigationRestructureFeedback(effectiveQuery)) {
    const cockpitMeta = resolveMetaConversationRoute(effectiveQuery, { history });
    if (cockpitMeta?.tier === "reflective") {
      return emit({
        path: "meta_conversation_reflective",
        mode: RESPONSE_MODES.SIMPLE_FAST,
        reply: null,
        deferToLlm: true,
        step: `🧭 Cockpit UX — ${cockpitMeta.subKind} (avis produit, pas G48)...`,
        enforce: { allowRefusal: false },
        metaSubKind: cockpitMeta.subKind,
        reflectiveHint: buildMetaReflectiveHint(cockpitMeta.subKind, effectiveQuery, {
          history,
        }),
      });
    }
  }

  const reactAuditHit = resolveReactAuditShortCircuitEmit(effectiveQuery, {
    history,
    workspaceRoot: options.workspaceRoot,
    packageJsonHasReact: options.packageJsonHasReact,
    attachments: options.attachments || [],
  });
  if (reactAuditHit?.reply || reactAuditHit?.deferToLlm) {
    return emit(reactAuditHit);
  }

  // WEB_SUMMARY (toute cible web) avant analyse fichier locale — évite faux positif
  // path `/…/fichier.ext` dans une URL (INLINE_FILE / existing_source).
  const maybeWebTarget =
    extractSummaryUrl(effectiveQuery) ||
    (hasSummaryShell(effectiveQuery) && hasWebPageSummaryIntent(effectiveQuery));
  if (maybeWebTarget) {
    const summaryEarly = resolveSummaryContractShortCircuit(
      effectiveQuery,
      history,
      options.attachments || [],
      { contract: options.summaryContract || null },
    );
    const isWebSummaryEarly =
      summaryEarly?.webSummary ||
      summaryEarly?.summaryContract?.contract === "WEB_SUMMARY";
    if (isWebSummaryEarly && summaryEarly?.deferToLlm) {
      return emit({
        path: summaryEarly.path || "document_synthesis_llm",
        mode: RESPONSE_MODES.DOCUMENT,
        reply: null,
        deferToLlm: true,
        documentSynthesis: true,
        documentSynthesisKind: summaryEarly.kind,
        webSummary: true,
        summaryExecutionMode: summaryEarly.summaryExecutionMode || null,
        reflectiveHint: summaryEarly.reflectiveHint,
        summaryContract: summaryEarly.summaryContract,
        summaryContractTelemetry: summaryEarly.summaryContractTelemetry,
        step: "🌐 Summary contract — WEB_SUMMARY (G38)...",
        enforce: { allowRefusal: false },
      });
    }
    if (isWebSummaryEarly && summaryEarly?.reply) {
      return emit({
        path: summaryEarly.path,
        mode: RESPONSE_MODES.INSTANT,
        reply: summaryEarly.reply,
        step:
          summaryEarly.path === "clarification_gate"
            ? "❓ Summary ambigu — clarification ciblée (G38)..."
            : "📄 Summary — précision source ciblée (G38)...",
        enforce: { allowRefusal: false, sectionedComposite: true },
        summaryContract: summaryEarly.summaryContract,
        summaryContractTelemetry: summaryEarly.summaryContractTelemetry,
        documentSynthesisKind: summaryEarly.kind,
      });
    }
  }

  // Analyse fichier existant (projects/ ou file:///) — avant toute création guidée / Forge.
  const existingSourceEarly = resolveExistingSourceAnalysisShortCircuit(effectiveQuery);
  if (existingSourceEarly?.reply) {
    return emit({
      path: existingSourceEarly.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: existingSourceEarly.reply,
      step: "📂 Source locale — lecture / analyse fichier existant...",
      enforce: { allowRefusal: false },
      existingSourceAnalysis: true,
      sourceRef: existingSourceEarly.sourceRef,
    });
  }

  // Revue de dépôt (projects/… ou GitHub) — REPO_ANALYSIS_V1, pas DOCUMENT.
  const repoAnalysisEarly = resolveRepoAnalysisShortCircuit(effectiveQuery);
  if (repoAnalysisEarly?.reply) {
    return emit({
      path: repoAnalysisEarly.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: repoAnalysisEarly.reply,
      step: repoAnalysisEarly.step || "📂 Repo — revue REPO_ANALYSIS_V1...",
      enforce: { allowRefusal: false },
      repoAnalysis: true,
      repoTarget: repoAnalysisEarly.repoTarget,
    });
  }
  if (repoAnalysisEarly?.deferToLlm) {
    return emit({
      path: repoAnalysisEarly.path,
      mode: RESPONSE_MODES.COMPOSER,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      preferWebResearch: true,
      repoAnalysis: true,
      repoTarget: repoAnalysisEarly.repoTarget,
      forcedIntentContractId: "REPO_ANALYSIS",
      webQueryOverride: repoAnalysisEarly.webQuery,
      step: repoAnalysisEarly.step || "🔍 Repo distant — REPO_ANALYSIS_V1...",
      enforce: { allowRefusal: false },
    });
  }

  const guidedCreationHit = resolveGuidedCreationScopingShortCircuit(effectiveQuery);
  if (guidedCreationHit?.deferToLlm) {
    return emit({
      path: guidedCreationHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      guidedCreationScoping: true,
      reflectiveHint: guidedCreationHit.reflectiveHint,
      step: guidedCreationHit.step,
      enforce: { allowRefusal: false },
    });
  }

  const webScopingEarly = classifyWebProjectScopingRequest(query);
  if (webScopingEarly) {
    if (webScopingEarly.needsClarify && webScopingEarly.clarifyQuestion) {
      return emit({
        path: "web_project_scoping_clarify",
        mode: RESPONSE_MODES.INSTANT,
        reply: webScopingEarly.clarifyQuestion,
        step: "🌐 Projet web — précision type de site (cadrage)...",
        enforce: { allowRefusal: false },
      });
    }
    if (webScopingEarly.directReply) {
      return emit({
        path: "web_project_scoping_direct",
        mode: RESPONSE_MODES.OPEN_PROPOSITION,
        reply: webScopingEarly.directReply,
        step: "🌐 Projet web — cadrage et premières étapes...",
        enforce: { allowRefusal: false },
      });
    }
  }

  if (isTranslationPipelineReady(effectiveQuery, history)) {
    const plan = buildTranslationRequestPlan(effectiveQuery, history);
    return emit({
      path: plan.multiTarget ? "translation_multi_target" : "translation_pipeline",
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      deferToLlm: true,
      translation: true,
      translationDerived: plan.derived,
      translationMultiTarget: plan.multiTarget,
      translationLanguageCount: plan.targetLanguageCount,
      translationExecutionMode: plan.executionMode,
      translationPlanMode: plan.mode,
      previousOutputAsSource: plan.previousOutputAsSource,
      translationPlan: plan,
      translationEffectiveQuery: plan.effectiveQuery,
      preferWebResearch: false,
      step: plan.derived
        ? "🌐 Traduction suite — phrase précédente → langue cible (sans web)..."
        : plan.multiTarget
          ? `🌐 Traduction multi-cibles (${plan.targetLanguageCount}) — batch structuré (sans web)...`
          : "🌐 Traduction — pipeline direct (sans web)...",
      enforce: { allowRefusal: false },
    });
  }

  if (requiresTranslationClarification(effectiveQuery, history)) {
    const clarifyReply = buildTranslationClarifyReply(effectiveQuery, history);
    if (clarifyReply) {
      return emit({
        path: "translation_clarify",
        mode: RESPONSE_MODES.INSTANT,
        reply: clarifyReply,
        step: "❓ Précision langue ou texte pour traduction...",
        enforce: { allowRefusal: false },
      });
    }
  }

  const pedagogySoftHit = resolvePedagogySoftOverviewShortCircuit(effectiveQuery);
  if (pedagogySoftHit?.reply) {
    return emit({
      path: pedagogySoftHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: pedagogySoftHit.reply,
      step: "📖 Aperçu souple — intro minimale utile (SIL)...",
      enforce: { allowRefusal: false },
      pedagogySoftOverview: true,
      pedagogySoftDomain: pedagogySoftHit.task?.domain,
    });
  }
  if (pedagogySoftHit?.deferToLlm) {
    return emit({
      path: pedagogySoftHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      pedagogySoftOverview: true,
      reflectiveHint: pedagogySoftHit.reflectiveHint,
      pedagogySoftDomain: pedagogySoftHit.task?.domain,
      step: "📖 Aperçu souple — réponse directe (sans orchestrateur)...",
      enforce: { allowRefusal: false },
    });
  }

  const promptForArtifactHit = resolvePromptForArtifactShortCircuit(effectiveQuery);
  if (promptForArtifactHit?.reply) {
    return emit({
      path: promptForArtifactHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: promptForArtifactHit.reply,
      step: "📝 Prompt opératoire — artefact prêt à copier (SIL)...",
      enforce: { allowRefusal: false },
      promptForArtifact: promptForArtifactHit.task,
    });
  }

  // Scheduler pédagogique (lots / continue / confirm) AVANT continuité générique « continue ».
  const scheduledEduHit = resolvePedagogicalScheduledExplain(effectiveQuery, {
    history,
  });
  if (scheduledEduHit?.reply) {
    return emit({
      path: scheduledEduHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: withPedagogicalComposition(effectiveQuery, scheduledEduHit.reply),
      deferToLlm: false,
      explanationRegister: scheduledEduHit.explanationRegister || "illustrated",
      outputFormat: scheduledEduHit.outputFormat || null,
      responseContract: scheduledEduHit.responseContract || null,
      pedagogicalStructuredExplain: true,
      pedagogicalBatchMode: scheduledEduHit.pedagogicalBatchMode || null,
      workloadSignal: scheduledEduHit.workloadSignal || null,
      workUnitPlan: scheduledEduHit.workUnitPlan || null,
      step: scheduledEduHit.step,
      enforce: { allowRefusal: false, sectionedComposite: true },
    });
  }
  if (scheduledEduHit?.deferToLlm) {
    return emit({
      path: scheduledEduHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      reflectiveHint: scheduledEduHit.reflectiveHint,
      pedagogicalHybridPrefix: scheduledEduHit.pedagogicalHybridPrefix
        ? withPedagogicalComposition(
            effectiveQuery,
            scheduledEduHit.pedagogicalHybridPrefix,
          )
        : null,
      pedagogicalBatchFooter: scheduledEduHit.pedagogicalBatchFooter || null,
      explanationRegister: scheduledEduHit.explanationRegister || "illustrated",
      outputFormat: scheduledEduHit.outputFormat || null,
      responseContract: scheduledEduHit.responseContract || null,
      pedagogicalStructuredExplain: true,
      pedagogicalBatchMode: scheduledEduHit.pedagogicalBatchMode || null,
      workloadSignal: scheduledEduHit.workloadSignal || null,
      workUnitPlan: scheduledEduHit.workUnitPlan || null,
      lexiconExplainLight: true,
      lexiconSchoolScienceExplain: true,
      step: scheduledEduHit.step,
      enforce: { allowRefusal: false, sectionedComposite: true },
    });
  }

  const continuityEarlyHit = resolveConversationContinuityShortCircuit(
    effectiveQuery,
    history,
  );
  if (continuityEarlyHit?.deferToFullPipeline) {
    return emit({
      path: continuityEarlyHit.path,
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      step: "🔗 Continuité — approfondissement culture générale...",
      enforce: { allowRefusal: false },
      generalKnowledge: true,
      continuityEffectiveQuery: continuityEarlyHit.effectiveQuery,
      continuitySubject: continuityEarlyHit.continuitySubject,
    });
  }
  if (continuityEarlyHit?.reply) {
    const isSchema =
      continuityEarlyHit.path === "lexicon_science_format_deterministic" ||
      continuityEarlyHit.path === "lexicon_science_format_detailed_deterministic" ||
      continuityEarlyHit.path === "lexicon_science_format_table_deterministic" ||
      continuityEarlyHit.kind === "lexicon_science_schema";
    const isTakeaway =
      continuityEarlyHit.path === "lexicon_science_takeaway_deterministic" ||
      continuityEarlyHit.kind === "lexicon_science_takeaway";
    const schemaStep = continuityEarlyHit.path.includes("table")
      ? "🔗 Continuité — tableau pédagogique..."
      : continuityEarlyHit.path.includes("detailed")
        ? "🔗 Continuité — schéma pédagogique détaillé..."
        : "🔗 Continuité — schéma pédagogique...";
    return emit({
      path: continuityEarlyHit.path,
      mode:
        isSchema || isTakeaway
          ? RESPONSE_MODES.OPEN_PROPOSITION
          : RESPONSE_MODES.INSTANT,
      reply: isSchema
        ? withPedagogicalComposition(effectiveQuery, continuityEarlyHit.reply)
        : continuityEarlyHit.reply,
      step: isSchema
        ? schemaStep
        : isTakeaway
          ? "🔗 Continuité — résumé / à retenir..."
          : "🔗 Continuité conversationnelle — enchaînement...",
      explanationRegister:
        continuityEarlyHit.explanationRegister ||
        (isSchema ? "illustrated" : isTakeaway ? "synthetic" : null),
      enforce: {
        allowRefusal: false,
        ...((isSchema || isTakeaway) ? { sectionedComposite: true } : {}),
      },
    });
  }

  const lexiconExplainHit = resolveLexiconExplainShortCircuit(effectiveQuery);
  if (lexiconExplainHit?.deferToLlm) {
    const schoolScience = Boolean(lexiconExplainHit.lexiconSchoolScienceExplain);
    return emit({
      path: lexiconExplainHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      reflectiveHint: lexiconExplainHit.reflectiveHint,
      lexiconExplainLight: true,
      lexiconSchoolScienceExplain: schoolScience,
      explanationRegister: lexiconExplainHit.explanationRegister || null,
      step: schoolScience
        ? "📚 Lexique — mini-panorama (sciences / nature)..."
        : "📚 Lexique — explication directe (sans menu d'angles)...",
      replyShape: lexiconExplainHit.replyShape || null,
      enforce: { allowRefusal: false },
    });
  }

  const subjectReferenceHit = resolveSubjectReferenceResumeShortCircuit(
    effectiveQuery,
    {
      history,
      sessionId: options.sessionId,
      sessionContext: options.sessionContext,
      lexiconLearning: options.lexiconLearning,
    },
  );
  if (subjectReferenceHit?.reply) {
    return emit({
      path: subjectReferenceHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: subjectReferenceHit.reply,
      step: subjectReferenceHit.contextual_resume
        ? "🔗 Reprise sujet session — référence résolue (SIL)..."
        : "🤝 Disponibilité domaine — sujet explicite (sans factuel)...",
      enforce: { allowRefusal: false },
      subjectReference: subjectReferenceHit.resolution,
      contextualResume: subjectReferenceHit.contextual_resume,
    });
  }

  const formalLetterHit = resolveFormalLetterTemplateShortCircuit(effectiveQuery, {
    attachments: options.attachments || [],
  });
  if (formalLetterHit?.reply) {
    return emit({
      path: formalLetterHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: formalLetterHit.reply,
      step: "✉️ Modèle de courrier — template prêt à personnaliser (SIL)...",
      enforce: { allowRefusal: false, sectionedComposite: true },
      formalLetterTemplate: true,
      letterSlots: formalLetterHit.slots,
    });
  }

  const domainOverviewHit = resolveFamiliarityDomainOverviewShortCircuit(
    effectiveQuery,
    {
      sessionId: options.sessionId,
      sessionContext: options.sessionContext,
      lexiconLearning: options.lexiconLearning,
    },
  );
  if (domainOverviewHit?.reply) {
    return emit({
      path: "familiarity_domain_overview_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: domainOverviewHit.reply,
      step: "🤝 Disponibilité domaine — familiarité ciblée (sans factuel)...",
      enforce: { allowRefusal: false },
    });
  }

  const familiarityReply =
    isInformationSeekingWithTarget(effectiveQuery)
      ? null
      : buildFamiliarityReply(effectiveQuery, {
          sessionId: options.sessionId,
          sessionContext: options.sessionContext,
          lexiconLearning: options.lexiconLearning,
        });
  if (familiarityReply) {
    return emit({
      path: "familiarity_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: familiarityReply,
      step: "🤝 Reconnaissance de sujet — état interprété (SIL)...",
      enforce: { allowRefusal: false },
    });
  }

  const beginnerHit = resolveBeginnerTopicOverviewShortCircuit(effectiveQuery);
  if (beginnerHit?.deferToLlm) {
    return emit({
      path: beginnerHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      beginnerTopicOverview: true,
      reflectiveHint: beginnerHit.reflectiveHint,
      step: "🌱 Aperçu d'initiation — réponse directe (sans orchestrateur)...",
      enforce: { allowRefusal: false },
    });
  }

  const careerHit = resolveCareerLearningPathShortCircuit(effectiveQuery);
  if (careerHit?.deferToLlm) {
    return emit({
      path: careerHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      careerLearningPath: true,
      reflectiveHint: careerHit.reflectiveHint,
      step: "🧭 Parcours carrière — roadmap formation (sans orchestrateur)...",
      enforce: { allowRefusal: false },
    });
  }

  const presentationOutlineHit =
    resolvePresentationOutlineShortCircuit(effectiveQuery);
  if (presentationOutlineHit?.deferToLlm) {
    return emit({
      path: presentationOutlineHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      presentationOutline: true,
      reflectiveHint: presentationOutlineHit.reflectiveHint,
      step: "📑 Plan slides — sommaire pédagogique (sans orchestrateur)...",
      enforce: { allowRefusal: false },
    });
  }

  const techLearningHit = resolveTechnicalLearningPathShortCircuit(effectiveQuery);
  if (techLearningHit?.reply) {
    return emit({
      path: techLearningHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: techLearningHit.reply,
      technicalLearningPath: true,
      step: "📚 Apprentissage technique — plan structuré (blueprint local)...",
      enforce: { allowRefusal: false },
    });
  }
  if (techLearningHit?.deferToLlm) {
    return emit({
      path: techLearningHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      technicalLearningPath: true,
      reflectiveHint: techLearningHit.reflectiveHint,
      step: "📚 Apprentissage technique — plan / fiches (sans orchestrateur)...",
      enforce: { allowRefusal: false },
    });
  }

  if (isArchitectureDesignIntent(query)) {
    const architectureReply = buildArchitectureDesignReply(effectiveQuery);
    if (architectureReply) {
      return emit({
        path: "architecture_design_deterministic",
        mode: RESPONSE_MODES.OPEN_PROPOSITION,
        reply: architectureReply,
        step: "🏗️ Architecture / design — 3 approches comparées...",
        enforce: { allowRefusal: false },
      });
    }
  }

  // Critique de réponse / réparation : avant debug (sinon « échec » → faux diagnostic)
  const repairHitBeforeDebug = resolveAssistantRepairShortCircuit(query, {
    history,
  });
  if (repairHitBeforeDebug?.reply) {
    return emit({
      path: repairHitBeforeDebug.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: repairHitBeforeDebug.reply,
      step: "🔧 Réparation assistant — reformulation (sans méta)...",
      enforce: { allowRefusal: false },
    });
  }

  const metaFeedbackBeforeDebug = resolveMetaFeedbackShortCircuit(query, {
    history,
  });
  if (metaFeedbackBeforeDebug?.reply) {
    return emit({
      path: metaFeedbackBeforeDebug.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: metaFeedbackBeforeDebug.reply,
      step: "💬 Méta-feedback — correction de routage (sans sujet collant)...",
      enforce: { allowRefusal: false },
      turnType: metaFeedbackBeforeDebug.turn.turnType,
    });
  }

  // Format solo tableau/schéma sciences avant technical_overview
  const structuredEduHit =
    resolvePedagogicalStructuredExplainShortCircuit(effectiveQuery);
  if (structuredEduHit?.reply) {
    return emit({
      path: structuredEduHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: withPedagogicalComposition(effectiveQuery, structuredEduHit.reply),
      deferToLlm: false,
      explanationRegister: structuredEduHit.explanationRegister || "illustrated",
      outputFormat: structuredEduHit.outputFormat || null,
      responseContract: structuredEduHit.responseContract || null,
      pedagogicalStructuredExplain: true,
      step: structuredEduHit.step,
      enforce: { allowRefusal: false, sectionedComposite: true },
    });
  }
  if (structuredEduHit?.deferToLlm) {
    return emit({
      path: structuredEduHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      reflectiveHint: structuredEduHit.reflectiveHint,
      explanationRegister: structuredEduHit.explanationRegister || "illustrated",
      outputFormat: structuredEduHit.outputFormat || null,
      responseContract: structuredEduHit.responseContract || null,
      pedagogicalStructuredExplain: true,
      lexiconExplainLight: true,
      lexiconSchoolScienceExplain: true,
      step: structuredEduHit.step,
      enforce: { allowRefusal: false, sectionedComposite: true },
    });
  }

  const technicalHit = resolveTechnicalOverviewShortCircuit(effectiveQuery);
  if (technicalHit?.deferToLlm) {
    return emit({
      path: technicalHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      technicalOverview: true,
      reflectiveHint: technicalHit.reflectiveHint,
      step: "⚙️ Aperçu technique — réponse directe (sans orchestrateur)...",
      enforce: { allowRefusal: false },
    });
  }

  const debugHit = resolveDebugDiagnosticShortCircuit(effectiveQuery);
  if (debugHit?.deferToLlm) {
    return emit({
      path: debugHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      debugDiagnostic: true,
      reflectiveHint: debugHit.reflectiveHint,
      step: "🔍 Diagnostic technique — analyse d'incident (sans orchestrateur)...",
      enforce: { allowRefusal: false },
    });
  }

  const openPromptHit = resolveOpenPromptContinuityShortCircuit(effectiveQuery, {
    history,
  });
  if (openPromptHit?.reply) {
    return emit({
      path: openPromptHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: openPromptHit.reply,
      step: openPromptHit.declineContinuation
        ? "↩️ Continuité — refus CTA + prochaine direction (G42)..."
        : "💡 Idéation ouverte — proposition structurée (G42)...",
      enforce: { allowRefusal: false },
      openPromptContinuity: true,
      declineContinuation: Boolean(openPromptHit.declineContinuation),
    });
  }

  const compareHit = resolveCompareChooseShortCircuit(effectiveQuery);
  if (compareHit?.deferToFullPipeline) {
    return emit({
      path: compareHit.path,
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      compareChoose: true,
      reflectiveHint: compareHit.reflectiveHint,
      step: "⚖️ Comparatif / choix — pipeline complet (sans troncature)...",
      enforce: { allowRefusal: false },
    });
  }

  const adminHit = resolveAdminProcedureShortCircuit(effectiveQuery);
  if (adminHit?.deferToFullPipeline) {
    return emit({
      path: adminHit.path,
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      adminProcedure: true,
      preferWebResearch: adminHit.preferWebResearch,
      reflectiveHint: adminHit.reflectiveHint,
      step: "🏛️ Procédure administrative — sources officielles (web/RAG)...",
      enforce: { allowRefusal: false },
    });
  }

  const pedagogicalHit = resolvePedagogicalOverviewShortCircuit(effectiveQuery);
  if (pedagogicalHit?.reply) {
    return emit({
      path: pedagogicalHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: pedagogicalHit.reply,
      step: "📐 Aperçu pédagogique — fiche locale (SIL)...",
      enforce: { allowRefusal: false },
    });
  }
  if (pedagogicalHit?.deferToLlm) {
    return emit({
      path: pedagogicalHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: Boolean(pedagogicalHit.deferToFullPipeline),
      pedagogicalOverview: true,
      reflectiveHint: pedagogicalHit.reflectiveHint,
      step: pedagogicalHit.deferToFullPipeline
        ? "📐 Aperçu pédagogique — recherche documentée (web/RAG)..."
        : "📐 Aperçu pédagogique — réponse directe (sans orchestrateur)...",
      enforce: { allowRefusal: false },
    });
  }

  const requestDecomposition =
    options.requestDecomposition || decomposeRequest(query, history);
  if (isMultiUnitRequest(requestDecomposition)) {
    const compositeReply = buildMultiUnitCompositeReply(requestDecomposition);
    if (compositeReply?.reply) {
      const partial = Boolean(compositeReply.partial);
      return emit({
        path: partial ? "multi_unit_partial_clarify" : "multi_unit_deterministic",
        mode: RESPONSE_MODES.INSTANT,
        reply: compositeReply.reply,
        step: partial
          ? "🔗 Multi-unités — faits servis + précision how-to ciblée..."
          : "🔗 Requête multi-unités — réponse fusionnée (déterministe)...",
        enforce: { allowRefusal: false, sectionedComposite: true },
        requestDecomposition,
        howToQualification: compositeReply.howToQualification || null,
      });
    }
  }

  const howToHit = resolveHowToShortCircuit(effectiveQuery);
  if (howToHit?.reply) {
    return emit({
      path: howToHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: howToHit.reply,
      step:
        howToHit.path === "how_to_clarify"
          ? "❓ How-to ambigu — précision ciblée..."
          : howToHit.path === "how_to_complex_clarify"
            ? "❓ How-to complexe — cadrage..."
            : "📋 How-to simple — réponse locale...",
      enforce: { allowRefusal: false, sectionedComposite: true },
      howToQualification: howToHit.howToQualification || null,
    });
  }
  if (howToHit?.deferToLlm) {
    return emit({
      path: howToHit.path,
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: null,
      deferToLlm: true,
      reflectiveHint: howToHit.reflectiveHint,
      howToProcedural: true,
      howToQualification: howToHit.howToQualification || null,
      step: "📋 How-to procédural — procédure ancrée (LLM)...",
      enforce: { allowRefusal: false },
    });
  }

  // Avant G38 : « va te renseigner puis résume » ≠ synthèse d'un passage fourni
  if (isResearchThenSummarizeRequest(effectiveQuery, {
    attachments: options.attachments || [],
  })) {
    return emit({
      path: "information_seeking_full_pipeline",
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      preferWebResearch: true,
      informationSeeking: true,
      researchThenSummarize: true,
      step: "🔍 Recherche externe puis synthèse — pipeline web...",
      enforce: { allowRefusal: false },
    });
  }

  // (attachment_task_full_pipeline déjà évalué avant G48 — ne pas rejouer ici)

  const summaryHit = resolveSummaryContractShortCircuit(
    effectiveQuery,
    history,
    options.attachments || [],
    { contract: options.summaryContract || null },
  );
  if (summaryHit?.reply) {
    return emit({
      path: summaryHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: summaryHit.reply,
      step:
        summaryHit.path === "clarification_gate"
          ? "❓ Summary ambigu — clarification ciblée (G38)..."
          : "📄 Summary — précision source ciblée (G38)...",
      enforce: { allowRefusal: false, sectionedComposite: true },
      summaryContract: summaryHit.summaryContract,
      summaryContractTelemetry: summaryHit.summaryContractTelemetry,
      documentSynthesisKind: summaryHit.kind,
    });
  }
  if (summaryHit?.deferToLlm) {
    if (summaryHit.culturalContentSummary) {
      return emit({
        path: summaryHit.path || "cultural_content_summary",
        mode: RESPONSE_MODES.SIMPLE_FAST,
        reply: null,
        deferToLlm: true,
        generalKnowledge: true,
        culturalContentSummary: true,
        reflectiveHint: summaryHit.reflectiveHint,
        summaryContract: summaryHit.summaryContract,
        summaryContractTelemetry: summaryHit.summaryContractTelemetry,
        step: "🎬 Summary contract — résumé œuvre (SIMPLE_FAST, G38)...",
        enforce: { allowRefusal: false },
      });
    }
    return emit({
      path: summaryHit.path || "document_synthesis_llm",
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      documentSynthesis: true,
      documentSynthesisKind: summaryHit.kind,
      webSummary: Boolean(summaryHit.webSummary),
      summaryExecutionMode: summaryHit.summaryExecutionMode || null,
      reflectiveHint: summaryHit.reflectiveHint,
      summaryContract: summaryHit.summaryContract,
      summaryContractTelemetry: summaryHit.summaryContractTelemetry,
      step: summaryHit.webSummary
        ? "🌐 Summary contract — WEB_SUMMARY (G38)..."
        : "📄 Summary contract — TEXT_SUMMARY (G38)...",
      enforce: { allowRefusal: false },
    });
  }

  const generalKnowledgeHit =
    resolveGeneralKnowledgeShortCircuit(effectiveQuery);
  if (generalKnowledgeHit?.reply) {
    return emit({
      path: "general_knowledge_deterministic",
      mode: RESPONSE_MODES.DOCUMENT,
      reply: generalKnowledgeHit.reply,
      step: "📚 Culture générale — fiche locale (SIL)...",
      enforce: { allowRefusal: false },
    });
  }
  if (generalKnowledgeHit?.deferToFullPipeline) {
    return emit({
      path: "general_knowledge_full_pipeline",
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      step: "📚 Culture générale — réponse humaine généreuse...",
      enforce: { allowRefusal: false },
      generalKnowledge: true,
    });
  }
  if (generalKnowledgeHit?.deferToLlm) {
    return emit({
      path: generalKnowledgeHit.path || "cultural_content_summary",
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      deferToLlm: true,
      generalKnowledge: true,
      culturalContentSummary: Boolean(generalKnowledgeHit.culturalContentSummary),
      reflectiveHint: generalKnowledgeHit.reflectiveHint,
      step: generalKnowledgeHit.culturalContentSummary
        ? "🎬 Résumé œuvre culturelle — SIMPLE_FAST (sans orchestrateur)..."
        : "📚 Culture générale — réponse directe (sans orchestrateur)...",
      enforce: { allowRefusal: false },
    });
  }

  const queryCompositeHit = resolveQueryCompositeShortCircuit(effectiveQuery, history);
  if (queryCompositeHit?.reply) {
    return emit({
      path: queryCompositeHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: queryCompositeHit.reply,
      step:
        queryCompositeHit.path === "math_composite_deterministic"
          ? "🔢 Maths composite — lecture multi-intent + réponse séquencée (G28)..."
          : "🧭 Requête composite — compréhension multi-domaine + réponse séquencée...",
      enforce: { allowRefusal: false, sectionedComposite: true },
      queryUnderstanding: queryCompositeHit.understanding,
      executionPlan: queryCompositeHit.plan,
    });
  }

  const mathSimpleHit = resolveMathSimpleShortCircuit(effectiveQuery);
  if (mathSimpleHit?.reply) {
    return emit({
      path: "math_simple_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: mathSimpleHit.reply,
      step: "🔢 Maths simple — factorisation locale (déterministe)...",
      enforce: { allowRefusal: false },
      mathSimpleKind: mathSimpleHit.kind,
    });
  }

  const mathRootHit = resolveMathRootShortCircuit(effectiveQuery);
  if (mathRootHit?.reply) {
    return emit({
      path: "math_root_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: mathRootHit.reply,
      step: "√ Racine — calcul ou explication locale (déterministe)...",
      enforce: { allowRefusal: false },
      mathRootKind: mathRootHit.kind,
    });
  }

  const mathGeometryHit = resolveMathGeometryShortCircuit(effectiveQuery);
  if (mathGeometryHit?.reply) {
    return emit({
      path: "math_geometry_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: mathGeometryHit.reply,
      step: "📐 Géométrie — calcul local (déterministe)...",
      enforce: { allowRefusal: false },
      mathGeometryKind: mathGeometryHit.kind,
    });
  }

  const mathExplainHit = resolveMathExplainShortCircuit(effectiveQuery);
  if (mathExplainHit?.reply) {
    return emit({
      path: "math_explain_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: mathExplainHit.reply,
      step: "📐 Maths — explication théorique locale (déterministe)...",
      enforce: { allowRefusal: false },
      mathExplainKind: mathExplainHit.kind,
    });
  }

  const mathPercentHit = resolveMathPercentShortCircuit(effectiveQuery);
  if (mathPercentHit?.reply) {
    return emit({
      path: "math_percent_deterministic",
      mode: RESPONSE_MODES.INSTANT,
      reply: mathPercentHit.reply,
      step: "％ Pourcentages — calcul local (déterministe)...",
      enforce: { allowRefusal: false },
      mathPercentKind: mathPercentHit.kind,
    });
  }

  const existingSourceHit = resolveExistingSourceAnalysisShortCircuit(effectiveQuery);
  if (existingSourceHit?.reply) {
    return emit({
      path: existingSourceHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: existingSourceHit.reply,
      step: "📂 Source locale — accès fichier (analyse existante)...",
      enforce: { allowRefusal: false },
      existingSourceAnalysis: true,
      sourceRef: existingSourceHit.sourceRef,
    });
  }

  const docSynthHit = resolveDocumentSynthesisShortCircuit(
    effectiveQuery,
    history,
    options.attachments || [],
  );
  if (
    !shouldSuppressTurnFamilyPath(turnClassification, "document_synthesis_llm") &&
    !shouldSuppressTurnFamilyPath(turnClassification, "GUIDED_DOCUMENT_SYNTHESIS")
  ) {
  if (docSynthHit?.reply) {
    return emit({
      path: docSynthHit.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: docSynthHit.reply,
      step:
        docSynthHit.path === "document_synthesis_clarify"
          ? "📄 Synthèse document — précision source ciblée..."
          : "📄 Synthèse document — réponse ancrée locale (déterministe)...",
      enforce: { allowRefusal: false, sectionedComposite: true },
      documentSynthesisKind: docSynthHit.kind,
    });
  }
  if (docSynthHit?.deferToLlm) {
    return emit({
      path: "document_synthesis_llm",
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      documentSynthesis: true,
      documentSynthesisKind: docSynthHit.kind,
      step: "📄 Synthèse document — analyse ancrée (LLM)...",
      enforce: { allowRefusal: false },
    });
  }
  }

  const exploratoryHitEarly = resolveExploratoryConversationShortCircuit(
    effectiveQuery,
    { attachments: options.attachments || [] },
  );
  if (exploratoryHitEarly?.deferToLlm) {
    return emit({
      path: exploratoryHitEarly.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      deferToLlm: true,
      reflectiveHint: exploratoryHitEarly.reflectiveHint,
      exploratoryConversation: true,
      step: "🧭 Exploration — thème ouvert (sans mandat livrable)...",
      enforce: { allowRefusal: false },
    });
  }

  if (isHistoricalDateQuestion(effectiveQuery)) {
    const local = tryResolveDeterministicSimpleFactual(effectiveQuery);
    if (local) {
      return emit({
        path: "simple_factual_lookup",
        mode: RESPONSE_MODES.SIMPLE_FAST,
        reply: local,
        step: "📅 Date historique — réponse factuelle déterministe...",
        enforce: { allowRefusal: false },
        simpleFactual: true,
      });
    }
    return emit({
      path: "simple_factual_lookup",
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      deferToLlm: true,
      step: "📅 Date historique — recherche factuelle...",
      enforce: { allowRefusal: false },
      simpleFactual: true,
    });
  }

  const externalCalendarHit =
    resolveExternalCalendarLookupShortCircuit(effectiveQuery);
  if (externalCalendarHit) {
    return emit({
      path: externalCalendarHit.path,
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      preferWebResearch: true,
      simpleFactual: true,
      externalCalendarLookup: true,
      explicitWebToolRequest: Boolean(externalCalendarHit.explicitWebToolRequest),
      currentWebFactWebQuery: externalCalendarHit.webQuery,
      externalCalendarWebQuery: externalCalendarHit.webQuery,
      step: externalCalendarHit.step,
      enforce: { allowRefusal: false },
    });
  }

  if (isRelativeOrFutureDatetimeQuestion(effectiveQuery)) {
    const local = tryResolveDeterministicSimpleFactual(effectiveQuery);
    if (local) {
      return emit({
        path: "simple_factual_lookup",
        mode: RESPONSE_MODES.SIMPLE_FAST,
        reply: local,
        step: "📅 Date relative — réponse factuelle déterministe...",
        enforce: { allowRefusal: false },
        simpleFactual: true,
      });
    }
    return emit({
      path: "simple_factual_lookup",
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      deferToLlm: true,
      step: "📅 Date relative — recherche factuelle...",
      enforce: { allowRefusal: false },
      simpleFactual: true,
    });
  }

  const socialHit = buildSocialDeterministicShortCircuit(
    effectiveQuery,
    getDeterministicSocialResponse,
    { history },
  );
  if (socialHit) {
    return emit(socialHit);
  }

  const groundingHit = resolveComprehensionGroundingShortCircuit(query, {
    history,
  });
  if (groundingHit?.reply) {
    return emit({
      path: groundingHit.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: groundingHit.reply,
      step: "🧭 Grounding — preuve de compréhension conversationnelle...",
      enforce: { allowRefusal: false },
      groundingKind: groundingHit.groundingKind,
    });
  }

  const metaBehaviorHit = resolveMetaAssistantBehaviorShortCircuit(query, {
    history,
  });
  if (metaBehaviorHit?.reply) {
    return emit({
      path: metaBehaviorHit.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: metaBehaviorHit.reply,
      step: "🪞 Méta-comportement — feedback UX (sans clarification)...",
      enforce: { allowRefusal: false },
    });
  }

  const metaRouteEarly = resolveMetaConversationRoute(query, {
    history,
    sessionId: options.sessionId,
    turnTimestamp: options.turnTimestamp,
    priorState: options.priorState,
  });
  if (metaRouteEarly?.subKind === "forge_status" && metaRouteEarly.reply) {
    return emit({
      path: "meta_conversation_deterministic",
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: metaRouteEarly.reply,
      step: "🔨 Forge — état opérationnel...",
      enforce: { allowRefusal: false },
      metaSubKind: "forge_status",
    });
  }
  if (metaRouteEarly?.tier === "deterministic" && metaRouteEarly.reply) {
    return emit({
      path: "meta_conversation_deterministic",
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: metaRouteEarly.reply,
      step: `ℹ️ Méta-conversation — ${metaRouteEarly.subKind} (déterministe)...`,
      enforce: { allowRefusal: false },
      metaSubKind: metaRouteEarly.subKind,
    });
  }
  if (metaRouteEarly?.tier === "reflective") {
    return emit({
      path: "meta_conversation_reflective",
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      step: `🧠 Méta-conversation — nuance (${metaRouteEarly.subKind}), lecture contextuelle...`,
      enforce: { allowRefusal: false },
      metaSubKind: metaRouteEarly.subKind,
      reflectiveHint: buildMetaReflectiveHint(metaRouteEarly.subKind, query, {
        history,
        sessionId: options.sessionId,
        turnTimestamp: options.turnTimestamp,
        priorState: options.priorState,
      }),
      deferToLlm: true,
    });
  }

  const utteranceClarifyHit = resolveAssistantUtteranceClarifyShortCircuit(query, {
    history,
  });
  if (utteranceClarifyHit?.reply) {
    return emit({
      path: utteranceClarifyHit.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: utteranceClarifyHit.reply,
      step: "💬 Clarification — reformulation de ma phrase précédente (G44)...",
      enforce: { allowRefusal: false },
    });
  }

  // repair / meta déjà traités avant debug (évite double branche)

  const exploratoryHit = resolveExploratoryConversationShortCircuit(
    effectiveQuery,
    { attachments: options.attachments || [] },
  );
  if (exploratoryHit?.deferToLlm) {
    return emit({
      path: exploratoryHit.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      deferToLlm: true,
      reflectiveHint: exploratoryHit.reflectiveHint,
      exploratoryConversation: true,
      step: "🧭 Exploration — thème ouvert (sans mandat livrable)...",
      enforce: { allowRefusal: false },
    });
  }

  if (shouldRunFactualSanityGate(effectiveQuery)) {
    const sanity = evaluateFactualSanityGate(effectiveQuery, { history });
    if (sanity.decision === "abstain" && sanity.safeUserMessage) {
      recordFactualSanityTelemetry(effectiveQuery, {
        path: "simple_factual_abstain",
        decision: sanity.decision,
        reason: sanity.reason,
        matchedRule: sanity.matchedRule,
      });
      return emit({
        path: "simple_factual_abstain",
        mode: RESPONSE_MODES.INSTANT,
        reply: sanity.safeUserMessage,
        step: "🛡️ Repère factuel non fiable — abstention prudente...",
        enforce: { allowRefusal: false },
        factualSanity: sanity,
      });
    }
    if (sanity.decision === "clarify" && sanity.safeUserMessage) {
      recordFactualSanityTelemetry(effectiveQuery, {
        path: "simple_factual_clarify",
        decision: sanity.decision,
        reason: sanity.reason,
        matchedRule: sanity.matchedRule,
      });
      return emit({
        path: "simple_factual_clarify",
        mode: RESPONSE_MODES.INSTANT,
        reply: sanity.safeUserMessage,
        step: "❓ Précision utile avant réponse factuelle...",
        enforce: { allowRefusal: false },
        factualSanity: sanity,
      });
    }
  }

  if (isInformationSeekingWithTarget(effectiveQuery)) {
    const subjectTyping = resolveSubjectTypingFromQuery(effectiveQuery);
    if (subjectTyping?.requires_subject_disambiguation) {
      const clarifyReply = buildSubjectTypeClarifyReply(subjectTyping);
      if (clarifyReply) {
        return emit({
          path: "subject_type_clarify",
          mode: RESPONSE_MODES.INSTANT,
          reply: clarifyReply,
          step: "❓ Précision du type de sujet (entité ambiguë)...",
          enforce: { allowRefusal: false },
          subjectTyping,
        });
      }
    }
    return emit({
      path: "information_seeking_full_pipeline",
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      preferWebResearch: true,
      informationSeeking: true,
      step: "🔍 Recherche d'information ciblée — pipeline documenté (web)...",
      enforce: { allowRefusal: false },
    });
  }

  const currentWebFactHit = resolveCurrentWebFactShortCircuit(effectiveQuery);
  if (currentWebFactHit) {
    return emit({
      path: currentWebFactHit.path,
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      preferWebResearch: true,
      simpleFactual: true,
      currentWebFact: true,
      currentWebFactType: currentWebFactHit.factType,
      weatherCurrent: Boolean(currentWebFactHit.weatherCurrent),
      trafficCurrent: Boolean(currentWebFactHit.trafficCurrent),
      currentWebFactWebQuery: currentWebFactHit.currentWebFactWebQuery,
      weatherWebQuery:
        currentWebFactHit.weatherWebQuery || currentWebFactHit.currentWebFactWebQuery,
      trafficWebQuery: currentWebFactHit.trafficWebQuery,
      step: currentWebFactHit.step,
      enforce: { allowRefusal: false },
    });
  }

  if (isSimpleFactualQuestion(effectiveQuery)) {
    if (
      shouldSuppressTurnFamilyPath(turnClassification, "simple_factual_lookup")
    ) {
      return null;
    }
    return emit({
      path: "simple_factual_lookup",
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      deferToLlm: true,
      step: "🔎 Question factuelle simple — recherche ou réponse directe...",
      enforce: { allowRefusal: false },
      simpleFactual: true,
    });
  }

  const anaphoraHit = resolveAnaphoraReferenceShortCircuit(query, history);
  if (anaphoraHit?.deferToLlm) {
    return emit({
      path: anaphoraHit.path,
      mode: RESPONSE_MODES.DOCUMENT,
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      step: "🔗 Continuité anaphorique — antécédent résolu, pipeline complet...",
      enforce: { allowRefusal: false },
      reflectiveHint: anaphoraHit.reflectiveHint,
      anaphoraKind: anaphoraHit.kind,
      anaphoraCandidates: anaphoraHit.candidates,
    });
  }
  if (anaphoraHit?.reply) {
    return emit({
      path: anaphoraHit.path,
      mode: RESPONSE_MODES.DOCUMENT,
      reply: anaphoraHit.reply,
      step: "🔗 Référence anaphorique — antécédent assistant (SIL)...",
      enforce: { allowRefusal: false },
      anaphoraKind: anaphoraHit.kind,
      anaphoraCandidates: anaphoraHit.candidates,
    });
  }

  const launcherHit = await resolveLauncherGuideShortCircuit(query, {
    sessionId: options.sessionId,
    sessionContext: options.sessionContext,
    history,
  });
  if (launcherHit?.reply) {
    return emit({
      path: launcherHit.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: launcherHit.reply,
      step: "🎮 Guide de lancement — route déterministe (SIL)...",
      enforce: { allowRefusal: false },
      launcherPlan: launcherHit.plan,
      followupQuestion: launcherHit.followupQuestion ?? null,
    });
  }

  const handoffBrief = resolveForgeHandoffBrief(query, history);
  if (handoffBrief) {
    return emit({
      path: "forge_handoff_ready",
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: buildForgeHandoffAckReply(handoffBrief.brief, {
        reason: handoffBrief.reason,
      }),
      step: "🔨 Handoff Forge — brief validé, transfert production...",
      enforce: { allowRefusal: false },
      forgeHandoff: true,
      forgeBrief: handoffBrief.brief,
    });
  }

  if (isForgeProjectScopingQuery(query)) {
    const forgeGate = await evaluateProcedureSubjectNatureGate(query, {
      sessionId: options.sessionId,
      sessionContext: options.sessionContext,
      llmClient: options.llmClient,
      history,
    });
    if (forgeGate.reply) {
      return emit({
        path: forgeGate.path || "forge_project_scoping_ready",
        mode: RESPONSE_MODES.SIMPLE_FAST,
        reply: forgeGate.reply,
        step: "🔨 Cadrage Forge partiel — structuration chat...",
        enforce: { allowRefusal: false },
      });
    }
  }

  const procedureCandidate =
    isExploitableProcedureIntent(query) ||
    isProcedureFormWithResolvableSubject(query);

  const procedureHit = procedureCandidate
    ? await resolveProcedureShortCircuit(query, {
        sessionId: options.sessionId,
        sessionContext: options.sessionContext,
        llmClient: options.llmClient,
      })
    : null;
  if (procedureHit?.reply) {
    const reasoned =
      procedureHit.path === "procedure_subject_nature_gate" ||
      procedureHit.path === "procedure_subject_mini_deliberation" ||
      procedureHit.path === "procedure_subject_reasoned_gate";
    const step = reasoned
      ? procedureHit.path === "procedure_subject_mini_deliberation"
        ? "🧠 Vérification de compréhension (mini-délibération)..."
        : "🔎 Sujet — vérification avant réponse procédurale..."
      : "📋 Procédure opérationnelle — réponse utile minimale (avant refus)...";
    return emit({
      path: procedureHit.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: procedureHit.reply,
      step,
      enforce: { allowRefusal: false },
    });
  }

  const metaRoute = resolveMetaConversationRoute(query, {
    history,
    sessionId: options.sessionId,
    turnTimestamp: options.turnTimestamp,
    priorState: options.priorState,
  });
  if (metaRoute?.subKind === "forge_status" && metaRoute.reply) {
    return emit({
      path: "meta_conversation_deterministic",
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: metaRoute.reply,
      step: "🔨 Forge — état opérationnel...",
      enforce: { allowRefusal: false },
      metaSubKind: "forge_status",
    });
  }
  if (metaRoute?.tier === "deterministic" && metaRoute.reply) {
    return emit({
      path: "meta_conversation_deterministic",
      mode: RESPONSE_MODES.OPEN_PROPOSITION,
      reply: metaRoute.reply,
      step: `ℹ️ Méta-conversation — ${metaRoute.subKind} (déterministe)...`,
      enforce: { allowRefusal: false },
      metaSubKind: metaRoute.subKind,
    });
  }
  if (metaRoute?.tier === "reflective") {
    return emit({
      path: "meta_conversation_reflective",
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      step: `🧠 Méta-conversation — nuance (${metaRoute.subKind}), lecture contextuelle...`,
      enforce: { allowRefusal: false },
      metaSubKind: metaRoute.subKind,
      reflectiveHint: buildMetaReflectiveHint(metaRoute.subKind, query, {
        history,
        sessionId: options.sessionId,
        turnTimestamp: options.turnTimestamp,
        priorState: options.priorState,
      }),
      deferToLlm: true,
    });
  }

  const segmentPlan = resolveMultiSegmentPlan(query);
  const multiSegmentDecomposition =
    options.requestDecomposition || requestDecomposition || decomposeRequest(query, history);
  if (
    segmentPlan.shouldDeferToPipeline &&
    shouldAllowMultiSegmentShortCircuit(query, {
      intentTriage: options.intentTriage,
      attachments: options.attachments,
    }) &&
    !shouldBypassMultiSegmentShortCircuit(query) &&
    !shouldPreemptMultiSegment(multiSegmentDecomposition)
  ) {
    return emit({
      path: "multi_segment_composite",
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      deferToLlm: true,
      step: "🔗 Requête multi-segments — contexte + but principal...",
      enforce: { allowRefusal: false },
      reflectiveHint: buildMultiSegmentSystemHint(segmentPlan),
      segmentPlan,
    });
  }

  // Bypass clarify interprète générique si la couche épistémique / chat a une meilleure sortie
  const epistemicLate = resolveEpistemicUncertaintyShortCircuit(effectiveQuery, {
    history,
  });
  if (epistemicLate?.reply) {
    return emit({
      path: epistemicLate.path,
      mode: RESPONSE_MODES.INSTANT,
      reply: epistemicLate.reply,
      step: epistemicLate.step,
      enforce: { allowRefusal: false },
      epistemicResolution: epistemicLate.epistemicResolution,
      culturalHypothesis: Boolean(epistemicLate.culturalHypothesis),
      socialChatContinuity: Boolean(epistemicLate.socialChatContinuity),
    });
  }

  const socialChatLate = resolveSocialChatContinuityShortCircuit(effectiveQuery, {
    history,
  });
  if (socialChatLate?.deferToLlm) {
    return emit({
      path: socialChatLate.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      deferToLlm: true,
      reflectiveHint: socialChatLate.reflectiveHint,
      continuityEffectiveQuery: socialChatLate.continuityEffectiveQuery,
      exploratoryConversation: true,
      socialChatContinuity: true,
      step: "💬 Continuité chat — sujet après invite (bypass clarify interprète)...",
      enforce: { allowRefusal: false },
    });
  }

  if (
    interpretation.nextAction === INTERPRETER_ACTIONS.CLARIFY &&
    interpretation.clarificationReply
  ) {
    return emit({
      path: "request_interpreter_clarify",
      mode: RESPONSE_MODES.INSTANT,
      reply: interpretation.clarificationReply,
      step: "🔍 Interprète de requête — clarification...",
      enforce: { allowRefusal: false },
    });
  }

  if (
    interpretation.nextAction === INTERPRETER_ACTIONS.CONFIRM &&
    interpretation.clarificationReply
  ) {
    return emit({
      path: "request_interpreter_confirm",
      mode: RESPONSE_MODES.INSTANT,
      reply: interpretation.clarificationReply,
      step: "🔍 Interprète de requête — confirmation sujet...",
      enforce: { allowRefusal: false },
    });
  }

  return null;
}

export async function classifyShortCircuitIntent(query, options = {}) {
  const hit = await runConversationShortCircuit(query, options);
  if (!hit) return { matched: false, path: null };
  return { matched: true, path: hit.path };
}
