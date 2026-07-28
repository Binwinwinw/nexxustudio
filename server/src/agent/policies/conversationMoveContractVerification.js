/**
 * verifyMoveContract — moteur P3 transversal par famille ConversationMove.
 * Spec : docs/agents/conversation-move-governance.md (invariant I2, étape 9)
 */
import {
  isInsufficientSignalRefusal,
  INSUFFICIENT_SIGNAL_REFUSAL,
} from "../config/modeResponseContracts.js";
import {
  isHowToProceduralContractViolation,
  isHowToProceduralSocialDrift,
  isHowToProceduralTopicViolation,
  enforceHowToProceduralDirectness,
} from "./howToQualificationPolicy.js";
import {
  isSimpleFactualContractViolation,
  enforceSimpleFactualDirectness,
  isHistoricalDateQuestion,
  isDatetimeSubjectMismatch,
} from "../micro/replies/simpleFactualComposer.js";
import {
  isDebugDiagnosticOverRefusal,
  enforceDebugDiagnosticDirectness,
} from "../micro/replies/debugDiagnosticComposer.js";
import {
  isWebProjectScopingContractViolation,
  enforceWebProjectScopingDirectness,
} from "../utils/webProjectScopingGuards.js";
import {
  isInformationSeekingContractViolation,
  enforceInformationSeekingDirectness,
} from "./informationSeekingQualificationPolicy.js";
import {
  isMultiSegmentContractViolation,
  enforceMultiSegmentDirectness,
} from "./multiSegmentQualificationPolicy.js";
import { resolveMultiSegmentPlan } from "../micro/parsing/multiSegmentResponsePlan.js";
import {
  isCompareChooseRequest,
  extractCompareDomain,
} from "../utils/compareChooseIntentGuards.js";
import { isGuidedProductRecommendationRequest } from "./guidedProductRecommendationPolicy.js";

export const MOVE_CONTRACT_PROFILES = Object.freeze({
  HOW_TO_PROCEDURAL: "how_to_procedural",
  SIMPLE_FACTUAL: "simple_factual",
  DEBUG_DIAGNOSTIC: "debug_diagnostic",
  WEB_PROJECT_SCOPING: "web_project_scoping",
  DATETIME_DETERMINISTIC: "datetime_deterministic",
  INFORMATION_SEEKING: "information_seeking",
  MULTI_SEGMENT_COMPOSITE: "multi_segment_composite",
});

const PSEUDO_CLARIFY_COMMON_RE =
  /\b(?:je vois la piste|pas encore la destination|objectif en une phrase|donne[- ]moi l['']objectif|pr[ée]cise(?:\s+ton|\s+ta)?\s+(?:besoin|objectif|format|angle)|je n['']?ai pas pu finaliser|reessaie ou precise|réessaie ou précise)\b/i;

const SOCIAL_DRIFT_COMMON_RE =
  /\b(?:bonjour|salut|coucou|hello|hey|bonsoir)\b.*\b(?:comment puis[- ]je t['']aider|tout va bien|comment puis[- ]je vous aider)\b|\bcomment puis[- ]je t['']aider\b/i;

/**
 * @param {string} text
 */
export function detectEmptySurface(text = "") {
  return !String(text || "").trim();
}

/**
 * @param {string} text
 */
export function detectRefusalLikeSurface(text = "") {
  const probe = String(text || "").trim();
  return (
    !probe ||
    probe === INSUFFICIENT_SIGNAL_REFUSAL ||
    isInsufficientSignalRefusal(probe)
  );
}

/**
 * @param {string} text
 */
export function detectPseudoClarifySurface(text = "") {
  return PSEUDO_CLARIFY_COMMON_RE.test(String(text || "").trim());
}

/**
 * @param {string} text
 */
export function detectSocialDriftSurface(text = "") {
  return SOCIAL_DRIFT_COMMON_RE.test(String(text || "").trim());
}

/**
 * @param {object} conversationMove
 * @param {string|null} pipelinePath
 * @returns {string|null}
 */
/**
 * @param {object} conversationMove
 * @param {string|null} pipelinePath
 * @param {string} [query]
 * @returns {string|null}
 */
