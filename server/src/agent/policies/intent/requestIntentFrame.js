/**
 * RequestIntentFrame v1.1 — couche amont commune (conversation + axes métier).
 * Délègue la détection aux guards existants ; produit une représentation structurée
 * consommable par le routage, justIntent et la doc de gouvernance.
 */
import { analyzeConversationIntentFrame } from "./conversationIntentFrame.js";
import {
  isTechnicalLearningPathRequest,
  isTechnicalLearningPathSignal,
  parseTechnicalLearningPath,
  extractLearningDomain,
} from "../../utils/intent-guards/technicalLearningPathIntentGuards.js";
import {
  isTechnicalOverviewRequest,
  parseTechnicalOverview,
  extractTechnicalSubject,
} from "../../utils/intent-guards/technicalOverviewIntentGuards.js";
import {
  isCareerLearningPathRequest,
  isCareerLearningPathSignal,
  isSecondaryCareerMotivation,
  parseCareerLearningPath,
  extractTargetRole,
} from "../../utils/intent-guards/careerLearningPathIntentGuards.js";
import {
  extractInformationSeekingTarget,
  isInformationSeekingWithTarget,
} from "../../utils/intent-guards/informationSeekingIntentGuards.js";
import {
  extractLearningRequestTarget,
  isLearningRequestForTechnicalDomain,
  isLearningRequestWithTarget,
} from "../../utils/intent-guards/learningRequestIntentGuards.js";
import {
  extractTargetLanguage,
  extractTargetLanguages,
  extractTranslationPayload,
  extractTranslationStyle,
  isTranslationRequest,
} from "../../utils/intent-guards/translationIntentGuards.js";
import { buildTranslationRequestPlan } from "../../utils/parsing-normalization/translationRequestPlan.js";

export const REQUEST_INTENT_FRAME_VERSION = "1.1";

/** @typedef {'learn'|'explain'|'career_path'|'translate'|'debug'|'compare'|'procedure'|'build'|null} TaskKind */
/** @typedef {'technical'|'career'|'pedagogical'|'social'|'general'|null} DomainKind */

/**
 * @param {string} query
 * @returns {TaskKind}
 */
export function detectTaskKind(query = "") {
  if (isTranslationRequest(query)) return "translate";
  if (isTechnicalLearningPathRequest(query)) return "learn";
  if (isCareerLearningPathRequest(query)) return "career_path";
  if (isLearningRequestWithTarget(query)) return "learn";
  if (isTechnicalOverviewRequest(query)) return "explain";
  if (isInformationSeekingWithTarget(query)) return "explain";
  return null;
}

/**
 * @param {string} query
 * @param {TaskKind} taskKind
 * @param {ReturnType<typeof analyzeConversationIntentFrame>} conversation
 * @returns {DomainKind}
 */
export function detectDomainKind(query, taskKind, conversation) {
  if (conversation.socialOnly) return "social";
  if (taskKind === "translate") return "general";
  if (taskKind === "career_path") return "career";
  if (taskKind === "learn") {
    if (
      isTechnicalLearningPathRequest(query) ||
      isLearningRequestForTechnicalDomain(query) ||
      isTechnicalLearningPathSignal(query)
    ) {
      return "technical";
    }
    if (isLearningRequestWithTarget(query)) return "general";
  }
  if (taskKind === "explain") return "technical";
  if (isCareerLearningPathSignal(query)) return "career";
  if (isTechnicalLearningPathSignal(query) || extractTechnicalSubject(query)) {
    return "technical";
  }
  return null;
}

/**
 * @param {string} query
 * @param {TaskKind} taskKind
 * @returns {string|null}
 */
export function detectObjectTarget(query, taskKind) {
  if (taskKind === "translate") {
    const langs = extractTargetLanguages(query);
    if (langs.length > 1) return langs.join(",");
    return langs[0] || extractTargetLanguage(query);
  }
  if (taskKind === "learn") {
    if (isLearningRequestWithTarget(query)) {
      return extractLearningRequestTarget(query);
    }
    const slots = parseTechnicalLearningPath(query);
    return slots?.domainLabel || extractLearningDomain(query) || null;
  }
  if (taskKind === "explain") {
    if (isInformationSeekingWithTarget(query)) {
      return extractInformationSeekingTarget(query);
    }
    const slots = parseTechnicalOverview(query);
    return slots?.techLabel || extractTechnicalSubject(query) || null;
  }
  if (taskKind === "career_path") {
    const slots = parseCareerLearningPath(query);
    return slots?.targetRoleLabel || extractTargetRole(query) || null;
  }
  return null;
}

