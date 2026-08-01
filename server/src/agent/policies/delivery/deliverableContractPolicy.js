/**
 * DeliverableContractPolicy P0.1 — lecture / télémétrie (pas d’enforcement).
 * Formalise la promesse de sortie ; le short-circuit social reste la surface UX.
 *
 * Mode : observe — n’altère ni clarification_gate ni rails.
 * Default hors cas connus : promisedValue=null (unknown), pas explanation.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { isSubstantiveWorkRequest } from "../../utils/genericGreetingGuards.js";
import {
  classifySocialPattern,
  isKnownSocialPattern,
  isSocialChatThreadActive,
  isSoftSocialChatFollowup,
} from "../social/index.js";
import { isOpenExplorationFrame } from "../openExplorationFramePolicy.js";

export const DELIVERABLE_CONTRACT_ID = "DELIVERABLE_CONTRACT_V1";
export const DELIVERABLE_POLICY_RULE = "deliverable_contract_policy_p0_1_observe";
/** @typedef {'observe'|'enforce'} DeliverablePolicyMode */
export const DELIVERABLE_POLICY_MODE = /** @type {DeliverablePolicyMode} */ (
  "observe"
);

export const PROMISED_VALUES = Object.freeze({
  SOCIAL_CONTINUITY: "social_continuity",
  EXPLORATION_PROPOSAL: "exploration_proposal",
  GUIDED_CHOICE: "guided_choice",
  CARE_ACK: "care_ack",
  ADVICE: "advice",
  PLAN: "plan",
  PATCH: "patch",
  EXPLANATION: "explanation",
  WORKSHOP: "workshop",
  EXECUTION: "execution",
  TRANSFORM: "transform",
  SCOPING: "scoping",
  CLARIFY: "clarify",
  REFUSAL: "refusal",
});

export const REPLY_SHAPES = Object.freeze({
  SHORT_OPEN: "short_open",
  MENU_PLUS_QUESTION: "menu_plus_question",
  CHOICE_HELP: "choice_help",
  CARE_LIMITS: "care_limits",
  STRUCTURED_ANSWER: "structured_answer",
  UNKNOWN: "unknown",
});

/** Continuité sociale — pas le mal-être corporel. */
const SOCIAL_CONTINUITY_PATTERNS = new Set([
  "social/chat_invite",
  "social/phatic_checkin",
  "social/casual_status",
  "social/mood_checkin",
  "social/gratitude",
  "social/whimsical_pivot",
  "social/anthropomorphic_checkin",
  "social/papoter_citadelle",
  "social/meta_who_drives",
]);

const EXPLORATION_PATTERNS = new Set(["social/open_prompt"]);

/**
 * Marqueurs structurels du panel exploration_proposal uniquement
 * (pas « papoter » / « apprendre » isolés — évite faux guided_choice).
 */
const EXPLORATION_PANEL_STRUCTURAL_RE =
  /\b(?:pas encore de sujet|tu as le choix|h[eé] bien tu as le choix|menu rapide|ouvrir le champ|je te propose(?:\s+un\s+panel)?|quelques pistes|voici les pistes|choisis un num[eé]ro|dis[- ]moi un num[eé]ro|balance juste un mot|on se lance)\b/i;

const EXPLORATION_PANEL_LIST_RE =
  /(?:^|\n)\s*[1-5][).]\s*\S+|·\s*(?:papoter|brainstorm|discussion|recherch)/i;

const GUIDED_CHOICE_OPTION_PICK_RE =
  /\b(?:papoter|brainstorm(?:er)?|recherche(?:r)?|web|livrable|apprendre|discussion libre|brainstorm l[eé]ger)\b/i;

/**
 * @param {Array<{ role?: string, content?: string }>} history
 */
function lastAssistantText(history = []) {
  const turns = Array.isArray(history) ? history : [];
  const last = [...turns]
    .reverse()
    .find((m) => m?.role === "assistant" || m?.role === "model");
  return String(last?.content || "");
}

