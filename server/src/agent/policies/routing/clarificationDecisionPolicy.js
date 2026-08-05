/**
 * CLARIFICATION_DECISION_V1 — clarify only on blocking ambiguity, not on answerable breadth.
 *
 * Matrice :
 * - can_answer_now          : chemin déterministe ou build_v1 immédiat
 * - can_answer_with_assumptions : livrable avec défauts intelligents (pas de blocage)
 * - needs_clarification     : ambiguïté bloquante — sujet/objectif réellement manquant
 */
import { INTENT_DOMAINS, EXECUTION_STRATEGIES } from "../../../../../shared/justIntentCatalog.js";
import { isGeneralKnowledgeRequest } from "../../utils/generalKnowledgeIntentGuards.js";
import {
  normalizeFamiliarityQuery,
  parseFamiliarityQuery,
} from "../../utils/familiarityIntentGuards.js";
import { shouldSuppressPrematureClarify } from "../posture/index.js";
import { isPedagogicalOverviewRequest } from "../../utils/pedagogicalOverviewIntentGuards.js";
import { isBeginnerTopicOverviewRequest } from "../../utils/beginnerTopicOverviewIntentGuards.js";
import { isCodeConceptExplainRequest } from "../code/codeConceptExplainPolicy.js";
import { isTechnicalOverviewRequest } from "../../utils/technicalOverviewIntentGuards.js";
import { isDebugDiagnosticRequest } from "../../utils/debugDiagnosticIntentGuards.js";
import { isCompareChooseRequest, extractCompareDomain } from "../../utils/compareChooseIntentGuards.js";
import {
  getMissingProductRecommendationSlots,
  buildProductRecommendationClarifyReply,
} from "./compareChooseCompositePolicy.js";
import { isAdminProcedureRequest } from "../../utils/adminProcedureIntentGuards.js";
import { isCareerLearningPathRequest } from "../../utils/careerLearningPathIntentGuards.js";
import { isTechnicalLearningPathRequest } from "../../utils/technicalLearningPathIntentGuards.js";
import { isInformationSeekingWithTarget } from "../../utils/informationSeekingIntentGuards.js";
import { isTranslationRequestReady, isTranslationPipelineReady, isMultiTargetTranslationRequest } from "../../utils/translationIntentGuards.js";
import {
  isMathArithmeticSatisfiable,
  isMathSimpleSatisfiable,
  isMathRootSatisfiable,
  isMathGeometrySatisfiable,
  isMathPercentSatisfiable,
  isMathExplainRequest,
  isMathExplainSatisfiable,
  isMathFactorizationGeneralRequest,
} from "../math/index.js";
import { isQueryCompositeSatisfiable } from "../conversation/conversationQueryUnderstanding.js";
import {
  isDocumentSynthesisSatisfiable,
  buildMissingSourceClarifyReply,
  hasDocumentSynthesisShell,
} from "../document/index.js";
import {
  getMissingDocumentSynthesisSlots,
  isDocumentSynthesisSegment,
} from "../document/index.js";
import {
  isFamiliarityDomainOverviewSatisfiable,
  isSubjectReferenceResumeSatisfiable,
} from "../familiarity/index.js";
import { isSubjectReferenceAvailabilityRequest } from "../../micro/continuity/sessionSubjectReferenceGuards.js";
import {
  isTrafficCurrentRequestSatisfiable,
  isWeatherCurrentRequestSatisfiable,
} from "../web/index.js";
import { isPromptForArtifactSatisfiable } from "../delivery/index.js";
import { isPedagogySoftOverviewSatisfiable } from "../pedagogical/index.js";
import { isLexiconExplainLightRequest } from "../pedagogical/index.js";
import {
  buildConversationContinuityContext,
  isFullExplanationResumeRequest,
  isConversationContinuityFollowup,
} from "../../micro/continuity/conversationContinuityContext.js";
import { isMetaAssistantBehaviorRequest, isComprehensionDemonstrationRequest } from "../../utils/metaAssistantBehaviorGuards.js";
import { isMetaConversationIntent } from "../../utils/metaConversationIntentGuards.js";
import { isExploratoryTopicIntent } from "../../utils/exploratoryConversationGuards.js";
import {
  isSocialChatThreadActive,
  isSoftSocialChatFollowup,
  isKnownSocialPattern,
} from "../social/index.js";
import {
  EPISTEMIC_ACTIONS,
  evaluateEpistemicUncertaintyResolution,
} from "../epistemic/index.js";
import { isReactAuditRequest } from "../../utils/reactAuditIntentGuards.js";
import { shouldAllowClarifyThenBuild } from "../../utils/deliverableMandateGuards.js";
import { isExistingSourceAnalysisSatisfiable } from "../analysis/index.js";
import {
  decomposeRequest,
  suppressesClarificationForDecomposedRequest,
} from "./requestDecompositionPolicy.js";
import { isBenignProceduralHowToRequest } from "../qualification/howToQualificationPolicy.js";
import { isConversationSocialOnlyQuery } from "../intent/conversationIntentFrame.js";
import { isOpenExplorationFrame } from "../conversation/openExplorationFramePolicy.js";
import {
  isInlineProductBriefPaste,
  isProjectScopingAssistRequest,
} from "../guided/index.js";
import { isAssistantUtteranceClarifyRequest } from "../qualification/assistantUtteranceClarifyPolicy.js";
import {
  classifySummaryContract,
  SUMMARY_INTENTS,
} from "../summary/index.js";
import {
  buildIntentClarificationMessage,
  TRIAGE_ROUTING_ACTION,
} from "../../classifiers/intentTriageClassifier.js";

