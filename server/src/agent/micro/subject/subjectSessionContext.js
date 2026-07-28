/**
 * Contexte session pour biais interne (priorité projet Citadelle > registre public).
 * @param {{ sessionId?: string|null, sessionContext?: object }} options
 */
export function buildSubjectSessionContext(options = {}) {
  const explicit = options.sessionContext || {};
  return {
    inCitadelleWorkspace:
      Boolean(explicit.inCitadelleWorkspace) || Boolean(options.sessionId),
    activeProjectNames: Array.isArray(explicit.activeProjectNames)
      ? explicit.activeProjectNames
      : [],
    forgeModeActive: Boolean(explicit.forgeModeActive),
  };
}
