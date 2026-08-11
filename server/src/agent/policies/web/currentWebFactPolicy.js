/**
 * current_web_fact — routeur transverse (lot #38).
 * Délègue la météo (#36) sans remigration ; ajoute trafic (#38a).
 */
import {
  isWeatherCurrentRequest,
  buildWeatherCurrentWebQuery,
  parseWeatherCurrentTask,
  buildWeatherCurrentRecoveryMessage,
  resolveWeatherCurrentShortCircuit,
} from "./weatherCurrentRequestPolicy.js";
import {
  isTrafficCurrentRequest,
  buildTrafficCurrentWebQuery,
  parseTrafficCurrentTask,
  buildTrafficCurrentRecoveryMessage,
  resolveTrafficCurrentShortCircuit,
} from "./trafficCurrentRequestPolicy.js";
import { CURRENT_WEB_FACT_TYPES } from "../../utils/currentWebFactIntentGuards.js";

export const CURRENT_WEB_FACT_POLICY = "current_web_fact_policy_v1";

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {boolean}
 */
export function isCurrentWebFactRequest(query = "", options = {}) {
  return (
    isWeatherCurrentRequest(query, options) || isTrafficCurrentRequest(query)
  );
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {boolean}
 */
export function isCurrentWebFactSatisfiable(query = "", options = {}) {
  return isCurrentWebFactRequest(query, options);
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {string|null}
 */
export function buildCurrentWebFactWebQuery(query = "", options = {}) {
  if (isTrafficCurrentRequest(query)) {
    return buildTrafficCurrentWebQuery(query);
  }
  if (isWeatherCurrentRequest(query, options)) {
    return buildWeatherCurrentWebQuery(query, options);
  }
  return null;
}

/**
 * @param {string} query
 * @param {string} [reason]
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {string}
 */
export function buildCurrentWebFactRecoveryMessage(
  query = "",
  reason = "empty_output",
  options = {},
) {
  if (isTrafficCurrentRequest(query)) {
    return buildTrafficCurrentRecoveryMessage(query, reason);
  }
  if (isWeatherCurrentRequest(query, options)) {
    return buildWeatherCurrentRecoveryMessage(query, reason, options);
  }
  return (
    "Je n'ai pas réussi à récupérer cette information actuelle. " +
    "Réessaie dans un instant ou précise le lieu / l'axe concerné."
  );
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {object|null}
 */
export function resolveCurrentWebFactShortCircuit(query = "", options = {}) {
  const trafficHit = resolveTrafficCurrentShortCircuit(query);
  if (trafficHit) {
    return {
      ...trafficHit,
      trafficCurrent: true,
      preferWebResearch: true,
      simpleFactual: true,
      deferToLlm: true,
      deferToFullPipeline: true,
      step: "🚗 Trafic actuel — recherche web prioritaire...",
    };
  }

  const weatherHit = resolveWeatherCurrentShortCircuit(query, options);
  if (weatherHit) {
    const webQuery = weatherHit.weatherWebQuery;
    return {
      ...weatherHit,
      factType: CURRENT_WEB_FACT_TYPES.WEATHER,
      currentWebFactWebQuery: webQuery,
      weatherCurrent: true,
      preferWebResearch: true,
      simpleFactual: true,
      deferToLlm: true,
      deferToFullPipeline: true,
      step:
        weatherHit.task?.locationSource === "carryover"
          ? "🌤️ Météo actuelle — lieu repris du fil (recherche web)..."
          : "🌤️ Météo actuelle — recherche web prioritaire...",
    };
  }

  return null;
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {{ factType: string|null, subject: string|null, webQuery: string|null }}
 */
export function parseCurrentWebFactTask(query = "", options = {}) {
  if (isTrafficCurrentRequest(query)) {
    const task = parseTrafficCurrentTask(query);
    return {
      factType: CURRENT_WEB_FACT_TYPES.TRAFFIC,
      subject: task?.subjectLabel || task?.subject || null,
      webQuery: buildTrafficCurrentWebQuery(query),
    };
  }
  if (isWeatherCurrentRequest(query, options)) {
    const task = parseWeatherCurrentTask(query, options);
    return {
      factType: CURRENT_WEB_FACT_TYPES.WEATHER,
      subject: task?.locationLabel || task?.location || null,
      webQuery: buildWeatherCurrentWebQuery(query, options),
    };
  }
  return { factType: null, subject: null, webQuery: null };
}
