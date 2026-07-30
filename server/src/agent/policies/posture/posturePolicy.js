/**
 * PosturePolicy P0 — sticky modes + switch explicite + override d’autorité.
 * Ne change pas les rails métiers : sélectionne/maintient la posture relationnelle.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { isSubstantiveWorkRequest } from "../../utils/genericGreetingGuards.js";
import { isExplicitWebSearchRequest } from "../explicitWebSearchRequestPolicy.js";
import {
  POSTURES,
  POSTURE_SOURCES,
  POSTURE_INTENSITIES,
  DEFAULT_TTL_TURNS,
  applySessionModePosture,
  createDefaultSessionModeState,
  normalizeSessionModeState,
  tickSessionModeTtl,
  buildSessionModeTelemetry,
} from "./sessionModeState.js";

export const POSTURE_POLICY_RULE = "posture_policy_p0_v1";
export const POSTURE_DECISION_CONTRACT = "POSTURE_DECISION_V1";

const EXPLICIT_SET_RE =
  /\b(?:reste\s+en\s+mode|reste\s+en|passe\s+en\s+mode|passe\s+en|bascule\s+en\s+mode|mode)\s+(mentor|conseiller|advisor|ex[eé]cut(?:eur|ant)|executor|architecte|architect|formatteur|formatter|conversationnel|conversational)(?:\s+(l[eé]ger|light|fort|strong|normal))?\b/i;

const INTENSITY_STRONG_RE =
  /\b(?:fortement|mode\s+fort|vraiment\s+en\s+mode|socratique\s+strict)\b/i;
const INTENSITY_LIGHT_RE =
  /\b(?:l[eé]g[eè]rement|mode\s+l[eé]ger|un\s+peu\s+en\s+mode|style\s+l[eé]ger)\b/i;

const EXPLICIT_STOP_MENTOR_RE =
  /\b(?:arr[eê]te\s+(?:le\s+)?mentorat|stop\s+mentor|plus\s+de\s+mentorat|sors\s+du\s+mode\s+mentor|r[eé]ponds?\s+direct(?:ement)?|donne\s+la\s+r[eé]ponse\s+directe|mode\s+normal|reviens\s+en\s+mode\s+normal)\b/i;

const EXPLICIT_STOP_ANY_RE =
  /\b(?:arr[eê]te\s+(?:ce\s+)?mode|sors\s+du\s+mode|quitte\s+le\s+mode|reset\s+mode|mode\s+par\s+d[eé]faut)\b/i;

const INFER_MENTOR_RE =
  /\b(?:explique[- ]?moi\s+doucement|comme\s+un\s+mentor|guide[- ]?moi|aide[- ]?moi\s+[àa]\s+comprendre|sans\s+me\s+donner\s+la\s+solution|pousse[- ]?moi\s+[àa]\s+r[eé]fl[eé]chir)\b/i;

const INFER_ADVISOR_RE =
  /\b(?:que\s+me\s+conseilles[- ]?tu|ton\s+avis\s+d[eé]cisionnel|aide[- ]?moi\s+[àa]\s+(?:choisir|trancher|arbitrer)|quels?\s+sont\s+les\s+(?:options|arbitrages)|recommandes[- ]?tu)\b/i;

const INFER_ARCHITECT_RE =
  /\b(?:atelier\s+architecture|arbitrage\s+(?:archi|architecture)|concevoir\s+l['']architecture|trade[- ]?offs?\s+archi)\b/i;

const EXECUTION_MANDATE_RE =
  /\b(?:fais[- ]?le\s+(?:pour\s+moi\s+)?(?:maintenant|direct)|[eé]cris[- ]?le\s+(?:pour\s+moi|maintenant)|g[eé]n[eè]re[- ]?le\s+maintenant|impl[eé]mente[- ]?le|livre[- ]?moi\s+le\s+(?:code|patch)|on\s+code\s+maintenant)\b/i;

const FORGE_BREAK_RE =
  /\b(?:lance\s+la\s+forge|forge\s+le\s+projet|handoff\s+forge|produis\s+le\s+projet)\b/i;

/**
 * @param {string} label
 * @returns {string|null}
 */
