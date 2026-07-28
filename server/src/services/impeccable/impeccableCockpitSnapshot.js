/**
 * Snapshot dernier audit Impeccable pour le Cockpit (E2).
 */
const latestBySession = new Map();
let globalLatest = null;

/**
 * @param {object} payload
 */
export function publishImpeccableCockpitSnapshot(payload = {}) {
  const entry = {
    ...payload,
    updated_at: Date.now(),
  };
  globalLatest = entry;
  if (payload.sessionId) {
    latestBySession.set(payload.sessionId, entry);
  }
  return entry;
}

/**
 * @param {string} [sessionId]
 */
export function getImpeccableCockpitSnapshot(sessionId = null) {
  if (sessionId && latestBySession.has(sessionId)) {
    return latestBySession.get(sessionId);
  }
  return globalLatest;
}

export default {
  publishImpeccableCockpitSnapshot,
  getImpeccableCockpitSnapshot,
};
