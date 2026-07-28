/**
 * Garde épistémique — auto-modification / fichiers système de NEXXUS.
 * Réponses déterministes : refus honnête + redirection vers les bons espaces.
 */
import {
  classifyIntentGuard,
  isSelfModificationQuery,
} from "../../utils/intentGuards.js";

const DENY_CAPABILITY_REPLY = `Non — dans mon mode opératoire actuel, je ne suis pas capable de modifier les fichiers qui me composent (orchestrateur, prompts, hooks, pipeline). Ce périmètre est l'infrastructure runtime, pas l'espace Forge où je peux produire des artefacts pour vos projets.`;

const EXPLAIN_HOW_REPLY = `Je ne peux pas m'auto-modifier : je suis exécuté depuis un runtime préconfiguré, sans accès direct en écriture à mes propres sources.

Pour changer mon comportement, les modifications passent par :
- le dépôt technique (\`server/src/agent/\`, \`server/src/hooks/\`) ;
- la documentation d'architecture (ADRs dans le Vault) ;
- un agent IDE ou un développeur humain — pas par une réécriture de moi-même dans le chat.

Je peux cartographier ces espaces et expliquer une évolution ciblée si tu précises ce que tu veux ajuster.`;

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
