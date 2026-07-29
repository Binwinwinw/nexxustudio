/**
 * G46 — routage par famille de tour conversationnel.
 */
import {
  classifyConversationTurnFamily,
  CONVERSATION_TURN_FAMILIES,
} from "../../micro/classifiers/conversationTurnClassifier.js";
import {
  resolveComprehensionGroundingShortCircuit,
  buildConversationGroundingReply,
} from "../comprehensionGroundingPolicy.js";
import { resolveMetaAssistantBehaviorShortCircuit } from "../metaAssistantBehaviorPolicy.js";
import { resolveAssistantRepairShortCircuit } from "../../micro/replies/assistantRepairReplyBuilder.js";
import { resolveOpenPromptContinuityShortCircuit } from "../openPromptContinuityPolicy.js";
import { getIdeationDeterministicReply } from "../../utils/ideationIntentGuards.js";
import { isComprehensionDemonstrationRequest } from "../../utils/metaAssistantBehaviorGuards.js";
import { isIdeationIntent } from "../../utils/ideationIntentGuards.js";
import { isAssistantRepairIntent } from "../../utils/assistantRepairGuards.js";
import { isMetaAssistantBehaviorRequest } from "../../utils/metaAssistantBehaviorGuards.js";
import {
  isSocialAcceptanceOfOffer,
  resolveSocialAcceptanceOfOfferShortCircuit,
} from "../socialAcceptanceOfOfferPolicy.js";
import {
  isMetaCapabilitiesIntent,
  resolveMetaCapabilitiesShortCircuit,
} from "../metaCapabilitiesPolicy.js";
import { isExplicitWebSearchRequest } from "../explicitWebSearchRequestPolicy.js";

const SOCIAL_HEALTH_RE =
  /\b(?:comment (?:ca|ça) va|comment vas[- ]?tu|comment allez[- ]?vous|tu vas bien|ca va\b|ça va\b|comment tu te sens)\b/i;
const SOCIAL_GREETING_RE =
  /^(?:salut|bonjour|coucou|hello|hey|bonsoir)(?:\s+[!?.…]*)?$/i;

const COMPREHENSION_WEAK_RE =
  /\b(?:tu comprends|as[- ]tu compris|compris mon|saisi (?:la |le |l[''])?|montre[- ]?moi|prouve|suis le fil|mon intention)\b/i;
const IDEATION_OPEN_RE =
  /\b(?:on (?:pourrait|peut)|qu(?:e|oi) (?:pourrait|peut)[- ]on)\b.*\b(?:projet|construire|faire|lancer|bosser|attaquer)\b/i;
const IDEATION_PROJECT_RE =
  /\b(?:faire quoi|quoi faire|quel projet|quelle piste)\b.*\bprojet\b|\bprojet\b.*\b(?:faire quoi|quoi faire|pourrait|peut|lancer|mettre)\b/i;
const IDEATION_ATTACK_RE =
  /\b(?:attaquer|bosser sur|lancer)\s+(?:un\s+)?(?:nouveau\s+)?truc\b|\battaquer\s+un\s+nouveau\b|\b(?:tu )?proposerais quoi\b/i;

/**
 * @param {string} family
 * @param {string} query
 * @param {{ history?: object[], tier?: string }} options
 */
function routeFamilyToShortCircuit(family, query = "", options = {}) {
  switch (family) {
    case CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF: {
      const explicit = resolveComprehensionGroundingShortCircuit(query, options);
      if (explicit?.reply) {
        return {
          path: explicit.path,
          reply: explicit.reply,
          turnFamily: family,
          turnFamilyTier: options.tier || "high",
        };
      }
      return {
        path: "comprehension_grounding_deterministic",
        reply: buildConversationGroundingReply(query, options.history || []),
        turnFamily: family,
        turnFamilyTier: options.tier || "high",
      };
    }
    case CONVERSATION_TURN_FAMILIES.META_CRITIQUE_ASSISTANT: {
      const hit = resolveMetaAssistantBehaviorShortCircuit(query, options);
      if (!hit?.reply) return null;
      return {
        path: hit.path,
        reply: hit.reply,
        turnFamily: family,
        turnFamilyTier: options.tier || "high",
      };
    }
    case CONVERSATION_TURN_FAMILIES.REPAIR_REQUEST: {
      const hit = resolveAssistantRepairShortCircuit(query, options);
      if (!hit?.reply) return null;
      return {
        path: hit.path,
        reply: hit.reply,
        turnFamily: family,
        turnFamilyTier: options.tier || "high",
      };
    }
    case CONVERSATION_TURN_FAMILIES.IDEATION: {
      // Filet : demande web explicite ne doit jamais servir des pistes RAG.
      if (isExplicitWebSearchRequest(query)) return null;
      const hit = resolveOpenPromptContinuityShortCircuit(query, options);
      if (hit?.reply) {
        return {
          path: hit.path,
          reply: hit.reply,
          turnFamily: family,
          turnFamilyTier: options.tier || "high",
        };
      }
      const ideationReply = getIdeationDeterministicReply(query);
      if (ideationReply) {
        return {
          path: "ideation_deterministic",
          reply: ideationReply,
          turnFamily: family,
          turnFamilyTier: options.tier || "high",
        };
      }
      if (
        options.tier === "high" &&
        (IDEATION_OPEN_RE.test(query) ||
          IDEATION_PROJECT_RE.test(query) ||
          IDEATION_ATTACK_RE.test(query))
      ) {
        const fallback = getIdeationDeterministicReply(
          "quel projet pourrions nous mettre sur pied",
        );
        if (fallback) {
          return {
            path: "ideation_deterministic",
            reply: fallback,
            turnFamily: family,
            turnFamilyTier: options.tier || "high",
          };
        }
      }
      return null;
    }
    case CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN: {
      const hit = resolveSocialAcceptanceOfOfferShortCircuit(query, options);
      if (!hit?.reply) return null;
      return {
        path: hit.path,
        reply: hit.reply,
        turnFamily: family,
        turnFamilyTier: options.tier || "high",
      };
    }
    case CONVERSATION_TURN_FAMILIES.META_CAPABILITIES: {
      const hit = resolveMetaCapabilitiesShortCircuit(query, options);
      if (!hit?.reply) return null;
      return {
        path: hit.path,
        reply: hit.reply,
        turnFamily: family,
        turnFamilyTier: options.tier || "high",
      };
    }
    default:
      return null;
  }
}

