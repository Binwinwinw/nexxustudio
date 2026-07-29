/**
 * META_ASSISTANT_BEHAVIOR — réponse méta sans clarification objectif/format.
 */
import {
  isMetaAssistantBehaviorRequest,
  isComprehensionDemonstrationRequest,
} from "../../utils/metaAssistantBehaviorGuards.js";
import { extractRecentThreadTopicHint } from "../../utils/metaConversationIntentGuards.js";

export const META_ASSISTANT_BEHAVIOR_RULE = "meta_assistant_behavior_v1";

/** Batterie arts martiaux — critique clarification. */
export const META_BEHAVIOR_CANONICAL_REFLECT_QUERY =
  "tu penses qu'à l'avenir tu vas réfléchir avant de répondre ???";

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {string}
 */
export function buildMetaAssistantBehaviorReply(query = "", history = []) {
  const threadHint = extractRecentThreadTopicHint(history || []);
  const threadLine = threadHint
    ? ` Fil récent : « ${threadHint.slice(0, 100)} ».`
    : "";

  return [
    "Tu as raison de pointer ça — ce tour porte sur **ma façon de répondre**, pas sur un livrable à produire.",
    "",
    "Je ne « réfléchis » pas comme un humain : je route ta phrase vers des rails (social, réparation, métier…) puis je réponds dans ce cadre. Une bascule vers un plan de projets ou un orchestrateur lourd sur une critique comme celle-ci est hors sujet.",
    "",
    `Ce que je retiens de notre fil : salutations, puis une question sur mon « projet en cours » (formule générique — pas de projet actif en session).${threadLine}`,
    "",
    "Si tu veux avancer concrètement — code, doc, archi, autre — donne-moi le sujet et on y va sans plan de présentation. Si tu veux ajuster comment je clarifie ou je répare, précise ce qui t'a gêné sur le tour précédent.",
  ].join("\n");
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {{ path: string, reply: string }|null}
 */
export function resolveMetaAssistantBehaviorShortCircuit(query = "", options = {}) {
  if (isComprehensionDemonstrationRequest(query)) return null;
  if (!isMetaAssistantBehaviorRequest(query)) return null;
  return {
    path: "meta_assistant_behavior_deterministic",
    reply: buildMetaAssistantBehaviorReply(query, options.history || []),
  };
}
