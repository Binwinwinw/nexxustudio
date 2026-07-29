/**
 * G40.2 — execution lock code_concept_explain (rail terminal Plan B).
 * G40.3 — glossaire local si SIMPLE_FAST échoue.
 */
import { isCodeConceptExplainRequest } from "./codeConceptExplainPolicy.js";
import {
  buildSpecVsMiniSpecGlossaryReply,
  resolveCodeConceptGlossaryFallback,
  CODE_CONCEPT_GLOSSARY_SOURCES,
} from "./codeConceptGlossaryPolicy.js";
import {
  composeMannerReply,
  RESPONSE_MANNER_FAMILIES,
} from "../responseMannerPolicy.js";

export const CODE_CONCEPT_EXPLAIN_PIPELINE_PATH = "code_concept_explain";
export const CODE_CONCEPT_EXPLAIN_FALLBACK_PIPELINE_PATH =
  "code_concept_explain_fallback";

export const CODE_CONCEPT_EXECUTION_PATHS = Object.freeze({
  TECHNICAL_OVERVIEW_TERMINAL: "technical_overview_terminal",
  TECHNICAL_OVERVIEW_VALIDATED: "technical_overview_validated",
  SIMPLE_FAST_FALLBACK: "code_concept_simple_fast_fallback",
  GLOSSARY_FALLBACK: "code_concept_glossary_fallback",
  GLOSSARY_DIRECT: "code_concept_glossary_direct",
  COMPOSER_LEAK_BLOCKED: "code_concept_composer_leak_blocked",
  COMPOSER_LEAK: "code_concept_composer_leak",
});

export const CODE_CONCEPT_CONTRACT_VIOLATIONS = Object.freeze({
  COMPOSER_ESCALATION_BLOCKED: "code_concept_composer_escalation_blocked",
  SIMPLE_FAST_FAILED: "code_concept_simple_fast_failed",
});

/**
 * @param {object|null} shortCircuit
 * @param {object|null} pipelineTelemetryCtx
 * @returns {boolean}
 */
export function isCodeConceptExplainExecution(shortCircuit = null, pipelineTelemetryCtx = null) {
  if (shortCircuit?.codeConceptExplain) return true;
  if (
    shortCircuit?.technicalOverview &&
    shortCircuit?.codeConceptExplainDriven
  ) {
    return true;
  }
  const telem = pipelineTelemetryCtx?.codeConceptExplainExecution;
  return Boolean(telem?.code_concept_explain);
}

/**
 * @param {object|null} shortCircuit
 * @param {object|null} pipelineTelemetryCtx
 * @param {string} [query]
 * @returns {boolean}
 */
export function shouldEnforceCodeConceptExplainTerminalLock(
  shortCircuit = null,
  pipelineTelemetryCtx = null,
  query = "",
) {
  if (isCodeConceptExplainExecution(shortCircuit, pipelineTelemetryCtx)) return true;
  return Boolean(query && isCodeConceptExplainRequest(query));
}

/**
 * @param {string} query
 * @param {{ conceptLabel?: string|null, history?: object[] }} [ctx]
 * @returns {{ text: string, source: string, conceptKey: string|null, conceptFallbackUsed: boolean }}
 */
export function buildCodeConceptExplainFallbackReply(query = "", ctx = {}) {
  const glossaryHit = resolveCodeConceptGlossaryFallback(query, {
    conceptLabel: ctx.conceptLabel || null,
    history: ctx.history || [],
    preferDirect: false,
  });
  if (glossaryHit?.text) {
    return glossaryHit;
  }

  const label = ctx.conceptLabel || extractCodeConceptExplainSubject(query) || "ce concept";
  return {
    text: composeMannerReply({
      family: RESPONSE_MANNER_FAMILIES.FALLBACK_RETRY_SOFT,
      slots: { conceptLabel: label },
      history: ctx.history || [],
      salt: label,
    }),
    source: CODE_CONCEPT_GLOSSARY_SOURCES.FAILURE,
    conceptKey: null,
    conceptFallbackUsed: true,
  };
}

/**
 * @param {string} query
 * @param {{ conceptLabel?: string|null }} [ctx]
 * @returns {string}
 * @deprecated Préférer buildCodeConceptExplainFallbackReply (G40.3 + G41).
 */
export function buildCodeConceptExplainSoberFallback(query = "", ctx = {}) {
  return buildCodeConceptExplainFallbackReply(query, ctx).text;
}

/**
 * @param {Error|{ message?: string }} error
 * @param {object|null} shortCircuit
 * @returns {object|null}
 */
