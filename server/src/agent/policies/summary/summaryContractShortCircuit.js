/**
 * G38 — short-circuit piloté par SummaryContract (source de vérité routage summary/*).
 */
import {
  classifySummaryContract,
  SUMMARY_INTENTS,
  SUMMARY_CONTRACTS,
} from "./summaryContractRouter.js";
import { resolveDocumentSynthesisShortCircuit } from "../documentSynthesisPolicy.js";
import { buildCulturalContentSummarySystemAddon } from "../../micro/replies/generalKnowledgeComposerContract.js";
import { buildSummaryContractTelemetry } from "../../telemetry/summaryContractTelemetry.js";
import { buildSummaryExecutionSystemAddon } from "./summaryExecutionPromptPolicy.js";

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {unknown[]} [attachments]
 * @param {{ contract?: import("./summaryContractRouter.js").SummaryContract|null }} [options]
 * @returns {object|null}
 */
export function resolveSummaryContractShortCircuit(
  query = "",
  history = [],
  attachments = [],
  options = {},
) {
  const contract =
    options.contract || classifySummaryContract(query, { attachments, history });
  if (!contract) return null;

  const summaryContractTelemetry = buildSummaryContractTelemetry(contract);
  const base = {
    summaryContract: contract,
    summaryContractTelemetry,
    summaryContractDriven: true,
  };

  if (contract.intent === SUMMARY_INTENTS.KNOWN_ENTITY) {
    return {
      ...base,
      path: contract.routing.pipelinePath,
      deferToLlm: true,
      culturalContentSummary: true,
      generalKnowledge: true,
      reflectiveHint: buildCulturalContentSummarySystemAddon(query),
    };
  }

  if (contract.intent === SUMMARY_INTENTS.AMBIGUOUS) {
    const optionLines = (contract.clarification.options || [])
      .map((value, index) => `${index + 1}. ${value}`)
      .join("\n");
    const reply = optionLines
      ? `${contract.clarification.question}\n\n${optionLines}`
      : contract.clarification.question;

    return {
      ...base,
      path: contract.routing.pipelinePath,
      reply,
    };
  }

  if (contract.clarification?.needed) {
    const docHit = resolveDocumentSynthesisShortCircuit(query, history, attachments);
    if (docHit?.reply) {
      return {
        ...base,
        ...docHit,
        path: contract.routing.pipelinePath || docHit.path,
        summaryContractDriven: true,
      };
    }

    return {
      ...base,
      path: contract.routing.pipelinePath,
      reply: contract.clarification.question,
    };
  }

  if (
    contract.contract === SUMMARY_CONTRACTS.TEXT_SUMMARY ||
    contract.contract === SUMMARY_CONTRACTS.WEB_SUMMARY
  ) {
    const docHit = resolveDocumentSynthesisShortCircuit(query, history, attachments);
    const path = contract.routing.pipelinePath;
    const execution = buildSummaryExecutionSystemAddon(contract, query);
    const baseExecution = {
      ...base,
      path,
      deferToLlm: Boolean(docHit?.deferToLlm) || path === "document_synthesis_llm",
      documentSynthesis: true,
      summaryExecutionMode: execution.mode,
      reflectiveHint: execution.addon,
      webSummary: contract.contract === SUMMARY_CONTRACTS.WEB_SUMMARY,
    };
    if (docHit) {
      return {
        ...baseExecution,
        ...docHit,
        path,
        deferToLlm: Boolean(docHit.deferToLlm) || path === "document_synthesis_llm",
      };
    }

    return baseExecution;
  }

  return null;
}