function mapPostureLabel(label = "") {
  const l = String(label || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/mentor/.test(l)) return POSTURES.MENTOR;
  if (/conseiller|advisor/.test(l)) return POSTURES.ADVISOR;
  if (/execut|executor/.test(l)) return POSTURES.EXECUTOR;
  if (/architect/.test(l)) return POSTURES.ARCHITECT;
  if (/formatt|formatter/.test(l)) return POSTURES.FORMATTER;
  if (/conversation/.test(l)) return POSTURES.CONVERSATIONAL;
  return null;
}

/**
 * @param {string} posture
 */
export function getPostureCapabilities(posture = POSTURES.CONVERSATIONAL) {
  switch (posture) {
    case POSTURES.MENTOR:
      return {
        mayAskQuestions: true,
        mayExecute: false,
        initiative: "medium",
        styleHints: ["socratic", "low_dump"],
      };
    case POSTURES.ADVISOR:
      return {
        mayAskQuestions: true,
        mayExecute: false,
        initiative: "medium",
        styleHints: ["options", "recommendation", "risks"],
      };
    case POSTURES.EXECUTOR:
      return {
        mayAskQuestions: false,
        mayExecute: true,
        initiative: "high",
        styleHints: ["actionable", "concise"],
      };
    case POSTURES.FORMATTER:
      return {
        mayAskQuestions: true,
        mayExecute: false,
        initiative: "low",
        styleHints: ["transform_only"],
      };
    case POSTURES.ARCHITECT:
      return {
        mayAskQuestions: true,
        mayExecute: false,
        initiative: "medium",
        styleHints: ["tradeoffs", "iterative_workshop"],
      };
    default:
      return {
        mayAskQuestions: true,
        mayExecute: false,
        initiative: "low",
        styleHints: ["conversational"],
      };
  }
}

/**
 * @param {string} query
 * @returns {"light"|"normal"|"strong"}
 */
export function detectPostureIntensity(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (INTENSITY_STRONG_RE.test(q) || /\b(?:fort|strong)\b/i.test(q)) {
    return POSTURE_INTENSITIES.STRONG;
  }
  if (INTENSITY_LIGHT_RE.test(q) || /\b(?:leger|léger|light)\b/i.test(q)) {
    return POSTURE_INTENSITIES.LIGHT;
  }
  return POSTURE_INTENSITIES.NORMAL;
}

/**
 * @param {string} query
 * @returns {{ kind: "set"|"clear", posture?: string, lockedByUser?: boolean, intensity?: string }|null}
 */
export function detectExplicitPostureSwitch(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return null;

  if (EXPLICIT_STOP_MENTOR_RE.test(q) || EXPLICIT_STOP_ANY_RE.test(q)) {
    return { kind: "clear", posture: POSTURES.CONVERSATIONAL, lockedByUser: false };
  }

  const setMatch = q.match(EXPLICIT_SET_RE);
  if (setMatch?.[1]) {
    const posture = mapPostureLabel(setMatch[1]);
    if (posture) {
      let intensity = detectPostureIntensity(q);
      const intensityToken = setMatch[2];
      if (intensityToken) {
        const t = intensityToken.toLowerCase();
        if (/leger|léger|light/.test(t)) intensity = POSTURE_INTENSITIES.LIGHT;
        else if (/fort|strong/.test(t)) intensity = POSTURE_INTENSITIES.STRONG;
        else intensity = POSTURE_INTENSITIES.NORMAL;
      }
      return { kind: "set", posture, lockedByUser: true, intensity };
    }
  }
  return null;
}

/**
 * @param {string} query
 * @returns {{ posture: string, confidence: string }|null}
 */