export function resolveMoveContractProfile(
  conversationMove = {},
  pipelinePath = null,
  query = "",
) {
  const path = String(pipelinePath || conversationMove.pipelinePath || "");
  const family = String(conversationMove.family || "");

  // Rails méta déterministes : jamais écrasés par le contrat information_seeking
  // (sinon fiche Vision → rewrite « prix / specs / actu » si family residual).
  if (
    path.startsWith("meta_capabilities") ||
    path.startsWith("meta_conversation") ||
    family === "meta_capabilities" ||
    family === "meta_conversation"
  ) {
    return null;
  }

  if (
    path === "how_to_procedural_llm" ||
    (family === "how_to" &&
      (path.includes("how_to_procedural") || path === "COMPOSER"))
  ) {
    return MOVE_CONTRACT_PROFILES.HOW_TO_PROCEDURAL;
  }
  // social_deterministic = panels / check-ins — pas le rail datetime (évite rewrite factuel).
  if (path === "datetime_deterministic") {
    return MOVE_CONTRACT_PROFILES.DATETIME_DETERMINISTIC;
  }
  if (path === "multi_segment_composite") {
    return MOVE_CONTRACT_PROFILES.MULTI_SEGMENT_COMPOSITE;
  }
  // Comparatif produit : validé par productReco / composer — pas le rail « fiche locale ».
  if (
    path === "compare_choose" ||
    path.startsWith("compare_choose") ||
    family === "compare_choose" ||
    (query &&
      (isGuidedProductRecommendationRequest(query) ||
        (isCompareChooseRequest(query) &&
          extractCompareDomain(query) === "product")))
  ) {
    return null;
  }
  if (
    path === "information_seeking_full_pipeline" ||
    path === "information_seeking_escalation" ||
    path === "general_knowledge_full_pipeline" ||
    path === "general_knowledge_deterministic" ||
    family === "information_seeking" ||
    family === "general_knowledge"
  ) {
    return MOVE_CONTRACT_PROFILES.INFORMATION_SEEKING;
  }
  if (
    path === "simple_factual_lookup" ||
    family === "factual_lookup" ||
    (path === "COMPOSER" && family === "factual_lookup")
  ) {
    return MOVE_CONTRACT_PROFILES.SIMPLE_FACTUAL;
  }
  if (path === "debug_diagnostic" || family === "debug_diagnostic") {
    return MOVE_CONTRACT_PROFILES.DEBUG_DIAGNOSTIC;
  }
  if (
    path.startsWith("web_project_scoping") ||
    family === "web_project_scoping"
  ) {
    return MOVE_CONTRACT_PROFILES.WEB_PROJECT_SCOPING;
  }
  return null;
}

/**
 * @param {string} text
 * @param {string} query
 * @param {{ conversationMove?: object, pipelinePath?: string|null }} ctx
 */
export function detectMoveContractViolations(
  text = "",
  query = "",
  { conversationMove = {}, pipelinePath = null, segmentPlan = null } = {},
) {
  const profile = resolveMoveContractProfile(
    conversationMove,
    pipelinePath,
    query,
  );
  if (!profile) {
    return {
      applicable: false,
      profile: null,
      violated: false,
      signals: [],
    };
  }

  const signals = [];
  const probe = String(text || "").trim();

  switch (profile) {
    case MOVE_CONTRACT_PROFILES.HOW_TO_PROCEDURAL:
      if (!isHowToProceduralContractViolation(probe, query)) break;
      if (detectEmptySurface(probe)) signals.push("empty_response");
      if (detectRefusalLikeSurface(probe)) {
        signals.push("insufficient_signal_refusal");
      } else if (detectPseudoClarifySurface(probe)) {
        signals.push("pseudo_clarify_prompt");
      } else if (
        isHowToProceduralSocialDrift(probe) ||
        detectSocialDriftSurface(probe)
      ) {
        signals.push("social_drift");
      } else if (isHowToProceduralTopicViolation(probe, query)) {
        signals.push("off_topic_surface");
      }
      break;
    case MOVE_CONTRACT_PROFILES.SIMPLE_FACTUAL:
      if (!isSimpleFactualContractViolation(probe, query)) break;
      if (detectEmptySurface(probe)) signals.push("empty_response");
      if (detectRefusalLikeSurface(probe) || detectPseudoClarifySurface(probe)) {
        signals.push("pseudo_clarify_or_recovery");
      } else if (detectSocialDriftSurface(probe)) {
        signals.push("social_drift");
      } else {
        signals.push("factual_answer_miss");
      }
      break;
    case MOVE_CONTRACT_PROFILES.DEBUG_DIAGNOSTIC:
      if (!isDebugDiagnosticOverRefusal(probe)) break;
      if (detectEmptySurface(probe)) signals.push("empty_response");
      if (detectRefusalLikeSurface(probe)) signals.push("insufficient_signal_refusal");
      else signals.push("pseudo_clarify_or_overview");
      break;
    case MOVE_CONTRACT_PROFILES.WEB_PROJECT_SCOPING:
      if (!isWebProjectScopingContractViolation(probe, query, conversationMove)) {
        break;
      }
      if (detectRefusalLikeSurface(probe) || detectPseudoClarifySurface(probe)) {
        signals.push("pseudo_clarify_or_recovery");
      } else if (detectSocialDriftSurface(probe)) {
        signals.push("social_drift");
      } else {
        signals.push("scoping_surface_miss");
      }
      break;
    case MOVE_CONTRACT_PROFILES.DATETIME_DETERMINISTIC:
      if (!isDatetimeSubjectMismatch(probe, query)) break;
      signals.push("datetime_subject_mismatch");
      break;
    case MOVE_CONTRACT_PROFILES.INFORMATION_SEEKING:
      if (!isInformationSeekingContractViolation(probe, query)) break;
      if (detectEmptySurface(probe)) signals.push("empty_response");
      if (detectRefusalLikeSurface(probe) || detectPseudoClarifySurface(probe)) {
        signals.push("pseudo_clarify_or_recovery");
      } else if (detectSocialDriftSurface(probe)) {
        signals.push("social_drift");
      } else {
        signals.push("subject_anchor_miss");
      }
      break;
    case MOVE_CONTRACT_PROFILES.MULTI_SEGMENT_COMPOSITE: {
      const plan = segmentPlan || resolveMultiSegmentPlan(query);
      if (!isMultiSegmentContractViolation(probe, query, plan)) break;
      if (/\bnous sommes le\b/i.test(probe) && probe.length < 200) {
        signals.push("preamble_without_followup");
      } else if (/\bnous sommes le\b/i.test(probe)) {
        signals.push("signal_only_closure");
      } else {
        signals.push("primary_goal_miss");
      }
      break;
    }
    default:
      break;
  }

  const uniqueSignals = [...new Set(signals)];
  return {
    applicable: true,
    profile,
    violated: uniqueSignals.length > 0,
    signals: uniqueSignals,
  };
}

