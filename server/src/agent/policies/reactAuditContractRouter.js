/**
 * G48 — ReactAuditContract router (Plan A).
 */
import {
  REACT_AUDIT_CONTRACT_ID,
  REACT_AUDIT_FORBIDDEN_PATHS,
  extractReactAuditRootPath,
  hasReactAuditPhrase,
  hasReactStackSignal,
  isReactAuditAmbiguous,
  isReactAuditDiffRequest,
  isReactAuditExcluded,
  isReactAuditRequest,
  isReactAuditScoreOnlyRequest,
} from "../utils/reactAuditIntentGuards.js";
import { RESPONSE_MODES } from "../config/modeResponseContracts.js";

export const REACT_AUDIT_INTENTS = Object.freeze({
  REPO_SCAN: "react_audit/repo_scan",
  DIFF_SCAN: "react_audit/diff_scan",
  SCORE_ONLY: "react_audit/score_only",
  AMBIGUOUS: "react_audit/ambiguous",
});

export const REACT_AUDIT_PIPELINE_PATHS = Object.freeze({
  DETERMINISTIC: "react_audit_deterministic",
  DIFF: "react_audit_diff",
  SCORE: "react_audit_score",
  CLARIFY: "react_audit_clarify",
});

/** Flags CLI validés spec — --offline optionnel (probe G48.2). */
export const REACT_AUDIT_CLI_BASE_FLAGS = Object.freeze([
  "--json",
  "--verbose",
  "--yes",
  "--no-telemetry",
  "--no-score",
]);

/**
 * @param {string} query
 * @param {{ workspaceRoot?: string, packageJsonHasReact?: boolean, offlineFlagSupported?: boolean }} [options]
 */
export function buildReactAuditCliArgs(query = "", options = {}) {
  const args = [...REACT_AUDIT_CLI_BASE_FLAGS];
  if (options.offlineFlagSupported) args.push("--offline");
  if (isReactAuditDiffRequest(query)) {
    const m = String(query).match(/\b(?:vs|contre|diff)\s+(main|master|develop)\b/i);
    args.push("--diff", m?.[1] || "main");
  }
  if (isReactAuditScoreOnlyRequest(query)) args.push("--score");
  return args;
}

/**
 * @param {string} query
 * @param {{ workspaceRoot?: string, packageJsonHasReact?: boolean, history?: object[] }} [options]
 * @returns {import("./reactAuditContractRouter.js").ReactAuditContract|null}
 */
export function classifyReactAuditContract(query = "", options = {}) {
  if (isReactAuditExcluded(query, options)) return null;
  if (!isReactAuditRequest(query, options) && !isReactAuditAmbiguous(query, options)) {
    return null;
  }

  const rootPath = extractReactAuditRootPath(query, options);
  let intent = REACT_AUDIT_INTENTS.REPO_SCAN;
  let pipelinePath = REACT_AUDIT_PIPELINE_PATHS.DETERMINISTIC;
  let scanMode = "full";
  let clarification = { needed: false, question: null, options: [] };

  if (isReactAuditAmbiguous(query, options)) {
    intent = REACT_AUDIT_INTENTS.AMBIGUOUS;
    pipelinePath = REACT_AUDIT_PIPELINE_PATHS.CLARIFY;
    clarification = {
      needed: true,
      question:
        "Tu veux un avis produit/UX sur l'organisation des menus (sidebar, réglages), ou un audit technique React (React Doctor) sur le code du front ?",
      options: [
        "Avis UX — regrouper / déplacer des entrées de menu",
        "Audit React Doctor — repo, diff ou score santé",
        "Les deux — d'abord UX puis audit code",
      ],
    };
  } else if (isReactAuditScoreOnlyRequest(query)) {
    intent = REACT_AUDIT_INTENTS.SCORE_ONLY;
    pipelinePath = REACT_AUDIT_PIPELINE_PATHS.SCORE;
    scanMode = "score_only";
  } else if (isReactAuditDiffRequest(query)) {
    intent = REACT_AUDIT_INTENTS.DIFF_SCAN;
    pipelinePath = REACT_AUDIT_PIPELINE_PATHS.DIFF;
    scanMode = "diff";
  }

  const diffMatch = String(query).match(/\b(?:vs|contre|diff)\s+(main|master|develop)\b/i);

  return {
    $schema: "react-audit-contract/v1",
    family: "react_audit",
    intent,
    contract: REACT_AUDIT_CONTRACT_ID,
    version: 1,
    target: {
      rootPath,
      workspaceProject: null,
      framework: hasReactStackSignal(query) ? "react" : null,
      reactVersion: null,
      confidence: rootPath ? 0.86 : 0.62,
    },
    scan: {
      mode: scanMode,
      diffBase: scanMode === "diff" ? diffMatch?.[1] || "main" : null,
      verbose: scanMode !== "score_only",
      scoreOnly: scanMode === "score_only",
      offline: Boolean(options.offlineFlagSupported),
      noTelemetry: true,
      noScore: true,
      json: true,
      cli: "npx -y react-doctor@latest",
      cliArgs: buildReactAuditCliArgs(query, options),
    },
    constraints: {
      maxDiagnostics: 40,
      severityFloor: "warning",
      categories: [
        "state_effects",
        "performance",
        "architecture",
        "security",
        "accessibility",
      ],
      language: "fr",
    },
    resolution: {
      strategy: "react_doctor_cli",
      reason: hasReactAuditPhrase(query)
        ? "react_audit_phrase_detected"
        : "react_stack_detected",
    },
    routing: {
      plan: clarification.needed ? "A" : "B",
      pipelinePath,
      mode: RESPONSE_MODES.SIMPLE_FAST,
      triageIntent: "code_review",
      forbidWebSearch: true,
      forbidComposer: true,
      forbidDocumentRequest: true,
      forbiddenPaths: [...REACT_AUDIT_FORBIDDEN_PATHS],
      envelope: "deterministic_presentation",
      executionPhase: "g48_2_pending",
    },
    clarification,
  };
}

/**
 * @typedef {ReturnType<typeof classifyReactAuditContract>} ReactAuditContract
 */
