/**
 * Cadrage projet Forge suffisant — évite les clarifications install/Steam hors sujet.
 */
import { normalizeText } from "../../utils/normalizationGuards.js";

const FORGE_CONTEXT =
  /\b(forge|handoff|citadelle|nexxus\s+studio|déclench\w*\s+(?:la\s+)?forge|declench\w*\s+(?:la\s+)?forge)\b/i;

const STRUCTURE_SIGNALS = [
  /\bobjectif\b/i,
  /\bcontraintes?\b/i,
  /\blivrables?\b/i,
  /\bcadrage\s+projet\b/i,
  /\bsp[ée]cification\s+forge\b/i,
  /\bproposition\s+produit\b/i,
  /\bmvp\b/i,
  /\br[ée]ponse\s+attendue\b/i,
];

const STACK_SIGNALS = [
  /\breact\s*\/\s*vite\b/i,
  /\bvite\s+react\b/i,
  /\bnpm\s+create\s+vite\b/i,
  /\breact-plotly\b/i,
  /\bplotly\.js\b/i,
  /\bcalculatrice\b/i,
  /\bwebapp\b/i,
];

/** « Installer les dépendances » dans un brief npm — pas une demande Steam/OS. */
const NPM_DEPENDENCY_INSTALL =
  /\b(installer|install)\s+(uniquement\s+)?(les\s+)?(d[ée]pendances|deps|packages?)\b/i;

/**
 * @param {string} query
 */
export function isForgeProjectScopingQuery(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (q.length < 80 || !FORGE_CONTEXT.test(q)) return false;

  const structureHits = STRUCTURE_SIGNALS.filter((p) => p.test(q)).length;
  const stackHits = STACK_SIGNALS.filter((p) => p.test(q)).length;
  const hasObjective = /\bobjectif\b/.test(q);
  const hasDeliverables = /\blivrables?\b/.test(q);

  return (
    (hasObjective && hasDeliverables && structureHits >= 1) ||
    (structureHits >= 2 && stackHits >= 1) ||
    (structureHits >= 1 && stackHits >= 2)
  );
}

/**
 * @param {string} query
 */
export function inferForgeScopingUsageOverride(query = "") {
  if (!isForgeProjectScopingQuery(query)) return null;
  return "internal_handoff";
}

/**
 * @param {string} draft
 */
export function isInstallClarificationDraft(draft = "") {
  const text = String(draft || "");
  return (
    /Tu sembles vouloir installer/i.test(text) ||
    /indique ton OS et la source/i.test(text) ||
    (/Steam/i.test(text) && /package manager/i.test(text))
  );
}

/**
 * @param {string} query
 * @param {string|null} draft
 */
export function shouldRescueProcedureDraft(query = "", draft = null) {
  if (!isForgeProjectScopingQuery(query)) return false;
  if (!draft || !String(draft).trim()) return true;
  if (isInstallClarificationDraft(draft)) return true;
  if (/n'est pas résolu avec assez de certitude/i.test(draft) && /ce sujet/i.test(draft)) {
    return true;
  }
  return false;
}

/**
 * Réponse déterministe — brief Forge prêt ou squelette (pas install jeu).
 * @param {string} [query]
 */
const FORGE_HANDOFF_CONFIRMATION =
  /\b(tu\s+as\s+|as\s+tu\s+)?(bien\s+)?(compris|capture|cadr[ée]|retenu)\b/i;

/**
 * Tour de validation après un cadrage déjà posé (« tu as bien compris ? »).
 * @param {string} query
 */
export function isForgeOptionSelectionQuery(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (q.length > 120) return false;
  return (
    /\b(je\s+choisis|j\s+choisis|je\s+prends|option\s*[123]|la\s+(?:3(?:e|ème|ere)?|troisième)\s*(?:proposition|option)?)\b/.test(
      q,
    ) && /\b(proposition|option|pistes?)\b/.test(q)
  );
}

