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
 * @returns {boolean}
 */
export function isCurrentWebFactRequest(query = "") {
  return isWeatherCurrentRequest(query) || isTrafficCurrentRequest(query);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isCurrentWebFactSatisfiable(query = "") {
  return isCurrentWebFactRequest(query);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function buildCurrentWebFactWebQuery(query = "") {
  if (isTrafficCurrentRequest(query)) {
    return buildTrafficCurrentWebQuery(query);
  }
  if (isWeatherCurrentRequest(query)) {
    return buildWeatherCurrentWebQuery(query);
  }
  return null;
}

/**
 * @param {string} query
 * @param {string} [reason]
 * @returns {string}
 */
export function buildCurrentWebFactRecoveryMessage(
  query = "",
  reason = "empty_output",
) {
  if (isTrafficCurrentRequest(query)) {
    return buildTrafficCurrentRecoveryMessage(query, reason);
  }
  if (isWeatherCurrentRequest(query)) {
    return buildWeatherCurrentRecoveryMessage(query, reason);
  }
  return (
    "Je n'ai pas réussi à récupérer cette information actuelle. " +
    "Réessaie dans un instant ou précise le lieu / l'axe concerné."
  );
}

/**
 * @param {string} query
 * @returns {object|null}
 */
export function resolveCurrentWebFactShortCircuit(query = "") {
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

  const weatherHit = resolveWeatherCurrentShortCircuit(query);
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
      step: "🌤️ Météo actuelle — recherche web prioritaire...",
    };
  }

  return null;
}

/**
 * @param {string} query
 * @returns {{ factType: string|null, subject: string|null, webQuery: string|null }}
 */
export function parseCurrentWebFactTask(query = "") {
  if (isTrafficCurrentRequest(query)) {
    const task = parseTrafficCurrentTask(query);
    return {
      factType: CURRENT_WEB_FACT_TYPES.TRAFFIC,
      subject: task?.subjectLabel || task?.subject || null,
      webQuery: buildTrafficCurrentWebQuery(query),
    };
  }
  if (isWeatherCurrentRequest(query)) {
    const task = parseWeatherCurrentTask(query);
    return {
      factType: CURRENT_WEB_FACT_TYPES.WEATHER,
      subject: task?.locationLabel || task?.location || null,
      webQuery: buildWeatherCurrentWebQuery(query),
    };
  }
  return { factType: null, subject: null, webQuery: null };
}