/**
 * @param {string} assistantText
 */
export function isExplorationPanelOffer(assistantText = "") {
  const t = String(assistantText || "");
  if (!t.trim()) return false;
  return (
    EXPLORATION_PANEL_STRUCTURAL_RE.test(t) || EXPLORATION_PANEL_LIST_RE.test(t)
  );
}

/**
 * Germe / sélection après panel exploration structurel.
 * Runtime : `guidedChoicePolicy` → path `guided_choice_deterministic`.
 * @param {string} query
 * @param {Array<object>} history
 */
export function isGuidedChoiceSurface(query = "", history = []) {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 1 || q.length > 120) return false;
  if (isSubstantiveWorkRequest(query)) return false;
  if (isKnownSocialPattern(query)) return false;

  if (!isExplorationPanelOffer(lastAssistantText(history))) return false;

  // Sélection numérotée explicite
  if (/^[1-5](?:\b|[).:])/.test(q)) return true;

  // Mot d’option du menu, très court (pas soft-chat générique)
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length <= 4 && GUIDED_CHOICE_OPTION_PICK_RE.test(q)) return true;

  return false;
}

/**
 * @param {object} partial
 */
function buildContract(partial = {}) {
  const promisedValue =
    partial.promisedValue === undefined ? null : partial.promisedValue;
  const clarificationRequired = Boolean(partial.clarificationRequired);
  const gateSuppressed =
    partial.gateSuppressed != null
      ? Boolean(partial.gateSuppressed)
      : promisedValue != null &&
        [
          PROMISED_VALUES.SOCIAL_CONTINUITY,
          PROMISED_VALUES.EXPLORATION_PROPOSAL,
          PROMISED_VALUES.GUIDED_CHOICE,
          PROMISED_VALUES.CARE_ACK,
        ].includes(promisedValue);

  const replyShape = partial.replyShape || REPLY_SHAPES.UNKNOWN;
  /** true seulement si un couloir runtime exécute déjà cette shape */
  const runtimeAligned =
    partial.runtimeAligned != null ? Boolean(partial.runtimeAligned) : false;

  return {
    contract: DELIVERABLE_CONTRACT_ID,
    mode: DELIVERABLE_POLICY_MODE,
    rule: DELIVERABLE_POLICY_RULE,
    promisedValue,
    structureHint: partial.structureHint ?? null,
    evidenceLevel: partial.evidenceLevel ?? "none",
    mayAct: Boolean(partial.mayAct),
    verifyBeforeDeliver: Boolean(partial.verifyBeforeDeliver),
    clarificationRequired,
    gateSuppressed,
    replyShape,
    source: partial.source || "default",
    socialPatternName: partial.socialPatternName || null,
    enforcement: false,
    runtimeAligned,
    telemetry: {
      deliverableContract: DELIVERABLE_CONTRACT_ID,
      promisedValue,
      clarificationRequired,
      gateSuppressed,
      replyShape,
      mode: DELIVERABLE_POLICY_MODE,
      enforcement: false,
      runtimeAligned,
    },
  };
}

/**
 * Résout le contrat de sortie (observe-only).
 * @param {string} query
 * @param {{
 *   history?: object[],
 *   socialPatternName?: string|null,
 *   justIntent?: object|null,
 * }} [options]
 */
