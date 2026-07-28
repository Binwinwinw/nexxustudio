export const CAPABILITY_IDS = Object.freeze({
  PONYTAIL: "behavior.ponytail",
  CAVEMAN: "behavior.caveman",
  GRAPHIFY: "tool.graphify",
  OCR: "tool.ocr",
});

/** Plus petit = injecté en premier. */
export const CAPABILITY_PRIORITY = Object.freeze({
  [CAPABILITY_IDS.GRAPHIFY]: 10,
  [CAPABILITY_IDS.OCR]: 15,
  [CAPABILITY_IDS.PONYTAIL]: 20,
  [CAPABILITY_IDS.CAVEMAN]: 30,
});

/**
 * @typedef {object} CapabilityMatchResult
 * @property {boolean} active
 * @property {number} [score]
 * @property {string[]} [why]
 */

/**
 * @typedef {object} CapabilityMatchInput
 * @property {string} query
 * @property {object[]} [history]
 * @property {string|null} [intentContractId]
 * @property {object} [justIntent]
 * @property {object} [conversationMove]
 * @property {string} [responseMode]
 * @property {string} [orchestratorMode]
 * @property {string} [cavemanLevel]
 * @property {boolean} [toolHeavyTurn]
 * @property {object} [capabilities]
 * @property {unknown[]} [attachments]
 */

/**
 * @typedef {object} RegisteredTool
 * @property {string} name
 * @property {string} capabilityId
 */

/**
 * @typedef {object} ComposedCapabilityContext
 * @property {string[]} instructionBlocks
 * @property {RegisteredTool[]} tools
 * @property {{ id: string, active: boolean, why: string[] }[]} telemetry
 */
