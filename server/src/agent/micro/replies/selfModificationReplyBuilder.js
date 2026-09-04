/**
 * Garde épistémique — auto-modification / fichiers système de NEXXUS.
 * Réponses déterministes : refus honnête + redirection vers les bons espaces.
 */
import {
  classifyIntentGuard,
  isSelfModificationQuery,
} from "../../utils/intent-guards/intentGuards.js";

const DENY_CAPABILITY_REPLY = `Non — dans mon mode opératoire actuel, je ne suis pas capable de modifier les fichiers qui me composent (orchestrateur, prompts, hooks, pipeline). Ce périmètre est l'infrastructure runtime, pas l'espace Forge où je peux produire des artefacts pour vos projets.`;

const EXPLAIN_HOW_REPLY = `Je ne peux pas m'auto-modifier : je tourne dans un runtime préconfiguré, sans écriture sur ce qui me compose.

Pour faire évoluer mon comportement, ça passe par le dépôt et un humain ou un agent IDE — pas par une réécriture de moi-même dans le chat.

Je peux t'aider à cadrer le changement si tu précises l'objectif.`;

function isHowToModifyQuery(normalized = "") {
  return /\b(comment|comment faire|ou se trouve|ou sont|peux tu dire comment|es tu en capacite de dire comment)\b/.test(
    normalized,
  );
}

/**
 * @param {string} query
 * @returns {{ reply: string, subKind: 'self_modification_deny'|'self_modification_how', label: string }|null}
 */
export function resolveSelfModificationRoute(query = "") {
  if (!isSelfModificationQuery(query)) return null;

  const guard = classifyIntentGuard(query);
  const how = isHowToModifyQuery(guard.normalized);

  return {
    reply: how ? EXPLAIN_HOW_REPLY : DENY_CAPABILITY_REPLY,
    subKind: how ? "self_modification_how" : "self_modification_deny",
    label: guard.label,
  };
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function buildSelfModificationReply(query = "") {
  return resolveSelfModificationRoute(query)?.reply ?? null;
}
