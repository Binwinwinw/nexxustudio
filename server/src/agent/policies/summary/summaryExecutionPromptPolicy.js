/**
 * G38.1 — prompts et mode d'exécution TEXT_SUMMARY vs WEB_SUMMARY.
 */
import {
  SUMMARY_CONTRACTS,
  SUMMARY_INTENTS,
} from "./summaryContractRouter.js";
import { extractSummaryUrl } from "./summaryContractRouter.js";

export const SUMMARY_EXECUTION_MODES = Object.freeze({
  TEXT: "text",
  WEB: "web",
});

/**
 * @param {import("./summaryContractRouter.js").SummaryContract|null} contract
 * @returns {"text"|"web"|null}
 */
export function resolveSummaryExecutionMode(contract) {
  if (!contract) return null;
  if (contract.contract === SUMMARY_CONTRACTS.WEB_SUMMARY) return SUMMARY_EXECUTION_MODES.WEB;
  if (contract.contract === SUMMARY_CONTRACTS.TEXT_SUMMARY) return SUMMARY_EXECUTION_MODES.TEXT;
  return null;
}

/**
 * @param {import("./summaryContractRouter.js").SummaryContract|null} contract
 * @returns {object}
 */
export function buildSummaryExecutionValidationContext(contract) {
  if (!contract) return {};
  return {
    contract: contract.contract,
    intent: contract.intent,
    sourceType: contract.source?.type || null,
    fidelity: contract.constraints?.fidelity || null,
    forbidDocumentRequest: Boolean(contract.routing?.forbidDocumentRequest),
    summaryExecutionMode: resolveSummaryExecutionMode(contract),
  };
}

/**
 * @param {string} query
 * @param {import("./summaryContractRouter.js").SummaryContract} [contract]
 * @returns {string}
 */
export function buildTextSummarySystemAddon(query = "", contract = null) {
  const fidelity = contract?.constraints?.fidelity || "strict";
  return [
    "VARIANTE TEXT_SUMMARY (G38) — compression fidèle du texte fourni :",
    `- Fidélité : ${fidelity} — résume uniquement le contenu fourni par l'utilisateur.`,
    "- N'ajoute aucun contexte externe, aucun fait, aucune donnée hors source.",
    "- Signale les ambiguïtés ou lacunes du texte sans les combler par déduction.",
    "- Préserve le sens, les faits explicites et les limites du passage.",
    "INTERDIT :",
    "- Enrichissement par connaissance générale ou recherche web.",
    "- Demander un document ou un passage supplémentaire si le texte est déjà fourni.",
    "- Résumer des éléments absents du texte source.",
  ].join("\n");
}

/**
 * @param {string} query
 * @param {import("./summaryContractRouter.js").SummaryContract} [contract]
 * @returns {string}
 */
export function buildWebSummarySystemAddon(query = "", contract = null) {
  const url = contract?.source?.url || extractSummaryUrl(query) || "URL fournie";
  const maxSentences = contract?.constraints?.max_sentences || 8;
  return [
    "VARIANTE WEB_SUMMARY (G38) — distillation structurée du contenu principal :",
    `- Source page : ${url}`,
    `- Longueur cible : ~${maxSentences} phrases sur le contenu principal.`,
    "ÉTAPES :",
    "1) Identifie l'article ou le contenu principal de la page.",
    "2) Exclue explicitement : navigation, header, footer, menus, bannières, promos, widgets, formulaires, cookies, liens annexes, répétitions de layout.",
    "3) Résume la thèse, les points clés, les données explicites et les action items éventuels présents dans le contenu principal.",
    "INTERDIT :",
    "- Résumer le chrome du site (menus, footer, CTA marketing).",
    "- Inventer des faits absents du contenu principal extrait.",
    "- Traiter la page comme un texte collé brut sans sélection du main content.",
  ].join("\n");
}

/**
 * @param {import("./summaryContractRouter.js").SummaryContract|null} contract
 * @param {string} [query]
 * @returns {{ mode: "text"|"web"|null, addon: string|null }}
 */
export function buildSummaryExecutionSystemAddon(contract, query = "") {
  const mode = resolveSummaryExecutionMode(contract);
  if (!mode) return { mode: null, addon: null };

  const addon =
    mode === SUMMARY_EXECUTION_MODES.WEB
      ? buildWebSummarySystemAddon(query, contract)
      : buildTextSummarySystemAddon(query, contract);

  return { mode, addon };
}

/**
 * Heuristique légère — extrait le bloc « contenu principal » d'un payload web bruité.
 * @param {string} raw
 * @returns {{ mainContent: string, chromeContent: string }}
 */
export function splitWebPayloadMainAndChrome(raw = "") {
  const text = String(raw || "").trim();
  if (!text) return { mainContent: "", chromeContent: "" };

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const chromePatterns = [
    /(?:accueil|menu|navigation|footer|copyright|newsletter|cookies?|panier|connexion|inscription)\b/i,
    /(?:home|about|contact|subscribe|sign\s+in|log\s+in|add\s+to\s+cart)\b/i,
    /(?:mentions\s+legales|politique\s+de\s+confidentialite|politique\s+de\s+cookies?)\b/i,
  ];
  const mainLines = [];
  const chromeLines = [];

  for (const line of lines) {
    const normalizedLine = line
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const isChrome =
      chromePatterns.some((re) => re.test(normalizedLine)) || line.length < 25;
    if (isChrome) {
      chromeLines.push(line);
    } else {
      mainLines.push(line);
    }
  }

  return {
    mainContent: mainLines.join("\n"),
    chromeContent: chromeLines.join("\n"),
  };
}

/**
 * @param {string} intent
 * @returns {boolean}
 */
export function isTextSummaryIntent(intent = "") {
  return (
    intent === SUMMARY_INTENTS.USER_PROVIDED_TEXT ||
    intent === SUMMARY_INTENTS.EXCERPT_OR_CHAPTER
  );
}
