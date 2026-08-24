/**
 * META_ASSISTANT_BEHAVIOR — réponse méta sans clarification objectif/format.
 */
import {
  isMetaAssistantBehaviorRequest,
  isComprehensionDemonstrationRequest,
} from "../../utils/intent-guards/metaAssistantBehaviorGuards.js";
import { extractRecentThreadTopicHint } from "../../utils/intent-guards/metaConversationIntentGuards.js";
import {
  inferActiveGoal,
  buildMetaConversationFeedbackReply,
} from "../conversation/activeGoalPolicy.js";

export const META_ASSISTANT_BEHAVIOR_RULE = "meta_assistant_behavior_v1";
export const META_CONVERSATION_FEEDBACK_PATH = "meta_conversation_feedback";

/** Batterie arts martiaux — critique clarification. */
export const META_BEHAVIOR_CANONICAL_REFLECT_QUERY =
  "tu penses qu'à l'avenir tu vas réfléchir avant de répondre ???";

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {{ priorState?: object|null }} [options]
 * @returns {string}
 */
export function buildMetaAssistantBehaviorReply(query = "", history = [], options = {}) {
  const goal = inferActiveGoal(history || [], options.priorState || null);
  const threadHint = extractRecentThreadTopicHint(history || []);
  const body = buildMetaConversationFeedbackReply(goal, threadHint);
  return body;
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }>, priorState?: object|null }} [options]
 * @returns {{ path: string, reply: string }|null}
 */
export function resolveMetaAssistantBehaviorShortCircuit(query = "", options = {}) {
  if (isComprehensionDemonstrationRequest(query)) return null;
  if (!isMetaAssistantBehaviorRequest(query)) return null;
  return {
    path: META_CONVERSATION_FEEDBACK_PATH,
    reply: buildMetaAssistantBehaviorReply(query, options.history || [], options),
  };
}
