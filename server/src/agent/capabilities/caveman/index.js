import { CODE_INTENT_KINDS } from "../../../../../shared/codeIntentCatalog.js";
import { CAPABILITY_IDS, CAPABILITY_PRIORITY } from "../capabilityTypes.js";
import {
  assessCavemanInstructionCompatibility,
} from "../contractGuards.js";
import {
  buildCavemanInstructionBlock,
  resolveEffectiveCavemanLevel,
  CAVEMAN_EXPLICIT_INTENSITY_LEVELS,
} from "./instructions.js";

export const id = CAPABILITY_IDS.CAVEMAN;
export const priority = CAPABILITY_PRIORITY[id];

/**
 * @param {import("../capabilityTypes.js").CapabilityMatchInput} input
 * @returns {import("../capabilityTypes.js").CapabilityMatchResult}
 */
export function match(input) {
  const level = resolveEffectiveCavemanLevel(input);
  if (level === "NORMAL") {
    return { active: false, why: ["caveman_level_normal"] };
  }

  const codeKind = input.justIntent?.codeIntentKind || null;
  if (codeKind === CODE_INTENT_KINDS.EXPLAIN) {
    return { active: false, why: ["excluded:code_explain_pedagogy"] };
  }

  const compat = assessCavemanInstructionCompatibility(input);
  if (!compat.ok) {
    return { active: false, why: compat.why };
  }

  const explicit = CAVEMAN_EXPLICIT_INTENSITY_LEVELS.has(level);
  if (level === "LITE" && !explicit) {
    const hasSignal = compat.why.some(
      (w) =>
        w.startsWith("contract:") ||
        w.startsWith("code_intent:") ||
        w === "tool_heavy_turn",
    );
    if (!hasSignal) {
      return { active: false, why: ["lite_requires_compatible_turn"] };
    }
  }

  return {
    active: true,
    why: [`caveman_instruction:${level.toLowerCase()}`, ...compat.why],
  };
}

/**
 * @param {import("../capabilityTypes.js").CapabilityMatchInput} input
 * @returns {string|null}
 */
export function injectInstructions(input) {
  if (!match(input).active) return null;
  const level = resolveEffectiveCavemanLevel(input);
  return buildCavemanInstructionBlock(level);
}

export function registerTools() {
  return [];
}