export const CLARIFICATION_DECISION_CONTRACT = "CLARIFICATION_DECISION_V1";

/** Chemin pipeline unifié — lot 1 clarification gate. */
export const CLARIFICATION_GATE_PIPELINE_PATH = "clarification_gate";

export const CLARIFICATION_SOURCES = Object.freeze({
  BLOCKING_AMBIGUITY: "blocking_ambiguity",
  JUST_INTENT: "just_intent",
  TRIAGE_INTENT_AMBIGUITY: "triage_intent_ambiguity",
});

export const CLARIFICATION_DECISIONS = Object.freeze({
  CAN_ANSWER_NOW: "can_answer_now",
  NEEDS_CLARIFICATION: "needs_clarification",
  CAN_ANSWER_WITH_ASSUMPTIONS: "can_answer_with_assumptions",
});

export const CLARIFICATION_ROUTING_RULE =
  "clarify_only_on_blocking_ambiguity_not_answerable_breadth";

const SOCIAL_SHORT_RE =
  /^(salut|bonjour|hello|coucou|hey|yépa|yepa|merci|ok|d'accord|dacord|bien|bonsoir|top|top top|au top|c'est top|tout bon|carré|carre|ok top)\b/i;

const DETERMINISTIC_SHORT_RE =
  /\b(comment ça va|ca va|quel est ton nom|ton nom|comment tu t['’]appelles|comment t['’]appelles[-\s]?tu|comment t appelles tu|tu t['’]appelles comment|qui es[-\s]?tu|quelle heure est[-\s]?il|quelle heure est il|heure actuelle|quelle est la date|date du jour|jour actuel|date actuelle|quel jour sommes nous|quel jour sommes[- ]nous|quel jour on est|top|top top|au top|c'est top|tout bon|carré|carre|ok top|yépa|yepa)\b/i;

/** Sujet/objectif réellement absent — clarification légitime. */
const BLOCKING_AMBIGUITY_RE =
  /\b(fais quelque chose|fais moi quelque chose|genere quelque chose|génère quelque chose|aide[- ]?moi pour mon projet|aide moi pour mon projet|help me\b|un truc\b|ce truc\b|cette chose\b|mon truc\b|je sais pas quoi\b|je ne sais pas quoi\b)\b/i;

/** « aide moi » seul ou sans cible — pas « aide moi à préciser le projet ». */
const BARE_HELP_REQUEST_RE =
  /^aide[- ]?moi\s*[!.?…]*$|^help me\s*[!.?]*$/i;

const DEICTIC_ONLY_SUBJECT_RE =
  /^(?:parle[- ]?moi de|dis[- ]?moi en plus sur|que sais[- ]?tu de)\s+(?:ce truc|cette chose|mon truc|quelque chose)\b/;

/**
 * @param {string} query
 * @returns {boolean}
 */
/**
 * Normalisation amont unique pour la gate de clarification.
 * @param {string} query
 */
export function normalizeQueryForClarificationGate(query = "") {
  return normalizeFamiliarityQuery(query)
    .replace(/\?\s*\?+/g, "?")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function isBlockingAmbiguityQuery(query = "") {
  const q = normalizeQueryForClarificationGate(query);
  if (!q) return true;
  if (DEICTIC_ONLY_SUBJECT_RE.test(q)) return true;
  if (BLOCKING_AMBIGUITY_RE.test(q)) return true;
  if (BARE_HELP_REQUEST_RE.test(q)) return true;
  if (q.length < 10 && /^(aide|help|fais|genere|generer)\b/.test(q)) return true;
  return false;
}

/**
 * @param {string} query
 * @param {ReturnType<import('./justIntentDetectionPolicy.js').evaluateJustIntent>} [evaluation]
 * @param {{ top_intent?: string, confidence?: string }|null} [intentTriage]
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {{
 *   contract: string,
 *   decision: string,
 *   reason: string,
 *   avoidableClarification: boolean,
 *   signals: string[],
 * }}
 */
export function evaluateClarificationDecision(
  query = "",
  evaluation = {},
  intentTriage = null,
  history = [],
  attachments = [],
) {
  const signals = [];
  const q = normalizeQueryForClarificationGate(query);

  // R4 — sujet/format déjà ancrés : pas de clarify objectif/format prématuré
  if (shouldSuppressPrematureClarify(query)) {
    signals.push("voice_continuity_r4_anchored");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "voice_anchor_no_premature_clarify",
      true,
      signals,
    );
  }

  if (isReactAuditRequest(query, { history })) {
    signals.push("react_audit_g48");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "react_audit_answerable",
      true,
      signals,
    );
  }

  if (isComprehensionDemonstrationRequest(query)) {
    signals.push("comprehension_grounding_g45");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "comprehension_grounding_answerable",
      true,
      signals,
    );
  }

  if (isMetaAssistantBehaviorRequest(query)) {
    signals.push("meta_assistant_behavior");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "meta_assistant_behavior_answerable",
      true,
      signals,
    );
  }

  if (isAssistantUtteranceClarifyRequest(query, { history })) {
    signals.push("assistant_utterance_clarify_g44");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "assistant_utterance_clarify_answerable",
      true,
      signals,
    );
  }

  if (isExploratoryTopicIntent(query)) {
    signals.push("exploratory_conversation");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "exploratory_conversation_answerable",
      true,
      signals,
    );
  }

  if (isBenignProceduralHowToRequest(query)) {
    signals.push("how_to_procedural");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "how_to_procedural_answerable",
      true,
      signals,
    );
  }

  if (isExistingSourceAnalysisSatisfiable(query)) {
    signals.push("existing_source_analysis");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "existing_source_analysis_answerable",
      true,
      signals,
    );
  }

  if (isCodeConceptExplainRequest(query)) {
    signals.push("code_concept_explain_g40");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "code_concept_explain_answerable",
      true,
      signals,
    );
  }

  if (isOpenExplorationFrame(query)) {
    signals.push("open_exploration_frame");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "open_exploration_frame_answerable",
      true,
      signals,
    );
  }

  if (isKnownSocialPattern(query)) {
    signals.push("social_pattern_hardening_g35");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "known_social_pattern_answerable",
      true,
      signals,
    );
  }

  const summaryContract = classifySummaryContract(query, { attachments, history });
  if (summaryContract) {
    if (summaryContract.intent === SUMMARY_INTENTS.KNOWN_ENTITY) {
      signals.push("summary_known_entity_answerable");
      signals.push("cultural_content_summary_g37");
      return pack(
        CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
        "summary_known_entity_answerable",
        true,
        signals,
      );
    }

    if (summaryContract.intent === SUMMARY_INTENTS.AMBIGUOUS) {
      signals.push("summary_ambiguous_kind");
      if (summaryContract.source?.missing_reason) {
        signals.push(`summary_missing:${summaryContract.source.missing_reason}`);
      }
      return pack(
        CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION,
        "summary_ambiguous_kind",
        false,
        signals,
      );
    }

    if (summaryContract.clarification?.needed) {
      signals.push("summary_missing_source");
      if (summaryContract.source?.missing_reason) {
        signals.push(`summary_missing:${summaryContract.source.missing_reason}`);
      }
      return pack(
        CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION,
        "summary_missing_source",
        false,
        signals,
      );
    }
  }

  if (isConversationSocialOnlyQuery(query)) {
    signals.push("conversation_social_only");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "conversation_social_only",
      true,
      signals,
    );
  }

  const requestDecomposition = decomposeRequest(query, history);
  if (suppressesClarificationForDecomposedRequest(requestDecomposition)) {
    signals.push(`request_decomp:${requestDecomposition.requestMode}`);
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      `request_decomposition_${requestDecomposition.requestMode}`,
      true,
      signals,
    );
  }

  if (isPedagogySoftOverviewSatisfiable(query)) {
    signals.push("pedagogy_soft_overview");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "pedagogy_soft_overview_answerable",
      true,
      signals,
    );
  }

  if (isPromptForArtifactSatisfiable(query)) {
    signals.push("prompt_for_artifact");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "prompt_for_artifact_deterministic",
      true,
      signals,
    );
  }

  if (isLexiconExplainLightRequest(query)) {
    signals.push("lexicon_explain_light");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "lexicon_explain_light_answerable",
      true,
      signals,
    );
  }

  if (isMetaConversationIntent(query)) {
    signals.push("meta_conversation");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "meta_conversation_answerable",
      true,
      signals,
    );
  }

  const continuityState = buildConversationContinuityContext(history).state;
  if (isFullExplanationResumeRequest(query, continuityState)) {
    signals.push("continuity_full_resume");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "continuity_full_resume_answerable",
      true,
      signals,
    );
  }

  if (isConversationContinuityFollowup(query, history)) {
    signals.push("conversation_continuity_followup");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "conversation_continuity_followup",
      true,
      signals,
    );
  }

  if (isSocialChatThreadActive(history) && isSoftSocialChatFollowup(query)) {
    signals.push("social_chat_continuity");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "social_chat_continuity_answerable",
      true,
      signals,
    );
  }

  const epistemic = evaluateEpistemicUncertaintyResolution(query, { history });
  if (
    epistemic.action === EPISTEMIC_ACTIONS.TARGETED_CLARIFY ||
    epistemic.action === EPISTEMIC_ACTIONS.ADMIT_UNCERTAINTY
  ) {
    signals.push(`epistemic_${epistemic.action}`);
    // La couche épistémique produit la clarification ciblée / l'aveu — pas le gate générique
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "epistemic_uncertainty_resolution_handles",
      true,
      signals,
    );
  }

  if (isTrafficCurrentRequestSatisfiable(query)) {
    signals.push("traffic_current_request");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "traffic_current_request_web_first",
      true,
      signals,
    );
  }

  if (isWeatherCurrentRequestSatisfiable(query)) {
    signals.push("weather_current_request");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "weather_current_request_web_first",
      true,
      signals,
    );
  }

  if (isSubjectReferenceAvailabilityRequest(query)) {
    if (isSubjectReferenceResumeSatisfiable(query, history)) {
      signals.push("subject_reference_resume");
      return pack(
        CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
        "subject_reference_resume_answerable",
        true,
        signals,
      );
    }
    signals.push("subject_reference_unresolved");
    return pack(
      CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION,
      "subject_reference_implicit_unresolved",
      false,
      signals,
    );
  }

  if (parseFamiliarityQuery(query)) {
    if (isFamiliarityDomainOverviewSatisfiable(query)) {
      signals.push("familiarity_domain_overview");
    } else {
      signals.push("familiarity_overview");
    }
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "familiarity_answerable_breadth",
      true,
      signals,
    );
  }

  if (isPedagogicalOverviewRequest(query)) {
    signals.push("pedagogical_overview");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "pedagogical_overview_answerable",
      true,
      signals,
    );
  }

  if (isBeginnerTopicOverviewRequest(query)) {
    signals.push("beginner_topic_overview");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "beginner_topic_overview_answerable",
      true,
      signals,
    );
  }

  if (isCareerLearningPathRequest(query)) {
    signals.push("career_learning_path");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "career_learning_path_answerable",
      true,
      signals,
    );
  }

  if (isTechnicalLearningPathRequest(query)) {
    signals.push("technical_learning_path");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "technical_learning_path_answerable",
      true,
      signals,
    );
  }

  if (isTechnicalOverviewRequest(query)) {
    signals.push("technical_overview");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "technical_overview_answerable",
      true,
      signals,
    );
  }

  if (isInformationSeekingWithTarget(query)) {
    signals.push("information_seeking_with_target");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "information_seeking_answerable",
      true,
      signals,
    );
  }

  if (isTranslationPipelineReady(query, history)) {
    signals.push("translation_pipeline_ready");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      isMultiTargetTranslationRequest(query)
        ? "translation_multi_target_pipeline_ready"
        : "translation_answerable",
      true,
      signals,
    );
  }

  if (isTranslationRequestReady(query)) {
    signals.push("translation_request_ready");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "translation_answerable",
      true,
      signals,
    );
  }

  if (isQueryCompositeSatisfiable(query)) {
    signals.push("query_composite");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "query_composite_answerable",
      true,
      signals,
    );
  }

  if (isMathArithmeticSatisfiable(query)) {
    signals.push("math_arithmetic");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "math_arithmetic_answerable",
      true,
      signals,
    );
  }

  if (isMathSimpleSatisfiable(query)) {
    signals.push("math_simple");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "math_simple_answerable",
      true,
      signals,
    );
  }

  if (isMathRootSatisfiable(query)) {
    signals.push("math_root");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "math_root_answerable",
      true,
      signals,
    );
  }

  if (isMathGeometrySatisfiable(query)) {
    signals.push("math_geometry");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "math_geometry_answerable",
      true,
      signals,
    );
  }

  if (isMathExplainSatisfiable(query) || isMathExplainRequest(query)) {
    signals.push("math_explain");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      isMathExplainSatisfiable(query)
        ? "math_explain_answerable"
        : isMathFactorizationGeneralRequest(query)
          ? "math_factorization_general_answerable"
          : "math_explain_theory_answerable",
      true,
      signals,
    );
  }

  if (isMathPercentSatisfiable(query)) {
    signals.push("math_percent");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "math_percent_answerable",
      true,
      signals,
    );
  }

  if (
    isDocumentSynthesisSegment(query) ||
    hasDocumentSynthesisShell(query)
  ) {
    const missing = getMissingDocumentSynthesisSlots(query, history, attachments);
    if (missing.includes("source")) {
      signals.push("document_synthesis");
      return pack(
        CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION,
        "document_synthesis_missing_source",
        false,
        signals,
      );
    }
  }

  if (isDocumentSynthesisSatisfiable(query, history, attachments)) {
    signals.push("document_synthesis");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "document_synthesis_answerable",
      true,
      signals,
    );
  }

  if (isDebugDiagnosticRequest(query)) {
    signals.push("debug_diagnostic");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "debug_diagnostic_answerable",
      true,
      signals,
    );
  }

  if (isCompareChooseRequest(query)) {
    signals.push("compare_choose");
    const missing = getMissingProductRecommendationSlots(
      query,
      extractCompareDomain(query),
    );
    if (missing.length > 0) {
      return pack(
        CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION,
        "compare_choose_missing_slots",
        false,
        signals,
      );
    }
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "compare_choose_answerable",
      true,
      signals,
    );
  }

  if (isAdminProcedureRequest(query)) {
    signals.push("admin_procedure");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "admin_procedure_answerable",
      true,
      signals,
    );
  }

  if (isGeneralKnowledgeRequest(query)) {
    signals.push("general_knowledge");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "general_knowledge_generous_path",
      true,
      signals,
    );
  }

  if (DETERMINISTIC_SHORT_RE.test(q)) {
    signals.push("deterministic_short");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "deterministic_short_circuit",
      true,
      signals,
    );
  }

  if (q.length < 18 && SOCIAL_SHORT_RE.test(q)) {
    signals.push("social_short");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "social_greeting",
      true,
      signals,
    );
  }

  if (
    intentTriage?.top_intent === "general" &&
    intentTriage?.confidence === "high" &&
    q.length < 24
  ) {
    signals.push("triage_high_confidence");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "intent_triage_high_confidence",
      true,
      signals,
    );
  }

  if (isProjectScopingAssistRequest(query)) {
    signals.push("project_scoping_assist");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "project_scoping_assist_answerable",
      true,
      signals,
    );
  }

  if (isInlineProductBriefPaste(query)) {
    signals.push("inline_product_brief");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "inline_product_brief_synthesis",
      true,
      signals,
    );
  }

  if (
    /\b(?:le|mon|ce)\s+projet\b/i.test(q) &&
    Array.isArray(history) &&
    history.some((m) =>
      /\b(?:saas|projet|cadrage|forge|mvp)\b/i.test(String(m?.content || "")),
    )
  ) {
    signals.push("project_thread_anchor");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "project_thread_scoping_answerable",
      true,
      signals,
    );
  }

  if (isBlockingAmbiguityQuery(query)) {
    signals.push("blocking_ambiguity");
    return pack(
      CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION,
      "blocking_ambiguity_subject_or_goal_missing",
      false,
      signals,
    );
  }

  if (evaluation.canBuildDirectly) {
    signals.push("can_build_directly");
    if (evaluation.strategy === EXECUTION_STRATEGIES.BUILD_WITH_SMART_DEFAULTS) {
      return pack(
        CLARIFICATION_DECISIONS.CAN_ANSWER_WITH_ASSUMPTIONS,
        "smart_defaults_without_blocking_ambiguity",
        false,
        signals,
      );
    }
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      "build_v1_without_blocking_ambiguity",
      false,
      signals,
    );
  }

  if (evaluation.strategy === EXECUTION_STRATEGIES.BUILD_WITH_SMART_DEFAULTS) {
    signals.push("strategy_smart_defaults");
    return pack(
      CLARIFICATION_DECISIONS.CAN_ANSWER_WITH_ASSUMPTIONS,
      "build_with_smart_defaults",
      false,
      signals,
    );
  }

  if (
    evaluation.strategy === EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD &&
    (evaluation.clarificationQuestions?.length ?? 0) > 0 &&
    evaluation.domain === INTENT_DOMAINS.GENERAL &&
    q.length >= 12
  ) {
    if (!shouldAllowClarifyThenBuild(query, evaluation)) {
      signals.push("conversational_bypass_clarify");
      return pack(
        CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
        "exploratory_or_meta_bypass_clarify",
        true,
        signals,
      );
    }
    signals.push("legacy_general_partial_ambiguity");
    return pack(
      CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION,
      "general_partial_ambiguity",
      false,
      signals,
    );
  }

  if (
    evaluation.strategy === EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD &&
    (evaluation.clarificationQuestions?.length ?? 0) > 0
  ) {
    if (!shouldAllowClarifyThenBuild(query, evaluation)) {
      signals.push("conversational_bypass_clarify");
      return pack(
        CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
        "exploratory_or_meta_bypass_clarify",
        true,
        signals,
      );
    }
    signals.push("domain_specific_clarify");
    return pack(
      CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION,
      "domain_specific_clarify_then_build",
      false,
      signals,
    );
  }

  return pack(
    CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
    "default_no_clarification",
    false,
    signals,
  );
}

