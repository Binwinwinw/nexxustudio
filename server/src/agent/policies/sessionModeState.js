/**
 * SESSION_MODE_STATE_V1 — état sticky de posture (TTL, rupture, observabilité).
 * P0 / P0.1 : TTL observé (before/after) + intensité light|normal|strong.
 */
export const SESSION_MODE_STATE_CONTRACT = "SESSION_MODE_STATE_V1";
export const SESSION_MODE_STATE_RULE = "session_mode_state_p0_v1";

export const POSTURES = Object.freeze({
  CONVERSATIONAL: "conversational",
  MENTOR: "mentor",
  ADVISOR: "advisor",
  EXECUTOR: "executor",
  FORMATTER: "formatter",
  ARCHITECT: "architect",
});

export const POSTURE_SOURCES = Object.freeze({
  EXPLICIT: "explicit",
  INFERRED: "inferred",
  STICKY: "sticky",
  DEFAULT: "default",
  AUTHORITY_OVERRIDE: "authority_override",
  FALLBACK: "fallback",
});

/** Intensité de posture — style léger vs futur rail socratique fort. */
export const POSTURE_INTENSITIES = Object.freeze({
  LIGHT: "light",
  NORMAL: "normal",
  STRONG: "strong",
});

export const DEFAULT_TTL_TURNS = 8;
export const MAX_TTL_TURNS = 10;

/**
 * @returns {object}
 */
export function createDefaultSessionModeState() {
  return {
    contract: SESSION_MODE_STATE_CONTRACT,
    posture: POSTURES.CONVERSATIONAL,
    source: POSTURE_SOURCES.DEFAULT,
    intensity: POSTURE_INTENSITIES.NORMAL,
    ttlTurns: DEFAULT_TTL_TURNS,
    confidence: "low",
    lockedByUser: false,
    lastReaffirmedAt: null,
    breakReason: null,
    dominantPromisedValue: null,
    turnCountAtSet: 0,
  };
}

/**
 * @param {object|null|undefined} raw
 * @returns {object}
 */
export function normalizeSessionModeState(raw = null) {
  const base = createDefaultSessionModeState();
  if (!raw || typeof raw !== "object") return base;

  const posture = Object.values(POSTURES).includes(raw.posture)
    ? raw.posture
    : POSTURES.CONVERSATIONAL;
  const source = Object.values(POSTURE_SOURCES).includes(raw.source)
    ? raw.source
    : POSTURE_SOURCES.DEFAULT;
  const intensity = Object.values(POSTURE_INTENSITIES).includes(raw.intensity)
    ? raw.intensity
    : POSTURE_INTENSITIES.NORMAL;
  const ttl = Number(raw.ttlTurns);
  const ttlTurns = Number.isFinite(ttl)
    ? Math.max(0, Math.min(MAX_TTL_TURNS, Math.floor(ttl)))
    : DEFAULT_TTL_TURNS;

  return {
    ...base,
    ...raw,
    contract: SESSION_MODE_STATE_CONTRACT,
    posture,
    source,
    intensity,
    ttlTurns,
    confidence: ["low", "medium", "high"].includes(raw.confidence)
      ? raw.confidence
      : "low",
    lockedByUser: Boolean(raw.lockedByUser),
    lastReaffirmedAt: raw.lastReaffirmedAt || null,
    breakReason: raw.breakReason || null,
    dominantPromisedValue: raw.dominantPromisedValue || null,
    turnCountAtSet: Number(raw.turnCountAtSet) || 0,
  };
}

/**
 * Décrémente le TTL avec observation ttlBefore / ttlAfter / ttlResetReason.
 * @param {object} state
 * @param {{ forceExpire?: boolean, reason?: string }} [opts]
 * @returns {{
 *   state: object,
 *   ttlBefore: number,
 *   ttlAfter: number,
 *   ttlResetReason: string|null,
 * }}
 */