export function inferPostureFromQuery(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return null;
  if (INFER_MENTOR_RE.test(q)) {
    return { posture: POSTURES.MENTOR, confidence: "medium" };
  }
  if (INFER_ADVISOR_RE.test(q)) {
    return { posture: POSTURES.ADVISOR, confidence: "medium" };
  }
  if (INFER_ARCHITECT_RE.test(q)) {
    return { posture: POSTURES.ARCHITECT, confidence: "medium" };
  }
  return null;
}

/**
 * @param {string} query
 * @param {{ lockedByUser?: boolean }} [ctx]
 * @returns {{ break: boolean, reason: string|null, forceExecutor: boolean }}
 */
export function detectHardPostureBreak(query = "", ctx = {}) {
  void ctx;
  const q = normalizeFamiliarityQuery(query);
  if (!q) return { break: false, reason: null, forceExecutor: false };

  if (EXECUTION_MANDATE_RE.test(q) || isSubstantiveWorkRequest(query)) {
    return { break: true, reason: "execution_mandate", forceExecutor: true };
  }
  if (FORGE_BREAK_RE.test(q)) {
    // Couloir majeur : sticky ne survit pas (même lockedByUser)
    return { break: true, reason: "forge_mandate", forceExecutor: true };
  }
  if (isExplicitWebSearchRequest(query)) {
    return { break: true, reason: "explicit_web_search", forceExecutor: false };
  }
  return { break: false, reason: null, forceExecutor: false };
}

/**
 * Résout la posture du tour + nouvel état sticky à persister.
 * @param {string} query
 * @param {{
 *   priorSessionMode?: object|null,
 *   turnTimestamp?: string,
 *   turnCount?: number,
 * }} [options]
 */
