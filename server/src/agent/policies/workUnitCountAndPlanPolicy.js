/**
 * WorkUnitCountAndPlanPolicy — boucle amont bornée :
 * Count → Reconcile → Normalize → Plan → (exécute seulement si verrouillé).
 * Le parallèle ne vient qu’après stabilisation du plan.
 */
import { normalizeFamiliarityQuery } from "../utils/familiarityIntentGuards.js";
import { resolveRequestWorkloadSignal } from "./requestWorkloadSignalPolicy.js";

export const WORK_UNIT_COUNT_AND_PLAN_CONTRACT = "WORK_UNIT_COUNT_AND_PLAN_V1";
export const WORK_UNIT_COUNT_AND_PLAN_RULE = "work_unit_count_and_plan_v1";

/** Modes d’exécution (orchestration, pas rails métier). */
export const WORK_UNIT_EXECUTION_MODES = Object.freeze({
  SINGLE_UNIT: "single_unit",
  MULTI_UNIT_SEQUENTIAL: "multi_unit_sequential",
  MULTI_UNIT_PARALLEL: "multi_unit_parallel",
  BLOCKED_CLARIFY: "blocked_clarify",
  NONE: "none",
});

/** Cycle de vie attendu par unité (contrat, pas runtime async). */
export const WORK_UNIT_LIFECYCLE = Object.freeze([
  "start",
  "execute",
  "validate",
  "retry",
  "complete",
]);

/** Budget parallèle soft (aligné lots pédagogiques). */
export const MAX_PARALLEL_WORK_UNITS = 4;

const DETAILED_RE =
  /\b(?:en detail|en détail|detaille|détaillé|approfond|avec des details|avec des détails)\b/i;
const SHORT_RE =
  /\b(?:en bref|resume court|résumé court|version courte|simplement)\b/i;
