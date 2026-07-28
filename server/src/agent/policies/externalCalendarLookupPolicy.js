/**
 * external_calendar_lookup — routeur web pour événements calendaires externes.
 */
import {
  buildExternalCalendarWebQuery,
  isExplicitWebToolInvocationRequest,
  isExternalCalendarLookupRequest,
  isExternalDateLookupRequest,
} from "../utils/externalCalendarLookupIntentGuards.js";

export const EXTERNAL_CALENDAR_LOOKUP_RULE = "external_calendar_lookup_v1";

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isExternalCalendarLookupRoute(query = "") {
  return (
    isExternalCalendarLookupRequest(query) ||
    isExternalDateLookupRequest(query) ||
    isExplicitWebToolInvocationRequest(query)
  );
}

/**
 * @param {string} query
 * @returns {object|null}
 */
export function resolveExternalCalendarLookupShortCircuit(query = "") {
  if (!isExternalCalendarLookupRoute(query)) return null;

  const explicitTool = isExplicitWebToolInvocationRequest(query);
  const step = explicitTool
    ? "🌐 Demande explicite d'outil web — recherche calendrier externe..."
    : "🌙 Calendrier externe — recherche web prioritaire (pas datetime local)...";

  return {
    path: "simple_factual_lookup",
    factType: "external_calendar",
    externalCalendarLookup: true,
    explicitWebToolRequest: explicitTool,
    currentWebFactWebQuery: buildExternalCalendarWebQuery(query),
    webQuery: buildExternalCalendarWebQuery(query),
    step,
  };
}