export function resolveDeliverableContract(query = "", options = {}) {
  const history = options.history || [];
  const patternHit =
    options.socialPatternName ||
    classifySocialPattern(query)?.patternName ||
    null;

  // Frame slots prime — même si le bridge social/open_prompt n’est pas encore posé
  if (isOpenExplorationFrame(query)) {
    return buildContract({
      promisedValue: PROMISED_VALUES.EXPLORATION_PROPOSAL,
      clarificationRequired: false,
      gateSuppressed: true,
      replyShape: REPLY_SHAPES.MENU_PLUS_QUESTION,
      structureHint: "ack+menu_3_5+open_question",
      source: "open_exploration_frame",
      socialPatternName: patternHit || "social/open_prompt",
      runtimeAligned: true,
    });
  }

  if (patternHit === "social/personal_discomfort") {
    return buildContract({
      promisedValue: PROMISED_VALUES.CARE_ACK,
      clarificationRequired: false,
      gateSuppressed: true,
      replyShape: REPLY_SHAPES.CARE_LIMITS,
      structureHint: "empathy+limits+redirect",
      source: "social_pattern",
      socialPatternName: patternHit,
      runtimeAligned: true,
    });
  }

  if (patternHit && EXPLORATION_PATTERNS.has(patternHit)) {
    return buildContract({
      promisedValue: PROMISED_VALUES.EXPLORATION_PROPOSAL,
      clarificationRequired: false,
      gateSuppressed: true,
      replyShape: REPLY_SHAPES.MENU_PLUS_QUESTION,
      structureHint: "ack+menu_3_5+open_question",
      source: "social_pattern",
      socialPatternName: patternHit,
      runtimeAligned: true,
    });
  }

  if (patternHit && SOCIAL_CONTINUITY_PATTERNS.has(patternHit)) {
    return buildContract({
      promisedValue: PROMISED_VALUES.SOCIAL_CONTINUITY,
      clarificationRequired: false,
      gateSuppressed: true,
      replyShape: REPLY_SHAPES.SHORT_OPEN,
      structureHint: "1_2_phrases+ouverture",
      source: "social_pattern",
      socialPatternName: patternHit,
      runtimeAligned: true,
    });
  }

  if (isGuidedChoiceSurface(query, history)) {
    return buildContract({
      promisedValue: PROMISED_VALUES.GUIDED_CHOICE,
      clarificationRequired: false,
      gateSuppressed: true,
      replyShape: REPLY_SHAPES.CHOICE_HELP,
      structureHint: "narrow_options+help_choose",
      source: "guided_choice_surface",
      socialPatternName: null,
      runtimeAligned: true,
    });
  }

  if (
    isSocialChatThreadActive(history) &&
    isSoftSocialChatFollowup(query) &&
    !isSubstantiveWorkRequest(query)
  ) {
    return buildContract({
      promisedValue: PROMISED_VALUES.SOCIAL_CONTINUITY,
      clarificationRequired: false,
      gateSuppressed: true,
      replyShape: REPLY_SHAPES.SHORT_OPEN,
      structureHint: "soft_chat_continuity",
      source: "social_chat_thread",
      runtimeAligned: true,
    });
  }

  const just = options.justIntent || null;
  if (just?.strategy === "clarify_then_build") {
    return buildContract({
      promisedValue: PROMISED_VALUES.CLARIFY,
      clarificationRequired: true,
      gateSuppressed: false,
      replyShape: REPLY_SHAPES.STRUCTURED_ANSWER,
      structureHint: "just_clarify_then_build",
      source: "just_intent_observe",
      runtimeAligned: true,
    });
  }

  // Hors cas connus : unknown propre (pas de faux explanation)
  return buildContract({
    promisedValue: null,
    clarificationRequired: false,
    gateSuppressed: false,
    replyShape: REPLY_SHAPES.UNKNOWN,
    structureHint: "unclassified_observe",
    source: "default_unknown",
    runtimeAligned: false,
  });
}

/**
 * Résumé console / onStep.
 * @param {ReturnType<typeof resolveDeliverableContract>} contract
 */
export function formatDeliverableContractSummary(contract = null) {
  if (!contract) return "";
  const pv = contract.promisedValue ?? "unknown";
  return (
    `promisedValue=${pv}` +
    ` clarify=${contract.clarificationRequired ? "yes" : "no"}` +
    ` gateSuppressed=${contract.gateSuppressed ? "yes" : "no"}` +
    ` shape=${contract.replyShape}` +
    ` mode=${contract.mode}` +
    ` enforce=no` +
    (contract.runtimeAligned === false ? ` runtimeAligned=no` : "")
  );
}
