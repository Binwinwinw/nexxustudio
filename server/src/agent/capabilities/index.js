import * as ponytail from "./ponytail/index.js";
import * as caveman from "./caveman/index.js";
import * as graphify from "./graphify/index.js";
import * as ocr from "./ocr/index.js";
import { CAPABILITY_IDS } from "./capabilityTypes.js";

const PACKS = [graphify, ocr, ponytail, caveman];

/**
 * @param {import("./capabilityTypes.js").CapabilityMatchInput} input
 * @returns {import("./capabilityTypes.js").ComposedCapabilityContext}
 */
export function composeCapabilityContext(input) {
  const evaluated = PACKS.map((pack) => ({
    pack,
    hit: pack.match(input),
  }))
    .filter(({ hit }) => hit.active)
    .sort((a, b) => a.pack.priority - b.pack.priority);

  const instructionBlocks = [];
  const tools = [];
  const telemetry = [];

  for (const { pack, hit } of evaluated) {
    telemetry.push({
      id: pack.id,
      active: true,
      why: hit.why || [],
    });
    const block = pack.injectInstructions(input);
    if (block) instructionBlocks.push(block);
    tools.push(...pack.registerTools(input));
  }

  for (const pack of PACKS) {
    if (telemetry.some((t) => t.id === pack.id)) continue;
    const hit = pack.match(input);
    telemetry.push({
      id: pack.id,
      active: false,
      why: hit.why || [],
    });
  }

  return { instructionBlocks, tools, telemetry };
}

/**
 * @param {import("./capabilityTypes.js").ComposedCapabilityContext} ctx
 * @returns {string|null}
 */
export function buildCapabilityPacksPromptAddon(ctx) {
  if (!ctx?.instructionBlocks?.length) return null;
  return ctx.instructionBlocks.join("\n\n");
}

/**
 * @param {import("./capabilityTypes.js").ComposedCapabilityContext} ctx
 * @returns {string}
 */
export function formatCapabilityPacksStepLabel(ctx) {
  const active = (ctx?.telemetry || []).filter((t) => t.active);
  const parts = (ctx?.telemetry || []).map((t) => {
    const tag = t.active ? "on" : "off";
    const reason = t.active && t.why?.[0] ? `(${t.why[0]})` : "";
    return `${t.id.replace("behavior.", "").replace("tool.", "")}=${tag}${reason}`;
  });
  return `🧩 Capabilities : ${parts.join(" · ")}`;
}

export { CAPABILITY_IDS };
