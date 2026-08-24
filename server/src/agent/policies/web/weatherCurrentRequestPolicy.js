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

const WEATHER_PRIMARY_HOST_RE =
  /\b(?:meteofrance\.com|meteofrance\.mq|meteo\.fr|weather\.com|accuweather\.com|openweathermap\.org|yr\.no|wunderground\.com|weather\.gov|aemet\.es)\b/i;

const WEATHER_CONDITION_RE =
  /\b(?:ensoleill[ée]|soleil|clair|nuageux|couvert|pluvieux|pluie|averses?|orageux|orage|brumeux|brouillard|venteux|neigeux|neige|partiellement\s+nuageux|ciel\s+d[eé]gag[ée])\b/i;

const WEATHER_MARKETING_RE =
  /\b(?:retrouvez|prévisions?\s+(?:météo\s+)?(?:à\s+)?15\s+jours|météos?\s+locales?\s+gratuites?|complètes?\s+et\s+détaillées?|à\s+15\s+jours)\b/i;

const NON_TERRESTRIAL_LOCATION_RE =
  /^(?:mars|lune|moon|venus|vénus|mercure|jupiter|saturne|uranus|neptune|pluton|soleil|espace|iss|titan)$/i;

const LOCATION_STOPWORDS = new Set([
  "en",
  "a",
  "au",
  "aux",
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "l",
  "sur",
  "pour",
  "the",
  "in",
  "at",
]);

/** Alias région → villes / codes pour ancrer les sources sans inventer. */
const LOCATION_ALIASES = {
  martinique: ["fort-de-france", "fort de france", "972", "meteofrance.mq"],
  guadeloupe: ["pointe-a-pitre", "basse-terre", "971"],
  guyane: ["cayenne", "973"],
  reunion: ["saint-denis", "974"],
  espagne: ["spain", "madrid", "aemet", "meteo-espagne"],
  spain: ["espagne", "madrid", "aemet", "meteo-espagne"],
  france: ["paris", "meteo-france"],
};

/**
 * @param {string} text
 */
