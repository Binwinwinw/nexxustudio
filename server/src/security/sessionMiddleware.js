/**
 * Middleware et validateurs de session (SEC — La Citadelle)
 */

const MAX_FEEDBACK_COMMENT_LENGTH = 2000;

/**
 * Valide le payload de POST /api/telemetry/feedback
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
export function validateTelemetryFeedback(body = {}) {
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) {
    return { ok: false, error: "sessionId requis." };
  }

  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    return { ok: false, error: "score doit être un entier entre 1 et 5." };
  }

  const comment =
    body.comment == null
      ? ""
      : String(body.comment).trim().slice(0, MAX_FEEDBACK_COMMENT_LENGTH);

  return {
    ok: true,
    data: {
      sessionId,
      score: Math.round(score),
      comment,
    },
  };
}

/**
 * Fabrique le middleware requireMandatorySession (sessionId obligatoire + verrou navigateur)
 */
export function createRequireMandatorySession({
  ensureBrowserId,
  getSessionIdFromRequest,
  sessionAccessService,
  safeError,
}) {
  return async function requireMandatorySession(req, res, next) {
    try {
      const browserId = await ensureBrowserId(req, res);
      const sessionId = getSessionIdFromRequest(req);

      if (!sessionId || typeof sessionId !== "string" || !sessionId.trim()) {
        return res.status(400).json({ error: "sessionId requis." });
      }

      const normalizedSessionId = sessionId.trim();
      const hasAccess = await sessionAccessService.ensureAccess(
        normalizedSessionId,
        browserId,
      );
      if (!hasAccess) {
        return res.status(403).json({ error: "Acces refuse a cette session." });
      }

      req.browserId = browserId;
      req.sessionId = normalizedSessionId;
      next();
    } catch (error) {
      res.status(500).json({ error: safeError(error) });
    }
  };
}
