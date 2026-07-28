/** Outils capability activés pour le tour en cours (session légère, pas de fuite inter-tours). */
const CAPABILITY_PACK_TOOLS = new Set([
  "graph_query",
  "graph_path",
  "graph_explain",
  "ocr_page",
  "ocr_document",
]);

let activeCapabilityTools = new Set();

/**
 * @param {string[]} toolNames
 */
export function setCapabilityToolsForTurn(toolNames = []) {
  activeCapabilityTools = new Set(
    (toolNames || []).filter((name) => CAPABILITY_PACK_TOOLS.has(name)),
  );
}

export function clearCapabilityToolsForTurn() {
  activeCapabilityTools = new Set();
}

/**
 * @param {string} toolName
 * @returns {boolean}
 */
export function isCapabilityToolEnabled(toolName = "") {
  return activeCapabilityTools.has(toolName);
}

/**
 * @returns {string[]}
 */
export function getActiveCapabilityTools() {
  return [...activeCapabilityTools];
}

export function isCapabilityPackTool(toolName = "") {
  return CAPABILITY_PACK_TOOLS.has(toolName);
}

/** @deprecated utiliser isCapabilityPackTool */
export function isGraphCapabilityTool(toolName = "") {
  return CAPABILITY_PACK_TOOLS.has(toolName);
}
