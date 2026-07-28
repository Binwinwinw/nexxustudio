/* Follow-up familiarité — délègue à la couche P2 conversationContinuityContext */
import {
  buildConversationContinuityContext,
  isConversationContinuityFollowup,
  isShortFollowupText,
  parseFamiliarityProposalFromTurn,
  resolveShortFollowup,
} from "../micro/continuity/conversationContinuityContext.js";

export { buildFamiliarityFollowupApercuReply } from "./familiarityIntentGuards.js";

/**
 * Doctrine : un refus épistémique ne doit jamais s'activer sur un follow-up
 * explicite d'une proposition de familiarité simple (oui, parle-m'en, etc.).
 */
export const FAMILIARITY_FOLLOWUP_NO_REFUSAL_RULE = "familiarity_followup_no_refusal";

export const FAMILIARITY_FOLLOWUP_REPLY_MODE = "familiarity_followup_apercu";

export {
  isShortFollowupText as isFamiliarityFollowupAcceptance,
  parseFamiliarityProposalFromTurn as parseFamiliarityProposalFromAssistant,
};

export function isFamiliarityFollowupIntent(query = "", history = []) {
  return isConversationContinuityFollowup(query, history);
}

export function getFamiliarityFollowupDeterministicReply(query = "", history = []) {
  const { state } = buildConversationContinuityContext(history);
  return resolveShortFollowup(query, state)?.reply ?? null;
}
