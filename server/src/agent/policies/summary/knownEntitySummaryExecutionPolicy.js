/**
 * G38.2 — execution lock summary/known_entity (rail terminal Plan B).
 */
import {
  SUMMARY_CONTRACTS,
  SUMMARY_INTENTS,
} from "./summaryContractRouter.js";
import { extractCulturalSummarySubject } from "./culturalContentSummaryPolicy.js";

export const KNOWN_ENTITY_PIPELINE_PATH = "cultural_content_summary";
export const KNOWN_ENTITY_FALLBACK_PIPELINE_PATH =
  "cultural_content_summary_fallback";

export const KNOWN_ENTITY_EXECUTION_PATHS = Object.freeze({
  SIMPLE_FAST_TERMINAL: "simple_fast_terminal",
  SIMPLE_FAST_VALIDATED: "simple_fast_validated",
  SIMPLE_FAST_FALLBACK: "simple_fast_fallback",
  COMPOSER_LEAK_BLOCKED: "composer_leak_blocked",
  COMPOSER_LEAK: "composer_leak",
});

export const KNOWN_ENTITY_CONTRACT_VIOLATIONS = Object.freeze({
  COMPOSER_ESCALATION_BLOCKED: "known_entity_composer_escalation_blocked",
  SIMPLE_FAST_FAILED: "known_entity_simple_fast_failed",
});

/**
 * @param {object|null} shortCircuit
 * @param {object|null} pipelineTelemetryCtx
 * @returns {boolean}
 */
export function isKnownEntityDirectSummaryExecution(
  shortCircuit = null,
  pipelineTelemetryCtx = null,
) {
  if (shortCircuit?.culturalContentSummary) return true;

  const contract = shortCircuit?.summaryContract;
  if (
    contract?.intent === SUMMARY_INTENTS.KNOWN_ENTITY &&
    contract?.contract === SUMMARY_CONTRACTS.DIRECT_SUMMARY
  ) {
    return true;
  }

  const telem = pipelineTelemetryCtx?.summaryContract;
  return (
    telem?.intent === SUMMARY_INTENTS.KNOWN_ENTITY &&
    telem?.contract === SUMMARY_CONTRACTS.DIRECT_SUMMARY
  );
}

/**
 * Verrou terminal : un tour DIRECT_SUMMARY ne doit pas atteindre l'orchestrateur complet.
 * @param {object|null} shortCircuit
 * @param {object|null} pipelineTelemetryCtx
 * @returns {boolean}
 */
export function shouldEnforceKnownEntitySummaryTerminalLock(
  shortCircuit = null,
  pipelineTelemetryCtx = null,
) {
  return isKnownEntityDirectSummaryExecution(shortCircuit, pipelineTelemetryCtx);
}

/**
 * @param {string} query
 * @param {{ summaryContract?: object|null, summaryContractTelemetry?: object|null }} [ctx]
 * @returns {string}
 */
export function buildKnownEntitySummarySoberFallback(query = "", ctx = {}) {
  const subject =
    ctx.summaryContract?.entity?.label ||
    ctx.summaryContractTelemetry?.entityLabel ||
    extractCulturalSummarySubject(query) ||
    "cette œuvre";
  return `Je n'ai pas de synopsis fiable en local pour **${subject}** pour ce tour. Reformule ou réessaie dans un instant.`;
}

/**
 * @param {Error|{ message?: string, code?: string }} error
 * @param {object|null} shortCircuit
 * @returns {object|null}
 */
export function resolveKnownEntitySummaryCatchOutcome(error = null, shortCircuit = null) {
  if (!isKnownEntityDirectSummaryExecution(shortCircuit)) return null;

  return {
    pipelinePath: KNOWN_ENTITY_FALLBACK_PIPELINE_PATH,
    reason: KNOWN_ENTITY_CONTRACT_VIOLATIONS.SIMPLE_FAST_FAILED,
    executionPath: KNOWN_ENTITY_EXECUTION_PATHS.SIMPLE_FAST_FALLBACK,
    composerBypassed: true,
    validationIssues: ["simple_fast_execution_failed"],
    errorMessage: String(error?.message || error || "").slice(0, 240),
  };
}

