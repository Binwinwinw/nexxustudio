/**
 * G46 — classifieur de tour conversationnel (famille fonctionnelle + contexte fil).
 * Doctrine : famille -> rail ; regex = filet, pas décision principale.
 */
import { normalizeText } from "../../utils/normalizationGuards.js";
import { isIdeationIntent } from "../../utils/ideationIntentGuards.js";
import { isAssistantRepairIntent } from "../../utils/assistantRepairGuards.js";
import {
  isMetaAssistantBehaviorRequest,
  isComprehensionDemonstrationRequest,
} from "../../utils/metaAssistantBehaviorGuards.js";
import {
  isAssistantSocialMenuOffer,
  isSocialAcceptanceOfOffer,
} from "../../policies/socialAcceptanceOfOfferPolicy.js";
import {
  isSocialChatThreadActive,
  isSoftSocialChatFollowup,
} from "../../policies/socialChatContinuityPolicy.js";
import {
  classifyMetaCapabilitiesSubKind,
  isMetaCapabilitiesIntent,
} from "../../policies/metaCapabilitiesPolicy.js";
import { isExplicitWebSearchRequest } from "../../policies/explicitWebSearchRequestPolicy.js";
import { isKnownSocialPattern } from "../../policies/socialPatternPolicy.js";

export const CONVERSATION_TURN_FAMILIES = Object.freeze({
  SOCIAL_CHECKIN: "social_checkin",
  META_CAPABILITIES: "meta_capabilities",
  IDEATION: "ideation",
  REPAIR_REQUEST: "repair_request",
  META_CRITIQUE_ASSISTANT: "meta_critique_assistant",
  COMPREHENSION_PROOF: "comprehension_proof",
  TASK_REQUEST: "task_request",
  OTHER: "other",
});

export const G46_HIGH_CONFIDENCE = 0.78;
export const G46_MEDIUM_CONFIDENCE = 0.55;

/** @type {Record<string, string[]>} */
export const FAMILY_SUPPRESSIONS = Object.freeze({
  [CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN]: [
    "simple_factual_lookup",
    "simple_fast",
    "semantic_intent_resolver",
    "COMPOSER",
  ],
  [CONVERSATION_TURN_FAMILIES.META_CAPABILITIES]: [
    "simple_factual_lookup",
    "simple_fast",
    "semantic_intent_resolver",
    "COMPOSER",
    "document_synthesis_deterministic",
    "document_synthesis_llm",
    "document_synthesis_clarify",
    "GUIDED_DOCUMENT_SYNTHESIS",
    "document_analysis",
    "information_seeking_escalation",
    "general_knowledge_full_pipeline",
    "PRESENTATION_OUTLINE",
    "IDEATION_OPEN",
  ],
  [CONVERSATION_TURN_FAMILIES.IDEATION]: [
    "semantic_intent_resolver",
    "social_deterministic",
    "simple_factual_lookup",
  ],
  [CONVERSATION_TURN_FAMILIES.REPAIR_REQUEST]: [
    "semantic_intent_resolver",
    "simple_factual_lookup",
  ],
  [CONVERSATION_TURN_FAMILIES.META_CRITIQUE_ASSISTANT]: [
    "semantic_intent_resolver",
    "simple_factual_lookup",
    "COMPOSER",
    "PRESENTATION_OUTLINE",
  ],
  [CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF]: [
    "semantic_intent_resolver",
    "simple_factual_lookup",
    "social_deterministic",
  ],
  [CONVERSATION_TURN_FAMILIES.TASK_REQUEST]: [],
  [CONVERSATION_TURN_FAMILIES.OTHER]: [],
});

const SOCIAL_HEALTH_RE =
  /\b(?:comment (?:ca|ça) va|comment vas[- ]?tu|comment allez[- ]?vous|tu vas bien|ca va\b|ça va\b|comment tu te sens)\b/i;
const SOCIAL_GREETING_RE =
  /^(?:salut|bonjour|coucou|hello|hey|bonsoir)(?:\s+[!?.…]*)?$/i;

/** « on pourrait faire » seul = open_prompt social, pas idéation projet. */
const IDEATION_OPEN_RE =
  /\b(?:on (?:pourrait|peut)|qu(?:e|oi) (?:pourrait|peut)[- ]on)\b.*\b(?:projet|construire|lancer|bosser|attaquer|faire (?:un|une|du|de la|des|mon|notre))\b/i;
