/**
 * G38.2 — execution lock summary/known_entity (rail terminal Plan B).
 *
 * Invariant : pour une œuvre culturelle identifiée, l'absence de signal local
 * fiable ne conclut pas la réponse ; elle déclenche une recherche web obligatoire.
 * La réponse finale reste courte, mais fondée sur une source externe si le local
 * Cadrage validé 2026-08-17. Canon input inchangé. Lots voisins non rouverts.
 */
import {
  SUMMARY_CONTRACTS,
  SUMMARY_INTENTS,
} from "./summaryContractRouter.js";
import { extractCulturalSummarySubject } from "./culturalContentSummaryPolicy.js";

export const KNOWN_ENTITY_PIPELINE_PATH = "cultural_content_summary";
export const KNOWN_ENTITY_FALLBACK_PIPELINE_PATH =
  "cultural_content_summary_fallback";
export const KNOWN_ENTITY_WEB_PIPELINE_PATH = "cultural_content_summary_web";
export const KNOWN_ENTITY_ESCALATE_WEB_CODE = "KNOWN_ENTITY_ESCALATE_WEB";

/** Œuvre identifiée + local absent / faible / non fiable → web obligatoire. */
export const CULTURAL_WORK_WEB_ON_LOCAL_MISS_RULE =
  "cultural_work_local_miss_triggers_mandatory_web";

