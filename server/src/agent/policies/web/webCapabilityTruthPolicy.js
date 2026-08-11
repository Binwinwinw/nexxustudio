/**
 * Vérité de capacité web — challenge « tu devrais pouvoir naviguer / sources officielles ».
 * Doctrine : capacité produit ≠ navigateur interactif ; jamais faux déni générique si web search existe.
 */
import {
  extractLastWeatherLocationFromHistory,
  resolveWeatherCurrentShortCircuit,
} from "./weatherCurrentRequestPolicy.js";

export const WEB_CAPABILITY_TRUTH_RULE = "web_capability_truth_v1";

const FALSE_WEB_DENIAL_PATTERNS = [
  /\bje n['’]ai pas acc[eè]s [àa] un navigateur(?:\s+web)?(?:\s+actif)?\b/i,
  /\bpas (?:d['’])?acc[eè]s [àa] (?:un )?navigateur(?:\s+web)?(?:\s+actif)?\b/i,
  /\bje n['’]ai pas (?:d['’])?acc[eè]s au web\b/i,
  /\bje n['’]ai pas (?:d['’])?acc[eè]s [àa] internet\b/i,
  /\bje ne peux (?:donc )?pas (?:aller )?chercher .{0,60}moi[- ]?m[eê]me\b/i,
];

/**
 * Capacité produit web search (expert / service), hors env de désactivation.
 * @param {{ webSearchAvailable?: boolean }} [options]
 * @returns {boolean}
 */
export function isProductWebSearchAvailable(options = {}) {
  if (options.webSearchAvailable === false) return false;
  if (String(process.env.NEXXUS_WEB_SEARCH_DISABLED || "").toLowerCase() === "true") {
    return false;
  }
  return true;
}

/**
 * Challenge utilisateur sur capacité naviguer / sources officielles / web.
 * @param {string} query
 * @returns {boolean}
 */
export function isWebCapabilityChallenge(query = "") {
  const q = String(query || "").trim();
  if (!q) return false;

  const hasWebTarget =
    /\b(?:naviguer|navigateur|sources?\s+officielles?|acc[eè]s\s+(?:au\s+)?(?:web|internet)|recherche\s+web|trouver\s+des\s+sources?)\b/i.test(
      q,
    );
  if (!hasWebTarget) return false;

  const hasCapabilityFrame =
    /\b(?:capacit[eé]|tu\s+devrais|vous\s+devriez|tu\s+peux|vous\s+pouvez|devrais\s+avoir|pouvoir\s+naviguer|tu\s+devrais\s+pouvoir)\b/i.test(
      q,
    );
  return hasCapabilityFrame;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function containsFalseWebCapabilityDenial(text = "") {
  const body = String(text || "");
  if (!body.trim()) return false;
  return FALSE_WEB_DENIAL_PATTERNS.some((re) => re.test(body));
}

/**
 * @returns {string}
 */
export function buildWebCapabilityAvailableReply() {
  return (
    "Oui — j'ai une **recherche web** dans La Citadelle (sources sourcées), " +
    "ce n'est pas un navigateur interactif type Chrome, mais je peux aller chercher des infos officielles. " +
    "Dis le sujet ou le lieu à vérifier, je lance."
  );
}

/**
 * @returns {string}
 */
export function buildWebCapabilityUnavailableReply() {
  return (
    "Dans **ce tour**, la recherche web n'est pas joignable. " +
    "Ce n'est pas une absence générale de capacité web — réessaie dans un instant, " +
    "ou colle un extrait / lien officiel et je l'analyse."
  );
}

/**
 * Remplace un faux déni générique quand la capacité produit existe.
 * @param {string} text
 * @param {{ webSearchAvailable?: boolean }} [options]
 * @returns {string}
 */
export function sanitizeFalseWebCapabilityDenial(text = "", options = {}) {
  const body = String(text || "");
  if (!body.trim()) return body;
  if (!isProductWebSearchAvailable(options)) return body;
  if (!containsFalseWebCapabilityDenial(body)) return body;
  return buildWebCapabilityAvailableReply();
}

/**
 * @param {string} query
 * @param {{
 *   history?: Array<{ role?: string, content?: string }>,
 *   webSearchAvailable?: boolean,
 * }} [options]
 * @returns {object|null}
 */
export function resolveWebCapabilityTruthShortCircuit(query = "", options = {}) {
  if (!isWebCapabilityChallenge(query)) return null;

  const available = isProductWebSearchAvailable(options);
  if (!available) {
    return {
      path: "web_capability_truth_unavailable",
      reply: buildWebCapabilityUnavailableReply(),
      preferWebResearch: false,
      webCapabilityTruth: true,
      webSearchAvailable: false,
      step: "🌐 Capacité web — indisponible dans ce tour (honnête)...",
    };
  }

  const history = Array.isArray(options.history) ? options.history : [];
  const weatherHit = resolveWeatherCurrentShortCircuit(
    "quelle est la météo actuelle ?",
    { history },
  );
  if (weatherHit?.weatherWebQuery) {
    return {
      path: "simple_factual_lookup",
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      preferWebResearch: true,
      simpleFactual: true,
      currentWebFact: true,
      weatherCurrent: true,
      currentWebFactWebQuery: weatherHit.weatherWebQuery,
      weatherWebQuery: weatherHit.weatherWebQuery,
      task: weatherHit.task,
      weatherLocationSource: weatherHit.task?.locationSource || "carryover",
      webCapabilityTruth: true,
      webSearchAvailable: true,
      step: "🌐 Capacité web — reprise météo via recherche...",
    };
  }

  const lastLoc = extractLastWeatherLocationFromHistory(history);
  if (lastLoc) {
    const label = lastLoc.charAt(0).toUpperCase() + lastLoc.slice(1);
    const webQuery = `météo actuelle ${label} maintenant`;
    return {
      path: "simple_factual_lookup",
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      preferWebResearch: true,
      simpleFactual: true,
      currentWebFact: true,
      weatherCurrent: true,
      currentWebFactWebQuery: webQuery,
      weatherWebQuery: webQuery,
      weatherLocationSource: "carryover",
      webCapabilityTruth: true,
      webSearchAvailable: true,
      step: "🌐 Capacité web — reprise météo via recherche...",
    };
  }

  return {
    path: "web_capability_truth_deterministic",
    reply: buildWebCapabilityAvailableReply(),
    preferWebResearch: true,
    webCapabilityTruth: true,
    webSearchAvailable: true,
    step: "🌐 Capacité web — vérité produit (recherche disponible)...",
  };
}
