/**
 * G44 — clarification référentielle sur la dernière phrase de l'assistant.
 * Ex. « de quel projet tu parles ? » après une formule d'accueil générique.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";

export const ASSISTANT_UTTERANCE_CLARIFY_RULE = "assistant_utterance_clarify_g44";

const UTTERANCE_CLARIFY_RE =
  /\b(?:de quel(?:le)?\s+\w+(?:\s+\w+)?\s+tu\s+parles|de quoi tu\s+parles|tu\s+parles\s+de\s+quoi|tu\s+veux\s+dire\s+quoi|qu['']?\s*est[- ]ce que tu\s+veux\s+dire|qu['']?\s*entends[- ]tu\s+par|c['']?\s*est[- ]à[- ]dire\s+quoi|pourquoi tu\s+(?:dis|dit)\s+(?:projet|ça|ca)|c['']?\s*est[- ]à[- ]dire\s+(?:projet|ça))\b/i;

const META_FEEDBACK_ASSISTANT_RE =
  /\b(?:feedback sur l.?assistant|tour est un feedback|pas une nouvelle action m[eé]tier|compris\s+—\s+ce tour)\b/i;

const PROJECT_REFERENCE_RE = /\bprojet\b/i;

/**
 * @param {Array<{ role?: string, content?: string }>} history
 * @returns {boolean}
 */
function hasRecentAssistantTurn(history = []) {
  return history.some(
    (m) => m?.role === "assistant" || m?.role === "model",
  );
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {boolean}
 */
export function isAssistantUtteranceClarifyRequest(query = "", options = {}) {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 10 || q.length > 160) return false;
  if (!UTTERANCE_CLARIFY_RE.test(q)) return false;
  return hasRecentAssistantTurn(options.history || []);
}

/**
 * @param {Array<{ role?: string, content?: string }>} history
 * @returns {string}
 */
function findLastAssistantSnippet(history = []) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role === "assistant" || history[i]?.role === "model") {
      return String(history[i].content || "").trim();
    }
  }
  return "";
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {string}
 */
export function buildAssistantUtteranceClarifyReply(query = "", history = []) {
  const last = findLastAssistantSnippet(history);

  if (META_FEEDBACK_ASSISTANT_RE.test(last)) {
    return [
      "Tu demandes de quoi je parlais — c'était un **méta-feedback**, pas un sujet métier (jeu, launcher, install).",
      "",
      "Je disais que ton tour précédent portait sur **mon comportement** (conscience de contexte, façon de répondre), pas sur une tâche à exécuter. Je m'étais volontairement détaché du dernier sujet technique résolu pour ne pas te coller une réponse hors-sujet.",
      "",
      "Si tu veux qu'on reprenne ta question sur mes capacités (fichiers, intégration), redis-le en une phrase et je réponds sur ce rail.",
    ].join("\n");
  }

  if (PROJECT_REFERENCE_RE.test(query) || /projet en cours/i.test(last)) {
    return [
      "Bonne question — quand j'ai parlé de « projet en cours », c'était une **formule d'accueil générique**, pas un projet actif dans cette session.",
      "",
      "On part de zéro ici. Tu veux lancer quelque chose de concret (code, doc, archi) ou simplement continuer à papoter ?",
    ].join("\n");
  }

  const excerpt =
    last.length > 120 ? `${last.slice(0, 120)}…` : last;

  return [
    "Tu demandes une précision sur ma phrase précédente — c'est légitime.",
    "",
    excerpt
      ? `Je reformule : « ${excerpt} ».`
      : "Je n'ai pas de formulation précise à rattacher dans l'historique récent.",
    "",
    "Dis-moi ce qui reste flou et on repart sur un sujet concret.",
  ].join("\n");
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {{ path: string, reply: string }|null}
 */
export function resolveAssistantUtteranceClarifyShortCircuit(
  query = "",
  options = {},
) {
  const history = options.history || [];
  if (!isAssistantUtteranceClarifyRequest(query, { history })) return null;
  return {
    path: "assistant_utterance_clarify_deterministic",
    reply: buildAssistantUtteranceClarifyReply(query, history),
  };
}
