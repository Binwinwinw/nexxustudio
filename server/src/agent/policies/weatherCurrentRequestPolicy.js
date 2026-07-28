/**
 * weather_current_request — donnée météo actuelle (intent + slots + exclusions).
 * Patron transverse : web prioritaire, pas de déclenchement lexical sur narration/collé.
 */
import { normalizeFamiliarityQuery } from "../utils/familiarityIntentGuards.js";
import { hasDocumentSynthesisShell } from "./documentSynthesisPolicy.js";

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

const WEATHER_METRIC_RE =
  /\b(?:temperature|températures?|temps|meteo|météo|degres|degrés|°c|°f|pluie|vent|ressenti|humidite|humidité|previsions|prévisions)\b/i;

const WEATHER_REQUEST_SHELL_RE =
  /\b(?:quelle est|quel est|quelle|combien|quel temps|quelle temperature|quelle température|tu as (?:la )?meteo|tu as (?:la )?météo|as[- ]tu (?:la )?meteo|as[- ]tu (?:la )?météo|donne[- ]?moi (?:la )?meteo|donne[- ]?moi (?:la )?météo|peux[- ]?tu (?:me )?donner (?:la )?meteo|peux[- ]?tu (?:me )?donner (?:la )?météo)\b/i;

const NARRATIVE_WEATHER_RE =
  /\b(?:quelle sale|quel temps qu|on a eu|nous avons eu|nous sommes|j'ai eu|j ai eu|il a fait|elle a fait|quel temps il faisait|c'était|cetait|heureusement|malheureusement|dommage que|bien heureusement)\b/i;

const DOCUMENT_TASK_RE =
  /\b(?:resume|resumer|synthese|commente|commenter|analyse ce passage|ce passage|ce texte|dans ce texte|dans le texte|le passage suivant|texte suivant|passage suivant|peux[- ]?tu le commenter|peux tu le commenter)\b/i;

const LOCATION_EXTRACTION_PATTERNS = [
  /\b(?:temperature|température|meteo|météo|temps|pluie|vent|ressenti)\s+(?:a|à|pour|de)\s+(?:la |le |les |l')?([a-z0-9][a-z0-9\s'-]{1,50}?)(?:\s*\?|\s*$|,)/,
  /\b(?:a|à|pour|de)\s+(?:la |le |les |l')?([a-z0-9][a-z0-9\s'-]{1,50}?)(?:\s*\?|\s*$|,)/,
];

/**
 * @param {string} raw
 */
function normalizeWeatherQuery(raw = "") {
  return normalizeFamiliarityQuery(raw);
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
  if (!WEATHER_METRIC_RE.test(q)) return false;
  if (NARRATIVE_WEATHER_RE.test(q)) return true;
  const hasRequestShell =
    String(query || "").includes("?") || WEATHER_REQUEST_SHELL_RE.test(q);
  if (!hasRequestShell && WEATHER_METRIC_RE.test(q)) return true;
  return false;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isWeatherInfoRequest(query = "") {
  const q = normalizeWeatherQuery(query);
  if (!WEATHER_METRIC_RE.test(q)) return false;
  const hasRequestShell =
    String(query || "").includes("?") ||
    WEATHER_REQUEST_SHELL_RE.test(q) ||
    /\b(?:tu as|as tu|donne moi|peux tu)\b/.test(q);
  return hasRequestShell;
}

/**
 * @param {string} tail
 */
function cleanWeatherLocation(tail = "") {
  return String(tail || "")
    .replace(
      /\s+(?:actuellement|maintenant|aujourd hui|aujourd'hui|stp|svp)\b.*/i,
      "",
    )
    .replace(/\?+$/g, "")
    .trim();
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractWeatherLocation(query = "") {
  const q = normalizeWeatherQuery(query);
  if (!q) return null;

  for (const pattern of LOCATION_EXTRACTION_PATTERNS) {
    const match = q.match(pattern);
    if (!match?.[1]) continue;
    const raw = cleanWeatherLocation(match[1]);
    if (raw.length >= 2 && !/^(ce|cet|cette|la|le|les|un|une)\b/.test(raw)) {
      return raw;
    }
  }

  return null;
}

/**
 * @param {string} query
 * @returns {{
 *   kind: string,
 *   location: string,
 *   locationLabel: string,
 *   metric: string,
 * }|null}
 */
export function parseWeatherCurrentTask(query = "") {
  if (!isWeatherInfoRequest(query)) return null;
  const location = extractWeatherLocation(query);
  if (!location) return null;

  const q = normalizeWeatherQuery(query);
  let metric = "météo";
  if (/\btemperature|température|degres|degrés|°c|°f\b/.test(q)) {
    metric = "température";
  } else if (/\bpluie\b/.test(q)) {
    metric = "pluie";
  } else if (/\bvent\b/.test(q)) {
    metric = "vent";
  } else if (/\bressenti\b/.test(q)) {
    metric = "ressenti";
  } else if (/\bprevisions|prévisions\b/.test(q)) {
    metric = "prévisions";
  }

  const locationLabel =
    location.charAt(0).toUpperCase() + location.slice(1);

  return {
    kind: "weather_current",
    location,
    locationLabel,
    metric,
  };
}

/**
 * Demande exploitable d'information météo actuelle (pas narration ni document).
 * @param {string} query
 * @returns {boolean}
 */
export function isWeatherCurrentRequest(query = "") {
  if (!query || !String(query).trim()) return false;
  if (isQuotedOrPastedWeatherContext(query)) return false;
  if (isNarrativeOrExpressiveWeatherUtterance(query)) return false;
  return Boolean(parseWeatherCurrentTask(query));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isWeatherCurrentRequestSatisfiable(query = "") {
  return isWeatherCurrentRequest(query);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function buildWeatherCurrentWebQuery(query = "") {
  const task = parseWeatherCurrentTask(query);
  if (!task?.location) return null;
  return `météo actuelle ${task.locationLabel} ${task.metric} maintenant`;
}

/**
 * @param {string} query
 * @param {string} [reason]
 * @returns {string}
 */
export function buildWeatherCurrentRecoveryMessage(
  query = "",
  reason = "empty_output",
) {
  const task = parseWeatherCurrentTask(query);
  const label = task?.locationLabel || "cet endroit";
  return (
    `Je n'ai pas réussi à récupérer la météo actuelle pour ${label} ` +
    `(${reason}). Réessaie dans un instant ou précise le lieu si besoin.`
  );
}

/**
 * @param {string} query
 * @returns {{
 *   path: string,
 *   kind: string,
 *   weatherWebQuery: string,
 *   task: object,
 * }|null}
 */
export function resolveWeatherCurrentShortCircuit(query = "") {
  if (!isWeatherCurrentRequest(query)) return null;
  const task = parseWeatherCurrentTask(query);
  const weatherWebQuery = buildWeatherCurrentWebQuery(query);
  if (!task || !weatherWebQuery) return null;

  return {
    path: "simple_factual_lookup",
    kind: task.kind,
    weatherWebQuery,
    task,
  };
}
