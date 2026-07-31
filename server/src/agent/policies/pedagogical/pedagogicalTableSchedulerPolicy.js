/**
 * Scheduler pédagogique multi-tableaux — lots, hybride local/LLM, validation par unité.
 */
import {
  PEDAGOGICAL_TABLE_HEADERS,
  validatePedagogicalTableResponse,
} from "../../../../../shared/pedagogicalTableContract.js";
import {
  buildLexiconPedagogicalSchemaReply,
  buildPedagogicalMultiTableSystemAddon,
  isPedagogicalStructuredExplainRequest,
  parsePedagogicalStructuredUnits,
  pedagogicalSubjectLabel,
} from "./lexiconExplainLightPolicy.js";
import { resolveRequestWorkloadSignal } from "../workload/index.js";
import {
  resolveWorkUnitCountAndPlan,
  WORK_UNIT_EXECUTION_MODES,
} from "../workload/index.js";

/**
 * Invariant cardinalité : demandé (WorkloadSignal) = planifié (unités parse).
 * @param {ReturnType<typeof resolveRequestWorkloadSignal>} workload
 * @param {object[]} units
 * @returns {{ ok: boolean, expected: number, planned: number, reason?: string }}
 */
export function assertPedagogicalWorkloadCardinality(workload, units = []) {
  const planned = Array.isArray(units) ? units.length : 0;
  const expected = Math.max(
    Number(workload?.units?.length) || 0,
    Number(workload?.stated_count) || 0,
  );
  if (!workload?.must_preserve_all_units || expected < 2) {
    return { ok: true, expected: expected || planned, planned };
  }
  if (planned < expected) {
    return {
      ok: false,
      expected,
      planned,
      reason: "planned_lt_requested",
    };
  }
  if (
    workload.stated_count &&
    planned !== workload.stated_count &&
    planned !== workload.units.length
  ) {
    return {
      ok: false,
      expected: workload.stated_count,
      planned,
      reason: "stated_count_mismatch",
    };
  }
  return { ok: true, expected, planned };
}

export const MAX_PEDAGOGICAL_UNITS_PER_BATCH = 4;
export const MAX_PEDAGOGICAL_UNITS_AUTO = 8;

export const PEDAGOGICAL_BATCH_MODES = Object.freeze({
  SINGLE_BATCH: "single_batch",
  MULTI_BATCH_AUTO: "multi_batch_auto",
  MULTI_BATCH_CONFIRMED: "multi_batch_confirmed",
});

const CONTINUE_RE =
  /^(?:continue|continues|continuer|vas[- ]?y|allez[- ]?y|ok|okay|oui|ouais|go|suivant|lot suivant|encore)\b/i;