function buildJustIntentStyleClarification(evaluation = {}, query = "") {
  const qs = evaluation.clarificationQuestions || [];
  if (!qs.length) return "";

  let prefix = "";
  if (evaluation.domain === INTENT_DOMAINS.GENERAL && query) {
    const cleanQuery = query.trim();
    if (cleanQuery.length > 0 && cleanQuery.length < 200) {
      prefix = `Je n'ai pas compris ce que tu entends par "${cleanQuery}".\n`;
    }
  }

  const header = "Il faudrait que tu arrives à préciser :";
  const body = qs.map((item, i) => `${i + 1}. ${item}`).join("\n");
  return `${prefix}${header}\n${body}\nRéponds en une phrase et je s'occupe de tout, tu s'occupes de rien!!!`;
}

function buildBlockingAmbiguityMessage() {
  return (
    "Je n'ai pas assez d'éléments pour avancer.\n\n" +
    "Précise en une phrase ce que tu veux obtenir (sujet, objectif ou format)."
  );
}

function resolveClarificationSource(decisionResult = {}, intentTriage = null) {
  if (decisionResult.reason === "blocking_ambiguity_subject_or_goal_missing") {
    return CLARIFICATION_SOURCES.BLOCKING_AMBIGUITY;
  }
  if (
    intentTriage?.routing_action === TRIAGE_ROUTING_ACTION.ASK_CLARIFICATION &&
    intentTriage?.runner_up
  ) {
    return CLARIFICATION_SOURCES.TRIAGE_INTENT_AMBIGUITY;
  }
  return CLARIFICATION_SOURCES.JUST_INTENT;
}

