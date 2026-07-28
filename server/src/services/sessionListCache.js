/**
 * Cache mémoire court pour GET /api/sessions (sidebar bootstrap).
 */
const TTL_MS = 10_000;
const store = new Map();

export function getSessionListCache(browserId) {
  if (!browserId) return null;
  const entry = store.get(browserId);
  if (!entry || Date.now() - entry.at > TTL_MS) {
    store.delete(browserId);
    return null;
  }
  return entry.data;
}

export function setSessionListCache(browserId, sessions) {
  if (!browserId) return;
  store.set(browserId, { at: Date.now(), data: sessions });
}

export function invalidateSessionListCache(browserId) {
  if (browserId) store.delete(browserId);
}

export function clearSessionListCache() {
  store.clear();
}

export const SESSION_LIST_CACHE_TTL_MS = TTL_MS;