export function resolvePosture(query = "", options = {}) {
  const prior = normalizeSessionModeState(options.priorSessionMode);
  const turnTimestamp = options.turnTimestamp || new Date().toISOString();
  const turnCount = options.turnCount ?? 0;
  /** @type {{ ttlBefore: number|null, ttlAfter: number|null, ttlResetReason: string|null }} */
  let ttlObs = { ttlBefore: null, ttlAfter: null, ttlResetReason: null };

  const finalize = (decision) => {
    decision.intensity =
      decision.nextState?.intensity ||
      decision.intensity ||
      prior.intensity ||
      POSTURE_INTENSITIES.NORMAL;
    decision.ttlBefore = ttlObs.ttlBefore;
    decision.ttlAfter =
      ttlObs.ttlAfter !== null ? ttlObs.ttlAfter : decision.nextState?.ttlTurns ?? null;
    decision.ttlResetReason = ttlObs.ttlResetReason;
    decision.telemetry = buildSessionModeTelemetry(decision.nextState, decision);
    return decision;
  };

  const caps = (posture, source, extra = {}) => {
    const c = getPostureCapabilities(posture);
    return {
      contract: POSTURE_DECISION_CONTRACT,
      rule: POSTURE_POLICY_RULE,
      posture,
      source,
      intensity: extra.intensity || prior.intensity || POSTURE_INTENSITIES.NORMAL,
      confidence: extra.confidence || prior.confidence || "medium",
      mayAskQuestions: c.mayAskQuestions,
      mayExecute: c.mayExecute,
      initiative: c.initiative,
      styleHints: c.styleHints,
      maintainReason: extra.maintainReason || null,
      breakReason: extra.breakReason || null,
      authorityConflict: extra.authorityConflict || null,
      nextState: extra.nextState || prior,
      telemetry: null,
    };
  };

  // 1) Switch explicite utilisateur
  const explicit = detectExplicitPostureSwitch(query);
  if (explicit?.kind === "clear") {
    const ttlBefore = prior.ttlTurns;
    const nextState = applySessionModePosture(prior, {
      posture: POSTURES.CONVERSATIONAL,
      source: POSTURE_SOURCES.EXPLICIT,
      confidence: "high",
      intensity: POSTURE_INTENSITIES.NORMAL,
      lockedByUser: false,
      ttlTurns: DEFAULT_TTL_TURNS,
      turnTimestamp,
      turnCount,
    });
    ttlObs = {
      ttlBefore,
      ttlAfter: nextState.ttlTurns,
      ttlResetReason: "user_clear_mode",
    };
    return finalize(
      caps(POSTURES.CONVERSATIONAL, POSTURE_SOURCES.EXPLICIT, {
        confidence: "high",
        intensity: POSTURE_INTENSITIES.NORMAL,
        breakReason: "user_clear_mode",
        maintainReason: "explicit_user_clear",
        nextState: { ...nextState, breakReason: "user_clear_mode" },
      }),
    );
  }
  if (explicit?.kind === "set" && explicit.posture) {
    const ttlBefore = prior.ttlTurns;
    const intensity = explicit.intensity || POSTURE_INTENSITIES.NORMAL;
    const nextState = applySessionModePosture(prior, {
      posture: explicit.posture,
      source: POSTURE_SOURCES.EXPLICIT,
      confidence: "high",
      intensity,
      lockedByUser: true,
      ttlTurns: DEFAULT_TTL_TURNS,
      turnTimestamp,
      turnCount,
    });
    ttlObs = {
      ttlBefore,
      ttlAfter: nextState.ttlTurns,
      ttlResetReason: "explicit_user_set",
    };
    return finalize(
      caps(explicit.posture, POSTURE_SOURCES.EXPLICIT, {
        confidence: "high",
        intensity,
        maintainReason: "explicit_user_set",
        nextState,
      }),
    );
  }

  // 2) Tick TTL sur sticky existant
  let working = prior;
  if (
    prior.posture !== POSTURES.CONVERSATIONAL ||
    prior.lockedByUser ||
    prior.source === POSTURE_SOURCES.STICKY ||
    prior.source === POSTURE_SOURCES.EXPLICIT ||
    prior.source === POSTURE_SOURCES.INFERRED
  ) {
    const tick = tickSessionModeTtl(prior);
    working = tick.state;
    ttlObs = {
      ttlBefore: tick.ttlBefore,
      ttlAfter: tick.ttlAfter,
      ttlResetReason: tick.ttlResetReason,
    };
    if (working.breakReason === "ttl_expired") {
      return finalize(
        caps(POSTURES.CONVERSATIONAL, POSTURE_SOURCES.FALLBACK, {
          confidence: "low",
          breakReason: "ttl_expired",
          maintainReason: "ttl_expired_to_default",
          nextState: working,
        }),
      );
    }
  }

  // 3) Rupture / mandat (autorité #2) — forge/web cassent le sticky même locked
  const hard = detectHardPostureBreak(query, {
    lockedByUser: working.lockedByUser,
  });
  if (hard.break && hard.forceExecutor) {
    const conflict =
      working.posture !== POSTURES.EXECUTOR &&
      working.posture !== POSTURES.CONVERSATIONAL
        ? {
            stickyPosture: working.posture,
            override: POSTURES.EXECUTOR,
            reason: hard.reason,
          }
        : null;
    const clearSticky =
      hard.reason === "forge_mandate" || !working.lockedByUser;
    const nextState = clearSticky
      ? applySessionModePosture(working, {
          posture: POSTURES.EXECUTOR,
          source: POSTURE_SOURCES.AUTHORITY_OVERRIDE,
          confidence: "high",
          intensity: POSTURE_INTENSITIES.NORMAL,
          lockedByUser: false,
          ttlTurns: Math.min(4, DEFAULT_TTL_TURNS),
          turnTimestamp,
          turnCount,
        })
      : {
          // Mandat ponctuel sous lock user : executor ce tour, sticky conservé ensuite
          ...working,
          breakReason: hard.reason,
        };
    if (clearSticky) {
      ttlObs = {
        ttlBefore: ttlObs.ttlBefore ?? working.ttlTurns,
        ttlAfter: nextState.ttlTurns,
        ttlResetReason: hard.reason,
      };
    }
    return finalize(
      caps(POSTURES.EXECUTOR, POSTURE_SOURCES.AUTHORITY_OVERRIDE, {
        confidence: "high",
        intensity: POSTURE_INTENSITIES.NORMAL,
        breakReason: hard.reason,
        maintainReason:
          hard.reason === "forge_mandate"
            ? "authority_forge_clears_sticky"
            : "authority_execution_mandate",
        authorityConflict: conflict,
        nextState: { ...nextState, breakReason: hard.reason },
      }),
    );
  }
  if (hard.break && !hard.forceExecutor) {
    // Web explicite / rupture domaine : sticky ne survit pas
    const nextState = {
      ...createDefaultSessionModeState(),
      source: POSTURE_SOURCES.FALLBACK,
      breakReason: hard.reason,
    };
    ttlObs = {
      ttlBefore: ttlObs.ttlBefore ?? working.ttlTurns,
      ttlAfter: nextState.ttlTurns,
      ttlResetReason: hard.reason,
    };
    return finalize(
      caps(POSTURES.CONVERSATIONAL, POSTURE_SOURCES.FALLBACK, {
        breakReason: hard.reason,
        maintainReason: "hard_break_corridor_change",
        nextState,
      }),
    );
  }

  // 4) Sticky actif
  if (
    working.posture &&
    working.posture !== POSTURES.CONVERSATIONAL &&
    working.ttlTurns > 0
  ) {
    const nextState = {
      ...working,
      source: POSTURE_SOURCES.STICKY,
      breakReason: null,
    };
    return finalize(
      caps(working.posture, POSTURE_SOURCES.STICKY, {
        confidence: working.confidence || "medium",
        intensity: working.intensity || POSTURE_INTENSITIES.NORMAL,
        maintainReason: working.lockedByUser
          ? "sticky_locked_by_user"
          : "sticky_ttl_active",
        nextState,
      }),
    );
  }

  // 5) Inférence légère
  const inferred = inferPostureFromQuery(query);
  if (inferred) {
    const intensity = detectPostureIntensity(query);
    const nextState = applySessionModePosture(working, {
      posture: inferred.posture,
      source: POSTURE_SOURCES.INFERRED,
      confidence: inferred.confidence,
      intensity,
      lockedByUser: false,
      ttlTurns: DEFAULT_TTL_TURNS,
      turnTimestamp,
      turnCount,
    });
    ttlObs = {
      ttlBefore: ttlObs.ttlBefore ?? working.ttlTurns,
      ttlAfter: nextState.ttlTurns,
      ttlResetReason: "inferred_from_query",
    };
    return finalize(
      caps(inferred.posture, POSTURE_SOURCES.INFERRED, {
        confidence: inferred.confidence,
        intensity,
        maintainReason: "inferred_from_query",
        nextState,
      }),
    );
  }

  // 6) Défaut
  const nextState = createDefaultSessionModeState();
  return finalize(
    caps(POSTURES.CONVERSATIONAL, POSTURE_SOURCES.DEFAULT, {
      confidence: "low",
      maintainReason: "default_conversational",
      nextState,
    }),
  );
}

