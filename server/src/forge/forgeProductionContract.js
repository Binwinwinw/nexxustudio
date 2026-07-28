/**
 * Contrat de mission Forge production — build logiciel, pas idéation Nexxus Design.
 */
export const FORGE_WEBAPP_BUILD_CONTRACT_ID = "FORGE_WEBAPP_BUILD";

export function isForgeWebappProductionQuery(query = "", packet = {}) {
  if (packet?.meta?.forge_production === true) return true;
  return /\[FORGE_PRODUCTION\s*[—-]/i.test(String(query || ""));
}
