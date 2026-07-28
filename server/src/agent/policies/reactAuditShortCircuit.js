/**
 * G48.1 — short-circuit audit React Doctor (router + guards ; CLI = G48.2).
 */
import {
  classifyReactAuditContract,
  REACT_AUDIT_INTENTS,
  REACT_AUDIT_PIPELINE_PATHS,
} from "./reactAuditContractRouter.js";
import { isReactAuditRequest } from "../utils/reactAuditIntentGuards.js";
import { isUiNavigationRestructureFeedback } from "../utils/uiNavigationFeedbackGuards.js";
import { RESPONSE_MODES } from "../config/modeResponseContracts.js";

/**
 * @param {import("./reactAuditContractRouter.js").ReactAuditContract} contract
 */
export function buildReactAuditClarifyReply(contract) {
  const options = (contract.clarification?.options || [])
    .map((value, index) => `${index + 1}. ${value}`)
    .join("\n");
  return [contract.clarification?.question, "", options].filter(Boolean).join("\n");
}

/**
 * Ack routage G48.1 — remplacé par sortie CLI en G48.2.
 * @param {import("./reactAuditContractRouter.js").ReactAuditContract} contract
 */
export function buildReactAuditRoutingAckReply(contract) {
  const target = contract.target?.rootPath || "(racine à confirmer)";
  const mode = contract.scan?.mode || "full";
  return [
    `Audit React Doctor identifié — contrat **${contract.contract}** (${contract.intent.replace("react_audit/", "")}).`,
    `Cible : \`${target}\` · mode **${mode}**.`,
    "Exécution CLI React Doctor branchée en **G48.2** (`--json --no-telemetry --no-score`).",
  ].join("\n");
}

/**
 * @param {string} query
 * @param {{ workspaceRoot?: string, packageJsonHasReact?: boolean, history?: object[], attachments?: unknown[] }} [options]
 * @returns {{
 *   path: string,
 *   reply: string,
 *   reactAuditContract: import("./reactAuditContractRouter.js").ReactAuditContract,
 *   reactAuditDriven: true,
 * }|null}
 */
export function resolveReactAuditShortCircuit(query = "", options = {}) {
  if (!isReactAuditRequest(query, options)) return null;

  const contract = classifyReactAuditContract(query, options);
  if (!contract) return null;

  if (contract.intent === REACT_AUDIT_INTENTS.AMBIGUOUS) {
    return {
      path: REACT_AUDIT_PIPELINE_PATHS.CLARIFY,
      reply: buildReactAuditClarifyReply(contract),
      reactAuditContract: contract,
      reactAuditDriven: true,
    };
  }

  return {
    path: contract.routing.pipelinePath,
    reply: buildReactAuditRoutingAckReply(contract),
    reactAuditContract: contract,
    reactAuditDriven: true,
  };
}

/**
 * @param {string} query
 * @param {object} [options]
 */
export function resolveReactAuditShortCircuitEmit(query = "", options = {}) {
  const hit = resolveReactAuditShortCircuit(query, options);
  if (!hit) return null;

  if (hit.path === REACT_AUDIT_PIPELINE_PATHS.CLARIFY) {
    const clarifyText = buildReactAuditClarifyReply(hit.reactAuditContract);
    const competingUi = isUiNavigationRestructureFeedback(query);
    if (competingUi) return null;
    return {
      path: hit.path,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      reply: null,
      deferToLlm: true,
      step: "🔬 G48 — clarification discriminante (UX vs React Doctor)...",
      enforce: { allowRefusal: false },
      reactAuditContract: hit.reactAuditContract,
      reactAuditDriven: true,
      reactAuditExecutionPhase: hit.reactAuditContract.routing.executionPhase,
      reflectiveHint: [
        "[CLARIFICATION DISCRIMINANTE G48]",
        clarifyText,
        "Ne pas lancer React Doctor ni répondre comme si l'audit était déjà choisi — poser la question ou traiter l'avis UX si c'est le cœur du message.",
      ].join("\n\n"),
    };
  }

  if (!hit?.reply) return null;
  return {
    path: hit.path,
    mode: RESPONSE_MODES.SIMPLE_FAST,
    reply: hit.reply,
    step: `🔬 G48 — React Doctor ${hit.reactAuditContract.intent.replace("react_audit/", "")}...`,
    enforce: { allowRefusal: false },
    reactAuditContract: hit.reactAuditContract,
    reactAuditDriven: true,
    reactAuditExecutionPhase: hit.reactAuditContract.routing.executionPhase,
  };
}
