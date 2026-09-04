/**
 * AGENT_ENVIRONMENT_DISCLOSURE_GUARD_V1
 * Le runtime peut connaître l'environnement. La sortie chat publique ne le cartographie pas.
 */

export const ENVIRONMENT_DISCLOSURE_RULE = "no_internal_environment_coordinates";

export const ENVIRONMENT_DISCLOSURE_SAFE_REPLY =
  "Je peux parler de mon rôle et des grandes lignes (orchestration locale, limites, principes de sécurité). " +
  "Je ne donne pas les coordonnées internes — chemins, commandes de tooling, noms de modules internes. " +
  "Si tu as un objectif concret, dis-le en une phrase.";

const INTERNAL_COORDINATE_RES = [
  /server[\\/](?:data|src|tests|scripts)\b/i,
  /\.cursor[\\/]/i,
  /citadelle-vault[\\/]/i,
  /\bnpm run (?:dashboard:skills|test:skills|vault:sync|premerge|triage:)/i,
  /\bhub des skills\s+v\d/i,
  /\bskills?\s+v1\.\d\b/i,
  /\b(?:schema|loader|adr-007)\s*v1\.\d\b/i,
  /\(v1\.\d\)/i,
  /\bskill-[a-z0-9-]+\b/i,
];

/**
 * @param {string} text
 * @returns {string[]}
 */
export function detectInternalEnvironmentDisclosure(text = "") {
  const raw = String(text || "");
  if (!raw.trim()) return [];
  return INTERNAL_COORDINATE_RES.filter((re) => re.test(raw)).map((re) => re.source);
}

/**
 * Fail-closed : une coordonnée interne dans la réponse → texte haut niveau, pas de redact chirurgical.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeInternalEnvironmentDisclosure(text = "") {
  const hits = detectInternalEnvironmentDisclosure(text);
  if (!hits.length) return text;
  return ENVIRONMENT_DISCLOSURE_SAFE_REPLY;
}