function foldWeatherText(text = "") {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * @param {string} locationLabel
 * @returns {boolean}
 */
export function isNonTerrestrialWeatherLocation(locationLabel = "") {
  const raw = String(locationLabel || "").trim();
  if (!raw) return false;
  const folded = foldWeatherText(raw)
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim();
  if (NON_TERRESTRIAL_LOCATION_RE.test(folded)) return true;
  return /\b(?:planete|planet|extraterrestre|martien)\b/i.test(raw);
}

/**
 * @param {string} [locationLabel]
 * @returns {string}
 */
export function buildNonTerrestrialWeatherReply(locationLabel = "") {
  const label = String(locationLabel || "").trim() || "ce lieu";
  return (
    `${label} n'est pas un lieu de météo terrestre : je ne peux pas donner un relevé ` +
    `« actuel » via Météo-France ou une source web classique. ` +
    `Pour un corps céleste, il faudrait une source spatiale dédiée (ex. NASA).`
  );
}

/**
 * @param {string} text
 * @returns {string|null}
 */
function extractWeatherTemperature(text = "") {
  const m = String(text || "").match(
    /(\d{1,2}(?:[.,]\d+)?)\s*(?:°\s*[cCfF]|degres?\s*c(?:elsius)?|degrees?\s*c)/i,
  );
  if (!m) return null;
  const value = String(m[1]).replace(",", ".");
  return `${value}°C`;
}

/**
 * @param {string} text
 * @returns {string|null}
 */
function extractWeatherCondition(text = "") {
  const m = String(text || "").match(WEATHER_CONDITION_RE);
  return m ? m[0].toLowerCase() : null;
}

/**
 * @param {string} text
 */
function isWeatherMarketingSnippet(text = "") {
  return WEATHER_MARKETING_RE.test(String(text || ""));
}

/**
 * @param {string} locationLabel
 * @returns {string[]}
 */
function locationMatchTokens(locationLabel = "") {
  const folded = foldWeatherText(locationLabel)
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim();
  const base = folded
    .split(/[\s-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !LOCATION_STOPWORDS.has(t));
  const aliasBlob = (LOCATION_ALIASES[folded] || []).join(" ");
  const aliases = foldWeatherText(aliasBlob)
    .replace(/[^a-z0-9\s.-]/g, " ")
    .split(/[\s-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !LOCATION_STOPWORDS.has(t));
  return [...new Set([...base, ...aliases])];
}

/**
 * @param {{ url?: string, title?: string, snippet?: string }} source
 * @param {string[]} tokens
 */
function sourceMatchesLocation(source = {}, tokens = []) {
  if (!tokens.length) return false;
  const hay = foldWeatherText(
    `${source.url || ""} ${source.title || ""} ${source.snippet || ""}`,
  );
  return tokens.some((t) => hay.includes(t));
}

/**
 * @param {{ url?: string }} source
 */
function isThinWeatherHomepage(source = {}) {
  try {
    const u = new URL(String(source.url || ""));
    const path = (u.pathname || "/").replace(/\/+$/, "") || "/";
    return path === "/" || path === "";
  } catch {
    return false;
  }
}

/**
 * @param {Array<{ url?: string, title?: string, snippet?: string }>} sources
 * @param {string[]} tokens
 */
function pickPrimaryWeatherSource(sources = [], tokens = []) {
  const list = Array.isArray(sources) ? sources.filter((s) => s?.url) : [];
  if (!list.length) return null;
  const scored = list.map((s, i) => {
    let score = list.length - i;
    if (WEATHER_PRIMARY_HOST_RE.test(String(s.url))) score += 8;
    if (sourceMatchesLocation(s, tokens)) score += 12;
    if (isWeatherMarketingSnippet(`${s.title}\n${s.snippet}`)) score -= 20;
    if (isThinWeatherHomepage(s)) score -= 10;
    if (extractWeatherTemperature(`${s.title}\n${s.snippet}`)) score += 6;
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.s || null;
}

/**
 * @param {{ url?: string, title?: string }} source
 */
function weatherSourceLabel(source = {}) {
  try {
    const host = new URL(String(source.url || "")).hostname.replace(/^www\./, "");
    if (/meteofrance|meteo\.fr/i.test(host)) return "Météo-France";
    if (/aemet\.es/i.test(host)) return "AEMET";
    if (/weather\.com/i.test(host)) return "Weather.com";
    if (/accuweather/i.test(host)) return "AccuWeather";
    return host || source.title || "source web";
  } catch {
    return source.title || "source web";
  }
}

/**
 * @param {string} [locationLabel]
 * @returns {string}
 */
function officialWeatherFallbackUrl(locationLabel = "") {
  const loc = foldWeatherText(locationLabel || "");
  if (
    /\b(?:martinique|guadeloupe|guyane|reunion|fort[- ]?de[- ]?france|antilles)\b/.test(
      loc,
    )
  ) {
    return "https://meteofrance.mq/fr";
  }
  if (/\bespagne|spain\b/.test(loc)) return "https://www.aemet.es";
  if (/\bfrance\b/.test(loc)) return "https://meteofrance.com";
  return "https://meteofrance.com";
}

/**
 * Réponse factuelle immédiate à partir des preuves web (pas de liste d'options).
 * @param {string} query
 * @param {Array<{ url?: string, title?: string, snippet?: string, excerpt?: string }>} [sources]
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {string|null}
 */
export function buildWeatherCurrentFactualReply(
  query = "",
  sources = [],
  options = {},
) {
  const task = parseWeatherCurrentTask(query, options);
  const label = task?.locationLabel || "cet endroit";
  if (isNonTerrestrialWeatherLocation(label)) {
    return buildNonTerrestrialWeatherReply(label);
  }

  const list = (Array.isArray(sources) ? sources : [])
    .map((s) => ({
      url: s?.url || s?.source || "",
      title: s?.title || "",
      snippet: s?.snippet || s?.excerpt || "",
    }))
    .filter((s) => s.url || s.snippet || s.title);
  if (!list.length) return null;

  const tokens = locationMatchTokens(label);
  const usable = list.filter((s) => {
    const blob = `${s.title}\n${s.snippet}`;
    if (isWeatherMarketingSnippet(blob)) return false;
    if (isThinWeatherHomepage(s) && !extractWeatherTemperature(blob)) return false;
    return sourceMatchesLocation(s, tokens);
  });

  // Pas de preuve ancrée sur le lieu → ne pas inventer un relevé.
  if (!usable.length) return null;

  const blob = usable.map((s) => `${s.title}\n${s.snippet}`).join("\n");
  const temp = extractWeatherTemperature(blob);
  const condition = extractWeatherCondition(blob);
  const primary = pickPrimaryWeatherSource(usable, tokens);
  if (!temp && !condition) return null;

  const lines = [];
  let head = `Météo actuelle en ${label}`;
  if (temp && condition) head += ` : environ ${temp}, ${condition}`;
  else if (temp) head += ` : environ ${temp}`;
  else head += ` : ${condition}`;
  head += ".";
  lines.push(head);

  if (primary?.url) {
    lines.push(`Source : ${weatherSourceLabel(primary)} — ${primary.url}`);
  }

  return lines.join("\n");
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
  if (isNonTerrestrialWeatherLocation(label)) {
    return buildNonTerrestrialWeatherReply(label);
  }
  const fallbackUrl = officialWeatherFallbackUrl(label);
  return (
    `Je n'ai pas pu récupérer la météo temps réel pour ${label} à l'instant` +
    `${reason && reason !== "empty_output" ? ` (${reason})` : ""}. ` +
    `Alternative : ouvre ${fallbackUrl} et colle le relevé, je l'analyse.`
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
 *   reply?: string,
 *   deferToFullPipeline?: boolean,
 *   preferWebResearch?: boolean,
 * }|null}
 */
export function resolveWeatherCurrentShortCircuit(query = "", options = {}) {
  if (!isWeatherCurrentRequest(query, options)) return null;
  const task = parseWeatherCurrentTask(query, options);
  if (!task) return null;

  if (isNonTerrestrialWeatherLocation(task.locationLabel || task.location)) {
    return {
      path: "simple_factual_lookup",
      kind: task.kind,
      weatherWebQuery: null,
      task,
      reply: buildNonTerrestrialWeatherReply(task.locationLabel || task.location),
      deferToFullPipeline: false,
      preferWebResearch: false,
    };
  }

  const weatherWebQuery = buildWeatherCurrentWebQuery(query, options);
  if (!weatherWebQuery) return null;

  return {
    path: "simple_factual_lookup",
    kind: task.kind,
    weatherWebQuery,
    task,
  };
}