const LOCAL_REFUSAL_RE =
  /\b(?:synopsis fiable en local|pas de synopsis|je n['’]ai pas de (?:synopsis|resume|résumé)|reformule ou r[eé]essaie)\b/i;

const LOCAL_WEAK_HEDGE_RE =
  /\b(?:je ne (?:connais|sais) pas (?:ce film|cette (?:serie|série|oeuvre|œuvre)|l['’]oeuvre|l['’]œuvre)|connaissances (?:internes|locales) insuffisantes)\b/i;

export const KNOWN_ENTITY_EXECUTION_PATHS = Object.freeze({
  SIMPLE_FAST_TERMINAL: "simple_fast_terminal",
  SIMPLE_FAST_VALIDATED: "simple_fast_validated",
  SIMPLE_FAST_FALLBACK: "simple_fast_fallback",
  WEB_ESCALATION: "web_escalation",
  COMPOSER_LEAK_BLOCKED: "composer_leak_blocked",
  COMPOSER_LEAK: "composer_leak",
});

export const KNOWN_ENTITY_CONTRACT_VIOLATIONS = Object.freeze({
  COMPOSER_ESCALATION_BLOCKED: "known_entity_composer_escalation_blocked",
  SIMPLE_FAST_FAILED: "known_entity_simple_fast_failed",
  LOCAL_INEFFECTIVE: "known_entity_local_ineffective",
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
  if (shortCircuit?.preferWebResearch || shortCircuit?.deferToFullPipeline) {
    return false;
  }
  return isKnownEntityDirectSummaryExecution(shortCircuit, pipelineTelemetryCtx);
}

/**
 * Requête web bornée : sujet + type d’œuvre + synopsis.
 * @param {string} query
 * @param {{ summaryContract?: object|null, summaryContractTelemetry?: object|null }} [ctx]
 * @returns {string|null}
 */
export function buildKnownEntitySummaryWebQuery(query = "", ctx = {}) {
  const subject =
    ctx.summaryContract?.entity?.label ||
    ctx.summaryContractTelemetry?.entityLabel ||
    extractCulturalSummarySubject(query);
  if (!subject) return null;
  const kind = ctx.summaryContract?.entity?.kind || ctx.summaryContractTelemetry?.entityKind;
  const typeHint =
    kind === "series" || /\b(?:serie|series|série)\b/i.test(query)
      ? "serie film"
      : kind === "book" || /\b(?:livre|roman|book)\b/i.test(query)
        ? "livre"
        : "film";
  return `${subject} ${typeHint} synopsis`;
}

/**
 * Miss local → web obligatoire (film / œuvre), pas le refus « synopsis en local ».
 * @param {object|null} shortCircuit
 * @param {string} [query]
 * @returns {object|null}
 */
export function resolveKnownEntityWebEscalation(shortCircuit = null, query = "") {
  if (!isKnownEntityDirectSummaryExecution(shortCircuit)) return null;
  const webQuery = buildKnownEntitySummaryWebQuery(query, {
    summaryContract: shortCircuit?.summaryContract,
    summaryContractTelemetry: shortCircuit?.summaryContractTelemetry,
  });
  return {
    pipelinePath: KNOWN_ENTITY_WEB_PIPELINE_PATH,
    reason: KNOWN_ENTITY_CONTRACT_VIOLATIONS.LOCAL_INEFFECTIVE,
    executionPath: KNOWN_ENTITY_EXECUTION_PATHS.WEB_ESCALATION,
    preferWebResearch: true,
    deferToFullPipeline: true,
    webQuery,
    composerBypassed: false,
    validationIssues: ["known_entity_local_ineffective"],
  };
}

/**
 * @param {object|null} shortCircuit
 * @param {object|null} outcome
 */
export function stampKnownEntityWebEscalation(shortCircuit, outcome) {
  if (!shortCircuit || !outcome?.preferWebResearch) return shortCircuit;
  shortCircuit.deferToFullPipeline = true;
  shortCircuit.preferWebResearch = true;
  if (outcome.webQuery) shortCircuit.webQueryOverride = outcome.webQuery;
  shortCircuit.path = outcome.pipelinePath;
  return shortCircuit;
}

/**
 * Local absent, refus « pas de synopsis », ou confiance trop faible.
 * Un synopsis court factuel n'est pas un miss.
 * @param {string} reply
 * @returns {{ ineffective: boolean, reasons: string[], rule: string }}
 */
export function assessKnownEntityLocalSummary(reply = "") {
  const body = String(reply || "").trim();
  const reasons = [];
  if (!body || body.length < 40) reasons.push("absent");
  if (body && LOCAL_REFUSAL_RE.test(body)) reasons.push("local_refusal");
  if (
    body &&
    LOCAL_WEAK_HEDGE_RE.test(body) &&
    countSummarySentences(body) <= 2
  ) {
    reasons.push("weak_confidence");
  }
  return {
    ineffective: reasons.length > 0,
    reasons,
    rule: CULTURAL_WORK_WEB_ON_LOCAL_MISS_RULE,
  };
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
export function resolveKnownEntitySummaryCatchOutcome(
  error = null,
  shortCircuit = null,
  query = "",
) {
  if (!isKnownEntityDirectSummaryExecution(shortCircuit)) return null;
  const web = resolveKnownEntityWebEscalation(shortCircuit, query);
  return {
    ...(web || {
      pipelinePath: KNOWN_ENTITY_FALLBACK_PIPELINE_PATH,
      reason: KNOWN_ENTITY_CONTRACT_VIOLATIONS.SIMPLE_FAST_FAILED,
      executionPath: KNOWN_ENTITY_EXECUTION_PATHS.SIMPLE_FAST_FALLBACK,
      composerBypassed: true,
    }),
    validationIssues: [
      "simple_fast_execution_failed",
      ...(web ? ["known_entity_local_ineffective"] : []),
    ],
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
  query = "",
) {
  if (!isKnownEntityDirectSummaryExecution(shortCircuit, pipelineTelemetryCtx)) {
    return null;
  }
  if (shortCircuit?.preferWebResearch || shortCircuit?.deferToFullPipeline) {
    return null;
  }

  const web = resolveKnownEntityWebEscalation(shortCircuit, query);
  return {
    escalateWeb: true,
    ...(web || {
      pipelinePath: KNOWN_ENTITY_FALLBACK_PIPELINE_PATH,
      reason: KNOWN_ENTITY_CONTRACT_VIOLATIONS.COMPOSER_ESCALATION_BLOCKED,
      executionPath: KNOWN_ENTITY_EXECUTION_PATHS.COMPOSER_LEAK_BLOCKED,
      composerBypassed: true,
    }),
    contractViolation: web
      ? KNOWN_ENTITY_CONTRACT_VIOLATIONS.LOCAL_INEFFECTIVE
      : KNOWN_ENTITY_CONTRACT_VIOLATIONS.COMPOSER_ESCALATION_BLOCKED,
    validationIssues: web
      ? ["known_entity_local_ineffective"]
      : ["composer_escalation_blocked"],
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