export function isForgeHandoffConfirmationQuery(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (q.length > 160) return false;
  return FORGE_HANDOFF_CONFIRMATION.test(q);
}

/**
 * @param {Array<{ role?: string, content?: string }>} history
 * @returns {string|null}
 */
export function findRecentForgeBriefInHistory(history = []) {
  const list = Array.isArray(history) ? history : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const turn = list[i];
    if (turn?.role === "user" && isForgeProjectScopingQuery(turn.content || "")) {
      return String(turn.content).trim();
    }
  }
  return null;
}

/**
 * Brief à transmettre à la Forge (message courant ou cadrage récent du fil).
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {{ brief: string, reason: string }|null}
 */
export function resolveForgeHandoffBrief(query = "", history = []) {
  if (isForgeProjectScopingQuery(query)) {
    return { brief: String(query).trim(), reason: "scoping_message" };
  }
  if (isForgeHandoffConfirmationQuery(query)) {
    const brief = findRecentForgeBriefInHistory(history);
    if (brief) {
      return { brief, reason: "confirmation_after_scoping" };
    }
  }
  if (isForgeOptionSelectionQuery(query)) {
    const brief = findRecentForgeBriefInHistory(history);
    if (brief) {
      return { brief, reason: "option_selection_after_scoping" };
    }
  }
  return null;
}

/**
 * Brief structuré complet → handoff Forge (le chat ne prolonge pas l'exploration).
 */
export function shouldAutoForgeHandoff(query = "", history = []) {
  return resolveForgeHandoffBrief(query, history) !== null;
}

/**
 * Accusé de réception court — ownership passe à la Forge dans le même tour.
 * @param {string} [query]
 * @param {{ reason?: string }} [options]
 */
export function buildForgeHandoffAckReply(query = "", { reason = "scoping_message" } = {}) {
  const q = normalizeText(query).toLowerCase();
  const mentionsPlotly = /\breact-plotly|plotly\b/.test(q);
  const mentionsVite = /\bvite|npm create vite\b/.test(q);
  const stackBits = [
    mentionsVite ? "Vite + React" : null,
    mentionsPlotly ? "react-plotly.js" : null,
  ].filter(Boolean);

  const stackHint = stackBits.length
    ? ` (${stackBits.join(", ")})`
    : "";

  if (reason === "confirmation_after_scoping") {
    return `Oui, bien compris${stackHint}. Je transmets le brief à la **Forge** — génération en cours.`;
  }

  return [
    `Brief Forge suffisant${stackHint} — je transmets à la **Forge** (le chat ne prolonge pas ce cadrage).`,
    NPM_DEPENDENCY_INSTALL.test(q)
      ? "_Les dépendances visées sont celles du **projet npm**, pas une install logicielle OS/Steam._"
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Réponse SIL / gate — handoff si brief complet, sinon demande de compléments.
 */
export function buildForgeProjectScopingReply(query = "") {
  if (isForgeProjectScopingQuery(query)) {
    return buildForgeHandoffAckReply(query, { reason: "scoping_message" });
  }

  const q = normalizeText(query).toLowerCase();
  const mentionsPlotly = /\breact-plotly|plotly\b/.test(q);
  const mentionsVite = /\bvite|npm create vite\b/.test(q);

  const stackLine = [
    mentionsVite ? "bootstrap **Vite + React**" : null,
    mentionsPlotly ? "graphe via **react-plotly.js**" : null,
    "calculatrice scientifique graphique (MVP local, sans backend)",
  ]
    .filter(Boolean)
    .join(", ");

  return [
    "Le **cadrage Forge** avance, mais il manque encore des repères pour un handoff automatique (objectif, contraintes, livrables et stack explicites).",
    "",
    `**Déjà détecté** : ${stackLine || "intention projet / Forge"}.`,
    "",
    "Complète l’objectif, les contraintes et les livrables — ou envoie un brief structuré comme dans ton exemple — et je passerai directement à la Forge.",
  ]
    .filter(Boolean)
    .join("\n");
}
