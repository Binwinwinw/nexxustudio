/**
 * Frame de requête composite — intent primaire + signaux secondaires + slots typés.
 * Lot 1 : domaine weather ; seul weather_current est actif pour le routage runtime.
 * Vocabulaire forecast / alerts / conditions déjà prévu pour éviter un parseur jetable.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";

export const COMPOSITE_FRAME_RULE = "composite_query_frame_v1";

/** Intents famille weather (entrée générale — pas un intent par métrique). */
export const WEATHER_INTENTS = Object.freeze({
  CURRENT: "weather_current",
  FORECAST: "weather_forecast",
  ALERTS: "weather_alerts",
  CONDITIONS: "weather_conditions",
});

/** Lot 1 — seuls ces intents déclenchent le routage web météo. */
export const WEATHER_INTENTS_ACTIVE = new Set([WEATHER_INTENTS.CURRENT]);

export const WEATHER_METRICS = Object.freeze([
  "météo",
  "température",
  "pluie",
  "vent",
  "ressenti",
  "prévisions",
  "jour/nuit",
]);

const WEATHER_METRIC_RE =
  /\b(?:temperature|températures?|temps|meteo|météo|degres|degrés|°c|°f|pluie|vent|ressenti|humidite|humidité|previsions|prévisions|jour|nuit)\b/i;

const WEATHER_REQUEST_SHELL_RE =
  /\b(?:quelle est|quel est|quelle|combien|quel temps|quelle temperature|quelle température|tu as (?:la )?meteo|tu as (?:la )?météo|as[- ]tu (?:la )?meteo|as[- ]tu (?:la )?météo|donne[- ]?moi (?:la )?meteo|donne[- ]?moi (?:la )?météo|peux[- ]?tu (?:me )?donner (?:la )?meteo|peux[- ]?tu (?:me )?donner (?:la )?météo|y a[- ]?t[- ]?il|est[- ]?ce que|fait[- ]?il)\b/i;

const WEATHER_FORECAST_RE =
  /\b(?:previsions|prévisions|forecast|demain|cette\s+semaine|week[- ]?end|jours?\s+prochains?)\b/i;

const WEATHER_ALERTS_RE =
  /\b(?:alerte|vigilances?|avis\s+de\s+temp|orage\s+violent|cyclone)\b/i;

const WEATHER_CONDITIONS_RE =
  /\b(?:conditions?\s+(?:meteo|météo)|ciel\s+(?:couvert|clair)|ensoleill)\b/i;

// Pas de \b avant « à » : en JS, à n'est pas un word-char → \bà échoue après espace.
const TEMPORAL_MODIFIER_RE =
  /(?:(?:a|à)\s+l['’]?\s*heure(?:\s+actuelle)?|\b(?:maintenant|actuellement)\b|aujourd['’]?\s*hui)/i;

const STANDALONE_TIME_LOOKUP_RE =
  /\b(?:quelle\s+date|date\s+du\s+jour|date\s+d\s+aujourd|on\s+est\s+quel\s+jour|nous\s+sommes\s+quel\s+jour|jour\s+actuel|quelle\s+heure|heure\s+actuelle|il\s+est\s+quelle\s+heure)\b/i;

const TEMPORAL_AS_LOCALITY_RE =
  /^(?:l['’ ]*)?(?:heure(?:\s+actuelle)?|maintenant|aujourd(?:['’ ]*hui)?|actuel(?:le)?ment)$/i;

const LOCATION_PATTERNS = [
  {
    re: /\btemps\s+fait[- ]?il\s+(?:en|a|à|sur)\s+(?:la |le |les |l')?([a-z0-9][a-z0-9\s'-]{1,50}?)(?:\s+(?:a|à)\s+l|\s*\?|\s*$|,)/i,
    confidence: 0.92,
  },
  {
    re: /\b(?:temperature|température|meteo|météo|temps|pluie|vent|ressenti)\s+(?:a|à|pour|de|en|sur)\s+(?:la |le |les |l')?([a-z0-9][a-z0-9\s'-]{1,50}?)(?:\s*\?|\s*$|,)/i,
    confidence: 0.88,
  },
  {
    re: /\b(?:en|a|à|pour|de|sur)\s+(?:la |le |les |l')?([a-z0-9][a-z0-9\s'-]{1,50}?)(?:\s*\?|\s*$|,)/i,
    confidence: 0.68,
  },
];

/**
 * @param {string} raw
 */
export function normalizeCompositeQuery(raw = "") {
  return normalizeFamiliarityQuery(raw);
}

