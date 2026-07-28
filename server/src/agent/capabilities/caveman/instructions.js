/** Instruction Caveman-lite — formulation serrée, pas fragments « classic caveman ». */
export const CAVEMAN_CAPABILITY_RULE = "behavior_caveman_lite_v1";

export const CAVEMAN_LITE_INSTRUCTION_BLOCK = [
  "CAPABILITY behavior.caveman — formulation lite (compression sortie, pas logique) :",
  "- Phrases complètes mais courtes ; supprime fillers, hedging et politesses inutiles.",
  "- Tutoiement FR conservé ; pas de narration d'outils ni tableaux décoratifs.",
  "- INTERDIT de modifier : blocs de code, commandes CLI, messages d'erreur, identifiants, chemins, URLs.",
  "- Cite les erreurs au mot près (ligne décisive) ; pas de dump log brut sauf demande.",
  "- Termes techniques et acronymes usuels exacts ; pas d'abréviations inventées (cfg/impl).",
  "- Pas de mode « classic caveman » ni fragments télégraphiques — registre pro tight.",
  "- Si sécurité, action irréversible ou séquence ambiguë : clarté avant brièveté.",
].join("\n");

/**
 * P2 : contenu instruction toujours lite ; le level sert au match / télémétrie seulement.
 * @param {string} [_level]
 * @returns {string}
 */
export function buildCavemanInstructionBlock(_level = "LITE") {
  return CAVEMAN_LITE_INSTRUCTION_BLOCK;
}

/**
 * @param {import("../capabilityTypes.js").CapabilityMatchInput} input
 * @returns {string}
 */
export function resolveEffectiveCavemanLevel(input = {}) {
  const fromInput = String(input.cavemanLevel || "NORMAL").toUpperCase();
  if (fromInput !== "NORMAL") return fromInput;
  return "NORMAL";
}

/** Niveaux explicites demandés par l'utilisateur (plus permissif hors contrat). */
export const CAVEMAN_EXPLICIT_INTENSITY_LEVELS = new Set([
  "FULL",
  "ULTRA",
  "DENSE",
  "WENYAN",
]);
