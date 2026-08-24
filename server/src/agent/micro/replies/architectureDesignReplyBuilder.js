import {
  getArchitectureDesignDeterministicReply,
  classifyArchitectureDesignSignal,
  resolveArchitectureDepthControl,
} from "../../utils/intent-guards/architectureDesignIntentGuards.js";
import { applyConversationMomentum } from "../momentum/conversationMomentumOrchestrator.js";
import { INTENT_CONTRACTS } from "../momentum/conversationMoveTypes.js";

export function buildArchitectureDesignReply(query = "") {
  const baseReply = getArchitectureDesignDeterministicReply(query);
  if (!baseReply) return null;

  if (resolveArchitectureDepthControl(query).analysisMode === "deferred") {
    return baseReply;
  }

  const { reply } = applyConversationMomentum({
    contractId: INTENT_CONTRACTS.ARCHITECTURE_OPTIONS,
    query,
    baseReply,
    signal: classifyArchitectureDesignSignal(query),
  });

  return reply;
}
