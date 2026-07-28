import { CAPABILITY_IDS, CAPABILITY_PRIORITY } from "../capabilityTypes.js";
import {
  isPedagogicalOrSupportContext,
  matchesGraphifyIntent,
} from "../contractGuards.js";
import { assessGraphifyGraphAvailability } from "./graphifyPaths.js";
import {
  registerGraphifyTools,
  GRAPHIFY_INSTRUCTION_BLOCK,
} from "./registerTools.js";

export const id = CAPABILITY_IDS.GRAPHIFY;
export const priority = CAPABILITY_PRIORITY[id];

/**
 * @param {import("../capabilityTypes.js").CapabilityMatchInput} input
 */
export function match(input) {
  const pedagogical = isPedagogicalOrSupportContext(
    input.query,
    input.intentContractId || null,
    input.conversationMove,
  );
  const graph = matchesGraphifyIntent(input.query, input.intentContractId || null, {
    attachments: input.attachments,
  });

  if (!graph.active) {
    return { active: false, why: ["no_graphify_signal"] };
  }
  if (pedagogical.blocked) {
    return { active: false, why: [`excluded:${pedagogical.why.join("+")}`] };
  }

  const avail = assessGraphifyGraphAvailability();
  if (!avail.ok) {
    return { active: false, why: [`graph_unavailable:${avail.reason}`] };
  }

  return {
    active: true,
    why: [...graph.why, `graph_ok:${avail.graphPath}`],
  };
}

/**
 * @param {import("../capabilityTypes.js").CapabilityMatchInput} input
 * @returns {string|null}
 */
export function injectInstructions(input) {
  const tools = registerGraphifyTools(input);
  if (!tools.length) return null;
  return GRAPHIFY_INSTRUCTION_BLOCK;
}

/**
 * @param {import("../capabilityTypes.js").CapabilityMatchInput} input
 */
export function registerTools(input) {
  const hit = match(input);
  if (!hit.active) return [];
  return registerGraphifyTools(input);
}
