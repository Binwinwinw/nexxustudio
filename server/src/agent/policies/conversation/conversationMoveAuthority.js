/**
 * P2 autorité — ConversationMove prime sur clarification_gate legacy.
 * Spec : docs/agents/conversation-move-governance.md § P2 autorité
 */
import {
  CONVERSATION_MOVES,
  shouldRunClarificationGate,
} from "./conversationMovePolicy.js";
import { resolveNamedCreateStartShortCircuit } from "./currentTurnAnchoringPolicy.js";

/**
 * @returns {boolean}
 */
export function isConversationMoveAuthorityEnabled() {
  const flag = process.env.CONVERSATION_MOVE_AUTHORITY;
  if (flag === "0" || flag === "false") return false;
  return true;
}

/**
 * @param {{
 *   conversationMove?: object|null,
 *   clarificationGate?: { shouldClarify?: boolean, message?: string, pipelinePath?: string|null },
 *   query?: string,
 *   response_commitment?: { renderMode?: string }|null,
 * }} input
 * @returns {{
 *   clarificationGate: object,
 *   earlyTurn: { text: string, pipelinePath: string }|null,
 *   authorityApplied: boolean,
 * }}
 */
export function applyConversationMoveAuthority({
  conversationMove = null,
  clarificationGate = {},
  query = "",
  response_commitment = null,
} = {}) {
  const gate = { ...clarificationGate };

  if (!isConversationMoveAuthorityEnabled() || !conversationMove) {
    return { clarificationGate: gate, earlyTurn: null, authorityApplied: false };
  }

  if (gate.shouldClarify && !shouldRunClarificationGate(conversationMove)) {
    return {
      clarificationGate: {
        ...gate,
        shouldClarify: false,
        suppressedByConversationMove: true,
        suppressionReason: conversationMove.move,
      },
      earlyTurn: null,
      authorityApplied: true,
    };
  }

  if (
    conversationMove.stopped &&
    conversationMove.move === CONVERSATION_MOVES.CLARIFY_ONE &&
    conversationMove.clarifyQuestion
  ) {
    if (resolveNamedCreateStartShortCircuit(query)?.reply) {
      return {
        clarificationGate: {
          ...gate,
          shouldClarify: false,
          suppressedByNamedCreate: true,
        },
        earlyTurn: null,
        authorityApplied: true,
      };
    }
    if (response_commitment?.renderMode !== "clarify") {
      return {
        clarificationGate: gate,
        earlyTurn: null,
        authorityApplied: true,
      };
    }
    return {
      clarificationGate: gate,
      earlyTurn: {
        text: conversationMove.clarifyQuestion,
        pipelinePath:
          conversationMove.pipelinePath || "clarification_gate",
      },
      authorityApplied: true,
    };
  }

  return { clarificationGate: gate, earlyTurn: null, authorityApplied: false };
}
