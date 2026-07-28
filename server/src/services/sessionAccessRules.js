/**
 * Règles d'accessibilité session (verrou navigateur) — testables sans DB.
 */
export function resolveEffectiveOwner(browserId, browserExpiresAt, now = new Date()) {
  if (!browserId) return null;
  if (browserExpiresAt && new Date(browserExpiresAt) < now) {
    return null;
  }
  return browserId;
}

export function isSessionAccessibleForBrowser(
  browserId,
  browserExpiresAt,
  requestBrowserId,
  now = new Date(),
) {
  const owner = resolveEffectiveOwner(browserId, browserExpiresAt, now);
  return owner === null || owner === requestBrowserId;
}
