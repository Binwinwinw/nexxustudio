/**
 * P5 — Politique du prochain mouvement conversationnel (100 % déterministe).
 */
import {
  CONVERSATION_MOMENTUM_RULE,
  CONVERSATION_NEXT_MOVES,
  FOLLOW_UP_STYLES,
  INTENT_CONTRACTS,
} from "./conversationMoveTypes.js";

export { CONVERSATION_MOMENTUM_RULE };

/**
 * @param {{
 *   contractId?: string,
 *   signal?: "explorable"|"vague"|null,
 *   optionCount?: number,
 * }} ctx
 * @returns {{
 *   move: string,
 *   followUpStyle: string,
 *   rule: string,
 * }}
 */
export function resolveNextMove(ctx = {}) {
  const {
    contractId = "",
    signal = null,
    optionCount = 0,
  } = ctx;

  if (contractId === INTENT_CONTRACTS.ARCHITECTURE_OPTIONS) {
    if (signal === "vague") {
      return {
        move: CONVERSATION_NEXT_MOVES.CLARIFY,
        followUpStyle: FOLLOW_UP_STYLES.FRAMING,
        rule: CONVERSATION_MOMENTUM_RULE,
      };
    }

    if (optionCount >= 2) {
      return {
        move: CONVERSATION_NEXT_MOVES.RECOMMEND,
        followUpStyle: FOLLOW_UP_STYLES.CONCRETE_STEP,
        rule: CONVERSATION_MOMENTUM_RULE,
      };
    }

    return {
      move: CONVERSATION_NEXT_MOVES.ADVANCE,
      followUpStyle: FOLLOW_UP_STYLES.CONCRETE_STEP,
      rule: CONVERSATION_MOMENTUM_RULE,
    };
  }

  return {
    move: CONVERSATION_NEXT_MOVES.RESPOND,
    followUpStyle: FOLLOW_UP_STYLES.NONE,
    rule: CONVERSATION_MOMENTUM_RULE,
  };
}

export function countNumberedOptions(reply = "") {
  const matches = String(reply || "").match(/^\d+\.\s+\*\*/gm);
  return matches?.length ?? 0;
}