const DEPENDENT_CHAIN_RE =
  /\b(?:puis|ensuite|après(?:\s+ça)?|alors|à partir de|en te basant(?:\s+sur)?|compare|comparer|versus|vs\.?|résume la|resume la|synthétise|synthetise|à l['’]aide de)\b/i;
const DEPENDENT_REF_RE =
  /\b(?:la comparaison|ce qui précède|précédent|ci-dessus|plus haut|le résultat précédent|à partir de (?:ça|cela|ce qui))\b/i;

/**
 * @param {ReturnType<typeof resolveRequestWorkloadSignal>} workload
 * @returns {{
 *   declared_count: number|null,
 *   parsed_count: number,
 *   reconciled_count: number|null,
 *   confidence: number,
 *   ok: boolean,
 *   reason: string|null,
 * }}
 */
export function reconcileUnitCounts(workload) {
  const declared =
    Number.isFinite(workload?.stated_count) ? Number(workload.stated_count) : null;
  const parsed = Array.isArray(workload?.units) ? workload.units.length : 0;

  if (parsed === 0 && !declared) {
    return {
      declared_count: null,
      parsed_count: 0,
      reconciled_count: null,
      confidence: 0,
      ok: true,
      reason: "no_units",
    };
  }

  if (declared != null && parsed === 0) {
    return {
      declared_count: declared,
      parsed_count: 0,
      reconciled_count: null,
      confidence: 0.2,
      ok: false,
      reason: "declared_without_parsed",
    };
  }

  if (declared != null && parsed > 0 && declared !== parsed) {
    return {
      declared_count: declared,
      parsed_count: parsed,
      reconciled_count: null,
      confidence: 0.35,
      ok: false,
      reason: "declared_parsed_mismatch",
    };
  }

  const reconciled = parsed > 0 ? parsed : declared;
  const confidence =
    declared != null && declared === parsed
      ? Math.max(0.92, Number(workload?.confidence) || 0)
      : parsed >= 2
        ? Math.max(0.85, Number(workload?.confidence) || 0)
        : parsed === 1
          ? 0.75
          : 0.5;

  return {
    declared_count: declared,
    parsed_count: parsed,
    reconciled_count: reconciled,
    confidence: Number(confidence.toFixed(3)),
    ok: true,
    reason: declared != null ? "declared_matches_parsed" : "parsed_only",
  };
}

/**
 * @param {string} segment
 * @param {number} index
 * @param {string} fullQuery
 * @returns {boolean}
 */
export function isWorkUnitIndependent(segment = "", index = 0, fullQuery = "") {
  const seg = String(segment || "");
  if (DEPENDENT_REF_RE.test(seg)) return false;
  if (index > 0 && DEPENDENT_CHAIN_RE.test(seg)) return false;
  // Chaîne globale « explique A, compare A et B, puis résume »
  if (
    index > 0 &&
    DEPENDENT_CHAIN_RE.test(fullQuery) &&
    /\b(?:compare|comparer|résume|resume|synthétise|synthetise)\b/i.test(seg)
  ) {
    return false;
  }
  return true;
}

/**
 * @param {object[]} rawUnits
 * @param {string} query
 * @returns {Array<{
 *   id: string,
 *   index: number,
 *   primary_action: string,
 *   target: string,
 *   output_format: string|null,
 *   depth: string|null,
 *   independent: boolean,
 *   segment: string,
 *   subject: string,
 * }>}
 */
export function normalizeWorkUnits(rawUnits = [], query = "") {
  const list = Array.isArray(rawUnits) ? rawUnits : [];
  return list.map((u, i) => {
    const segment = u.segment || "";
    const n = normalizeFamiliarityQuery(segment);
    let depth = null;
    if (DETAILED_RE.test(n)) depth = "detailed";
    else if (SHORT_RE.test(n)) depth = "short";

    return {
      id: `u${i + 1}`,
      index: i + 1,
      primary_action: u.action || "task",
      target: u.target || u.subject || "sujet",
      output_format: u.format || null,
      depth,
      independent: isWorkUnitIndependent(segment, i, query),
      segment,
      subject: u.subject || u.target || "sujet",
    };
  });
}

/**
 * @param {object[]} units
 * @param {{ reconcileOk?: boolean, maxParallel?: number }} [opts]
 * @returns {{
 *   mode: string,
 *   parallelism: { eligible: boolean, reason: string },
 * }}
 */
export function resolveWorkUnitExecutionMode(units = [], opts = {}) {
  const list = Array.isArray(units) ? units : [];
  const maxParallel = Number(opts.maxParallel) || MAX_PARALLEL_WORK_UNITS;

  if (opts.reconcileOk === false) {
    return {
      mode: WORK_UNIT_EXECUTION_MODES.BLOCKED_CLARIFY,
      parallelism: { eligible: false, reason: "reconcile_failed" },
    };
  }

  if (list.length === 0) {
    return {
      mode: WORK_UNIT_EXECUTION_MODES.NONE,
      parallelism: { eligible: false, reason: "no_units" },
    };
  }

  if (list.length === 1) {
    return {
      mode: WORK_UNIT_EXECUTION_MODES.SINGLE_UNIT,
      parallelism: { eligible: false, reason: "single_unit" },
    };
  }

  const allIndependent = list.every((u) => u.independent !== false);
  const withinBudget = list.length <= maxParallel;
  const formats = new Set(list.map((u) => u.output_format || "none"));
  const compatibleContracts = formats.size <= 2;

  if (allIndependent && withinBudget && compatibleContracts) {
    return {
      mode: WORK_UNIT_EXECUTION_MODES.MULTI_UNIT_PARALLEL,
      parallelism: {
        eligible: true,
        reason: "all_independent_within_budget",
      },
    };
  }

  let reason = "default_sequential";
  if (!allIndependent) reason = "dependency_detected";
  else if (!withinBudget) reason = "over_parallel_budget";
  else if (!compatibleContracts) reason = "incompatible_output_contracts";

  return {
    mode: WORK_UNIT_EXECUTION_MODES.MULTI_UNIT_SEQUENTIAL,
    parallelism: { eligible: false, reason },
  };
}

/**
 * Message de clarification si cardinalité non verrouillée.
 * @param {{ declared_count: number|null, parsed_count: number, reason?: string|null }} count
 * @returns {string}
 */
export function buildWorkUnitCardinalityClarifyReply(count) {
  const declared = count?.declared_count;
  const parsed = count?.parsed_count ?? 0;
  if (declared != null && parsed === 0) {
    return [
      `Tu as annoncé **${declared}** éléments à traiter, mais je n’ai pas pu isoler les sous-tâches.`,
      "Peux-tu les numéroter clairement ? Ex. : `1 - … 2 - …`",
    ].join("\n");
  }
  return [
    `Tu as annoncé **${declared}** éléments, mais j’en ai isolé **${parsed}**.`,
    "Je préfère verrouiller le plan avant d’exécuter.",
    "Confirme le bon découpage (ou reformule en liste numérotée 1 / 2 / 3…).",
  ].join("\n");
}

/**
 * Point d’entrée — plan verrouillé avant orchestration.
 * @param {string} query
 * @param {{
 *   workload?: ReturnType<typeof resolveRequestWorkloadSignal>|null,
 *   maxParallel?: number,
 * }} [options]
 */
export function resolveWorkUnitCountAndPlan(query = "", options = {}) {
  const raw = String(query || "").trim();
  const workload =
    options.workload || resolveRequestWorkloadSignal(raw);

  const count = reconcileUnitCounts(workload);
  // Normaliser même en mismatch (diagnostic / preview), mais execution_allowed=false.
  const units = normalizeWorkUnits(workload.units || [], raw);

  const blocked = !count.ok;
  const { mode, parallelism } = resolveWorkUnitExecutionMode(units, {
    reconcileOk: !blocked,
    maxParallel: options.maxParallel,
  });

  const finalMode = blocked
    ? WORK_UNIT_EXECUTION_MODES.BLOCKED_CLARIFY
    : mode;

  const unit_count = blocked
    ? count.parsed_count || count.declared_count || 0
    : count.reconciled_count || units.length;

  const all_units_accounted_for =
    !blocked &&
    unit_count > 0 &&
    units.length === unit_count &&
    (count.declared_count == null || count.declared_count === units.length);

  const execution_allowed =
    !blocked &&
    finalMode !== WORK_UNIT_EXECUTION_MODES.NONE &&
    finalMode !== WORK_UNIT_EXECUTION_MODES.BLOCKED_CLARIFY &&
    all_units_accounted_for;

  return {
    contract: WORK_UNIT_COUNT_AND_PLAN_CONTRACT,
    rule: WORK_UNIT_COUNT_AND_PLAN_RULE,
    unit_count,
    count,
    units,
    mode: finalMode,
    all_units_accounted_for,
    execution_allowed,
    parallelism: blocked
      ? { eligible: false, reason: count.reason || "reconcile_failed" }
      : parallelism,
    unit_lifecycle: [...WORK_UNIT_LIFECYCLE],
    must_preserve_all_units: Boolean(workload.must_preserve_all_units),
    workload_extraction_mode: workload.extraction_mode,
    clarify_reply: blocked ? buildWorkUnitCardinalityClarifyReply(count) : null,
    telemetry: {
      source: "work_unit_count_and_plan",
      declared: count.declared_count,
      parsed: count.parsed_count,
      reconciled: count.reconciled_count,
      mode: finalMode,
      parallel_eligible: Boolean(parallelism.eligible) && !blocked,
    },
  };
}

/**
 * @param {ReturnType<typeof resolveWorkUnitCountAndPlan>} plan
 * @returns {string}
 */
export function formatWorkUnitCountAndPlanSummary(plan) {
  if (!plan) return "none";
  return [
    `units=${plan.unit_count}`,
    `mode=${plan.mode}`,
    `accounted=${plan.all_units_accounted_for ? "yes" : "no"}`,
    `exec=${plan.execution_allowed ? "yes" : "no"}`,
    `parallel=${plan.parallelism?.eligible ? "yes" : "no"}`,
    `conf=${plan.count?.confidence ?? "?"}`,
  ].join(" ");
}