/**
 * @param {string} query
 * @returns {{ id: string, confidence: "high"|"medium"|"low" }|null}
 */
export function resolveFamilyHint(query = "") {
  const candidates = [];

  if (isTechnicalLearningPathRequest(query)) {
    candidates.push({ id: "technical_learning_path", confidence: "high" });
  } else if (isLearningRequestForTechnicalDomain(query)) {
    candidates.push({ id: "technical_learning_path", confidence: "medium" });
  } else if (isTechnicalLearningPathSignal(query)) {
    candidates.push({ id: "technical_learning_path", confidence: "low" });
  }

  if (isCareerLearningPathRequest(query)) {
    candidates.push({ id: "career_learning_path", confidence: "high" });
  } else if (isCareerLearningPathSignal(query)) {
    candidates.push({ id: "career_learning_path", confidence: "low" });
  }

  if (isTechnicalOverviewRequest(query)) {
    candidates.push({ id: "technical_overview", confidence: "high" });
  } else if (extractTechnicalSubject(query)) {
    candidates.push({ id: "technical_overview", confidence: "low" });
  }

  const high = candidates.filter((c) => c.confidence === "high");
  if (high.length === 1) return high[0];
  if (high.length > 1) {
    return high.sort((a, b) => priorityRank(a.id) - priorityRank(b.id))[0];
  }

  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    return candidates.sort((a, b) => priorityRank(a.id) - priorityRank(b.id))[0];
  }

  return null;
}

/** Ordre de préemption documenté (intent-families-philosophy.md § IntentFrame). */
function priorityRank(familyId) {
  const order = [
    "debug_diagnostic",
    "compare_choose",
    "career_learning_path",
    "technical_learning_path",
    "technical_overview",
  ];
  const idx = order.indexOf(familyId);
  return idx >= 0 ? idx : 99;
}

/**
 * @param {string} query
 * @param {TaskKind} taskKind
 * @param {{ id: string, confidence: string }|null} familyHint
 * @param {ReturnType<typeof analyzeConversationIntentFrame>} conversation
 */
function detectNeedsClarification(query, taskKind, familyHint, conversation) {
  if (conversation.composite && !taskKind) {
    return { needsClarification: true, reason: "composite_without_task_kind" };
  }

  const signals = [
    isTechnicalLearningPathSignal(query),
    isCareerLearningPathSignal(query),
    Boolean(extractTechnicalSubject(query)) &&
      !isTechnicalLearningPathSignal(query) &&
      !isCareerLearningPathSignal(query),
  ].filter(Boolean);

  if (signals.length >= 2 && !familyHint) {
    return { needsClarification: true, reason: "multi_family_signals" };
  }

  if (familyHint?.confidence === "low" && !taskKind) {
    return { needsClarification: true, reason: "weak_family_hint" };
  }

  return { needsClarification: false, reason: null };
}

/**
 * Frame complet — API interne de compréhension structurée.
 * @param {string} query
 */
export function analyzeRequestIntentFrame(query = "") {
  const conversation = analyzeConversationIntentFrame(query);
  const taskKind = conversation.socialOnly ? null : detectTaskKind(query);
  const domainKind = detectDomainKind(query, taskKind, conversation);
  const objectTarget = conversation.socialOnly ? null : detectObjectTarget(query, taskKind);
  const familyHint = conversation.socialOnly ? null : resolveFamilyHint(query);
  const { needsClarification, reason: clarificationReason } = detectNeedsClarification(
    query,
    taskKind,
    familyHint,
    conversation,
  );

  let confidence = conversation.confidence;
  if (familyHint?.confidence === "high") confidence = "high";
  else if (familyHint?.confidence === "medium") confidence = "medium";

  return {
    version: REQUEST_INTENT_FRAME_VERSION,
    normalized: conversation.normalized,
    conversation,
    task: {
      kind: taskKind,
      present: Boolean(taskKind) || conversation.task.present,
    },
    domain: {
      kind: domainKind,
      target: objectTarget,
    },
    composite: conversation.composite,
    secondaryGoal:
      taskKind === "learn" && isSecondaryCareerMotivation(query) ? "career" : null,
    familyHint,
    needsClarification,
    clarificationReason,
    confidence,
    translation:
      taskKind === "translate"
        ? (() => {
            const plan = buildTranslationRequestPlan(query);
            return {
              targetLanguage: extractTargetLanguage(query),
              targetLanguages: plan.targetLanguages,
              targetLanguageCount: plan.targetLanguageCount,
              multiTarget: plan.multiTarget,
              mode: plan.mode,
              executionMode: plan.executionMode,
              requestUnits: plan.requestUnits,
              sourceLanguage: "auto",
              textPresent: plan.textPresent,
              text: plan.text || null,
              style: extractTranslationStyle(query),
              payloadPreview: extractTranslationPayload(query)?.slice(0, 80) || null,
            };
          })()
        : null,
  };
}

