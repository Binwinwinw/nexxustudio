/** Navigation Citadelle — source unique desktop / mobile / tests. */
import { CITADELLE_VIEWS } from "../context/citadelleViews.js";

export const SETTINGS_NAV_ITEMS = [
  { id: CITADELLE_VIEWS.GOVERNANCE, label: "Gouvernance" },
  { id: CITADELLE_VIEWS.INTENT_TRIAGE, label: "Triage" },
  { id: CITADELLE_VIEWS.SECURITY_TELEMETRY, label: "Audits & télémétrie" },
  { id: CITADELLE_VIEWS.SECURITY_HOOKS, label: "Hooks" },
  { id: CITADELLE_VIEWS.IMPACT_AUDIT, label: "Audit d'impact" },
  { id: CITADELLE_VIEWS.PROJECT, label: "Artefacts" },
  { id: CITADELLE_VIEWS.FORGE_ASYNC, label: "Forge async" },
];

export const SETTINGS_VIEW_IDS = new Set(
  SETTINGS_NAV_ITEMS.map((item) => item.id),
);

/**
 * @param {string} viewId
 * @returns {boolean}
 */
export function isSettingsChild(viewId) {
  return SETTINGS_VIEW_IDS.has(viewId);
}

export const PRIMARY_NAV_SECTIONS = [
  {
    title: "Communication",
    items: [
      { id: CITADELLE_VIEWS.CHAT, label: "Chat" },
      { id: CITADELLE_VIEWS.SESSIONS, label: "Historique" },
    ],
  },
  {
    title: "Opérations",
    items: [
      { id: CITADELLE_VIEWS.COCKPIT, label: "Cockpit" },
      { id: CITADELLE_VIEWS.TELEMETRY, label: "Télémétrie" },
    ],
  },
];

export const MOBILE_PRIMARY_NAV_ITEMS = [
  { id: CITADELLE_VIEWS.CHAT, label: "Chat" },
  { id: CITADELLE_VIEWS.SESSIONS, label: "Historique" },
  { id: CITADELLE_VIEWS.COCKPIT, label: "Cockpit" },
  { id: CITADELLE_VIEWS.TELEMETRY, label: "Télémétrie" },
];

export const SETTINGS_DISCLOSURE_ID = "citadelle-settings-nav";