/**
 * @param {string} text
 * @param {string} query
 * @param {{ conversationMove?: object, pipelinePath?: string|null }} ctx
 */
export function enforceMoveContract(
  text = "",
  query = "",
  { conversationMove = {}, pipelinePath = null, segmentPlan = null } = {},
) {
  const profile = resolveMoveContractProfile(
    conversationMove,
    pipelinePath,
    query,
  );
  if (!profile) return String(text || "").trim();

  switch (profile) {
    case MOVE_CONTRACT_PROFILES.HOW_TO_PROCEDURAL:
      return enforceHowToProceduralDirectness(text, query);
    case MOVE_CONTRACT_PROFILES.SIMPLE_FACTUAL:
      return enforceSimpleFactualDirectness(text, query);
    case MOVE_CONTRACT_PROFILES.DEBUG_DIAGNOSTIC:
      return enforceDebugDiagnosticDirectness(text, query);
    case MOVE_CONTRACT_PROFILES.WEB_PROJECT_SCOPING:
      return enforceWebProjectScopingDirectness(text, query, conversationMove);
    case MOVE_CONTRACT_PROFILES.DATETIME_DETERMINISTIC:
      return enforceSimpleFactualDirectness(text, query);
    case MOVE_CONTRACT_PROFILES.INFORMATION_SEEKING:
      return enforceInformationSeekingDirectness(text, query);
    case MOVE_CONTRACT_PROFILES.MULTI_SEGMENT_COMPOSITE:
      return enforceMultiSegmentDirectness(
        text,
        query,
        segmentPlan || resolveMultiSegmentPlan(query),
      );
    default:
      return String(text || "").trim();
  }
}

/**
 * Vérifie et corrige la surface selon le move / pipeline promis.
 * @param {string} text
 * @param {string} query
 * @param {{ conversationMove?: object, pipelinePath?: string|null }} ctx
 */
export function verifyMoveContract(
  text = "",
  query = "",
  { conversationMove = {}, pipelinePath = null, segmentPlan = null } = {},
) {
  const detection = detectMoveContractViolations(text, query, {
    conversationMove,
    pipelinePath,
    segmentPlan,
  });

  if (!detection.applicable || !detection.violated) {
    return {
      applicable: detection.applicable,
      compliant: true,
      profile: detection.profile,
      signals: [],
      text: String(text || "").trim(),
    };
  }

  return {
    applicable: true,
    compliant: false,
    profile: detection.profile,
    signals: detection.signals,
    text: enforceMoveContract(text, query, {
      conversationMove,
      pipelinePath,
      segmentPlan,
    }),
  };
}
