import { isAssistantRepairIntent } from "../../utils/assistantRepairGuards.js";
import { isIdeationIntent } from "../../utils/ideationIntentGuards.js";

/**
 * Builds a grounded, minimalistic response acknowledging a misunderstanding
 * and inviting the user to clarify without diving into system capabilities.
 * @param {string} query 
 * @param {Array<{ role?: string, content?: string }>} history 
 * @returns {string}
 */
export function buildAssistantRepairReply(query, history = []) {
  // Try to find the most recent user turn before this one to anchor the reply
  let previousUserMessage = "";
  if (Array.isArray(history) && history.length >= 2) {
    for (let i = history.length - 2; i >= 0; i--) {
      if (history[i]?.role === "user") {
        previousUserMessage = history[i].content;
        break;
      }
    }
  }

  const baseAck = "Oui, tu as raison : j'ai mal interprété ta demande précédente.";

  if (previousUserMessage && isIdeationIntent(previousUserMessage)) {
    const cleanMsg = previousUserMessage.replace(/\n+/g, " ").trim();
    return [
      `${baseAck} Tu cherchais des pistes de **projet concret** avec moi (La Citadelle / dev local) — « ${cleanMsg} ».`,
      "J'ai soit proposé des idées trop génériques, soit un pipeline trop lourd pour une simple idéation.",
      "On peut repartir sur 3 pistes ancrées tech (RAG local, mini-app souveraine, automatisation légère) — dis-moi si tu vises plutôt code, doc ou archi.",
    ].join(" ");
  }
  
  if (previousUserMessage && previousUserMessage.length > 0 && previousUserMessage.length < 200) {
    const cleanMsg = previousUserMessage.replace(/\n+/g, " ").trim();
    return `${baseAck} Tu disais : « ${cleanMsg} ». Peux-tu repréciser ce point pour qu'on reparte sur de bonnes bases ?`;
  }

  return `${baseAck} Ma réponse n'était pas adaptée. Peux-tu reformuler ce que tu attendais exactement pour qu'on reparte sur de bonnes bases ?`;
}

/**
 * Resolves the short circuit for assistant repair intent.
 * @param {string} query 
 * @param {{ history?: Array<{ role?: string, content?: string }> }} options 
 * @returns {{ path: string, reply: string }|null}
 */
export function resolveAssistantRepairShortCircuit(query = "", options = {}) {
  const history = options.history || [];
  
  if (!isAssistantRepairIntent(query, history)) {
    return null;
  }

  return {
    path: "assistant_repair_deterministic",
    reply: buildAssistantRepairReply(query, history)
  };
}
