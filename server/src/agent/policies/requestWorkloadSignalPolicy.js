/**
 * WorkloadSignal — pré-comptage des unités de travail avant orchestration.
 * Invariant : explicit_unit_count doit être préservé jusqu’au plan d’exécution.
 */
import { normalizeFamiliarityQuery } from "../utils/familiarityIntentGuards.js";

export const WORKLOAD_SIGNAL_RULE = "request_workload_signal_v1";

const NUMBERED_SPLIT_RE = /\d+\s*[-–.)]\s+/;
const EXPLICIT_COUNT_RE =
  /\b(?:fait|fais|fais[- ]?moi|je\s+veux|j['’]ai|il\s+y\s+a|voici)\s+(\d+)\s+(?:choses?\s+à\s+faire|taches?|tâches?|points?|items?|etapes?|étapes?|tableaux?|sujets?)\b/i;
const EXPLICIT_COUNT_ALT_RE =
  /\b(\d+)\s+(?:choses?\s+à\s+faire|taches?|tâches?)\b/i;
const TABLE_RE = /\btableau(?:x)?\b/i;
const SCHEMA_RE = /\b(?:schema|schéma|diagramme)\b/i;
const EXPLAIN_RE =
  /\b(?:explique|expliquer|expliquant|explication|details?|détails?|concept)\b/i;

/**
 * Extrait un libellé de cible depuis un segment libre (hors glossaire).
 * @param {string} segment
 * @returns {string}
 */
export function extractFreeformUnitTarget(segment = "") {
  const raw = String(segment || "").trim();
  const patterns = [
    /\b(?:expliquant|expliquer|explique)\s+(?:le\s+|la\s+|l['’]|les\s+|un\s+|une\s+|du\s+|des\s+|de\s+la\s+|de\s+)?(.+?)(?:\s*[?.!]|$)/i,
    /\bconcept\s+(?:de\s+l['’]|de\s+la\s+|du\s+|des\s+|de\s+)(.+?)(?:\s*[?.!]|$)/i,
    /\bcycle\s+de\s+vie\s+(?:d['’]une?\s+|de\s+la\s+|du\s+|des\s+|de\s+)(.+?)(?:\s*[?.!]|$)/i,
    /\bsujet\s*:\s*(.+?)(?:\s*[?.!]|$)/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) {
      const label = normalizeFamiliarityQuery(m[1])
        .replace(
          /\b(?:sous forme de tableau|en tableau|detaille|détaillé|en detail|en détail)\b/gi,
          "",
        )
        .replace(/\s+/g, " ")
        .trim();
      if (label.length >= 2) return label.slice(0, 80);
    }
  }

  const stripped = normalizeFamiliarityQuery(raw)
    .replace(
      /^(?:tu dois|il faut|fais|fait|je veux|peux tu|pourrais tu)\b/i,
      "",
    )
    .replace(
      /\b(?:faire un tableau|un tableau|avec des details|avec des détails|expliquant)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 80) || "sujet";
}

/**
 * @param {string} segment
 * @param {{ globalTable?: boolean, globalSchema?: boolean }} [ctx]
 */
function inferUnitShape(segment, ctx = {}) {
  const n = normalizeFamiliarityQuery(segment);
  const asTable = TABLE_RE.test(n) || Boolean(ctx.globalTable);
  const asSchema = SCHEMA_RE.test(n) || Boolean(ctx.globalSchema);
  const action = EXPLAIN_RE.test(n) || asTable || asSchema ? "explain" : "task";
  return {
    action,
    format: asTable ? "table" : asSchema ? "schema" : null,
  };
}

/**
 * @param {string} query
 * @returns {{
 *   rule: string,
 *   explicit_unit_count: number,
 *   stated_count: number|null,
 *   units: Array<{
 *     index: number,
 *     action: string,
 *     format: string|null,
 *     target: string,
 *     segment: string,
 *     subject: string,
 *     label: string,
 *   }>,
 *   extraction_mode: string,
 *   confidence: number,
 *   must_plan_units: boolean,
 *   must_preserve_all_units: boolean,
 *   cardinality_ok: boolean,
 * }}
 */
export function resolveRequestWorkloadSignal(query = "") {
  const raw = String(query || "").trim();
  const empty = {
    rule: WORKLOAD_SIGNAL_RULE,
    explicit_unit_count: 0,
    stated_count: null,
    units: [],
    extraction_mode: "none",
    confidence: 0,
    must_plan_units: false,
    must_preserve_all_units: false,
    cardinality_ok: true,
  };
  if (!raw || raw.length < 8) return empty;

  const q = normalizeFamiliarityQuery(raw);
  const statedMatch = raw.match(EXPLICIT_COUNT_RE) || raw.match(EXPLICIT_COUNT_ALT_RE);
  const stated_count = statedMatch?.[1] ? Number(statedMatch[1]) : null;

  const globalTable = TABLE_RE.test(q);
  const globalSchema = SCHEMA_RE.test(q);

  const parts = raw
    .split(NUMBERED_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);

  const segments = [];
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (seg.length < 8) continue;
    // Préambule « fait N tableaux / choses à faire » — même si le mot « tableau » y figure
    const isCountPreamble =
      /^(?:fait|fais|fais[- ]?moi|voici)\s+\d+\s+(?:choses?\s+à\s+faire|taches?|tâches?|tableaux?|sujets?|points?|items?)\b/i.test(
        seg.trim(),
      ) && !EXPLAIN_RE.test(seg);
    if (isCountPreamble) continue;
    if (
      i === 0 &&
      stated_count &&
      !EXPLAIN_RE.test(seg) &&
      !/\b(?:expliquant|expliquer|explique|tu dois|il faut)\b/i.test(seg)
    ) {
      continue;
    }
    segments.push(seg);
  }

  const units = [];
  const seen = new Set();
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const shape = inferUnitShape(segment, { globalTable, globalSchema });
    const looksLikeTask =
      shape.format ||
      EXPLAIN_RE.test(segment) ||
      /\b(?:tu dois|il faut|fais|fait)\b/i.test(segment);
    if (!looksLikeTask && segments.length < 2) continue;

    const target = extractFreeformUnitTarget(segment);
    const subject = target;
    const key = normalizeFamiliarityQuery(subject);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    units.push({
      index: units.length + 1,
      action: shape.action,
      format: shape.format || (globalTable ? "table" : null),
      target,
      subject,
      segment,
      label: target,
    });
  }

  let extraction_mode = "none";
  if (units.length >= 2 && stated_count) {
    extraction_mode = "explicit_count_and_numbered_list";
  } else if (units.length >= 2) {
    extraction_mode = "explicit_numbered_list";
  } else if (stated_count && stated_count >= 2) {
    extraction_mode = "explicit_count_only";
  }

  const explicit_unit_count = Math.max(
    units.length,
    Number.isFinite(stated_count) ? stated_count : 0,
  );

  const cardinality_ok =
    !stated_count || stated_count === units.length;

  const confidence =
    extraction_mode === "explicit_count_and_numbered_list" && cardinality_ok
      ? 0.96
      : extraction_mode === "explicit_numbered_list"
        ? 0.9
        : extraction_mode === "explicit_count_only"
          ? 0.55
          : units.length === 1
            ? 0.7
            : 0;

  return {
    rule: WORKLOAD_SIGNAL_RULE,
    explicit_unit_count,
    stated_count: Number.isFinite(stated_count) ? stated_count : null,
    units,
    extraction_mode,
    confidence,
    must_plan_units: explicit_unit_count >= 2,
    must_preserve_all_units: explicit_unit_count >= 2,
    cardinality_ok: Boolean(cardinality_ok),
  };
}

/**
 * @param {ReturnType<typeof resolveRequestWorkloadSignal>} signal
 * @returns {string}
 */
export function formatWorkloadSignalSummary(signal) {
  if (!signal || !signal.explicit_unit_count) return "units=0";
  return [
    `units=${signal.explicit_unit_count}`,
    `parsed=${signal.units?.length || 0}`,
    `mode=${signal.extraction_mode}`,
    `preserve=${signal.must_preserve_all_units ? "yes" : "no"}`,
    `card_ok=${signal.cardinality_ok ? "yes" : "no"}`,
  ].join(" ");
}
