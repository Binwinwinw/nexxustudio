/**
 * traffic_current_request — trafic routier actuel (lot #38a).
 * Patron transverse current_web_fact ; web prioritaire, fallback honnête.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import {
  CURRENT_WEB_FACT_TYPES,
  extractCurrentWebFactTimeScope,
  isCurrentWebFactGloballyExcluded,
  isCurrentWebFactMechanismExplanation,
  requiresCurrentWebFactFreshness,
} from "../../utils/currentWebFactIntentGuards.js";

export const TRAFFIC_CURRENT_REQUEST_RULE = "traffic_current_request_v1";

/** Batterie #38a — autoroute + maintenant. */
export const TRAFFIC_CANONICAL_A1_QUERY =
  "quel est le trafic sur l'A1 maintenant ?";

/** Batterie #38a — ville + en ce moment. */
export const TRAFFIC_CANONICAL_PARIS_QUERY =
  "embouteillages Paris en ce moment";

/** Batterie #38a — how-to, pas current_web_fact. */
export const TRAFFIC_CANONICAL_HOWTO_QUERY =
  "comment éviter les embouteillages sur Paris ?";

/** Batterie #38a — narratif passé. */
export const TRAFFIC_CANONICAL_PAST_NARRATIVE_QUERY =
  "il y avait beaucoup de trafic hier soir sur l'A1";

/** Batterie #38a — mécanisme, pas valeur actuelle. */
export const TRAFFIC_CANONICAL_MECHANISM_QUERY =
  "explique-moi ce qu'est le trafic routier";

/** Batterie #38a — sans fraîcheur explicite. */
export const TRAFFIC_CANONICAL_NO_FRESHNESS_QUERY =
  "quel est le trafic sur l'A1";

const TRAFFIC_METRIC_RE =
  /\b(?:trafic|embouteillage|embouteillages|bouchon|bouchons|circulation|ralentissement|ralentissements|dense|densité|densite|bison|bisons)\b/i;

const TRAFFIC_REQUEST_SHELL_RE =
  /\b(?:quel est|quelle est|quel|quelle|y a[- ]t[- ]il|il y a|état du|etat du|situation du|info(?:s)? sur le|donne[- ]?moi (?:le |la )?)\b/i;

const ROUTE_SUBJECT_RE =
  /\b(?:sur\s+)?(?:l['']?)?(?:autoroute\s+)?([a-z]\d{1,3})\b/i;

const PERIPHERIQUE_RE = /\b(?:périphérique|peripherique|rocade)\b/i;

/**
 * @param {string} raw
 */
