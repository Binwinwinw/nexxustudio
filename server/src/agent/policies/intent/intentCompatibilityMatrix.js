/**
 * Matrice de compatibilité IntentComposition P0 — primary × secondary × contraintes.
 */

export const DROP_REASONS = Object.freeze({
  INCOMPATIBLE: "incompatible",
  LOW_CONFIDENCE: "low_confidence",
  BUDGET_EXCEEDED: "budget_exceeded",
  DOWNGRADED_TO_FOLLOWUP: "downgraded_to_followup",
  ABSORBED_AS_CONSTRAINT: "absorbed_as_constraint",
});

/** Secondaires autorisés pour une primary donnée. */
const PRIMARY_SECONDARY_ALLOW = Object.freeze({
  explain: new Set(["summarize", "cite_sources", "compare"]),
  compare: new Set(["explain", "summarize", "cite_sources"]),
  correct: new Set(["explain", "summarize"]),
  summarize: new Set(["translate", "cite_sources"]),
  generate: new Set(["explain", "cite_sources"]),
  structure: new Set(["cite_sources", "summarize"]),
  calculate: new Set(["explain"]),
  advise: new Set(["compare", "summarize"]),
  translate: new Set(["summarize"]),
});

/** Contraintes de format compatibles avec primary. */
const PRIMARY_FORMAT_ALLOW = Object.freeze({
  explain: new Set(["table", "schema", "list", "prose", null]),
  compare: new Set(["table", "list", "prose", null]),
  summarize: new Set(["list", "prose", null]),
  correct: new Set(["prose", "code", null]),
  generate: new Set(["code", "prose", "list", null]),
  calculate: new Set(["prose", "list", null]),
  advise: new Set(["list", "prose", null]),
  translate: new Set(["prose", null]),
});

/**
 * @param {string|null} primary
 * @param {string} secondary
 * @returns {boolean}
 */
export function isSecondaryCompatibleWithPrimary(primary, secondary) {
  if (!primary || !secondary) return false;
  const allowed = PRIMARY_SECONDARY_ALLOW[primary];
  return Boolean(allowed?.has(secondary));
}

/**
 * @param {string|null} primary
 * @param {string|null} format
 * @returns {boolean}
 */
export function isFormatCompatibleWithPrimary(primary, format) {
  if (!format) return true;
  if (!primary) return true;
  const allowed = PRIMARY_FORMAT_ALLOW[primary];
  if (!allowed) return true;
  return allowed.has(format);
}

/**
 * @param {string|null} depth
 * @param {string} query
 * @returns {boolean}
 */
export function hasDepthContradiction(depth, query = "") {
  const q = String(query || "");
  const wantsDetailed =
    depth === "detailed" ||
    /\b(?:en detail|en détail|detaille|détaillé|approfond)\b/i.test(q);
  const wantsUltraShort =
    /\b(?:ultra[- ]?court|en 1 phrase|une seule phrase|tres court|très court|en deux mots)\b/i.test(
      q,
    );
  return wantsDetailed && wantsUltraShort;
}

/**
 * @param {string|null} primary
 * @param {string[]} secondaries
 * @param {{ maxSecondary?: number }} [opts]
 * @returns {{ kept: string[], dropped: { label: string, reason: string }[] }}
 */
export function filterSecondaryActions(primary, secondaries = [], opts = {}) {
  const maxSecondary = Number(opts.maxSecondary) > 0 ? Number(opts.maxSecondary) : 2;
  const kept = [];
  const dropped = [];
  for (const sec of secondaries) {
    if (!sec) continue;
    if (!isSecondaryCompatibleWithPrimary(primary, sec)) {
      dropped.push({ label: sec, reason: DROP_REASONS.INCOMPATIBLE });
      continue;
    }
    if (kept.length >= maxSecondary) {
      dropped.push({ label: sec, reason: DROP_REASONS.DOWNGRADED_TO_FOLLOWUP });
      continue;
    }
    kept.push(sec);
  }
  return { kept, dropped };
}

/**
 * @param {{
 *   primary: string|null,
 *   secondaries: string[],
 *   format: string|null,
 *   depth: string|null,
 *   query?: string,
 *   droppedCount?: number,
 * }} input
 * @returns {{ score: number, clarification_required: boolean, clarify_reason: string|null }}
 */
export function scoreCompositionCompatibility(input = {}) {
  const primary = input.primary || null;
  const secondaries = Array.isArray(input.secondaries) ? input.secondaries : [];
  const format = input.format ?? null;
  const depth = input.depth ?? null;
  const query = input.query || "";
  const droppedCount = Number(input.droppedCount) || 0;

  if (!primary) {
    return {
      score: 0.4,
      clarification_required: false,
      clarify_reason: null,
    };
  }

  let score = 0.85;
  let clarification_required = false;
  let clarify_reason = null;

  if (!isFormatCompatibleWithPrimary(primary, format)) {
    score -= 0.35;
    clarification_required = true;
    clarify_reason = "format_incompatible_with_primary";
  }

  if (hasDepthContradiction(depth, query)) {
    score -= 0.4;
    clarification_required = true;
    clarify_reason = "depth_contradiction";
  }

  for (const sec of secondaries) {
    if (!isSecondaryCompatibleWithPrimary(primary, sec)) {
      score -= 0.2;
    }
  }

  score -= Math.min(0.25, droppedCount * 0.05);
  score = Math.max(0, Math.min(1, Number(score.toFixed(3))));

  return { score, clarification_required, clarify_reason };
}