export function resolveCodeConceptExplainCatchOutcome(error = null, shortCircuit = null) {
  if (!isCodeConceptExplainExecution(shortCircuit)) return null;
  return {
    pipelinePath: CODE_CONCEPT_EXPLAIN_FALLBACK_PIPELINE_PATH,
    reason: CODE_CONCEPT_CONTRACT_VIOLATIONS.SIMPLE_FAST_FAILED,
    executionPath: CODE_CONCEPT_EXECUTION_PATHS.SIMPLE_FAST_FALLBACK,
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
export function resolveCodeConceptComposerGateOutcome(
  shortCircuit = null,
  pipelineTelemetryCtx = null,
  query = "",
) {
  if (!shouldEnforceCodeConceptExplainTerminalLock(shortCircuit, pipelineTelemetryCtx, query)) {
    return null;
  }
  return {
    pipelinePath: CODE_CONCEPT_EXPLAIN_FALLBACK_PIPELINE_PATH,
    reason: CODE_CONCEPT_CONTRACT_VIOLATIONS.COMPOSER_ESCALATION_BLOCKED,
    executionPath: CODE_CONCEPT_EXECUTION_PATHS.COMPOSER_LEAK_BLOCKED,
    composerBypassed: true,
    contractViolation: CODE_CONCEPT_CONTRACT_VIOLATIONS.COMPOSER_ESCALATION_BLOCKED,
    validationIssues: ["composer_escalation_blocked"],
  };
}

/**
 * @param {{
 *   pipelineTelemetryCtx?: object|null,
 *   turnTelemetry?: { setMetric?: (key: string, value: unknown) => void }|null,
 *   executionPath?: string,
 *   composerBypassed?: boolean,
 *   validationIssues?: string[],
 *   contractViolation?: string|null,
 *   errorMessage?: string|null,
 *   conceptFallbackUsed?: boolean,
 *   conceptSource?: string|null,
 *   conceptKeyResolved?: string|null,
 * }} ctx
 */
export function recordCodeConceptExplainExecutionTelemetry(ctx = {}) {
  const payload = {
    code_concept_execution_path: ctx.executionPath || null,
    composer_bypassed: Boolean(ctx.composerBypassed),
    code_concept_validation_issues: [...(ctx.validationIssues || [])],
    code_concept_contract_violation: ctx.contractViolation || null,
    code_concept_error_message: ctx.errorMessage || null,
    code_concept_explain: true,
    concept_fallback_used: Boolean(ctx.conceptFallbackUsed),
    concept_source: ctx.conceptSource || null,
    concept_key_resolved: ctx.conceptKeyResolved || null,
  };

  if (ctx.pipelineTelemetryCtx) {
    ctx.pipelineTelemetryCtx.codeConceptExplainExecution = payload;
  }

  if (payload.code_concept_execution_path) {
    ctx.turnTelemetry?.setMetric?.(
      "code_concept_execution_path",
      payload.code_concept_execution_path,
    );
  }
  ctx.turnTelemetry?.setMetric?.("composer_bypassed", payload.composer_bypassed);
  if (payload.code_concept_validation_issues.length) {
    ctx.turnTelemetry?.setMetric?.(
      "code_concept_validation_issues",
      payload.code_concept_validation_issues.join(","),
    );
  }
  if (payload.code_concept_contract_violation) {
    ctx.turnTelemetry?.setMetric?.(
      "code_concept_contract_violation",
      payload.code_concept_contract_violation,
    );
    console.warn(
      `[CODE_CONCEPT_G40.2] contract_violation=${payload.code_concept_contract_violation} ` +
        `execution_path=${payload.code_concept_execution_path}`,
    );
  }

  if (payload.concept_fallback_used) {
    ctx.turnTelemetry?.setMetric?.("concept_fallback_used", true);
    ctx.turnTelemetry?.setMetric?.("concept_source", payload.concept_source);
    if (payload.concept_key_resolved) {
      ctx.turnTelemetry?.setMetric?.(
        "concept_key_resolved",
        payload.concept_key_resolved,
      );
    }
  }

  return payload;
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildCodeConceptExplainSystemAddon(query = "") {
  const subject = extractCodeConceptExplainSubject(query) || "le concept demandé";
  return [
    "VARIANTE EXPLICATION CONCEPT CODE/SYNTAXE (G40.2 — borné, factuel) :",
    `- Concept visé : **${subject}**.`,
    "FORMAT STRICT (3 à 6 phrases, prose continue) :",
    "1) Définition claire du rôle ou de la fonction.",
    "2) Mécanisme principal ou syntaxe typique (1–2 exemples courts si utile).",
    "3) Cas d'usage courant ou piège à éviter (optionnel, 1 phrase).",
    "INTERDIT :",
    "- Demander un document, un passage collé ou un fichier joint.",
    "- Livrer un script complet non demandé.",
    "- Rubriques encyclopédiques artificielles.",
    "- Escalade vers recherche web ou orchestrateur.",
    "- Réponse au-delà de 6 phrases.",
  ].join("\n");
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractCodeConceptExplainSubject(query = "") {
  if (!isCodeConceptExplainRequest(query)) return null;
  const q = String(query || "")
    .replace(/[«»""]/g, "")
    .trim();

  const patterns = [
    /\b(?:exemple|example)\s+(?:d['']?une?\s+|de\s+(?:la\s+|l['']?)?)?(fonction|function)\b/i,
    /\b(fonction|function)\s+(?:en|in)\s+(?:php|python|javascript|js)\b/i,
    /\b(?:qu['']?est[- ]ce qu['']?(?:une?|un)|qu est ce qu (?:une?|un))\s+(mini[- ]?spec|specification|spec|adr)\b/i,
    /\b(?:c['']?est quoi|c est quoi)\s+(?:une?\s+|un\s+)?(mini[- ]?spec|specification|spec|adr)\b/i,
    /\b(?:role|rôle)\s+(?:de|d')\s*<?([a-z][a-z0-9]*)>?/i,
    /\b(?:resume|resumé|résumé)\s+(?:du|de\s+la|de\s+l|d)?\s*(?:role|rôle)\s+(?:de|d')\s*<?([a-z][a-z0-9]*)>?/i,
    /\b(?:difference|différence|différences)\s+entre\s+([a-z]+)\s+et\s+([a-z]+)/i,
    /\b(?:explique|expliquer|a quoi sert|à quoi sert)\s+(?:la |le |les |l')?<?([a-z][a-z0-9_-]*)>?/i,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match?.[1]) {
      if (match[2]) return `${match[1]} vs ${match[2]}`;
      const raw = String(match[1]).trim().toLowerCase();
      return raw === "fonction" ? "function" : raw;
    }
  }

  const token = q.match(
    /\b(import|async|await|def|class|const|let|var|div|span|function|fonction)\b/i,
  );
  if (!token) return null;
  const raw = token[0].toLowerCase();
  return raw === "fonction" ? "function" : raw;
}

/**
 * @param {string} query
 * @returns {object|null}
 */
export function resolveCodeConceptExplainShortCircuit(query = "") {
  if (!isCodeConceptExplainRequest(query)) return null;

  const dualSpec = buildSpecVsMiniSpecGlossaryReply(query);
  if (dualSpec) {
    return {
      path: "code_concept_glossary_direct",
      deferToLlm: false,
      reply: dualSpec,
      technicalOverview: false,
      codeConceptExplain: true,
      codeConceptExplainDriven: true,
      glossaryDirect: true,
      conceptKey: "process:spec+mini_spec",
      conceptLabel: "spec / mini-spec",
      conceptSource: CODE_CONCEPT_GLOSSARY_SOURCES.GLOSSARY,
      explanationRegister: "simple_first",
      step: "📖 Explication simple — spec / mini-spec (pédagogique)...",
      enforce: { allowRefusal: false, sectionedComposite: true },
    };
  }

  const subject = extractCodeConceptExplainSubject(query);
  const glossaryHit = resolveCodeConceptGlossaryFallback(query, {
    conceptLabel: subject,
    preferDirect: true,
  });

  if (glossaryHit?.text && glossaryHit.conceptKey) {
    return {
      path: "code_concept_glossary_direct",
      deferToLlm: false,
      reply: glossaryHit.text,
      technicalOverview: false,
      codeConceptExplain: true,
      codeConceptExplainDriven: true,
      glossaryDirect: true,
      conceptKey: glossaryHit.conceptKey,
      conceptLabel: subject,
      conceptSource: CODE_CONCEPT_GLOSSARY_SOURCES.GLOSSARY,
      step: "📖 Explication concept — glossaire local (G40.4, instantané)...",
      enforce: { allowRefusal: false },
    };
  }

  const reflectiveHint = buildCodeConceptExplainSystemAddon(query);

  return {
    path: "technical_overview",
    deferToLlm: true,
    technicalOverview: true,
    codeConceptExplain: true,
    codeConceptExplainDriven: true,
    reflectiveHint,
    conceptLabel: subject,
    step: "💡 Explication concept — réponse directe (G40.2, sans orchestrateur)...",
  };
}
