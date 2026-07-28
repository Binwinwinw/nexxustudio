/**
 * external_calendar_lookup — dates d'événements externes (astronomie, calendriers).
 * Ne pas confondre avec datetime_deterministic (horloge locale).
 */
import { normalizeText } from "./normalizationGuards.js";
import { isHistoricalDateQuestion, isRelativeOrFutureDatetimeQuestion } from "../micro/replies/simpleFactualComposer.js";

const EXTERNAL_CALENDAR_EVENT_RE =
  /\b(?:pleine\s+lune|nouvelle\s+lune|derni[eè]re\s+lune|lune\s+bleue|phase\s+(?:de\s+la\s+)?lune|calendrier\s+lunaire|[eé]clipse\s+(?:lunaire|solaire)?|solstice|[eé]quinoxe)\b/i;

const FUTURE_EVENT_RE =
  /\b(?:prochain(?:e|es)?|prochainement|sera|seront|aura\s+lieu|quand\s+(?:aura|est|sera)|[àa]\s+quelle\s+date\s+(?:sera|aura))\b/i;

const EXPLICIT_WEB_TOOL_RE =
  /\b(?:utilise(?:z|r)?\s+(?:ton|votre|l['']?)\s*(?:outil\s+)?(?:de\s+)?(?:navigation\s+)?(?:web|internet)|va\s+sur\s+(?:le\s+)?(?:web|internet)|cherche(?:z|r)?\s+(?:sur\s+)?(?:le\s+)?(?:web|internet)|recherche\s+sur\s+(?:le\s+)?(?:web|internet)|fais\s+une\s+recherche\s+web|outil\s+de\s+navigation\s+web|navigation\s+web)\b/i;

const EXTERNAL_LOOKUP_VERB_RE =
  /\b(?:cherche(?:z|r)?|recherche(?:z|r)?|trouve(?:z|r)?|va\s+chercher|look\s+up)\b/i;

const LOCAL_DATETIME_RE =
  /\b(?:quelle\s+heure|heure\s+est[- ]?il|il\s+est\s+quelle\s+heure|heure\s+actuelle|date\s+du\s+jour|date\s+sommes[- ]?nous|jour\s+sommes[- ]?nous|nous\s+sommes\s+quel\s+jour|on\s+est\s+quel\s+jour|quelle\s+est\s+la\s+date\s+(?:du\s+jour|aujourd)|aujourd['']?hui\s+on\s+est|quel\s+jour\s+sommes)\b/i;

const GENERIC_DATE_QUESTION_RE =
  /\b(?:quelle\s+date|quel\s+est\s+la\s+date|quelle\s+est\s+la\s+date|[àa]\s+quelle\s+date|quel\s+jour)\b/i;

/** @param {string} query */
function normalize(query = "") {
  return normalizeText(query).trim();
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isExplicitWebToolInvocationRequest(query = "") {
  return EXPLICIT_WEB_TOOL_RE.test(normalize(query));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isExternalCalendarLookupRequest(query = "") {
  const q = normalize(query);
  if (!q) return false;
  if (EXTERNAL_CALENDAR_EVENT_RE.test(q)) return true;
  if (FUTURE_EVENT_RE.test(q) && /\b(?:lune|soleil|astre|astronomi)/i.test(q)) {
    return true;
  }
  return false;
}

/**
 * Question « quelle date » sur un événement futur externe — pas l'horloge locale.
 * @param {string} query
 * @returns {boolean}
 */
export function isExternalDateLookupRequest(query = "") {
  const q = normalize(query);
  if (!q) return false;
  if (isHistoricalDateQuestion(query)) return false;
  if (isRelativeOrFutureDatetimeQuestion(query)) return false;
  if (isLocalDatetimeRequest(query)) return false;
  if (!GENERIC_DATE_QUESTION_RE.test(q) && !EXTERNAL_LOOKUP_VERB_RE.test(q)) {
    return false;
  }
  if (EXTERNAL_CALENDAR_EVENT_RE.test(q)) return true;
  if (FUTURE_EVENT_RE.test(q)) return true;
  if (
    EXTERNAL_LOOKUP_VERB_RE.test(q) &&
    /\b(?:date|jour|lune|[eé]v[eè]nement|evenement)\b/i.test(q)
  ) {
    return true;
  }
  return false;
}

/**
 * Horloge / calendrier local uniquement.
 * @param {string} query
 * @returns {boolean}
 */
export function isLocalDatetimeRequest(query = "") {
  return LOCAL_DATETIME_RE.test(normalize(query));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function shouldBypassLocalDatetimeShortCircuit(query = "") {
  if (isHistoricalDateQuestion(query)) return false;
  if (isRelativeOrFutureDatetimeQuestion(query)) return false;
  if (isExplicitWebToolInvocationRequest(query)) return true;
  if (isExternalCalendarLookupRequest(query)) return true;
  if (isExternalDateLookupRequest(query)) return true;
  return false;
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildExternalCalendarWebQuery(query = "") {
  const q = normalize(query);
  if (/\bpleine\s+lune\b/i.test(q)) {
    return "prochaine pleine lune date calendrier lunaire";
  }
  if (/\bnouvelle\s+lune\b/i.test(q)) {
    return "prochaine nouvelle lune date calendrier lunaire";
  }
  if (/\b[eé]clipse\b/i.test(q)) {
    return "prochaine éclipse date calendrier astronomique";
  }
  if (/\bsolstice\b|\b[eé]quinoxe\b/i.test(q)) {
    return "prochain solstice équinoxe date calendrier";
  }
  return "calendrier lunaire prochaine pleine lune date";
}