/**
 * @param {string} family
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
function familyRegexSupport(family, query = "", history = []) {
  switch (family) {
    case CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF:
      return (
        isComprehensionDemonstrationRequest(query) ||
        COMPREHENSION_WEAK_RE.test(query)
      );
    case CONVERSATION_TURN_FAMILIES.META_CRITIQUE_ASSISTANT:
      return isMetaAssistantBehaviorRequest(query);
    case CONVERSATION_TURN_FAMILIES.REPAIR_REQUEST:
      return isAssistantRepairIntent(query, history);
    case CONVERSATION_TURN_FAMILIES.IDEATION:
      return (
        isIdeationIntent(query) ||
        IDEATION_OPEN_RE.test(query) ||
        IDEATION_PROJECT_RE.test(query) ||
        IDEATION_ATTACK_RE.test(query)
      );
    case CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN:
      return (
        isSocialAcceptanceOfOffer(query, history) ||
        SOCIAL_HEALTH_RE.test(query) ||
        SOCIAL_GREETING_RE.test(query)
      );
    case CONVERSATION_TURN_FAMILIES.META_CAPABILITIES:
      return isMetaCapabilitiesIntent(query, { history });
    default:
      return false;
  }
}

/**
 * @param {string} query
 * @param {{ history?: object[], priorState?: object, classification?: ReturnType<typeof classifyConversationTurnFamily> }} [options]
 * @returns {{
 *   path: string,
 *   reply: string,
 *   turnFamily: string,
 *   turnFamilyTier: string,
 *   turnFamilyConfidence: number,
 *   turnFamilySignals: string[],
 *   turnFamilySuppressions: string[],
 * }|null}
 */
export function resolveConversationTurnFamilyShortCircuit(
  query = "",
  options = {},
) {
  const classification =
    options.classification ||
    classifyConversationTurnFamily(query, {
      history: options.history || [],
      priorState: options.priorState,
      attachments: options.attachments || [],
    });

  if (classification.tier === "low") {
    if (
      classification.family === CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF &&
      classification.confidence >= 0.5 &&
      familyRegexSupport(classification.family, query, options.history || [])
    ) {
      const hit = routeFamilyToShortCircuit(classification.family, query, {
        history: options.history || [],
        priorState: options.priorState,
        attachments: options.attachments || [],
        tier: "medium",
      });
      if (hit) {
        return {
          ...hit,
          turnFamilyConfidence: classification.confidence,
          turnFamilySignals: classification.signals,
          turnFamilySuppressions: classification.suppressions,
        };
      }
    }
    return null;
  }

  const routeOpts = {
    history: options.history || [],
    priorState: options.priorState,
    attachments: options.attachments || [],
    tier: classification.tier,
  };

  if (classification.tier === "high") {
    const hit = routeFamilyToShortCircuit(classification.family, query, routeOpts);
    if (!hit) return null;
    return {
      ...hit,
      turnFamilyConfidence: classification.confidence,
      turnFamilySignals: classification.signals,
      turnFamilySuppressions: classification.suppressions,
    };
  }

  if (
    classification.tier === "medium" &&
    familyRegexSupport(classification.family, query, options.history || [])
  ) {
    const hit = routeFamilyToShortCircuit(classification.family, query, routeOpts);
    if (!hit) return null;
    return {
      ...hit,
      turnFamilyConfidence: classification.confidence,
      turnFamilySignals: classification.signals,
      turnFamilySuppressions: classification.suppressions,
    };
  }

  return null;
}

/**
 * @param {string} query
 * @param {{ history?: object[], priorState?: object }} [options]
 */
export function classifyTurnForPipeline(query = "", options = {}) {
  return classifyConversationTurnFamily(query, options);
}
