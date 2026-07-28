import { CAPABILITY_IDS, CAPABILITY_PRIORITY } from "../capabilityTypes.js";
import {
  isPedagogicalOrSupportContext,
  matchesOcrIntent,
  isSimpleVisionDescribeWithoutOcrNeed,
  OCR_ALLOWED_CONTRACT_IDS,
} from "../contractGuards.js";
import {
  resolveOcrServiceBaseUrl,
} from "./ocrConfig.js";
import {
  registerOcrTools,
  OCR_INSTRUCTION_BLOCK,
} from "./registerTools.js";

export const id = CAPABILITY_IDS.OCR;
export const priority = CAPABILITY_PRIORITY[id];

export function match(input) {
  const contractId = input.intentContractId || null;
  const ocrContractBypass =
    contractId && OCR_ALLOWED_CONTRACT_IDS.has(contractId);

  if (isSimpleVisionDescribeWithoutOcrNeed(input.query, input.attachments)) {
    return { active: false, why: ["vision_simple_sufficient"] };
  }

  if (!ocrContractBypass) {
    const pedagogical = isPedagogicalOrSupportContext(
      input.query,
      contractId,
      input.conversationMove,
    );
    if (pedagogical.blocked) {
      return { active: false, why: [`excluded:${pedagogical.why.join("+")}`] };
    }
  }

  const ocr = matchesOcrIntent(input.query, contractId, {
    attachments: input.attachments,
  });
  if (!ocr.active) {
    return { active: false, why: ["no_ocr_signal"] };
  }

  const baseUrl = resolveOcrServiceBaseUrl();
  if (!baseUrl) {
    return { active: false, why: ["ocr_service_url_unset"] };
  }

  return {
    active: true,
    why: [...ocr.why, `ocr_configured:${baseUrl}`],
  };
}

/**
 * @param {import("../capabilityTypes.js").CapabilityMatchInput} input
 * @returns {string|null}
 */
export function injectInstructions(input) {
  const tools = registerOcrTools(input);
  if (!tools.length) return null;
  const hit = match(input);
  if (!hit.active) return null;
  return OCR_INSTRUCTION_BLOCK;
}

/**
 * @param {import("../capabilityTypes.js").CapabilityMatchInput} input
 */
export function registerTools(input) {
  const hit = match(input);
  if (!hit.active) return [];
  return registerOcrTools(input);
}