const AFFIRM_RE =
  /^(?:oui|ouais|ok|okay|vas[- ]?y|allez[- ]?y|go|d['’]accord|dac|je confirme|confirme|commence|démarrer|demarrer)\b/i;

/**
 * @param {number} unitCount
 * @returns {string}
 */
export function resolvePedagogicalBatchMode(unitCount = 0) {
  const n = Number(unitCount) || 0;
  if (n <= MAX_PEDAGOGICAL_UNITS_PER_BATCH) {
    return PEDAGOGICAL_BATCH_MODES.SINGLE_BATCH;
  }
  if (n <= MAX_PEDAGOGICAL_UNITS_AUTO) {
    return PEDAGOGICAL_BATCH_MODES.MULTI_BATCH_AUTO;
  }
  return PEDAGOGICAL_BATCH_MODES.MULTI_BATCH_CONFIRMED;
}

/**
 * Résout une unité localement (déterministe + validation).
 * @param {{ subject: string, format?: string }} unit
 * @param {number} globalIndex
 * @returns {{ status: "validated"|"missing"|"failed", globalIndex: number, unit: object, block?: string, failures?: string[] }}
 */
export function resolvePedagogicalUnitLocally(unit, globalIndex) {
  const format = unit?.format === "schema" ? "schema" : "table";
  const body = buildLexiconPedagogicalSchemaReply(unit.subject, { format });
  if (!body) {
    return { status: "missing", globalIndex, unit };
  }
  if (format === "table") {
    const validation = validatePedagogicalTableResponse(body, {
      minRows: 5,
      headers: PEDAGOGICAL_TABLE_HEADERS,
    });
    if (!validation.ok) {
      return {
        status: "failed",
        globalIndex,
        unit,
        failures: validation.failures,
      };
    }
  }
  const label = pedagogicalSubjectLabel(unit.subject);
  return {
    status: "validated",
    globalIndex,
    unit,
    block: [`### ${globalIndex}. ${label}`, "", body].join("\n"),
  };
}

/**
 * @param {string} text
 * @returns {number} index max ### N. trouvé
 */
export function countDeliveredPedagogicalUnitIndex(text = "") {
  let max = 0;
  const re = /^#{1,3}\s*(\d+)\./gm;
  let m;
  while ((m = re.exec(String(text || ""))) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/**
 * @param {object[]} history
 * @returns {number}
 */
export function countDeliveredPedagogicalUnitsFromHistory(history = []) {
  let max = 0;
  for (const turn of history || []) {
    if (turn?.role !== "assistant") continue;
    max = Math.max(max, countDeliveredPedagogicalUnitIndex(turn.content));
  }
  return max;
}

/**
 * @param {object[]} history
 * @returns {string|null}
 */
export function findLatestMultiTableUserQuery(history = []) {
  for (let i = (history || []).length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn?.role !== "user") continue;
    const units = parsePedagogicalStructuredUnits(turn.content || "");
    if (units.length >= 2) return String(turn.content || "");
  }
  return null;
}

/**
 * @param {object[]} history
 * @returns {boolean}
 */
export function lastAssistantAwaitingPedagogicalConfirm(history = []) {
  for (let i = (history || []).length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn?.role !== "assistant") continue;
    const t = String(turn.content || "");
    return (
      /lots de\s*4/i.test(t) &&
      /réponds\s+\*\*oui\*\*|réponds oui|pour démarrer|pour demarrer/i.test(t)
    );
  }
  return false;
}

function buildProgressFooter({ delivered, total, nextStart, nextEnd, auto }) {
  if (delivered >= total) {
    return `\n\n---\n✅ **Progression** : ${total}/${total} traités.`;
  }
  const verb = auto
    ? `Dis **continue** pour le lot suivant (tableaux ${nextStart}–${nextEnd}).`
    : `Dis **continue** pour poursuivre (tableaux ${nextStart}–${nextEnd}).`;
  return [
    "",
    "---",
    `⏳ **Progression** : ${delivered}/${total} traités.`,
    verb,
  ].join("\n");
}

function buildConfirmReply(units) {
  const mode = resolvePedagogicalBatchMode(units.length);
  const preview = units
    .slice(0, MAX_PEDAGOGICAL_UNITS_PER_BATCH)
    .map((u, i) => `${i + 1}. ${pedagogicalSubjectLabel(u.subject)}`)
    .join("\n");
  return [
    `Tu as demandé **${units.length} tableaux pédagogiques**.`,
    `Pour garder qualité et lisibilité, je les traite par **lots de ${MAX_PEDAGOGICAL_UNITS_PER_BATCH}**.`,
    "",
    "**Lot 1** (si tu confirmes) :",
    preview,
    units.length > MAX_PEDAGOGICAL_UNITS_PER_BATCH
      ? `\n… puis ${units.length - MAX_PEDAGOGICAL_UNITS_PER_BATCH} autre(s) ensuite.`
      : "",
    "",
    "Réponds **oui** / **vas-y** pour démarrer le premier lot.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Assemble un lot : hybride local + file LLM pour les manquants du lot seulement.
 * @param {object[]} units
 * @param {{ offset?: number, confirmed?: boolean }} [opts]
 */
export function planPedagogicalBatchExecution(units = [], opts = {}) {
  const list = Array.isArray(units) ? units : [];
  const offset = Math.max(0, Number(opts.offset) || 0);
  const confirmed = Boolean(opts.confirmed);
  const mode = resolvePedagogicalBatchMode(list.length);
  const total = list.length;

  if (!total) return null;

  if (
    mode === PEDAGOGICAL_BATCH_MODES.MULTI_BATCH_CONFIRMED &&
    !confirmed &&
    offset === 0
  ) {
    return {
      kind: "confirm",
      mode,
      total,
      units: list,
      reply: buildConfirmReply(list),
    };
  }

  const batch = list.slice(offset, offset + MAX_PEDAGOGICAL_UNITS_PER_BATCH);
  if (!batch.length) return null;

  const localBlocks = [];
  const needLlm = [];
  for (let i = 0; i < batch.length; i++) {
    const globalIndex = offset + i + 1;
    const resolved = resolvePedagogicalUnitLocally(batch[i], globalIndex);
    if (resolved.status === "validated") localBlocks.push(resolved);
    else needLlm.push({ ...batch[i], globalIndex, reason: resolved.status });
  }

  const nextOffset = offset + batch.length;
  const remaining = list.slice(nextOffset);
  // Après lot complet (local+llm), delivered = nextOffset
  const deliveredWhenBatchComplete = nextOffset;

  return {
    kind: "execute",
    mode,
    total,
    units: list,
    batch,
    offset,
    nextOffset,
    remaining,
    localBlocks,
    needLlm,
    done: remaining.length === 0,
    progressFooter: buildProgressFooter({
      delivered: deliveredWhenBatchComplete,
      total,
      nextStart: nextOffset + 1,
      nextEnd: Math.min(total, nextOffset + MAX_PEDAGOGICAL_UNITS_PER_BATCH),
      auto: mode === PEDAGOGICAL_BATCH_MODES.MULTI_BATCH_AUTO,
    }),
    // used if only local published this turn (LLM pending): approximate
    localOnlyFooter: buildProgressFooter({
      delivered: Math.min(total, offset + localBlocks.length),
      total,
      nextStart: offset + localBlocks.length + 1,
      nextEnd: Math.min(total, offset + MAX_PEDAGOGICAL_UNITS_PER_BATCH),
      auto: mode === PEDAGOGICAL_BATCH_MODES.MULTI_BATCH_AUTO,
    }),
  };
}

/**
 * Construit la réponse short-circuit à partir d’un plan d’exécution.
 * @param {ReturnType<typeof planPedagogicalBatchExecution>} plan
 * @returns {object|null}
 */
export function materializePedagogicalBatchPlan(plan) {
  if (!plan) return null;

  if (plan.kind === "confirm") {
    return {
      path: "lexicon_science_format_table_budget_confirm",
      reply: plan.reply,
      deferToLlm: false,
      explanationRegister: "illustrated",
      outputFormat: "table",
      pedagogicalStructuredExplain: true,
      pedagogicalBatchMode: plan.mode,
      responseContract: {
        type: "table",
        multi: true,
        budgetConfirm: true,
        subjects: plan.units.map((u) => u.subject),
        totalUnits: plan.total,
        batchSize: MAX_PEDAGOGICAL_UNITS_PER_BATCH,
      },
      step: `📚 Éducation structurée — budget ${plan.total} tableaux (confirmation)...`,
    };
  }

  if (plan.kind !== "execute") return null;

  const localMarkdown = plan.localBlocks.map((b) => b.block).join("\n\n---\n\n");
  const intro =
    plan.offset === 0
      ? plan.needLlm.length === 0
        ? plan.total <= MAX_PEDAGOGICAL_UNITS_PER_BATCH
          ? `Voici **${plan.localBlocks.length} tableaux pédagogiques** demandés :`
          : `Voici le **lot ${Math.floor(plan.offset / MAX_PEDAGOGICAL_UNITS_PER_BATCH) + 1}** (${plan.localBlocks.length} tableau(x) sur ${plan.total}) :`
        : `Voici le **lot** — ${plan.localBlocks.length} tableau(x) locaux sur ${plan.batch.length} de ce lot (${plan.total} au total) :`
      : `Suite — **lot** (unités ${plan.offset + 1}–${plan.nextOffset} sur ${plan.total}) :`;

  // Tout local dans le lot → réponse déterministe complète du lot
  if (plan.needLlm.length === 0) {
    const reply = [intro, "", localMarkdown, plan.done ? "" : plan.progressFooter]
      .filter(Boolean)
      .join("\n");
    return {
      path:
        plan.total > MAX_PEDAGOGICAL_UNITS_PER_BATCH
          ? "lexicon_science_format_table_multi_batch_deterministic"
          : "lexicon_science_format_table_multi_deterministic",
      reply,
      deferToLlm: false,
      explanationRegister: "illustrated",
      outputFormat: "table",
      pedagogicalStructuredExplain: true,
      pedagogicalBatchMode: plan.mode,
      responseContract: {
        type: "table",
        multi: true,
        minRows: 5,
        headers: [...PEDAGOGICAL_TABLE_HEADERS],
        completenessRequired: true,
        domain: "science_education",
        subjects: plan.batch.map((u) => u.subject),
        totalUnits: plan.total,
        batchOffset: plan.offset,
        batchSize: plan.batch.length,
        remaining: plan.remaining.length,
      },
      step: plan.done
        ? `📚 Éducation structurée — ${plan.total} tableaux (lot final)...`
        : `📚 Éducation structurée — lot ${plan.offset + 1}–${plan.nextOffset}/${plan.total}...`,
    };
  }

  // Hybride : préfixe local + LLM uniquement pour les manquants du lot
  const llmUnits = plan.needLlm.map((u) => ({
    subject: u.subject,
    format: u.format || "table",
    globalIndex: u.globalIndex,
  }));

  const hybridHint = [
    buildPedagogicalMultiTableSystemAddon(
      llmUnits.map((u) => ({ subject: u.subject, format: u.format })),
    ),
    "",
    "CONTRAINTE HYBRIDE :",
    `- Des tableaux locaux sont DÉJÀ prêts (indices hors ${llmUnits.map((u) => u.globalIndex).join(", ")}).`,
    `- Tu ne génères QUE les tableaux manquants suivants (garde les numéros ### N.) :`,
    ...llmUnits.map(
      (u) =>
        `  - ### ${u.globalIndex}. ${pedagogicalSubjectLabel(u.subject)}`,
    ),
    "- Ne régénère pas les tableaux locaux.",
    plan.done
      ? ""
      : "En fin de réponse, n'ajoute pas de menu — le runtime gère la progression.",
  ]
    .filter(Boolean)
    .join("\n");

  const prefix = localMarkdown
    ? [intro, "", localMarkdown].join("\n")
    : `${intro}\n\n*(Aucun tableau local dans ce lot — génération des unités manquantes.)*`;

  return {
    path: "lexicon_science_format_table_multi_hybrid_llm",
    reply: null,
    deferToLlm: true,
    reflectiveHint: hybridHint,
    pedagogicalHybridPrefix: prefix,
    pedagogicalBatchFooter: plan.done ? "" : plan.progressFooter,
    explanationRegister: "illustrated",
    outputFormat: "table",
    pedagogicalStructuredExplain: true,
    lexiconExplainLight: true,
    lexiconSchoolScienceExplain: true,
    pedagogicalBatchMode: plan.mode,
    responseContract: {
      type: "table",
      multi: true,
      hybrid: true,
      minRows: 5,
      headers: [...PEDAGOGICAL_TABLE_HEADERS],
      completenessRequired: true,
      domain: "science_education",
      subjects: llmUnits.map((u) => u.subject),
      totalUnits: plan.total,
      batchOffset: plan.offset,
      remaining: plan.remaining.length,
    },
    step: `📚 Éducation structurée — lot hybride (${plan.localBlocks.length} local / ${plan.needLlm.length} LLM)...`,
  };
}

/**
 * Continue / confirme un lot pédagogique depuis l’historique.
 * @param {string} query
 * @param {object[]} history
 * @returns {object|null}
 */
export function resolvePedagogicalBatchContinuation(query = "", history = []) {
  const q = String(query || "").trim();
  if (!q || q.length > 80) return null;

  const awaiting = lastAssistantAwaitingPedagogicalConfirm(history);
  const original = findLatestMultiTableUserQuery(history);
  if (!original) return null;

  const units = parsePedagogicalStructuredUnits(original);
  if (units.length < 2) return null;

  if (awaiting && (AFFIRM_RE.test(q) || CONTINUE_RE.test(q))) {
    const plan = planPedagogicalBatchExecution(units, {
      offset: 0,
      confirmed: true,
    });
    return materializePedagogicalBatchPlan(plan);
  }

  if (!CONTINUE_RE.test(q)) return null;

  const delivered = countDeliveredPedagogicalUnitsFromHistory(history);
  if (delivered <= 0 || delivered >= units.length) return null;

  const plan = planPedagogicalBatchExecution(units, {
    offset: delivered,
    confirmed: true,
  });
  return materializePedagogicalBatchPlan(plan);
}

/**
 * Point d’entrée scheduler (multi + solo délégué au caller si null).
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {object|null}
 */
export function resolvePedagogicalScheduledExplain(query = "", options = {}) {
  const history = options.history || [];

  const continuation = resolvePedagogicalBatchContinuation(query, history);
  if (continuation) return continuation;

  if (!isPedagogicalStructuredExplainRequest(query)) return null;
  const workload = resolveRequestWorkloadSignal(query);
  const workUnitPlan = resolveWorkUnitCountAndPlan(query, { workload });

  // Cardinalité non verrouillée → clarifier, ne pas exécuter
  if (
    workUnitPlan.mode === WORK_UNIT_EXECUTION_MODES.BLOCKED_CLARIFY ||
    !workUnitPlan.execution_allowed
  ) {
    if (workload.stated_count && !workload.cardinality_ok) {
      return {
        path: "work_unit_count_clarify",
        reply: workUnitPlan.clarify_reply,
        deferToLlm: false,
        explanationRegister: "direct",
        pedagogicalStructuredExplain: true,
        workUnitPlan: {
          unit_count: workUnitPlan.unit_count,
          mode: workUnitPlan.mode,
          all_units_accounted_for: workUnitPlan.all_units_accounted_for,
          execution_allowed: false,
          parallelism: workUnitPlan.parallelism,
        },
        workloadSignal: {
          explicit_unit_count: workload.explicit_unit_count,
          stated_count: workload.stated_count,
          planned_units: workload.units.length,
          cardinality_ok: false,
          extraction_mode: workload.extraction_mode,
          must_preserve_all_units: workload.must_preserve_all_units,
        },
        step: "📋 Plan unités — cardinalité à clarifier...",
      };
    }
  }

  const units = parsePedagogicalStructuredUnits(query);
  if (units.length < 2) return null;

  const card = assertPedagogicalWorkloadCardinality(workload, units);
  if (!card.ok) {
    console.warn(
      `[PEDAGOGICAL] cardinality_invariant_fail expected=${card.expected} planned=${card.planned} reason=${card.reason}`,
    );
  }

  const mode = resolvePedagogicalBatchMode(units.length);
  const plan = planPedagogicalBatchExecution(units, {
    offset: 0,
    confirmed: mode !== PEDAGOGICAL_BATCH_MODES.MULTI_BATCH_CONFIRMED,
  });
  const materialized = materializePedagogicalBatchPlan(plan);
  if (!materialized) return null;
  return {
    ...materialized,
    workUnitPlan: {
      unit_count: workUnitPlan.unit_count,
      mode: workUnitPlan.mode,
      all_units_accounted_for: workUnitPlan.all_units_accounted_for,
      execution_allowed: workUnitPlan.execution_allowed,
      parallelism: workUnitPlan.parallelism,
    },
    workloadSignal: {
      explicit_unit_count: workload.explicit_unit_count,
      stated_count: workload.stated_count,
      planned_units: units.length,
      cardinality_ok: card.ok,
      extraction_mode: workload.extraction_mode,
      must_preserve_all_units: workload.must_preserve_all_units,
    },
  };
}
