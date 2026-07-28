import { IDEATION_FRAMING_REPLY } from "../../utils/ideationIntentGuards.js";

const CLARIFICATION_BY_KIND = {
  ideation_vague: IDEATION_FRAMING_REPLY,
  familiarity_unknown:
    "Je peux t'aider, mais précise le sujet : de quoi parles-tu exactement ?",
  generic:
    "Peux-tu préciser ce que tu veux faire ou savoir ?",
};

/**
 * Produit une question de cadrage unique selon le contexte.
 * @param {{ kind?: keyof typeof CLARIFICATION_BY_KIND }} [context]
 */
export function buildClarificationQuestion(context = {}) {
  return CLARIFICATION_BY_KIND[context.kind] ?? CLARIFICATION_BY_KIND.generic;
}
