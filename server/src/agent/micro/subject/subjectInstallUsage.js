/**
 * Taxonomie install — évite les collisions lexicales (npm deps vs Steam/OS).
 */
import { USAGE_INTENTS } from "./subjectUsageIntent.js";

export const INSTALL_USAGE_KINDS = {
  APP_USER: "install_app_user",
  PROJECT_DEPENDENCY: "install_project_dependency",
  RUNTIME_ENV: "install_runtime_env",
  BOOTSTRAP_PROJECT: "bootstrap_project",
};

const INSTALL_VERB =
  /\b(install|installer|installation|ajoute|ajouter|ajout)\b/i;

const BOOTSTRAP_MARKERS =
  /\b(npm create|npx create|create vite|create-react-app|initialiser un projet|initialiser le projet|cr[ée]er un projet|cr[ée]er le projet|bootstrap|scaffold|generateur vite|générer le projet)\b/i;

const PROJECT_DEPENDENCY_MARKERS =
  /\b(installer|install)\s+(uniquement\s+)?(les\s+)?(d[ée]pendances|deps|packages?)\b/i;

const PACKAGE_MANAGER_INSTALL =
  /\b(npm install|npm i|yarn add|pnpm add|pip install|composer require)\b/i;

const ADD_STACK_PACKAGE =
  /\b(ajoute|ajouter|install(?:er)?)\s+(react|plotly|vite|typescript|tailwind|express|vue|angular)\b/i;

const RUNTIME_ENV_MARKERS =
  /\b(installer|install)\s+(node|python|java|rust|go|docker|wsl|sdk|runtime|environnement virtuel|venv)\b/i;

const OS_PACKAGE_MANAGER =
  /\b(apt|apt-get|brew|choco|chocolatey|winget)\s+install\b/i;

const APP_DISTRIBUTION_MARKERS =
  /\b(steam|ea app|origin|epic games|playstation|ps4|ps5|xbox|nintendo|switch|site officiel|magasin d applications)\b/i;

/**
 * @param {string} query
 * @returns {string|null} INSTALL_USAGE_KINDS value
 */
export function classifyInstallUsage(query = "") {
  const q = String(query || "").toLowerCase();
  if (!INSTALL_VERB.test(q) && !PACKAGE_MANAGER_INSTALL.test(q) && !BOOTSTRAP_MARKERS.test(q)) {
    return null;
  }

  if (BOOTSTRAP_MARKERS.test(q)) {
    return INSTALL_USAGE_KINDS.BOOTSTRAP_PROJECT;
  }

  if (
    PROJECT_DEPENDENCY_MARKERS.test(q) ||
    PACKAGE_MANAGER_INSTALL.test(q) ||
    ADD_STACK_PACKAGE.test(q)
  ) {
    return INSTALL_USAGE_KINDS.PROJECT_DEPENDENCY;
  }

  if (RUNTIME_ENV_MARKERS.test(q) || OS_PACKAGE_MANAGER.test(q)) {
    return INSTALL_USAGE_KINDS.RUNTIME_ENV;
  }

  if (APP_DISTRIBUTION_MARKERS.test(q)) {
    return INSTALL_USAGE_KINDS.APP_USER;
  }

  if (/\b(jeu|game|logiciel|application|app)\b/.test(q) && INSTALL_VERB.test(q)) {
    return INSTALL_USAGE_KINDS.APP_USER;
  }

  if (/\b(react|vite|forge|plotly|npm|projet|package\.json|node_modules)\b/.test(q)) {
    return INSTALL_USAGE_KINDS.PROJECT_DEPENDENCY;
  }

  if (INSTALL_VERB.test(q) || PACKAGE_MANAGER_INSTALL.test(q)) {
    return INSTALL_USAGE_KINDS.APP_USER;
  }

  return null;
}

/**
 * @param {string|null} installKind
 * @returns {string|null} USAGE_INTENTS value
 */
export function mapInstallKindToUsageIntent(installKind) {
  switch (installKind) {
    case INSTALL_USAGE_KINDS.APP_USER:
      return USAGE_INTENTS.INSTALL;
    case INSTALL_USAGE_KINDS.PROJECT_DEPENDENCY:
    case INSTALL_USAGE_KINDS.BOOTSTRAP_PROJECT:
      return USAGE_INTENTS.INTERNAL_HANDOFF;
    case INSTALL_USAGE_KINDS.RUNTIME_ENV:
      return USAGE_INTENTS.CONFIGURE;
    default:
      return null;
  }
}

/**
 * @param {string|null} installKind
 * @returns {string|null}
 */
export function installUsageGuidanceLine(installKind) {
  switch (installKind) {
    case INSTALL_USAGE_KINDS.APP_USER:
      return "Tu sembles vouloir **installer une application** — indique ton OS et la source (Steam, site officiel, package manager…).";
    case INSTALL_USAGE_KINDS.PROJECT_DEPENDENCY:
      return "Tu sembles vouloir **ajouter des dépendances au projet** (npm/yarn) — pas une installation logicielle utilisateur.";
    case INSTALL_USAGE_KINDS.BOOTSTRAP_PROJECT:
      return "Tu sembles vouloir **initialiser ou structurer un projet** (Vite, React, squelette) — chemin dev/Forge, pas install Steam/OS.";
    case INSTALL_USAGE_KINDS.RUNTIME_ENV:
      return "Tu sembles vouloir **installer un runtime ou outil système** — précise OS et gestionnaire (apt, brew, winget…).";
    default:
      return null;
  }
}
