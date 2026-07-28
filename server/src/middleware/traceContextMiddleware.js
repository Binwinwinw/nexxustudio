import crypto from 'crypto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Propagation trace_id — entrée HTTP (M1-S1).
 * Réutilise X-Trace-Id entrant si valide, sinon génère un UUID v4.
 */
export function traceContextMiddleware(req, res, next) {
  const incoming = String(req.headers['x-trace-id'] || '').trim();
  const traceId = UUID_RE.test(incoming) ? incoming : crypto.randomUUID();

  req.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);
  next();
}

export default traceContextMiddleware;
