/**
 * Identifiants stables d'entité — distincts de canonical (forme normalisée).
 * Format : {domain}:{slug} — ex. public:game:nfs, internal:citadelle:forge
 */
export const ENTITY_DOMAINS = {
  PUBLIC: "public",
  INTERNAL: "internal",
  SESSION: "session",
  UNRESOLVED: "unresolved",
};

export const ENTITY_IDS = {
  PUBLIC_GAME_NFS: "public:game:need-for-speed",
  PUBLIC_GAME_FORTNITE: "public:game:fortnite",
  PUBLIC_GAME_MINECRAFT: "public:game:minecraft",
  PUBLIC_GAME_GTA: "public:game:grand-theft-auto",
  PUBLIC_GAME_LOL: "public:game:league-of-legends",
  PUBLIC_PLATFORM_STEAM: "public:platform:steam",
  PUBLIC_AMBIGUOUS_ECLIPSE: "public:ambiguous:eclipse",
  PUBLIC_AMBIGUOUS_ATLAS: "public:ambiguous:atlas",
  INTERNAL_FORGE: "internal:citadelle:forge",
  INTERNAL_NEXXUS: "internal:citadelle:nexxus",
  INTERNAL_CITADELLE: "internal:citadelle:citadelle",
  INTERNAL_STUDIO: "internal:citadelle:studio",
};

/**
 * @param {string} domain
 * @param {string} slug
 * @returns {string}
 */
export function buildEntityId(domain, slug) {
  return `${domain}:${slug}`;
}

/**
 * ID projet session — canonical ≠ identité résolue.
 * @param {string} projectSlug
 */
export function sessionProjectEntityId(projectSlug) {
  const slug = String(projectSlug || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
  return `${ENTITY_DOMAINS.SESSION}:project:${slug || "unknown"}`;
}