function normalizeTrafficQuery(raw = "") {
  return normalizeFamiliarityQuery(raw);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isTrafficInfoRequest(query = "") {
  const q = normalizeTrafficQuery(query);
  if (!TRAFFIC_METRIC_RE.test(q)) return false;
  const hasShell =
    String(query || "").includes("?") ||
    TRAFFIC_REQUEST_SHELL_RE.test(q) ||
    /\b(?:en ce moment|maintenant|actuellement)\b/.test(q);
  return hasShell;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractTrafficSubject(query = "") {
  const q = normalizeTrafficQuery(query);
  if (!q) return null;

  const routeMatch = q.match(
    /\b(?:trafic|embouteillage|embouteillages|bouchon|bouchons|circulation)\s+(?:sur\s+)?(?:l['']?)?(?:autoroute\s+)?([a-z]\d{1,3})\b/i,
  );
  if (routeMatch?.[1]) {
    return routeMatch[1].toLowerCase();
  }

  const routeLoose = q.match(ROUTE_SUBJECT_RE);
  if (routeLoose?.[1] && TRAFFIC_METRIC_RE.test(q)) {
    return routeLoose[1].toLowerCase();
  }

  const cityMatch = q.match(
    /\b(?:embouteillage|embouteillages|bouchon|bouchons|trafic|circulation)\s+(?:à|a|sur|pour|de)?\s*([a-z][a-z\s'-]{2,40}?)(?:\s+(?:en ce moment|maintenant|actuellement)|\s*\?|$)/i,
  );
  if (cityMatch?.[1]) {
    const city = cityMatch[1]
      .replace(/\s+(?:en ce moment|maintenant|actuellement)\s*$/i, "")
      .trim();
    if (city.length >= 3) return city;
  }

  if (PERIPHERIQUE_RE.test(q)) {
    const cityTail = q.match(
      /\b(?:périphérique|peripherique|rocade)\s+(?:de\s+)?([a-z][a-z\s'-]{2,30})/i,
    );
    return cityTail?.[1]?.trim() || "périphérique";
  }

  return null;
}

/**
 * @param {string} query
 * @returns {string}
 */
function resolveTrafficMetric(query = "") {
  const q = normalizeTrafficQuery(query);
  if (/\bembouteillage|embouteillages|bouchon|bouchons\b/.test(q)) {
    return "embouteillages";
  }
  if (/\bcirculation\b/.test(q)) return "circulation";
  if (/\b(?:ralentissement|ralentissements|dense|densité|densite)\b/.test(q)) {
    return "ralentissements";
  }
  return "trafic";
}

/**
 * @param {string} subject
 * @returns {string}
 */
function formatTrafficSubjectLabel(subject = "") {
  if (/^[a-z]\d{1,3}$/i.test(subject)) {
    return `l'autoroute ${subject.toUpperCase()}`;
  }
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

/**
 * @param {string} query
 * @returns {{
 *   kind: string,
 *   factType: string,
 *   subject: string,
 *   subjectLabel: string,
 *   metric: string,
 *   timeScope: string,
 * }|null}
 */
export function parseTrafficCurrentTask(query = "") {
  if (!isTrafficInfoRequest(query)) return null;
  if (!requiresCurrentWebFactFreshness(query)) return null;

  const subject = extractTrafficSubject(query);
  if (!subject) return null;

  const timeScope = extractCurrentWebFactTimeScope(query) || "now";

  return {
    kind: "traffic_current",
    factType: CURRENT_WEB_FACT_TYPES.TRAFFIC,
    subject: subject.toLowerCase(),
    subjectLabel: formatTrafficSubjectLabel(subject),
    metric: resolveTrafficMetric(query),
    timeScope,
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isTrafficCurrentRequest(query = "") {
  if (!query || !String(query).trim()) return false;
  if (isCurrentWebFactGloballyExcluded(query)) return false;
  if (isCurrentWebFactMechanismExplanation(query)) return false;
  return Boolean(parseTrafficCurrentTask(query));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isTrafficCurrentRequestSatisfiable(query = "") {
  return isTrafficCurrentRequest(query);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function buildTrafficCurrentWebQuery(query = "") {
  const task = parseTrafficCurrentTask(query);
  if (!task?.subject) return null;
  const timeWord = task.timeScope === "today" ? "aujourd'hui" : "maintenant";
  return `trafic routier ${task.subjectLabel} ${task.metric} ${timeWord} temps réel`;
}

/**
 * @param {string} query
 * @param {string} [reason]
 * @returns {string}
 */
export function buildTrafficCurrentRecoveryMessage(
  query = "",
  reason = "empty_output",
) {
  const task = parseTrafficCurrentTask(query);
  const label = task?.subjectLabel || "cet axe routier";
  return (
    `Je n'ai pas réussi à récupérer le trafic actuel pour ${label} ` +
    `(${reason}). Réessaie dans un instant ou précise l'autoroute / la ville.`
  );
}

/**
 * @param {string} query
 * @returns {{
 *   path: string,
 *   kind: string,
 *   factType: string,
 *   currentWebFactWebQuery: string,
 *   trafficWebQuery: string,
 *   task: object,
 * }|null}
 */
export function resolveTrafficCurrentShortCircuit(query = "") {
  if (!isTrafficCurrentRequest(query)) return null;
  const task = parseTrafficCurrentTask(query);
  const webQuery = buildTrafficCurrentWebQuery(query);
  if (!task || !webQuery) return null;

  return {
    path: "simple_factual_lookup",
    kind: task.kind,
    factType: CURRENT_WEB_FACT_TYPES.TRAFFIC,
    currentWebFactWebQuery: webQuery,
    trafficWebQuery: webQuery,
    task,
  };
}