export function tickSessionModeTtl(state = {}, opts = {}) {
  const current = normalizeSessionModeState(state);
  const ttlBefore = current.ttlTurns;

  if (current.posture === POSTURES.CONVERSATIONAL && !current.lockedByUser) {
    return {
      state: { ...current, breakReason: null },
      ttlBefore,
      ttlAfter: ttlBefore,
      ttlResetReason: null,
    };
  }

  if (opts.forceExpire) {
    const resetReason = opts.reason || "forced_expire";
    return {
      state: {
        ...createDefaultSessionModeState(),
        source: POSTURE_SOURCES.FALLBACK,
        breakReason: resetReason,
        lastReaffirmedAt: current.lastReaffirmedAt,
      },
      ttlBefore,
      ttlAfter: DEFAULT_TTL_TURNS,
      ttlResetReason: resetReason,
    };
  }

  const nextTtl = Math.max(0, ttlBefore - 1);
  if (nextTtl <= 0) {
    return {
      state: {
        ...createDefaultSessionModeState(),
        source: POSTURE_SOURCES.FALLBACK,
        breakReason: "ttl_expired",
        lastReaffirmedAt: current.lastReaffirmedAt,
      },
      ttlBefore,
      ttlAfter: 0,
      ttlResetReason: "ttl_expired",
    };
  }

  return {
    state: {
      ...current,
      ttlTurns: nextTtl,
      breakReason: null,
    },
    ttlBefore,
    ttlAfter: nextTtl,
    ttlResetReason: null,
  };
}

/**
 * Applique une nouvelle posture (set sticky).
 * @param {object} prev
 * @param {{
 *   posture: string,
 *   source: string,
 *   confidence?: string,
 *   intensity?: string,
 *   lockedByUser?: boolean,
 *   ttlTurns?: number,
 *   turnTimestamp?: string,
 *   turnCount?: number,
 *   ttlResetReason?: string|null,
 * }} patch
 */
export function applySessionModePosture(prev = {}, patch = {}) {
  const posture = Object.values(POSTURES).includes(patch.posture)
    ? patch.posture
    : POSTURES.CONVERSATIONAL;
  const ttl =
    typeof patch.ttlTurns === "number"
      ? Math.max(1, Math.min(MAX_TTL_TURNS, Math.floor(patch.ttlTurns)))
      : DEFAULT_TTL_TURNS;
  const intensity = Object.values(POSTURE_INTENSITIES).includes(patch.intensity)
    ? patch.intensity
    : prev.intensity || POSTURE_INTENSITIES.NORMAL;

  return normalizeSessionModeState({
    ...prev,
    posture,
    source: patch.source || POSTURE_SOURCES.EXPLICIT,
    intensity,
    confidence: patch.confidence || "high",
    lockedByUser: Boolean(patch.lockedByUser),
    ttlTurns: ttl,
    lastReaffirmedAt: patch.turnTimestamp || new Date().toISOString(),
    breakReason: null,
    turnCountAtSet: patch.turnCount ?? prev.turnCountAtSet ?? 0,
  });
}

/**
 * Snapshot télémétrie minimal par tour (P0.1 : TTL observé + intensité).
 * @param {object} state
 * @param {object} decision
 */
export function buildSessionModeTelemetry(state = {}, decision = {}) {
  return {
    rule: SESSION_MODE_STATE_RULE,
    posture: decision.posture || state.posture || POSTURES.CONVERSATIONAL,
    source: decision.source || state.source || POSTURE_SOURCES.DEFAULT,
    intensity:
      decision.intensity || state.intensity || POSTURE_INTENSITIES.NORMAL,
    ttlTurns: state.ttlTurns ?? null,
    ttlBefore:
      decision.ttlBefore !== undefined && decision.ttlBefore !== null
        ? decision.ttlBefore
        : null,
    ttlAfter:
      decision.ttlAfter !== undefined && decision.ttlAfter !== null
        ? decision.ttlAfter
        : state.ttlTurns ?? null,
    ttlResetReason: decision.ttlResetReason || null,
    lockedByUser: Boolean(state.lockedByUser),
    confidence: decision.confidence || state.confidence || "low",
    maintainReason: decision.maintainReason || null,
    breakReason: decision.breakReason || state.breakReason || null,
    authorityConflict: decision.authorityConflict || null,
  };
}
