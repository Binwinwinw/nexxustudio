/**
 * Migration short-circuits → cycle cognitif factorisé.
 * Doctrine : aucun handler terminal sans contribution aux 4 blocs.
 */
import { COGNITIVE_CYCLE_RULE } from "../conversation/conversationQueryUnderstanding.js";

export const SHORT_CIRCUIT_COGNITIVE_CYCLE_RULE =
  "short_circuit_cognitive_cycle_v1";

const SOCIAL_PATH_PREFIXES = ["social", "phatic", "greeting"];
const DATETIME_PATH_MARKERS = ["datetime", "time_lookup", "date_lookup"];
const MATH_SIMPLE_PATHS = new Set([
  "math_arithmetic_deterministic",
  "math_simple_deterministic",
  "math_composite_deterministic",
]);
const META_PATH_PREFIXES = [
  "meta_",
  "assistant_repair",
  "meta_feedback",
  "meta_conversation",
];

/**
 * @param {string} path
 */
function isSocialShortCircuitPath(path = "") {
  const p = String(path || "").toLowerCase();
  return SOCIAL_PATH_PREFIXES.some((prefix) => p.includes(prefix));
}

/**
 * @param {string} path
 */
function isDatetimeShortCircuitPath(path = "") {
  const p = String(path || "").toLowerCase();
  return (
    p === "datetime_deterministic" ||
    DATETIME_PATH_MARKERS.some((marker) => p.includes(marker))
  );
}

/**
 * @param {string} path
 */
function isMathSimpleShortCircuitPath(path = "") {
  return MATH_SIMPLE_PATHS.has(String(path || ""));
}

/**
 * @param {string} path
 */
function isMetaShortCircuitPath(path = "") {
  const p = String(path || "").toLowerCase();
  return META_PATH_PREFIXES.some((prefix) => p.startsWith(prefix) || p.includes(prefix));
}

/**
 * @param {string} path
 * @param {object} hit
 */
function resolveShortCircuitFamily(path = "", hit = {}) {
  if (hit.socialPatternMatched || isSocialShortCircuitPath(path)) {
    return {
      familyId: "social_deterministic",
      primaryDomain: "social",
      batch: "social",
    };
  }
  if (isDatetimeShortCircuitPath(path)) {
    return {
      familyId: "datetime_deterministic",
      primaryDomain: "datetime",
      batch: "datetime",
    };
  }
  if (isMathSimpleShortCircuitPath(path)) {
    return {
      familyId: "math_simple",
      primaryDomain: "math",
      batch: "math_simple",
    };
  }
  if (isMetaShortCircuitPath(path)) {
    return {
      familyId: "meta_assistant_behavior",
      primaryDomain: "meta",
      batch: "meta",
    };
  }
  return {
    familyId: path || "short_circuit",
    primaryDomain: "unknown",
    batch: "generic",
  };
}

/**
 * @param {object} hit
 * @returns {object|null}
 */
export function buildShortCircuitCognitiveContribution(hit = {}) {
  const path = hit.path || "unknown";
  const family = resolveShortCircuitFamily(path, hit);

  if (hit.deferToFullPipeline || hit.deferToLlm) {
    return {
      rule: COGNITIVE_CYCLE_RULE,
      source: "short_circuit_defer",
      shortCircuitPath: path,
      migrationBatch: family.batch,
      intent_assessment: {
        familyId: family.familyId,
        primaryDomain: family.primaryDomain,
        path,
        shortCircuitPath: path,
        responseStrategy: "full_pipeline",
      },
      evidence_requirement: {
        level: hit.preferWebResearch ? "medium" : "low",
        why: ["short_circuit_defer_to_full_pipeline"],
        freshnessSensitive: Boolean(hit.preferWebResearch),
        comparative: false,
        explicitWebRequested: false,
      },
      retrieval_decision: {
        needsExternalInfo: Boolean(hit.preferWebResearch),
        sourceKind: hit.preferWebResearch ? "web" : "none",
        why: hit.preferWebResearch
          ? "short_circuit_defer_web"
          : "short_circuit_defer_local",
        webQuery: null,
        riskIfSkipped: hit.preferWebResearch ? "medium" : "low",
      },
      response_commitment: {
        kind: family.familyId,
        renderMode: "defer_full_pipeline",
        deferToFullPipeline: true,
        shortCircuitPath: path,
        forbidClarification: false,
        evidenceAdaptation: "pipeline_required",
      },
    };
  }

  if (!hit.reply) {
    return null;
  }

  return {
    rule: COGNITIVE_CYCLE_RULE,
    source: "short_circuit_deterministic",
    shortCircuitPath: path,
    migrationBatch: family.batch,
    intent_assessment: {
      familyId: family.familyId,
      primaryDomain: family.primaryDomain,
      path,
      shortCircuitPath: path,
      responseStrategy: "deterministic",
    },
    evidence_requirement: {
      level: "none",
      why: ["deterministic_short_circuit"],
      freshnessSensitive: false,
      comparative: false,
      explicitWebRequested: false,
    },
    retrieval_decision: {
      needsExternalInfo: false,
      sourceKind: "none",
      why: "deterministic_no_retrieval",
      webQuery: null,
      riskIfSkipped: "low",
    },
    response_commitment: {
      kind: family.familyId,
      renderMode: "deterministic",
      terminalReply: hit.reply,
      shortCircuitPath: path,
      forbidClarification: true,
      insufficientEvidenceBehavior: null,
      evidenceAdaptation: "not_applicable",
      tone: "direct",
    },
  };
}

/**
 * @param {object|null} hit
 * @returns {object|null}
 */
export function annotateShortCircuitCognitiveCycle(hit) {
  if (!hit) return null;
  const contribution = buildShortCircuitCognitiveContribution(hit);
  if (!contribution) return hit;
  return {
    ...hit,
    cognitive_cycle: contribution,
    cognitiveCycleAuthoritative: Boolean(hit.reply && !hit.deferToFullPipeline),
  };
}

/**
 * Fusionne le cycle amont (understandQuery) avec la contribution short-circuit terminale.
 * @param {object|null} baseCycle
 * @param {object|null} shortCircuitCycle
 */
export function mergeAgentCycleWithShortCircuit(baseCycle, shortCircuitCycle) {
  if (!shortCircuitCycle) return baseCycle || null;
  if (!baseCycle) return shortCircuitCycle;

  return {
    rule: baseCycle.rule || shortCircuitCycle.rule,
    understanding: baseCycle.understanding,
    intent_assessment: {
      ...baseCycle.intent_assessment,
      ...shortCircuitCycle.intent_assessment,
    },
    evidence_requirement: {
      ...baseCycle.evidence_requirement,
      ...shortCircuitCycle.evidence_requirement,
    },
    retrieval_decision: {
      ...baseCycle.retrieval_decision,
      ...shortCircuitCycle.retrieval_decision,
    },
    response_commitment: {
      ...baseCycle.response_commitment,
      ...shortCircuitCycle.response_commitment,
    },
    short_circuit_authoritative: true,
    shortCircuitPath: shortCircuitCycle.shortCircuitPath,
    plan: baseCycle.plan,
  };
}