/**
 * @param {string} intent
 * @returns {boolean}
 */
export function isWeatherIntentActive(intent = "") {
  return WEATHER_INTENTS_ACTIVE.has(String(intent || ""));
}

/**
 * @param {string} intent
 * @returns {boolean}
 */
export function isWeatherFamilyIntent(intent = "") {
  return Object.values(WEATHER_INTENTS).includes(String(intent || ""));
}

/**
 * Contrat de precedence testable.
 * R1 : weather + temporal_modifier => weather wins ; time_lookup suppressed.
 * R2 : time_lookup ne gagne que si aucun intent weather détecté.
 *
 * @param {{
 *   weatherIntent?: string|null,
 *   hasTemporalModifier?: boolean,
 *   hasStandaloneTimeLookup?: boolean,
 * }} input
 * @returns {{
 *   winner: string|null,
 *   suppressed: string[],
 *   reason: string,
 * }}
 */
export function resolveWeatherTemporalPrecedence(input = {}) {
  const weatherIntent = input.weatherIntent || null;
  const hasTemporal = Boolean(input.hasTemporalModifier);
  const hasTime = Boolean(input.hasStandaloneTimeLookup);

  if (weatherIntent && isWeatherFamilyIntent(weatherIntent)) {
    return {
      winner: weatherIntent,
      suppressed: ["time_lookup"],
      reason: hasTemporal
        ? "weather_plus_temporal_modifier_weather_wins"
        : "weather_intent_suppresses_time_lookup",
    };
  }

  if (hasTime) {
    return {
      winner: "time_lookup",
      suppressed: [],
      reason: "standalone_time_lookup_no_weather",
    };
  }

  return {
    winner: null,
    suppressed: [],
    reason: "no_weather_no_time",
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasWeatherRequestShell(query = "") {
  const q = normalizeCompositeQuery(query);
  return (
    String(query || "").includes("?") ||
    WEATHER_REQUEST_SHELL_RE.test(q) ||
    /\b(?:tu as|as tu|donne moi|peux tu)\b/.test(q)
  );
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasWeatherMetricSignal(query = "") {
  return WEATHER_METRIC_RE.test(normalizeCompositeQuery(query));
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function detectWeatherPrimaryIntent(query = "") {
  const q = normalizeCompositeQuery(query);
  if (!q || !hasWeatherMetricSignal(q)) return null;
  if (!hasWeatherRequestShell(query)) return null;

  if (WEATHER_ALERTS_RE.test(q)) return WEATHER_INTENTS.ALERTS;
  if (WEATHER_FORECAST_RE.test(q) && !/\bactuelle|maintenant|heure actuelle\b/i.test(q)) {
    return WEATHER_INTENTS.FORECAST;
  }
  if (WEATHER_CONDITIONS_RE.test(q) && !/\btemperature|température|pluie|vent\b/i.test(q)) {
    return WEATHER_INTENTS.CONDITIONS;
  }
  return WEATHER_INTENTS.CURRENT;
}

/**
 * @param {string} query
 * @returns {{ type: string, value: string, text: string }|null}
 */
export function extractTemporalModifierSignal(query = "") {
  const raw = String(query || "");
  const match = raw.match(TEMPORAL_MODIFIER_RE);
  if (!match) return null;
  return {
    type: "temporal_modifier",
    value: "now",
    text: match[0],
  };
}

/**
 * Question horloge/date autonome (pas un modificateur météo).
 * @param {string} query
 * @returns {boolean}
 */
export function isStandaloneTimeLookup(query = "") {
  const q = normalizeCompositeQuery(query);
  if (!STANDALONE_TIME_LOOKUP_RE.test(q)) return false;
  if (detectWeatherPrimaryIntent(query)) return false;
  if (hasWeatherMetricSignal(q) && hasWeatherRequestShell(query)) return false;
  return true;
}

/**
 * @param {string} tail
 */
function cleanLocalityTail(tail = "") {
  return String(tail || "")
    .replace(
      /\s+(?:actuellement|maintenant|aujourd hui|aujourd['’]?hui|stp|svp|a\s+l['’ ]*heure(?:\s+actuelle)?|à\s+l['’ ]*heure(?:\s+actuelle)?)\b.*/i,
      "",
    )
    .replace(/\?+$/g, "")
    .trim();
}

/**
 * Slot localité typé — pas un string nu.
 * @param {string} query
 * @returns {{ text: string, normalized: string, source: 'explicit', confidence: number }|null}
 */
export function extractLocalitySlot(query = "") {
  const q = normalizeCompositeQuery(query);
  if (!q) return null;

  for (const { re, confidence } of LOCATION_PATTERNS) {
    const match = q.match(re);
    if (!match?.[1]) continue;
    const text = cleanLocalityTail(match[1]);
    if (!text || text.length < 2) continue;
    if (/^(ce|cet|cette|la|le|les|un|une)\b/.test(text)) continue;
    if (TEMPORAL_AS_LOCALITY_RE.test(text)) continue;
    return {
      text,
      normalized: text.toLowerCase().replace(/\s+/g, " ").trim(),
      source: "explicit",
      confidence,
    };
  }
  return null;
}

/**
 * @param {string} query
 * @returns {string}
 */
export function extractWeatherMetricSlot(query = "") {
  const q = normalizeCompositeQuery(query);
  if (/\btemperature|température|degres|degrés|°c|°f\b/.test(q)) {
    return "température";
  }
  if (/\b(?:jour|nuit|aube|crepuscule|crépuscule|lever|coucher)\b/.test(q)) {
    return "jour/nuit";
  }
  if (/\bpluie\b/.test(q)) return "pluie";
  if (/\bvent\b/.test(q)) return "vent";
  if (/\bressenti\b/.test(q)) return "ressenti";
  if (/\bprevisions|prévisions\b/.test(q)) return "prévisions";
  return "météo";
}

/**
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {number} [window]
 * @param {(content: string) => boolean} [isEligiblePrior]
 * @returns {{ text: string, normalized: string, source: 'carryover', confidence: number }|null}
 */
export function extractLocalitySlotFromHistory(
  history = [],
  window = 8,
  isEligiblePrior = null,
) {
  const turns = Array.isArray(history) ? history.slice(-Math.max(1, window)) : [];
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.role !== "user") continue;
    const content = String(turns[i].content || "");
    if (!content.trim()) continue;
    if (typeof isEligiblePrior === "function" && !isEligiblePrior(content)) {
      continue;
    }
    const slot = extractLocalitySlot(content);
    if (slot) {
      return {
        ...slot,
        source: "carryover",
        confidence: Math.min(0.75, slot.confidence),
      };
    }
  }
  return null;
}

function emptyFrame(raw = "") {
  return {
    domain: null,
    primaryIntent: null,
    secondarySignals: [],
    slots: {
      locality: null,
      metric: null,
    },
    routing: {
      winner: null,
      suppressed: [],
      preferWebResearch: false,
      reason: "empty",
    },
    raw: String(raw || ""),
  };
}

/**
 * Parse structuré réutilisable (lot 1 = weather).
 * @param {string} query
 * @param {{
 *   history?: Array<{ role?: string, content?: string }>,
 *   isEligibleWeatherPrior?: (content: string) => boolean,
 * }} [options]
 */
export function parseCompositeQueryFrame(query = "", options = {}) {
  const raw = String(query || "").trim();
  if (!raw) return emptyFrame(raw);

  const weatherIntent = detectWeatherPrimaryIntent(raw);
  const temporal = extractTemporalModifierSignal(raw);
  const standaloneTime = isStandaloneTimeLookup(raw);

  const secondarySignals = [];
  if (temporal) secondarySignals.push(temporal);

  let locality = null;
  let metric = null;

  if (weatherIntent) {
    locality = extractLocalitySlot(raw);
    if (!locality && Array.isArray(options.history) && options.history.length) {
      locality = extractLocalitySlotFromHistory(
        options.history,
        8,
        options.isEligibleWeatherPrior || null,
      );
    }
    metric = extractWeatherMetricSlot(raw);
  }

  const precedence = resolveWeatherTemporalPrecedence({
    weatherIntent,
    hasTemporalModifier: Boolean(temporal),
    hasStandaloneTimeLookup: standaloneTime,
  });

  const activeWeather =
    weatherIntent && isWeatherIntentActive(weatherIntent) && Boolean(locality);

  return {
    domain: weatherIntent ? "weather" : standaloneTime ? "time" : null,
    primaryIntent: weatherIntent || (standaloneTime ? "time_lookup" : null),
    secondarySignals,
    slots: {
      locality,
      metric,
    },
    routing: {
      winner: precedence.winner,
      suppressed: precedence.suppressed,
      preferWebResearch: Boolean(activeWeather),
      reason: precedence.reason,
    },
    raw,
  };
}

/**
 * @param {ReturnType<typeof parseCompositeQueryFrame>} frame
 * @returns {boolean}
 */
export function frameSuppressesTimeLookup(frame) {
  return Boolean(frame?.routing?.suppressed?.includes("time_lookup"));
}