const IDEATION_PROJECT_RE =
  /\b(?:faire quoi|quoi faire|quel projet|quelle piste)\b.*\bprojet\b|\bprojet\b.*\b(?:faire quoi|quoi faire|pourrait|peut|lancer|mettre)\b/i;

const COMPREHENSION_WEAK_RE =
  /\b(?:tu comprends|as[- ]tu compris|compris mon|saisi (?:la |le |l[''])?|montre[- ]?moi|prouve|suis le fil|mon intention|ta compréhension|ta comprehension)\b/i;

const META_CRITIQUE_SURFACE_RE =
  /\b(?:ne (?:veux|veut) pas reflechir|ne (?:veux|veut) pas réfléchir|uniquement repondre|uniquement répondre|façon de répondre|ton comportement|avant de repondre|avant de répondre|réponds?\s+sans\s+(?:reflechir|réfléchir)|mauvais\s+rail|trop\s+(?:vite\s+)?composer|pars?\s+(?:trop\s+)?(?:vite\s+)?(?:sur\s+)?(?:composer|orchestrat))\b/i;

const SOCIAL_MOOD_RE =
  /\b(?:ca roule|ça roule|quel mood|dans quel mood|comment tu te sens ce soir|t es dans quel mood)\b/i;

const SOCIAL_PAPOTER_CITADELLE_RE =
  /\b(?:on\s+)?papot(?:e|er|ons)(?:\s+un\s+peu)?\b.{0,50}\b(?:citadelle|nexxus)\b/i;

const SOCIAL_GRATITUDE_RE =
  /\bmerci\b.{0,50}\b(?:pour|de)\b/i;

const IDEATION_ATTACK_RE =
  /\b(?:attaquer|bosser sur|lancer)\s+(?:un\s+)?(?:nouveau\s+)?truc\b|\battaquer\s+un\s+nouveau\b/i;

const GREETING_CTX_RE = /\b(?:salut|bonjour|coucou|hello)\b/i;
const IDEATION_CTX_RE =
  /\b(?:projet|mettre sur pied|mettre en place|idée|idee|construire|lancer)\b/i;
const REPAIR_CTX_RE =
  /\b(?:pas compris|mal interpr|pas compris ce que)\b/i;
const META_CRITIQUE_CTX_RE =
  /\b(?:reflechir|réfléchir|uniquement repondre|uniquement répondre|façon de répondre)\b/i;
const ASSISTANT_REPAIR_CTX_RE = /\b(?:mal interprété|mal interprete|trop génériques)\b/i;
const ASSISTANT_META_CTX_RE = /\b(?:façon de répondre|rails|formule générique)\b/i;
const ASSISTANT_IDEATION_CTX_RE =
  /\b(?:pistes concrètes|RAG local|mini-app|La Citadelle)\b/i;

/**
 * @param {string} input
 */