/**
 * @param {object|null} shortCircuit
 * @param {object|null} pipelineTelemetryCtx
 * @returns {object|null}
 */
export function resolveKnownEntityComposerGateOutcome(
  shortCircuit = null,
  pipelineTelemetryCtx = null,
) {
  if (!shouldEnforceKnownEntitySummaryTerminalLock(shortCircuit, pipelineTelemetryCtx)) {
    return null;
  }

  return {
    pipelinePath: KNOWN_ENTITY_FALLBACK_PIPELINE_PATH,
    reason: KNOWN_ENTITY_CONTRACT_VIOLATIONS.COMPOSER_ESCALATION_BLOCKED,
    executionPath: KNOWN_ENTITY_EXECUTION_PATHS.COMPOSER_LEAK_BLOCKED,
    composerBypassed: true,
    contractViolation: KNOWN_ENTITY_CONTRACT_VIOLATIONS.COMPOSER_ESCALATION_BLOCKED,
    validationIssues: ["composer_escalation_blocked"],
  };
}

/**
 * @param {string} text
 * @returns {number}
 */
export function countSummarySentences(text = "") {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8).length;
}

/**
 * @param {{
 *   pipelineTelemetryCtx?: object|null,
 *   turnTelemetry?: { setMetric?: (key: string, value: unknown) => void }|null,
 *   executionPath?: string,
 *   composerBypassed?: boolean,
 *   validationIssues?: string[],
 *   sentenceCount?: number,
 *   contractViolation?: string|null,
 *   errorMessage?: string|null,
 * }} ctx
 * @returns {object}
 */
export function recordKnownEntitySummaryExecutionTelemetry(ctx = {}) {
  const payload = {
    summary_execution_path: ctx.executionPath || null,
    composer_bypassed: Boolean(ctx.composerBypassed),
    known_entity_validation_issues: [...(ctx.validationIssues || [])],
    summary_response_sentence_count:
      typeof ctx.sentenceCount === "number" ? ctx.sentenceCount : null,
    known_entity_contract_violation: ctx.contractViolation || null,
    known_entity_error_message: ctx.errorMessage || null,
  };

  if (ctx.pipelineTelemetryCtx) {
    ctx.pipelineTelemetryCtx.knownEntitySummaryExecution = payload;
    if (ctx.pipelineTelemetryCtx.summaryContract) {
      ctx.pipelineTelemetryCtx.summaryContract = {
        ...ctx.pipelineTelemetryCtx.summaryContract,
        ...payload,
      };
    }
  }

  if (payload.summary_execution_path) {
    ctx.turnTelemetry?.setMetric?.(
      "summary_execution_path",
      payload.summary_execution_path,
    );
  }
  ctx.turnTelemetry?.setMetric?.(
    "composer_bypassed",
    payload.composer_bypassed,
  );
  if (payload.known_entity_validation_issues.length) {
    ctx.turnTelemetry?.setMetric?.(
      "known_entity_validation_issues",
      payload.known_entity_validation_issues.join(","),
    );
  }
  if (typeof payload.summary_response_sentence_count === "number") {
    ctx.turnTelemetry?.setMetric?.(
      "summary_response_sentence_count",
      payload.summary_response_sentence_count,
    );
  }
  if (payload.known_entity_contract_violation) {
    ctx.turnTelemetry?.setMetric?.(
      "known_entity_contract_violation",
      payload.known_entity_contract_violation,
    );
    console.warn(
      `[KNOWN_ENTITY_G38.2] contract_violation=${payload.known_entity_contract_violation} ` +
        `execution_path=${payload.summary_execution_path}`,
    );
  }

  return payload;
}
