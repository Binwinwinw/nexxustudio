/**
 * P5 — Orchestrateur élan conversationnel (déterministe, sans LLM).
 */
import { classifyArchitectureDesignSignal } from "../../utils/architectureDesignIntentGuards.js";
import {
  buildDefaultRecommendation,
  enrichArchitectureOptionsReply,
} from "./defaultRecommendationBuilder.js";
import {
  CONVERSATION_NEXT_MOVES,
  INTENT_CONTRACTS,
} from "./conversationMoveTypes.js";
import { countNumberedOptions, resolveNextMove } from "./nextMovePolicy.js";

/**
 * @param {{
 *   contractId: string,
 *   query?: string,
 *   baseReply: string,
 *   signal?: "explorable"|"vague"|null,
 * }} ctx
 * @returns {{ reply: string, move: object, recommendation: object|null }}
 */
export function applyConversationMomentum(ctx = {}) {
  const { contractId, query = "", baseReply = "", signal = null } = ctx;

  const resolvedSignal =
    signal ??
    (contractId === INTENT_CONTRACTS.ARCHITECTURE_OPTIONS
      ? classifyArchitectureDesignSignal(query)
      : null);

  const move = resolveNextMove({
    contractId,
    signal: resolvedSignal,
    optionCount: countNumberedOptions(baseReply),
  });

  if (
    move.move === CONVERSATION_NEXT_MOVES.CLARIFY ||
    move.move === CONVERSATION_NEXT_MOVES.RESPOND
  ) {
    return { reply: baseReply, move, recommendation: null };
  }

  const recommendation = buildDefaultRecommendation({
    contractId,
    query,
    signal: resolvedSignal,
  });

  if (!recommendation) {
    return { reply: baseReply, move, recommendation: null };
  }

  if (contractId === INTENT_CONTRACTS.ARCHITECTURE_OPTIONS) {
    return {
      reply: enrichArchitectureOptionsReply(baseReply, recommendation),
      move,
      recommendation,
    };
  }

  return { reply: baseReply, move, recommendation: null };
}