function norm(input = "") {
  return normalizeText(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.*]+$/g, "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {Array<{ role?: string, content?: string }>} history
 */
function extractTurnContext(history = []) {
  const turns = Array.isArray(history) ? history : [];
  const userTurns = turns
    .filter((m) => m?.role === "user")
    .map((m) => String(m.content || "").trim())
    .filter(Boolean)
    .slice(-4);

  const lastAssistant = [...turns]
    .reverse()
    .find((m) => m?.role === "assistant" || m?.role === "model");
  const lastAssistantText = String(lastAssistant?.content || "");

  const userBlob = userTurns.join(" ");
  const afterGreeting = GREETING_CTX_RE.test(userBlob);
  const afterIdeation =
    userTurns.some((t) => IDEATION_CTX_RE.test(t)) ||
    ASSISTANT_IDEATION_CTX_RE.test(lastAssistantText);
  const afterRepair =
    userTurns.some((t) => REPAIR_CTX_RE.test(t)) ||
    ASSISTANT_REPAIR_CTX_RE.test(lastAssistantText);
  const afterMetaCritique =
    userTurns.some((t) => META_CRITIQUE_CTX_RE.test(t)) ||
    ASSISTANT_META_CTX_RE.test(lastAssistantText);

  return {
    userTurns,
    lastAssistantText,
    afterGreeting,
    afterIdeation,
    afterRepair,
    afterMetaCritique,
    afterSocialOffer: isAssistantSocialMenuOffer(lastAssistantText),
  };
}

/**
 * @param {string} query
 * @param {{ history?: object[], priorState?: object }} [options]
 * @returns {{
 *   family: string,
 *   confidence: number,
 *   signals: string[],
 *   suppressions: string[],
 *   tier: "high"|"medium"|"low",
 *   context: ReturnType<typeof extractTurnContext>,
 * }}
 */
export function classifyConversationTurnFamily(query = "", options = {}) {
  const q = norm(query);
  const ctx = extractTurnContext(options.history || []);
  const signals = [];

  /** @type {Record<string, number>} */
  const scores = {
    [CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN]: 0,
    [CONVERSATION_TURN_FAMILIES.META_CAPABILITIES]: 0,
    [CONVERSATION_TURN_FAMILIES.IDEATION]: 0,
    [CONVERSATION_TURN_FAMILIES.REPAIR_REQUEST]: 0,
    [CONVERSATION_TURN_FAMILIES.META_CRITIQUE_ASSISTANT]: 0,
    [CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF]: 0,
    [CONVERSATION_TURN_FAMILIES.TASK_REQUEST]: 0.08,
    [CONVERSATION_TURN_FAMILIES.OTHER]: 0,
  };

  if (SOCIAL_HEALTH_RE.test(q)) {
    scores[CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN] += 0.72;
    signals.push("surface_health_checkin");
  }
  if (SOCIAL_MOOD_RE.test(q)) {
    scores[CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN] += 0.7;
    signals.push("surface_mood_checkin");
  }
  if (SOCIAL_PAPOTER_CITADELLE_RE.test(q)) {
    scores[CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN] += 0.76;
    signals.push("social_papoter_citadelle");
  }
  if (SOCIAL_GRATITUDE_RE.test(q)) {
    scores[CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN] += 0.74;
    signals.push("social_gratitude_closure");
  }
  if (SOCIAL_GREETING_RE.test(q)) {
    scores[CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN] += 0.68;
    signals.push("surface_greeting");
  }
  if (isSocialAcceptanceOfOffer(query, options.history || [])) {
    scores[CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN] += 0.92;
    signals.push("social_acceptance_of_offer");
    scores[CONVERSATION_TURN_FAMILIES.TASK_REQUEST] = 0;
  } else if (
    ctx.afterSocialOffer &&
    /\b(?:papoter|discut(?:e|er)|bavarder)\b/i.test(q)
  ) {
    scores[CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN] += 0.38;
    signals.push("social_offer_thread");
  }

  if (
    isSocialChatThreadActive(options.history || []) &&
    isSoftSocialChatFollowup(query)
  ) {
    scores[CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN] += 0.85;
    signals.push("social_chat_topic_continuity");
    scores[CONVERSATION_TURN_FAMILIES.TASK_REQUEST] = Math.min(
      scores[CONVERSATION_TURN_FAMILIES.TASK_REQUEST],
      0.05,
    );
  }

  if (isMetaCapabilitiesIntent(query, options)) {
    const subKind = classifyMetaCapabilitiesSubKind(query, options);
    scores[CONVERSATION_TURN_FAMILIES.META_CAPABILITIES] += 0.9;
    scores[CONVERSATION_TURN_FAMILIES.TASK_REQUEST] = 0;
    signals.push(`meta_capabilities_${subKind}`);
    scores[CONVERSATION_TURN_FAMILIES.IDEATION] = Math.max(
      0,
      scores[CONVERSATION_TURN_FAMILIES.IDEATION] - 0.5,
    );
  } else if (
    Array.isArray(options.attachments) &&
    options.attachments.length > 0
  ) {
    // PJ présentes : privilégier tâche (vision/doc) sur fiche méta.
    scores[CONVERSATION_TURN_FAMILIES.TASK_REQUEST] += 0.35;
    signals.push("attachment_present_task_bias");
  }

  if (isExplicitWebSearchRequest(query)) {
    scores[CONVERSATION_TURN_FAMILIES.TASK_REQUEST] += 0.85;
    scores[CONVERSATION_TURN_FAMILIES.IDEATION] = 0;
    signals.push("explicit_web_search");
  }

  if (isIdeationIntent(query)) {
    scores[CONVERSATION_TURN_FAMILIES.IDEATION] += 0.78;
    signals.push("surface_ideation_trigger");
  }
  if (IDEATION_OPEN_RE.test(q) || IDEATION_PROJECT_RE.test(q)) {
    scores[CONVERSATION_TURN_FAMILIES.IDEATION] += 0.62;
    signals.push("open_project_wording");
  }
  if (IDEATION_ATTACK_RE.test(q)) {
    scores[CONVERSATION_TURN_FAMILIES.IDEATION] += 0.78;
    signals.push("ideation_attack_wording");
  }
  if (ctx.afterGreeting && (IDEATION_OPEN_RE.test(q) || IDEATION_PROJECT_RE.test(q))) {
    scores[CONVERSATION_TURN_FAMILIES.IDEATION] += 0.22;
    signals.push("ideation_after_greeting");
  }

  if (isAssistantRepairIntent(query, options.history || [])) {
    scores[CONVERSATION_TURN_FAMILIES.REPAIR_REQUEST] += 0.82;
    signals.push("surface_repair");
  }

  if (
    isMetaAssistantBehaviorRequest(query) &&
    !isComprehensionDemonstrationRequest(query)
  ) {
    scores[CONVERSATION_TURN_FAMILIES.META_CRITIQUE_ASSISTANT] += 0.76;
    signals.push("surface_meta_critique");
  }
  if (META_CRITIQUE_SURFACE_RE.test(q)) {
    scores[CONVERSATION_TURN_FAMILIES.META_CRITIQUE_ASSISTANT] += 0.48;
    signals.push("meta_critique_wording");
  }

  if (isComprehensionDemonstrationRequest(query)) {
    scores[CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF] += 0.82;
    signals.push("surface_comprehension_proof");
  }
  if (COMPREHENSION_WEAK_RE.test(q)) {
    scores[CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF] += 0.46;
    signals.push("weak_comprehension_wording");
    if (ctx.afterMetaCritique) {
      scores[CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF] += 0.24;
      signals.push("after_meta_critique");
    }
    if (ctx.afterRepair) {
      scores[CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF] += 0.2;
      signals.push("after_repair");
    }
    if (ctx.afterIdeation) {
      scores[CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF] += 0.14;
      signals.push("ideation_thread_comprehension");
    }
  }
  if (ctx.afterMetaCritique && ctx.afterRepair && COMPREHENSION_WEAK_RE.test(q)) {
    scores[CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF] += 0.12;
    signals.push("after_meta_and_repair");
  }

  if (/projet/i.test(q) && scores[CONVERSATION_TURN_FAMILIES.IDEATION] >= 0.55) {
    scores[CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN] = Math.max(
      0,
      scores[CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN] - 0.55,
    );
    signals.push("ideation_over_social");
  }

  // Open-prompt / meta_who_drives / check-ins : panel social, pas idéation livrable
  if (isKnownSocialPattern(query)) {
    scores[CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN] = Math.max(
      scores[CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN],
      0.92,
    );
    scores[CONVERSATION_TURN_FAMILIES.IDEATION] = 0;
    scores[CONVERSATION_TURN_FAMILIES.TASK_REQUEST] = Math.min(
      scores[CONVERSATION_TURN_FAMILIES.TASK_REQUEST],
      0.08,
    );
    signals.push("known_social_pattern_over_ideation");
  }
  if (
    scores[CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN] >= 0.6 &&
    !COMPREHENSION_WEAK_RE.test(q)
  ) {
    scores[CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF] *= 0.45;
  }
  if (
    scores[CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF] >= 0.55 &&
    scores[CONVERSATION_TURN_FAMILIES.META_CRITIQUE_ASSISTANT] >= 0.45 &&
    COMPREHENSION_WEAK_RE.test(q)
  ) {
    scores[CONVERSATION_TURN_FAMILIES.META_CRITIQUE_ASSISTANT] *= 0.55;
    signals.push("comprehension_over_meta");
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [family, rawScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;
  const margin = rawScore - secondScore;
  let confidence = Math.min(0.98, rawScore);
  if (margin < 0.12) confidence *= 0.82;
  if (margin < 0.06) confidence *= 0.75;

  const tier =
    confidence >= G46_HIGH_CONFIDENCE
      ? "high"
      : confidence >= G46_MEDIUM_CONFIDENCE
        ? "medium"
        : "low";

  return {
    family,
    confidence: Number(confidence.toFixed(3)),
    signals,
    suppressions: [...(FAMILY_SUPPRESSIONS[family] || [])],
    tier,
    context: ctx,
  };
}

/**
 * @param {{ suppressions?: string[], confidence?: number, tier?: string }|null|undefined} classification
 * @param {string} path
 */
export function shouldSuppressTurnFamilyPath(classification, path = "") {
  if (!classification || !path) return false;
  const minConfidence =
    classification.family === CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF
      ? 0.5
      : G46_MEDIUM_CONFIDENCE;
  if ((classification.confidence ?? 0) < minConfidence) return false;
  return (classification.suppressions || []).includes(path);
}

/**
 * @param {string} family
 */
export function isConversationFamily(family, expected) {
  return family === expected;
}