/**
 * Delivery hints (R6) — porte les styleHints jusqu’au composer / forme finale.
 * @param {ReturnType<typeof resolvePosture>|object} decision
 * @returns {string}
 */
export function buildPostureDeliveryAddon(decision = {}) {
  if (!decision?.posture || decision.posture === POSTURES.CONVERSATIONAL) {
    return "";
  }
  const caps = getPostureCapabilities(decision.posture);
  const hints = Array.isArray(decision.styleHints)
    ? decision.styleHints
    : caps.styleHints || [];
  const intensity = decision.intensity || POSTURE_INTENSITIES.NORMAL;
  const lines = [
    "[MODIFICATEUR: POSTURE_DELIVERY_V1]",
    `posture: ${decision.posture}`,
    `intensity: ${intensity}`,
    `styleHints: ${hints.join(", ") || "none"}`,
    "Ces hints modulient la forme finale ; ils ne changent pas le tutoiement ni la sobriété de base.",
  ];

  if (hints.includes("socratic") || hints.includes("low_dump")) {
    if (intensity === POSTURE_INTENSITIES.STRONG) {
      lines.push(
        "DELIVERY MENTOR (strong) : questions avant solution ; refuse le dump sauf demande explicite.",
      );
    } else if (intensity === POSTURE_INTENSITIES.LIGHT) {
      lines.push(
        "DELIVERY MENTOR (light) : 1 question max ; piste courte OK.",
      );
    } else {
      lines.push(
        "DELIVERY MENTOR : pistes courtes + 1–2 questions ; évite le dump complet.",
      );
    }
  }
  if (hints.includes("options") || hints.includes("recommendation")) {
    lines.push(
      "DELIVERY ADVISOR : options → critères → recommandation → risques → question de clôture.",
    );
  }
  if (hints.includes("actionable") || hints.includes("concise")) {
    lines.push(
      "DELIVERY EXECUTOR : actionnable et concis ; livrer plutôt que conseiller.",
    );
  }
  if (hints.includes("tradeoffs") || hints.includes("iterative_workshop")) {
    lines.push(
      "DELIVERY ARCHITECT : trade-offs itératifs ; pas un one-shot figé.",
    );
  }
  if (hints.includes("transform_only")) {
    lines.push(
      "DELIVERY FORMATTER : transformer la source vers la forme cible ; ne pas inventer de fond.",
    );
  }

  return `\n\n${lines.join("\n")}`;
}