/**
 * Message de clarification unifié (triage ou just_intent).
 * @param {{
 *   source: string,
 *   query?: string,
 *   justIntent?: object,
 *   intentTriage?: object|null,
 * }} params
 */
export function buildClarificationMessage({
  source,
  query = "",
  justIntent = {},
  intentTriage = null,
} = {}) {
  if (isCompareChooseRequest(query)) {
    const missing = getMissingProductRecommendationSlots(
      query,
      extractCompareDomain(query),
    );
    if (missing.length > 0) {
      return buildProductRecommendationClarifyReply(missing);
    }
  }

  if (isDocumentSynthesisSegment(query) || hasDocumentSynthesisShell(query)) {
    const missing = getMissingDocumentSynthesisSlots(query, [], []);
    if (missing.includes("source")) {
      return buildMissingSourceClarifyReply();
    }
  }

  if (
    source === CLARIFICATION_SOURCES.TRIAGE_INTENT_AMBIGUITY &&
    intentTriage?.runner_up
  ) {
    return buildIntentClarificationMessage(intentTriage);
  }

  const justMsg = buildJustIntentStyleClarification(justIntent, query);
  if (justMsg) return justMsg;

  if (intentTriage?.routing_action === TRIAGE_ROUTING_ACTION.ASK_CLARIFICATION) {
    return buildIntentClarificationMessage(intentTriage);
  }

  return buildBlockingAmbiguityMessage();
}