/**
 * Projection vers justIntent amont — dérivation, pas remplacement immédiat.
 * @param {ReturnType<typeof analyzeRequestIntentFrame>} frame
 */
export function projectFrameToJustIntentHints(frame) {
  if (!frame?.task?.kind) return null;

  const actionMap = {
    learn: "plan",
    explain: "explain",
    career_path: "plan",
    translate: "translate",
  };

  const domainMap = {
    technical: "technical",
    career: "general",
    pedagogical: "pedagogical",
    general: "general",
  };

  return {
    domain: domainMap[frame.domain.kind] || null,
    action: actionMap[frame.task.kind] || null,
    target: frame.domain.target,
    familyId: frame.familyHint?.id || null,
    preemptFamily: frame.familyHint?.confidence === "high" ? frame.familyHint.id : null,
  };
}

const TECHNICAL_JUST_DOMAINS = new Set(["code", "web_html", "analysis", "data"]);
const GENERAL_JUST_DOMAINS = new Set(["general", "writing", "document"]);
const SOCIAL_JUST_DOMAINS = new Set(["social"]);
const SOCIAL_JUST_ACTIONS = new Set(["social_checkin"]);

function isJustSocial(justIntent = {}) {
  return (
    SOCIAL_JUST_DOMAINS.has(justIntent.domain) ||
    SOCIAL_JUST_ACTIONS.has(justIntent.action)
  );
}

function domainRelation(hintDomain, justDomain) {
  if (!hintDomain || !justDomain) return "none";
  if (hintDomain === justDomain) return "exact";
  if (
    hintDomain === "technical" &&
    (TECHNICAL_JUST_DOMAINS.has(justDomain) || justDomain === "general")
  ) {
    return "vocab";
  }
  if (hintDomain === "pedagogical" && justDomain === "general") return "compat";
  if (hintDomain === "general" && GENERAL_JUST_DOMAINS.has(justDomain)) {
    return hintDomain === justDomain ? "exact" : "compat";
  }
  return "none";
}

/**
 * Compatibilité shadow frame ↔ JUST. Observe only. Ne mute rien.
 * Pas d'égalité brute : `technical` vs `code` = vocab_mismatch, pas un échec.
 *
 * @param {object|null} justIntent
 * @param {ReturnType<typeof projectFrameToJustIntentHints>} hints
 * @param {ReturnType<typeof analyzeRequestIntentFrame>|null} [frame]
 * @returns {{
 *   compatible: boolean|null,
 *   reason: 'match'|'compatible'|'vocab_mismatch'|'social_vs_work'|'action_mismatch'|'no_hint',
 * }}
 */
export function compareJustIntentToFrameHints(
  justIntent = null,
  hints = null,
  frame = null,
) {
  const socialOnly = Boolean(frame?.conversation?.socialOnly);
  const justSocial = isJustSocial(justIntent || {});

  if (!hints) {
    if (socialOnly && justSocial) {
      return { compatible: true, reason: "compatible" };
    }
    if (socialOnly && !justSocial) {
      return { compatible: false, reason: "social_vs_work" };
    }
    if (!socialOnly && justSocial && frame?.task?.kind) {
      return { compatible: false, reason: "social_vs_work" };
    }
    return { compatible: null, reason: "no_hint" };
  }

  if (justSocial) {
    return { compatible: false, reason: "social_vs_work" };
  }

  const hintAction = hints.action || null;
  const justAction = justIntent?.action || null;
  if (hintAction && justAction && hintAction !== justAction) {
    return { compatible: false, reason: "action_mismatch" };
  }

  const rel = domainRelation(hints.domain, justIntent?.domain);
  if (rel === "none") {
    return { compatible: false, reason: "action_mismatch" };
  }
  if (rel === "exact" && (!hintAction || hintAction === justAction)) {
    return { compatible: true, reason: "match" };
  }
  if (rel === "vocab") {
    return { compatible: true, reason: "vocab_mismatch" };
  }
  return { compatible: true, reason: "compatible" };
}
