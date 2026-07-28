/**
 * Réponse déterministe pour tours méta (correction / feedback sur l'assistant).
 */
import { classifyConversationTurn } from "../classifiers/conversationTurnType.js";

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {ReturnType<typeof classifyConversationTurn>} [turn]
 */
export function buildMetaFeedbackReply(query = "", history = [], turn = null) {
  const classified = turn || classifyConversationTurn(query, { history });

  if (classified.topicHint === "forge_react_mvp") {
    return [
      "Oui — ton message est une **remarque sur la réponse précédente**, pas une nouvelle demande d’installation ou de lancement de jeu.",
      "",
      "La dérive vers **Steam / OS / NFS** était un faux positif : le fil actif concerne plutôt le **cadrage Forge** (calculatrice React/Vite, MVP, handoff), pas Need for Speed.",
      "",
      "Je peux reprendre sur ce fil : brief Forge prêt à injecter, ou squelette Vite/React avec dépendances minimales. Que préfères-tu ?",
    ].join("\n");
  }

  if (classified.topicHint === "routing_correction") {
    return [
      "Oui — ici tu corriges le **routage ou le module** (ex. traitement NFS), pas une intention utilisateur « lancer/installer le jeu ».",
      "",
      "Je n’appliquerai pas de clarification plateforme (Steam, OS…) sur ce tour. Indique ce que tu veux ajuster : fichier, gate procédure, ou mémoire de session.",
    ].join("\n");
  }

  return [
    "Compris — tu signales que ma réponse précédente n’était pas correcte, ce n’est pas un bug technique à diagnostiquer.",
    "",
    "Dis-moi ce qui clochait (hors sujet, trop méta, mauvais ton…) ou reformule ce que tu attendais, et je reprends proprement.",
  ].join("\n");
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {{ path: string, reply: string, turn: object }|null}
 */
export function resolveMetaFeedbackShortCircuit(query = "", options = {}) {
  const turn = classifyConversationTurn(query, options);
  if (!turn.shortCircuit) return null;

  return {
    path: "meta_feedback_deterministic",
    reply: buildMetaFeedbackReply(query, options.history || [], turn),
    turn,
  };
}