/**
 * Porte unique de clarification — triage subordonné à CLARIFICATION_DECISION_V1.
 * @param {string} query
 * @param {{
 *   justIntent: ReturnType<import('./justIntentDetectionPolicy.js').evaluateJustIntent>,
 *   intentTriage?: object|null,
 *   history?: Array<{ role?: string, content?: string }>,
 *   attachments?: unknown[],
 * }} ctx
 */
export function resolveClarificationGate(
  query = "",
  { justIntent = {}, intentTriage = null, history = [], attachments = [] } = {},
) {
  const normalizedQuery = normalizeQueryForClarificationGate(query);
  const decision = evaluateClarificationDecision(
    normalizedQuery,
    justIntent,
    intentTriage,
    history,
    attachments,
  );
  const triageWantsClarify =
    intentTriage?.routing_action === TRIAGE_ROUTING_ACTION.ASK_CLARIFICATION;

  if (decision.decision === CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION) {
    const source = resolveClarificationSource(decision, intentTriage);
    const message = buildClarificationMessage({
      source,
      query: normalizedQuery,
      justIntent,
      intentTriage,
    });
    return {
      contract: CLARIFICATION_DECISION_CONTRACT,
      shouldClarify: Boolean(message),
      source,
      pipelinePath: CLARIFICATION_GATE_PIPELINE_PATH,
      message,
      decision,
      triageSuppressed: false,
      normalizedQuery,
    };
  }

  const triageSuppressed =
    triageWantsClarify &&
    (decision.decision === CLARIFICATION_DECISIONS.CAN_ANSWER_NOW ||
      decision.decision === CLARIFICATION_DECISIONS.CAN_ANSWER_WITH_ASSUMPTIONS);

  return {
    contract: CLARIFICATION_DECISION_CONTRACT,
    shouldClarify: false,
    source: null,
    pipelinePath: null,
    message: "",
    decision,
    triageSuppressed,
    normalizedQuery,
  };
}

/**
 * @param {string} query
 * @param {ReturnType<import('./justIntentDetectionPolicy.js').evaluateJustIntent>} evaluation
 * @param {Parameters<typeof evaluateClarificationDecision>[2]} intentTriage
 */
export function shouldApplyJustIntentClarificationFromDecision(
  query = "",
  evaluation = {},
  intentTriage = null,
) {
  return resolveClarificationGate(query, {
    justIntent: evaluation,
    intentTriage,
  }).shouldClarify;
}

/**
 * Clarification déclenchée alors qu'une réponse immédiate était possible.
 * @param {ReturnType<typeof evaluateClarificationDecision>} decisionResult
 * @param {{ clarificationUsed?: boolean }} [outcome]
 */
export function isAvoidableClarification(decisionResult = {}, outcome = {}) {
  return (
    Boolean(outcome.clarificationUsed) &&
    Boolean(decisionResult.avoidableClarification)
  );
}

function pack(decision, reason, avoidableClarification, signals) {
  return {
    contract: CLARIFICATION_DECISION_CONTRACT,
    decision,
    reason,
    avoidableClarification,
    signals,
  };
}
