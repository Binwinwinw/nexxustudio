/**
 * Télémétrie GUIDED_CREATION_SCOPING — contraintes extraites + discipline clarification.
 */
import {
  extractCreationConstraints,
  GUIDED_CREATION_SCOPING_CONTRACT_ID,
  isGuidedCreationScopingRequest,
} from "../policies/guidedCreationScopingPolicy.js";
import { normalizeFamiliarityQuery } from "../utils/familiarityIntentGuards.js";

export const GUIDED_CREATION_MAX_BLOCKING_QUESTIONS = 2;

const GENERIC_TAXONOMY_RE =
  /\b(?:sharepoint|wordpress|wix|webflow|squarespace|shopify|drupal|joomla|intranet|extranet|vitrine|espace collaboratif)\b/i;

const PREFAB_MATRIX_RE =
  /\b(?:3 approches|trois approches|je partirais plut[oô]t sur|rag\s*\+\s*r[eè]gles|approche interm[eé]diaire)\b/i;

const CONCRETE_NEXT_STEP_RE =
  /\b(?:prochaine [eé]tape|on peut commencer|pour d[eé]marrer|structure|plan|fichier|module|composant|interface|crud|json|python|html)\b/i;

/**
 * @param {string} text
 * @returns {number}
 */
export function countBlockingQuestions(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return 0;

  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  let explicit = 0;

  for (const line of lines) {
    if (!line.includes("?")) continue;
    if (/^\s*\d+[\).:\-]/.test(line)) {
      explicit++;
      continue;
    }
    if (
      /\b(?:dis[- ]?moi|pr[eé]cise|quel(?:le)?s?|souhaites|veux[- ]tu|pr[eé]f[eè]res|as[- ]tu|avant de|j['']ai (?:juste )?besoin)\b/i.test(
        line,
      )
    ) {
      explicit++;
    }
  }

  const questionSentences = (raw.match(/[^.!?\n]{8,}\?/g) || []).map((s) =>
    s.trim(),
  );

  return Math.max(explicit, Math.min(questionSentences.length, 6));
}

/**
 * @param {string} blob
 * @param {{ key: string, value: string }} constraint
 */
