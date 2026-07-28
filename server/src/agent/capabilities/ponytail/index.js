import { CODE_INTENT_KINDS } from "../../../../../shared/codeIntentCatalog.js";
import { CAPABILITY_IDS, CAPABILITY_PRIORITY } from "../capabilityTypes.js";
import {
  isPedagogicalOrSupportContext,
  PONYTAIL_ALLOWED_CONTRACT_IDS,
} from "../contractGuards.js";
import { requiresGenerousComposerResponse } from "../../policies/practicalAdviceRoutingGuard.js";
import { PONYTAIL_INSTRUCTION_BLOCK } from "./instructions.js";

export const id = CAPABILITY_IDS.PONYTAIL;
export const priority = CAPABILITY_PRIORITY[id];

const PONYTAIL_CODE_KINDS = new Set([
  CODE_INTENT_KINDS.REFACTOR,
  CODE_INTENT_KINDS.CORRECTION,
  CODE_INTENT_KINDS.DEBUG,
  CODE_INTENT_KINDS.REVIEW,
  CODE_INTENT_KINDS.AUDIT,
]);

const CODE_WRITE_RE =
  /\b(?:ecris|écris|crée|créer|cree|creer|generer|générer|genere|patch|impl[eé]mente|implemente|ajoute\s+(?:une\s+)?fonction|refactor)\b/i;

/**
 * @param {import("../capabilityTypes.js").CapabilityMatchInput} input
 * @returns {import("../capabilityTypes.js").CapabilityMatchResult}
 */
export function match(input) {
  const query = String(input.query || "");
  const why = [];
  const codeKind = input.justIntent?.codeIntentKind || null;
  if (codeKind === CODE_INTENT_KINDS.EXPLAIN) {
    return { active: false, why: ["excluded:code_explain_pedagogy"] };
  }

  const pedagogical = isPedagogicalOrSupportContext(
    query,
    input.intentContractId || null,
    input.conversationMove,
  );
  if (pedagogical.blocked) {
    return { active: false, why: [`excluded:${pedagogical.why.join("+")}`] };
  }

  const contractId = input.intentContractId || null;
  if (contractId === "REPO_ANALYSIS" || contractId === "GUIDED_PRODUCT_RECOMMENDATION") {
    return { active: false, why: [`excluded:contract:${contractId}`] };
  }

  if (requiresGenerousComposerResponse(query)) {
    return { active: false, why: ["excluded:generous_composer"] };
  }

  if (codeKind && PONYTAIL_CODE_KINDS.has(codeKind)) {
    why.push(`code_intent:${codeKind}`);
  }

  if (contractId && PONYTAIL_ALLOWED_CONTRACT_IDS.has(contractId)) {
    why.push(`contract:${contractId}`);
  }

  if (input.capabilities?.code === true && CODE_WRITE_RE.test(query)) {
    why.push("capability_code_write");
  }

  if (why.length === 0) {
    return { active: false, why: ["no_ponytail_signal"] };
  }
  return { active: true, why };
}

/**
 * @param {import("../capabilityTypes.js").CapabilityMatchInput} input
 * @returns {string|null}
 */
export function injectInstructions(_input) {
  return PONYTAIL_INSTRUCTION_BLOCK;
}

export function registerTools() {
  return [];
}
