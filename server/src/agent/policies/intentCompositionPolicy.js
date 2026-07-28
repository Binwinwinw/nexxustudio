/**
 * IntentCompositionPolicy P0 — observe / télémétrie + composition gouvernée.
 * Une requête = plan (social + primary + secondaires + contraintes), pas multi-rail naïf.
 */
import { INTENT_ACTIONS } from "../../../../shared/justIntentCatalog.js";
import { normalizeFamiliarityQuery } from "../utils/familiarityIntentGuards.js";
import {
  DROP_REASONS,
  filterSecondaryActions,
  hasDepthContradiction,
  scoreCompositionCompatibility,
} from "./intentCompatibilityMatrix.js";
import {
  isPedagogicalStructuredExplainRequest,
  parsePedagogicalStructuredUnits,
  buildLexiconScienceTakeawayReply,
  pedagogicalSubjectLabel,
} from "./lexiconExplainLightPolicy.js";
import { resolveRequestWorkloadSignal } from "./requestWorkloadSignalPolicy.js";
import { shouldDeferSocialRouting } from "./voiceContinuityPolicy.js";

export const INTENT_COMPOSITION_CONTRACT = "INTENT_COMPOSITION_V1";
export const INTENT_COMPOSITION_RULE = "intent_composition_policy_p0_observe";

const GREETING_RE =
  /^(?:bonjour|salut|hello|coucou|hey|bonsoir|yo|yop)\b/i;
const THANKS_RE = /\b(?:merci|thanks|thx)\b/i;
const TABLE_RE = /\btableau(?:x)?\b/i;
const SCHEMA_RE = /\b(?:schema|schéma|diagramme)\b/i;
const SUMMARIZE_RE =
  /\b(?:resume|résume|resume[- ]?moi|résume[- ]?moi|en\s+3\s+lignes|en\s+trois\s+lignes|mini[- ]?resume|mini[- ]?résumé|synthese|synthèse)\b/i;
const SOURCES_RE =
  /\b(?:sources?|references?|références?|cite|citation|bibliographie|avec\s+sources)\b/i;
const DETAILED_RE =
  /\b(?:en detail|en détail|detaille|détaillé|approfond)\b/i;
const SHORT_RE =
  /\b(?:en bref|resume court|résumé court|version courte|simplement)\b/i;
