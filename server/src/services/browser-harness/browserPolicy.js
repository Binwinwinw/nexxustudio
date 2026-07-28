/**
 * Politique Browser Harness Phase C — fail-closed, local-first, read-only par défaut.
 */
import { validateDesignExtractEgress } from '../design-extract/designExtractPolicy.js';

export const BROWSER_HARNESS_SKILL_ID = 'skill-browser-harness';

export const BROWSER_EGRESS_POLICIES = ['local-only', 'hybrid-controlled'];

/** Phase C : observe uniquement ; act réservé Phase D. */
export const BROWSER_OPERATION_MODES = ['observe'];

/** Actions autorisées en mode observe (Phase C). */
export const BROWSER_OBSERVE_ALLOWED_ACTIONS = new Set([
  'navigate',
  'snapshot',
  'styles',
  'screenshot',
  'close',
]);

/** Actions interdites Phase C sans confirmation explicite (Phase D). */
export const BROWSER_FORBIDDEN_ACTIONS_PHASE_C = new Set([
  'click',
  'type',
  'fill',
  'press',
  'upload',
  'download',
  'select',
  'check',
  'uncheck',
  'hover',
  'drag',
  'evaluate',
]);

export const BROWSER_NAVIGATION_TIMEOUT_MS = 12_000;
export const BROWSER_SESSION_TIMEOUT_MS = 45_000;
export const BROWSER_DOM_STABLE_TIMEOUT_MS = 8_000;
export const BROWSER_NETWORK_IDLE_TIMEOUT_MS = 4_000;

export const BROWSER_DEFAULT_VIEWPORT = { width: 1440, height: 900 };

export const BROWSER_VIEWPORT_LIMITS = {
  minWidth: 320,
  maxWidth: 3840,
  minHeight: 240,
  maxHeight: 2160,
};

export const BROWSER_SESSION_LIMITS = {
  maxPagesPerSession: 1,
  downloadsAllowed: false,
  uploadsAllowed: false,
  popupsPolicy: 'dismiss',
  javascriptEnabled: true,
  persistCookiesCrossSession: false,
};

/**
 * @param {string} urlString
 * @param {string} [egressPolicy='local-only']
 */
export function validateBrowserNavigationUrl(urlString, egressPolicy = 'local-only') {
  if (!BROWSER_EGRESS_POLICIES.includes(egressPolicy)) {
    return {
      ok: false,
      code: 'EGRESS_POLICY_INVALID',
      message: `Politique egress « ${egressPolicy} » non supportée.`,
    };
  }

  return validateDesignExtractEgress(urlString, egressPolicy);
}

/**
 * @param {string} action
 * @param {string} [mode='observe']
 */
export function validateBrowserAction(action = '', mode = 'observe') {
  const normalized = String(action).trim().toLowerCase();
  if (!normalized) {
    return { ok: false, code: 'ACTION_REQUIRED', message: 'Action browser requise.' };
  }

  if (!BROWSER_OPERATION_MODES.includes(mode)) {
    return {
      ok: false,
      code: 'MODE_FORBIDDEN',
      message: `Mode « ${mode} » non autorisé en Phase C.`,
    };
  }

  if (BROWSER_FORBIDDEN_ACTIONS_PHASE_C.has(normalized)) {
    return {
      ok: false,
      code: 'ACTION_FORBIDDEN',
      message: `Action « ${normalized} » interdite en Phase C (read-only).`,
    };
  }

  if (mode === 'observe' && !BROWSER_OBSERVE_ALLOWED_ACTIONS.has(normalized)) {
    return {
      ok: false,
      code: 'ACTION_NOT_ALLOWED',
      message: `Action « ${normalized} » non permise en mode observe.`,
    };
  }

  return { ok: true, action: normalized };
}

/**
 * @param {string[]} [requestedActions]
 * @param {string} [mode='observe']
 */
export function validateBrowserActionList(requestedActions = [], mode = 'observe') {
  for (const action of requestedActions) {
    const check = validateBrowserAction(action, mode);
    if (!check.ok) return check;
  }
  return { ok: true };
}

/**
 * @param {{ width?: number, height?: number }} [viewport]
 */
export function validateBrowserViewport(viewport = {}) {
  const width = Number(viewport.width ?? BROWSER_DEFAULT_VIEWPORT.width);
  const height = Number(viewport.height ?? BROWSER_DEFAULT_VIEWPORT.height);

  if (
    Number.isNaN(width) ||
    Number.isNaN(height) ||
    width < BROWSER_VIEWPORT_LIMITS.minWidth ||
    width > BROWSER_VIEWPORT_LIMITS.maxWidth ||
    height < BROWSER_VIEWPORT_LIMITS.minHeight ||
    height > BROWSER_VIEWPORT_LIMITS.maxHeight
  ) {
    return {
      ok: false,
      code: 'VIEWPORT_INVALID',
      message: 'Viewport hors limites autorisées.',
    };
  }

  return {
    ok: true,
    viewport: { width: Math.round(width), height: Math.round(height) },
  };
}

/**
 * Politique session — refus explicite downloads/uploads Phase C.
 * @param {{ intent?: 'download' | 'upload' }} [options]
 */
export function validateBrowserSessionPolicy(options = {}) {
  const intent = options.intent || null;

  if (intent === 'download' && !BROWSER_SESSION_LIMITS.downloadsAllowed) {
    return {
      ok: false,
      code: 'DOWNLOAD_FORBIDDEN',
      message: 'Téléchargements bloqués par politique Browser Harness Phase C.',
    };
  }

  if (intent === 'upload' && !BROWSER_SESSION_LIMITS.uploadsAllowed) {
    return {
      ok: false,
      code: 'UPLOAD_FORBIDDEN',
      message: 'Uploads bloqués par politique Browser Harness Phase C.',
    };
  }

  return { ok: true };
}

/**
 * @param {number} elapsedMs
 */
export function validateBrowserSessionTimeout(elapsedMs = 0) {
  if (elapsedMs > BROWSER_SESSION_TIMEOUT_MS) {
    return {
      ok: false,
      code: 'SESSION_TIMEOUT',
      message: `Session browser expirée (>${BROWSER_SESSION_TIMEOUT_MS}ms).`,
    };
  }
  return { ok: true };
}

export function getBrowserSessionLimits() {
  return { ...BROWSER_SESSION_LIMITS };
}

export function getBrowserTimeoutPolicy() {
  return {
    navigation_ms: BROWSER_NAVIGATION_TIMEOUT_MS,
    session_ms: BROWSER_SESSION_TIMEOUT_MS,
    dom_stable_ms: BROWSER_DOM_STABLE_TIMEOUT_MS,
    network_idle_ms: BROWSER_NETWORK_IDLE_TIMEOUT_MS,
  };
}

export default {
  BROWSER_HARNESS_SKILL_ID,
  BROWSER_EGRESS_POLICIES,
  BROWSER_OPERATION_MODES,
  BROWSER_NAVIGATION_TIMEOUT_MS,
  BROWSER_SESSION_TIMEOUT_MS,
  validateBrowserNavigationUrl,
  validateBrowserAction,
  validateBrowserActionList,
  validateBrowserViewport,
  validateBrowserSessionPolicy,
  validateBrowserSessionTimeout,
  getBrowserSessionLimits,
  getBrowserTimeoutPolicy,
};
