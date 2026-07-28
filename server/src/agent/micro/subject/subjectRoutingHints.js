import { USAGE_INTENTS } from "./subjectUsageIntent.js";
import { listEntityIdsByRelation } from "./subjectGraph.js";

/** Pistes de routage déterministe (builders / chemins pipeline) — sans LLM. */
export const DETERMINISTIC_ROUTES = {
  LAUNCHER_GUIDE_BUILDER: "launcher_guide_builder",
  INSTALL_GUIDE_BUILDER: "install_guide_builder",
  TROUBLESHOOT_SURFACE: "troubleshoot_surface",
  CONFIGURE_SURFACE: "configure_surface",
  COMPARE_SURFACE: "compare_surface",
  FAMILIARITY_SURFACE: "familiarity_surface",
  FORGE_PROCEDURE: "forge_procedure",
  FORGE_PROJECT_SCOPING_READY: "forge_project_scoping_ready",
  STUDIO_PROCEDURE: "studio_procedure",
  SUBJECT_CLARIFY: "subject_clarify",
  SUBJECT_DISAMBIGUATE: "subject_disambiguate",
};

const GAME_ENTITY_IDS = new Set(listEntityIdsByRelation("is_game"));

/**
 * @param {object} state — état interprété (nature, usage, resolvedEntityId…)
 * @returns {string|null}
 */
export function resolveDeterministicRouteHint(state = {}) {
  const { usage, resolvedEntityId, nature } = state;

  if (nature === "internal_studio_operation") {
    if (usage === USAGE_INTENTS.INTERNAL_HANDOFF || usage === USAGE_INTENTS.TRANSMIT) {
      return DETERMINISTIC_ROUTES.FORGE_PROCEDURE;
    }
    return DETERMINISTIC_ROUTES.STUDIO_PROCEDURE;
  }

  if (resolvedEntityId && GAME_ENTITY_IDS.has(resolvedEntityId)) {
    if (usage === USAGE_INTENTS.EXECUTE_LAUNCH) {
      return DETERMINISTIC_ROUTES.LAUNCHER_GUIDE_BUILDER;
    }
    if (usage === USAGE_INTENTS.INSTALL) {
      return DETERMINISTIC_ROUTES.INSTALL_GUIDE_BUILDER;
    }
    if (usage === USAGE_INTENTS.LEARN_ABOUT) {
      return DETERMINISTIC_ROUTES.FAMILIARITY_SURFACE;
    }
  }

  if (usage === USAGE_INTENTS.LEARN_ABOUT) {
    return DETERMINISTIC_ROUTES.FAMILIARITY_SURFACE;
  }
  if (usage === USAGE_INTENTS.TROUBLESHOOT) {
    return DETERMINISTIC_ROUTES.TROUBLESHOOT_SURFACE;
  }
  if (usage === USAGE_INTENTS.CONFIGURE) {
    return DETERMINISTIC_ROUTES.CONFIGURE_SURFACE;
  }
  if (usage === USAGE_INTENTS.COMPARE) {
    return DETERMINISTIC_ROUTES.COMPARE_SURFACE;
  }
  if (usage === USAGE_INTENTS.EXECUTE_LAUNCH) {
    return DETERMINISTIC_ROUTES.LAUNCHER_GUIDE_BUILDER;
  }
  if (usage === USAGE_INTENTS.INSTALL) {
    return DETERMINISTIC_ROUTES.INSTALL_GUIDE_BUILDER;
  }

  return null;
}