function constraintCitedInResponse(blob, constraint) {
  const blobL = String(blob || "").toLowerCase();
  const value = String(constraint.value || "").toLowerCase();
  const tokens = value
    .split(/[\s/,.-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  return tokens.some((token) => blobL.includes(token));
}

/**
 * @param {string} text
 * @param {string} query
 * @param {Array<{ key: string, value: string }>} [constraints]
 */
export function analyzeGuidedCreationResponse(
  text = "",
  query = "",
  constraints = [],
) {
  const q = normalizeFamiliarityQuery(query).toLowerCase();
  const blob = String(text || "");
  const blocking_questions_count = countBlockingQuestions(blob);
  /** @type {string[]} */
  const drift_signals = [];

  if (
    GENERIC_TAXONOMY_RE.test(blob) &&
    !GENERIC_TAXONOMY_RE.test(q)
  ) {
    drift_signals.push("generic_taxonomy");
  }
  if (PREFAB_MATRIX_RE.test(blob)) {
    drift_signals.push("prefab_matrix");
  }
  if (blocking_questions_count > GUIDED_CREATION_MAX_BLOCKING_QUESTIONS) {
    drift_signals.push("question_budget_exceeded");
  }
  if (constraints.length > 0) {
    const cited = constraints.filter((c) => constraintCitedInResponse(blob, c));
    if (cited.length === 0) {
      drift_signals.push("constraints_not_cited");
    }
  }
  const has_concrete_next_step = CONCRETE_NEXT_STEP_RE.test(blob);

  return {
    blocking_questions_count,
    drift_signals,
    has_concrete_next_step,
    question_budget_ok:
      blocking_questions_count <= GUIDED_CREATION_MAX_BLOCKING_QUESTIONS,
    contract_compliant:
      drift_signals.length === 0 &&
      blocking_questions_count <= GUIDED_CREATION_MAX_BLOCKING_QUESTIONS,
  };
}

/**
 * @param {string} query
 */
export function buildGuidedCreationRouteTelemetry(query = "") {
  const constraints = extractCreationConstraints(query);
  return {
    contract_id: GUIDED_CREATION_SCOPING_CONTRACT_ID,
    constraints_extracted: constraints.map((c) => `${c.key}:${c.value}`),
    constraints_count: constraints.length,
  };
}

/**
 * @param {string} query
 * @param {ReturnType<import('./conversationQueryUnderstanding.js').understandQuery>} [understanding]
 * @returns {string|null}
 */
export function resolveGuidedCreationIntentContractId(
  understanding,
  query = "",
) {
  const segmentQuery =
    understanding?.intents?.find(
      (item) =>
        (item.domain === "code" || item.domain === "web_html") &&
        !item.absorbable,
    )?.segment || query;

  if (isGuidedCreationScopingRequest(segmentQuery || query)) {
    return GUIDED_CREATION_SCOPING_CONTRACT_ID;
  }
  return null;
}

/**
 * @param {{
 *   query?: string,
 *   text?: string,
 *   phase?: "route"|"served",
 *   pipelinePath?: string,
 *   turnTelemetry?: { setMetric?: (key: string, value: unknown) => void }|null,
 *   pipelineTelemetryCtx?: object|null,
 * }} ctx
 */
export function recordGuidedCreationScopingTelemetry(ctx = {}) {
  const query = String(ctx.query || "");
  const phase = ctx.phase || "served";
  const constraints = extractCreationConstraints(query);
  const route = buildGuidedCreationRouteTelemetry(query);

  if (ctx.pipelineTelemetryCtx) {
    ctx.pipelineTelemetryCtx.guidedCreationScoping = {
      ...(ctx.pipelineTelemetryCtx.guidedCreationScoping || {}),
      ...route,
      phase,
    };
  }

  ctx.turnTelemetry?.setMetric?.("guided_creation_contract", route.contract_id);
  ctx.turnTelemetry?.setMetric?.(
    "constraints_extracted",
    route.constraints_extracted,
  );
  ctx.turnTelemetry?.setMetric?.("constraints_count", route.constraints_count);

  if (phase === "route") return route;

  const analysis = analyzeGuidedCreationResponse(ctx.text, query, constraints);
  if (ctx.pipelineTelemetryCtx?.guidedCreationScoping) {
    Object.assign(ctx.pipelineTelemetryCtx.guidedCreationScoping, analysis);
  }

  ctx.turnTelemetry?.setMetric?.(
    "blocking_questions_count",
    analysis.blocking_questions_count,
  );
  ctx.turnTelemetry?.setMetric?.("guided_creation_drift", analysis.drift_signals);
  ctx.turnTelemetry?.setMetric?.(
    "guided_creation_compliant",
    analysis.contract_compliant,
  );
  ctx.turnTelemetry?.setMetric?.(
    "guided_creation_has_next_step",
    analysis.has_concrete_next_step,
  );

  if (analysis.drift_signals.length > 0) {
    console.warn(
      `[GUIDED_CREATION_SCOPING] drift signals=${analysis.drift_signals.join(",")} ` +
        `questions=${analysis.blocking_questions_count} path=${ctx.pipelinePath || "unknown"}`,
    );
  }

  return { ...route, ...analysis };
}

/**
 * @param {string} query
 * @param {{ meta?: object }} [packet]
 */
export function shouldRecordGuidedCreationTelemetry(query = "", packet = {}) {
  if (packet?.meta?.intent_contract_id === GUIDED_CREATION_SCOPING_CONTRACT_ID) {
    return true;
  }
  return isGuidedCreationScopingRequest(query);
}