/**
 * Addon prompt minimal (style) — P0, pas de rail mentor encore.
 * @param {ReturnType<typeof resolvePosture>} decision
 */
export function buildPosturePromptAddon(decision = {}) {
  if (!decision?.posture || decision.posture === POSTURES.CONVERSATIONAL) {
    return "";
  }
  const intensity = decision.intensity || POSTURE_INTENSITIES.NORMAL;
  const lines = [
    "[MODIFICATEUR: POSTURE_SESSION_V1]",
    `posture: ${decision.posture}`,
    `source: ${decision.source}`,
    `intensity: ${intensity}`,
    `initiative: ${decision.initiative}`,
    `mayAskQuestions: ${decision.mayAskQuestions}`,
    `mayExecute: ${decision.mayExecute}`,
  ];
  if (decision.posture === POSTURES.MENTOR) {
    if (intensity === POSTURE_INTENSITIES.LIGHT) {
      lines.push(
        "STYLE MENTOR (light) : ton guidant léger, 1 question max, peut donner une piste courte.",
      );
    } else if (intensity === POSTURE_INTENSITIES.STRONG) {
      lines.push(
        "STYLE MENTOR (strong) : socratique strict — questions avant solution ; refuse le dump sauf demande explicite.",
      );
    } else {
      lines.push(
        "STYLE MENTOR : privilégie questions socratiques et pistes courtes ; évite le dump de solution complète sauf demande explicite.",
      );
    }
  } else if (decision.posture === POSTURES.ADVISOR) {
    lines.push(
      "STYLE ADVISOR : options → critères → recommandation → risques → question de clôture.",
    );
  } else if (decision.posture === POSTURES.EXECUTOR) {
    lines.push(
      "STYLE EXECUTOR : actionnable, concis ; livrer plutôt que conseiller.",
    );
  } else if (decision.posture === POSTURES.ARCHITECT) {
    lines.push(
      "STYLE ARCHITECT : arbitrages et trade-offs itératifs ; pas un one-shot de 3 options figées.",
    );
  } else if (decision.posture === POSTURES.FORMATTER) {
    lines.push(
      "STYLE FORMATTER : transformer un contenu source vers une cible de forme ; ne pas inventer de fond.",
    );
  }
  // R6 : même hints côté delivery (composer / forme finale)
  const delivery = buildPostureDeliveryAddon(decision).trim();
  const sessionBlock = `\n\n${lines.join("\n")}`;
  return delivery ? `${sessionBlock}\n\n${delivery}` : sessionBlock;
}