const COMPARE_RE = /\b(?:compare|comparer|versus|vs\.?|difference|différence)\b/i;
const CORRECT_RE = /\b(?:corrige|corriger|fix|repare|répare)\b/i;
const CALCULATE_RE = /\b(?:calcule|calculer|combien)\b/i;
const EXPLAIN_RE =
  /\b(?:explique|expliquer|explication|c['’]est quoi|dis[- ]?moi|pourrais[- ]?tu expliquer)\b/i;
const GENERATE_RE = /\b(?:genere|génère|genérer|créer|cree|écris|ecris|fais[- ]?moi)\b/i;

/**
 * @param {string} query
 * @returns {string[]}
 */
function detectSocial(query = "") {
  const q = String(query || "").trim();
  const social = [];
  if (GREETING_RE.test(q)) social.push("greeting");
  if (THANKS_RE.test(q)) social.push("thanks");
  return social;
}

/**
 * @param {string} query
 * @returns {{ format: string|null, depth: string|null, absorbed: { label: string, reason: string }[] }}
 */
function detectOutputConstraints(query = "") {
  const q = normalizeFamiliarityQuery(query);
  const absorbed = [];
  let format = null;
  if (TABLE_RE.test(q)) {
    format = "table";
    absorbed.push({ label: "table", reason: DROP_REASONS.ABSORBED_AS_CONSTRAINT });
  } else if (SCHEMA_RE.test(q)) {
    format = "schema";
    absorbed.push({ label: "schema", reason: DROP_REASONS.ABSORBED_AS_CONSTRAINT });
  }

  let depth = null;
  if (DETAILED_RE.test(q)) depth = "detailed";
  else if (SHORT_RE.test(q)) depth = "short";

  return { format, depth, absorbed };
}

/**
 * @param {string} query
 * @returns {{ secondaries: string[], with_sources: boolean, absorbed: { label: string, reason: string }[] }}
 */
function detectSecondariesAndExec(query = "") {
  const q = normalizeFamiliarityQuery(query);
  const secondaries = [];
  const absorbed = [];
  if (SUMMARIZE_RE.test(q)) secondaries.push("summarize");
  if (COMPARE_RE.test(q) && EXPLAIN_RE.test(q)) secondaries.push("compare");
  let with_sources = false;
  if (SOURCES_RE.test(q)) {
    with_sources = true;
    secondaries.push("cite_sources");
    absorbed.push({
      label: "cite_sources_as_intent",
      reason: DROP_REASONS.ABSORBED_AS_CONSTRAINT,
    });
  }
  return { secondaries, with_sources, absorbed };
}

/**
 * Primary depuis la requête (indépendamment de JUST).
 * @param {string} query
 * @returns {{ action: string|null, confidence: number }}
 */
function detectPrimaryFromQuery(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (CORRECT_RE.test(q) && !EXPLAIN_RE.test(q)) {
    return { action: "correct", confidence: 0.82 };
  }
  if (CALCULATE_RE.test(q) && !EXPLAIN_RE.test(q)) {
    return { action: "calculate", confidence: 0.8 };
  }
  if (COMPARE_RE.test(q) && !EXPLAIN_RE.test(q)) {
    return { action: "compare", confidence: 0.84 };
  }
  if (SUMMARIZE_RE.test(q) && !EXPLAIN_RE.test(q) && !TABLE_RE.test(q)) {
    return { action: "summarize", confidence: 0.8 };
  }
  if (
    EXPLAIN_RE.test(q) ||
    isPedagogicalStructuredExplainRequest(query) ||
    TABLE_RE.test(q)
  ) {
    return { action: "explain", confidence: 0.9 };
  }
  if (GENERATE_RE.test(q)) {
    return { action: "generate", confidence: 0.72 };
  }
  return { action: null, confidence: 0.2 };
}

/**
 * Mappe action JUST → primary composition.
 * @param {object|null} justIntent
 * @returns {{ action: string|null, confidence: number }}
 */
function mapJustPrimary(justIntent) {
  if (!justIntent?.action) return { action: null, confidence: 0 };
  const confMap = { high: 0.9, medium: 0.7, low: 0.45 };
  const confidence = confMap[justIntent.confidence] ?? 0.55;
  const action = String(justIntent.action || "").toLowerCase();
  const map = {
    [INTENT_ACTIONS.EXPLAIN]: "explain",
    [INTENT_ACTIONS.SUMMARIZE]: "summarize",
    [INTENT_ACTIONS.COMPARE]: "compare",
    [INTENT_ACTIONS.CORRECT]: "correct",
    [INTENT_ACTIONS.TRANSLATE]: "translate",
    [INTENT_ACTIONS.GENERATE]: "generate",
    [INTENT_ACTIONS.CREATE]: "generate",
    [INTENT_ACTIONS.PLAN]: "advise",
  };
  return { action: map[action] || action || null, confidence };
}

/**
 * @param {object|null} justMapped
 * @param {{ action: string|null, confidence: number }} fromQuery
 * @param {{ format: string|null }} constraints
 * @returns {{ primary: string|null, just_relation: string, primaryConfidence: number }}
 */
function resolvePrimaryRelation(justMapped, fromQuery, constraints) {
  const justAction = justMapped.action;
  const queryAction = fromQuery.action;

  if (!queryAction && !justAction) {
    return { primary: null, just_relation: "confirmed", primaryConfidence: 0.2 };
  }

  if (!queryAction && justAction) {
    return {
      primary: justAction,
      just_relation: "confirmed",
      primaryConfidence: justMapped.confidence,
    };
  }

  if (queryAction && !justAction) {
    return {
      primary: queryAction,
      just_relation: "overridden",
      primaryConfidence: fromQuery.confidence,
    };
  }

  // JUST plat (general/explain) alors que la requête porte format/secondaires riches
  const justIsFlatExplain =
    justAction === "explain" &&
    (constraints.format || fromQuery.confidence >= 0.85);

  if (queryAction === justAction) {
    if (justIsFlatExplain && constraints.format) {
      return {
        primary: queryAction,
        just_relation: "refined",
        primaryConfidence: Math.max(fromQuery.confidence, justMapped.confidence),
      };
    }
    return {
      primary: queryAction,
      just_relation: "confirmed",
      primaryConfidence: Math.max(fromQuery.confidence, justMapped.confidence),
    };
  }

  // Divergence : privilégier le signal requête si plus confiant
  if (fromQuery.confidence >= justMapped.confidence - 0.05) {
    return {
      primary: queryAction,
      just_relation: constraints.format ? "too_flat" : "refined",
      primaryConfidence: fromQuery.confidence,
    };
  }

  return {
    primary: justAction,
    just_relation: "confirmed",
    primaryConfidence: justMapped.confidence,
  };
}

/**
 * @param {string} query
 * @returns {string[]}
 */
function detectTargets(query = "") {
  const units = parsePedagogicalStructuredUnits(query);
  if (units.length) return units.map((u) => u.subject);
  return [];
}

/**
 * Résout la composition d'intentions (observe-first).
 * @param {string} query
 * @param {{
 *   history?: object[],
 *   justIntent?: object|null,
 *   requestDecomposition?: object|null,
 * }} [options]
 */
export function resolveIntentComposition(query = "", options = {}) {
  const justIntent = options.justIntent || null;
  const social = detectSocial(query);
  const { format, depth, absorbed: absorbedConstraints } =
    detectOutputConstraints(query);
  const {
    secondaries: rawSecondaries,
    with_sources,
    absorbed: absorbedExec,
  } = detectSecondariesAndExec(query);

  const fromQuery = detectPrimaryFromQuery(query);
  const justMapped = mapJustPrimary(justIntent);
  const { primary, just_relation, primaryConfidence } = resolvePrimaryRelation(
    justMapped,
    fromQuery,
    { format },
  );

  const dropped = [...absorbedConstraints];
  // cite_sources est à la fois secondaire exécutable et contrainte
  const secondaryCandidates = rawSecondaries.filter((s) => s !== "cite_sources" || true);
  const { kept: secondary_actions, dropped: droppedSecs } = filterSecondaryActions(
    primary,
    secondaryCandidates,
  );
  dropped.push(...droppedSecs);
  for (const row of absorbedExec) {
    if (row.label === "cite_sources_as_intent") {
      // garder cite_sources dans secondary si present, mais noter absorption du label intent
      dropped.push(row);
    }
  }

  // compare detecte en secondaire alors que primary=explain : ok
  // Si primary null et social only
  const workload = resolveRequestWorkloadSignal(query);
  const targets = detectTargets(query);
  const budget_units =
    Math.max(targets.length, workload.units.length, workload.explicit_unit_count || 0) ||
    (primary ? 1 : null);

  // R5 — social = modulateur de ton, pas force de routage (multi-unités OU mandat ancré)
  const deferSocial =
    Boolean(workload.must_plan_units) || shouldDeferSocialRouting(query);
  const socialForRouting = deferSocial ? [] : social;
  const social_weight = deferSocial
    ? "deferred_to_response"
    : social.length
      ? "opening"
      : "none";

  const compat = scoreCompositionCompatibility({
    primary,
    secondaries: secondary_actions,
    format,
    depth,
    query,
    droppedCount: dropped.length,
  });

  if (hasDepthContradiction(depth, query) && !compat.clarification_required) {
    compat.clarification_required = true;
    compat.clarify_reason = "depth_contradiction";
  }

  const followup_mode =
    secondary_actions.includes("summarize") && primary === "explain"
      ? "inline_after_primary"
      : secondary_actions.length
        ? "inline_after_primary"
        : null;

  const execution_plan = {
    mode: primary
      ? secondary_actions.length || format || socialForRouting.length
        ? "single_rail_augmented"
        : "single_rail"
      : socialForRouting.length
        ? "social_only"
        : "none",
    primary_path_hint:
      primary === "explain" && format === "table"
        ? "lexicon_science_format_table"
        : primary === "explain" && format === "schema"
          ? "lexicon_science_format_schema"
          : null,
    secondary_inline: secondary_actions.filter((s) =>
      ["summarize", "cite_sources"].includes(s),
    ),
    must_plan_units: Boolean(workload.must_plan_units),
    must_preserve_all_units: Boolean(workload.must_preserve_all_units),
  };

  const socialConf = workload.must_plan_units
    ? 0.2
    : social.length
      ? 0.85
      : 0.15;
  const secondaryConf = secondary_actions.length
    ? Math.min(0.9, 0.55 + secondary_actions.length * 0.15)
    : 0.2;
  const constraintsConf =
    format || depth || with_sources ? 0.92 : 0.35;
  const workloadConf = Number((workload.confidence || 0).toFixed(3));

  const composition = {
    contract: INTENT_COMPOSITION_CONTRACT,
    social,
    social_weight,
    primary_action: primary,
    secondary_actions,
    output_constraints: {
      format,
      depth,
    },
    execution_constraints: {
      with_sources: Boolean(with_sources || secondary_actions.includes("cite_sources")),
      no_web: false,
      budget_units,
      must_preserve_all_units: Boolean(workload.must_preserve_all_units),
    },
    targets,
    workload_signal: {
      explicit_unit_count: workload.explicit_unit_count,
      stated_count: workload.stated_count,
      parsed_units: workload.units.length,
      extraction_mode: workload.extraction_mode,
      cardinality_ok: workload.cardinality_ok,
      confidence: workload.confidence,
      units: workload.units.map((u) => ({
        index: u.index,
        action: u.action,
        format: u.format,
        target: u.target,
      })),
    },
    followup_mode,
    compatibility_score: compat.score,
    clarification_required: compat.clarification_required,
    clarify_reason: compat.clarify_reason,
    just_relation,
    execution_plan,
    confidence_breakdown: {
      primary_action: Number(primaryConfidence.toFixed(3)),
      secondary_actions: Number(secondaryConf.toFixed(3)),
      constraints: Number(constraintsConf.toFixed(3)),
      social: Number(socialConf.toFixed(3)),
      workload: workloadConf,
    },
    dropped_candidates: dropped,
    telemetry: {
      rule: INTENT_COMPOSITION_RULE,
      source: "intent_composition_p0",
      justAction: justIntent?.action || null,
      justDomain: justIntent?.domain || null,
      workload_rule: workload.rule,
    },
  };

  return composition;
}

/**
 * @param {ReturnType<typeof resolveIntentComposition>} composition
 * @returns {string}
 */
export function formatIntentCompositionSummary(composition) {
  if (!composition) return "none";
  const wl = composition.workload_signal;
  const parts = [
    `primary=${composition.primary_action || "null"}`,
    `format=${composition.output_constraints?.format || "null"}`,
    `secondary=${(composition.secondary_actions || []).join("+") || "none"}`,
    `just_relation=${composition.just_relation || "?"}`,
    `clarify=${composition.clarification_required ? "yes" : "no"}`,
  ];
  if (wl?.explicit_unit_count) {
    parts.push(
      `units=${wl.explicit_unit_count}`,
      `card_ok=${wl.cardinality_ok ? "yes" : "no"}`,
    );
  }
  return parts.join(" ");
}

/**
 * Augmente une réponse pédagogique déterministe selon la composition.
 * @param {string} reply
 * @param {ReturnType<typeof resolveIntentComposition>|null} composition
 * @param {{ subject?: string }} [opts]
 * @returns {string}
 */
export function applyPedagogicalCompositionAugment(reply = "", composition = null, opts = {}) {
  let out = String(reply || "");
  if (!out.trim() || !composition) return out;

  // Social d’ouverture en réponse seulement (jamais force de routage).
  // Si social_weight=deferred_to_response, on peut réinjecter un greeting léger ici.
  if (
    composition.social?.includes("greeting") &&
    !/^(?:bonjour|salut)\b/i.test(out)
  ) {
    out = `Bonjour.\n\n${out}`;
  }

  const wantsSummarize =
    composition.secondary_actions?.includes("summarize") ||
    composition.followup_mode === "inline_after_primary";

  if (wantsSummarize && !/\*\*En 3 lignes\*\*|\*\*En résumé\*\*/i.test(out)) {
    const subject =
      opts.subject ||
      composition.targets?.[0] ||
      "";
    const takeaway =
      buildLexiconScienceTakeawayReply(subject) ||
      `**En 3 lignes** : ${pedagogicalSubjectLabel(subject) || "le sujet"} se comprend mieux en étapes structurées ; retiens le fil cause → effet → résultat.`;
    const short = takeaway.startsWith("**En")
      ? takeaway
      : `**En 3 lignes** : ${takeaway}`;
    out = `${out.trim()}\n\n---\n${short}`;
  }

  // Sources : si demandé et absentes, note minimale
  if (
    composition.execution_constraints?.with_sources &&
    !/\*\*Sources\*\*/i.test(out)
  ) {
    out = `${out.trim()}\n\n**Sources**\n- Synthèse pédagogique (littérature de référence / ressources publiques usuelles).`;
  }

  return out;
}
