/**
 * weather_current_request — donnée météo actuelle (intent + slots + exclusions).
 * Adapte le frame composite (primaryIntent + slots typés + precedence).
 */
import { hasDocumentSynthesisShell } from "../document/index.js";
import {
  extractLocalitySlot,
  extractLocalitySlotFromHistory,
  hasWeatherMetricSignal,
  hasWeatherRequestShell,
  isWeatherIntentActive,
  normalizeCompositeQuery,
  parseCompositeQueryFrame,
  WEATHER_INTENTS,
} from "../../micro/parsing/compositeQueryFrameParser.js";

export const WEATHER_CURRENT_REQUEST_RULE = "weather_current_request_v1";

/** Batterie #36 — température actuelle (web). */
export const WEATHER_CANONICAL_MIAMI_QUERY =
  "quelle est la température à Miami ?";

/** Batterie #36 — météo DOM. */
export const WEATHER_CANONICAL_FDF_QUERY =
  "tu as la météo à Fort-de-France ?";

/** Batterie #36 — narration, pas de web. */
export const WEATHER_CANONICAL_NARRATIVE_QUERY =
  "Quelle sale météo à la campagne on a eu, bien heureusement nous sommes rentrés";

/** Batterie #36 — document collé, pas de web. */
export const WEATHER_CANONICAL_PASTED_NARRATIVE_QUERY = `Résume ce passage :

Quelle sale météo à la campagne on a eu, bien heureusement nous sommes rentrés`;

/** Batterie #36 — commentaire documentaire. */
export const WEATHER_CANONICAL_DOCUMENT_COMMENT_QUERY =
  "Dans ce texte, il parle de météo : peux-tu le commenter ?";

const NARRATIVE_WEATHER_RE =
  /\b(?:quelle sale|quel temps qu|on a eu|nous avons eu|nous sommes|j'ai eu|j ai eu|il a fait|elle a fait|quel temps il faisait|c'était|cetait|heureusement|malheureusement|dommage que|bien heureusement)\b/i;

const DOCUMENT_TASK_RE =
  /\b(?:resume|resumer|synthese|commente|commenter|analyse ce passage|ce passage|ce texte|dans ce texte|dans le texte|le passage suivant|texte suivant|passage suivant|peux[- ]?tu le commenter|peux tu le commenter)\b/i;

/**
 * @param {string} raw
 */
function normalizeWeatherQuery(raw = "") {
  return normalizeCompositeQuery(raw);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isQuotedOrPastedWeatherContext(query = "") {
  if (hasDocumentSynthesisShell(query)) return true;
  const q = normalizeWeatherQuery(query);
  if (DOCUMENT_TASK_RE.test(q)) return true;
  if (/\b(?:dans ce texte|dans le texte|il parle de|ce document)\b/.test(q)) {
    return true;
  }
  if (String(query || "").length > 100 && /[«""]/.test(String(query))) {
    return true;
  }
  return false;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isNarrativeOrExpressiveWeatherUtterance(query = "") {
  const q = normalizeWeatherQuery(query);
  if (!hasWeatherMetricSignal(q)) return false;
  if (NARRATIVE_WEATHER_RE.test(q)) return true;
  const hasRequestShell = hasWeatherRequestShell(query);
  if (!hasRequestShell && hasWeatherMetricSignal(q)) return true;
  return false;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isWeatherInfoRequest(query = "") {
  if (!hasWeatherMetricSignal(query)) return false;
  return hasWeatherRequestShell(query);
}

/**
 * @param {string} content
 */
function isEligibleWeatherPrior(content = "") {
  if (!content.trim()) return false;
  if (isQuotedOrPastedWeatherContext(content)) return false;
  if (isNarrativeOrExpressiveWeatherUtterance(content)) return false;
  return isWeatherInfoRequest(content);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractWeatherLocation(query = "") {
  const slot = extractLocalitySlot(query);
  return slot?.normalized || null;
}

/**
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {number} [window]
 * @returns {string|null}
 */
export function extractLastWeatherLocationFromHistory(history = [], window = 8) {
  const slot = extractLocalitySlotFromHistory(
    history,
    window,
    isEligibleWeatherPrior,
  );
  return slot?.normalized || null;
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 */
export function parseWeatherQueryFrame(query = "", options = {}) {
  if (!query || !String(query).trim()) return null;
  if (isQuotedOrPastedWeatherContext(query)) return null;
  if (isNarrativeOrExpressiveWeatherUtterance(query)) return null;

  const frame = parseCompositeQueryFrame(query, {
    history: options.history,
    isEligibleWeatherPrior,
  });

  if (frame.domain !== "weather") return null;
  if (!isWeatherIntentActive(frame.primaryIntent)) return null;
  return frame;
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {{
 *   kind: string,
 *   location: string,
 *   locationLabel: string,
 *   metric: string,
 *   locationSource: 'explicit'|'carryover',
 *   locality: object,
 *   secondarySignals: object[],
 *   temporal: string|null,
 *   frame: object,
 * }|null}
 */
export function parseWeatherCurrentTask(query = "", options = {}) {
  const frame = parseWeatherQueryFrame(query, options);
  if (!frame) return null;
  if (frame.primaryIntent !== WEATHER_INTENTS.CURRENT) return null;

  const locality = frame.slots?.locality;
  if (!locality?.normalized) return null;

  const temporal =
    frame.secondarySignals.find((s) => s.type === "temporal_modifier")?.value ||
    null;

  const locationLabel =
    locality.normalized.charAt(0).toUpperCase() + locality.normalized.slice(1);

  return {
    kind: WEATHER_INTENTS.CURRENT,
    location: locality.normalized,
    locationLabel,
    metric: frame.slots.metric || "météo",
    locationSource: locality.source,
    locality,
    secondarySignals: frame.secondarySignals,
    temporal,
    frame,
  };
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {boolean}
 */
export function isWeatherCurrentRequest(query = "", options = {}) {
  return Boolean(parseWeatherCurrentTask(query, options));
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {boolean}
 */
export function isWeatherCurrentRequestSatisfiable(query = "", options = {}) {
  return isWeatherCurrentRequest(query, options);
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {string|null}
 */
export function buildWeatherCurrentWebQuery(query = "", options = {}) {
  const task = parseWeatherCurrentTask(query, options);
  if (!task?.location) return null;
  return `météo actuelle ${task.locationLabel} ${task.metric} maintenant`;
}

/**
 * @param {string} query
 * @param {string} [reason]
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {string}
 */
export function buildWeatherCurrentRecoveryMessage(
  query = "",
  reason = "empty_output",
  options = {},
) {
  const task = parseWeatherCurrentTask(query, options);
  const label = task?.locationLabel || "cet endroit";
  return (
    `Je n'ai pas réussi à récupérer la météo actuelle pour ${label} ` +
    `(${reason}). Réessaie dans un instant ou précise le lieu si besoin.`
  );
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {{
 *   path: string,
 *   kind: string,
 *   weatherWebQuery: string,
 *   task: object,
 * }|null}
 */
export function resolveWeatherCurrentShortCircuit(query = "", options = {}) {
  if (!isWeatherCurrentRequest(query, options)) return null;
  const task = parseWeatherCurrentTask(query, options);
  const weatherWebQuery = buildWeatherCurrentWebQuery(query, options);
  if (!task || !weatherWebQuery) return null;

  return {
    path: "simple_factual_lookup",
    kind: task.kind,
    weatherWebQuery,
    task,
  };
}
