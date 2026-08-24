/**
 * Complétude d’input — garde d’existence / fraîcheur.
 * Unité explicite : borne de portée, pas un intent, pas un champ entities.
 */
import {
  normalizeFamiliarityQuery,
  parseFamiliarityQuery,
} from "../../utils/intent-guards/familiarityIntentGuards.js";
import {
  extractConversationState,
  readRecentTurns,
} from "../../micro/continuity/conversationContinuityContext.js";

export const INPUT_COMPLETENESS_RULE = "explicit_existence_unit_survives";
export const EXISTENCE_SCOPE_GUARD = "existence_current";
export const EXISTENCE_PLAN_SECTION = "existence_current";

const EXISTENCE_CLAUSE_RE =
  /\b(?:existe\s+toujours|existe\s+encore|encore\s+en\s+vente|toujours\s+en\s+vente|toujours\s+actifs?|ca\s+existe\s+encore|cela\s+existe\s+encore)\b/i;

const BRAND_PREFIX_RE = /^(?:la |le |les |l )?(?:marque|brand)\s+/i;

/**
 * @param {string} query
 * @returns {{ kind: string, clause: string }|null}
 */
export function detectExistenceScopeGuard(query = "") {
  const q = normalizeFamiliarityQuery(query);
  const match = q.match(EXISTENCE_CLAUSE_RE);
  if (!match?.[0]) return null;
  return { kind: EXISTENCE_SCOPE_GUARD, clause: match[0] };
}

function containsNormalized(haystack = "", needle = "") {
  const h = normalizeFamiliarityQuery(haystack);
  const n = normalizeFamiliarityQuery(needle);
  return Boolean(h && n && h.includes(n));
}

function stripBrandPrefix(label = "") {
  return normalizeFamiliarityQuery(label).replace(BRAND_PREFIX_RE, "").trim();
}

function resolveSubjectFromHistory(history = []) {
  const turns = readRecentTurns(history);
  const state = extractConversationState(turns);
  if (state.activeSubjectLabel) {
    const stripped = stripBrandPrefix(state.activeSubjectLabel);
    if (stripped) return stripped;
  }
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.role !== "user") continue;
    const parsed = parseFamiliarityQuery(turns[i].content);
    if (parsed?.rawSubject) {
      const stripped = stripBrandPrefix(parsed.rawSubject);
      if (stripped) return stripped;
    }
  }
  return null;
}

/**
 * Sujet nommé du fil (continuité existante) ou déjà présent dans la query.
 * @param {string} query
 * @param {object[]} [history]
 * @returns {string|null}
 */
export function resolveExistenceScopedSubject(query = "", history = []) {
  const fromHistory = resolveSubjectFromHistory(history);
  if (fromHistory) return fromHistory;
  const parsed = parseFamiliarityQuery(query);
  if (parsed?.rawSubject) return stripBrandPrefix(parsed.rawSubject);
  return null;
}

/**
 * effectiveQuery garde la clause ; préfixe le sujet résolu s’il manque.
 * @param {string} rawQuery
 * @param {string} [candidateQuery]
 * @param {{ history?: object[] }} [options]
 */
export function preserveExistenceInEffectiveQuery(
  rawQuery = "",
  candidateQuery = "",
  options = {},
) {
  const raw = String(rawQuery || "");
  let next = String(candidateQuery || raw);
  const guard = detectExistenceScopeGuard(raw);
  if (!guard) return next || raw;
  if (!detectExistenceScopeGuard(next)) next = raw;
  const subject = resolveExistenceScopedSubject(next, options.history);
  if (subject && !containsNormalized(next, subject)) {
    next = `${subject} : ${next}`;
  }
  return next;
}

/**
 * @param {object} composition
 * @param {string} query
 */
export function attachExistenceScopeGuard(composition, query = "") {
  const guard = detectExistenceScopeGuard(query);
  const prev = composition?.execution_constraints || {};
  return {
    ...composition,
    execution_constraints: {
      ...prev,
      scope_guards: guard ? [guard.kind] : Array.isArray(prev.scope_guards)
        ? prev.scope_guards
        : [],
    },
  };
}

/**
 * @param {object} plan
 * @param {string} query
 */
export function applyExistenceToResponsePlan(plan = {}, query = "") {
  if (!detectExistenceScopeGuard(query)) return plan;
  if (plan?.kind === "clarify_missing_slots") return plan;
  const sections = Array.isArray(plan?.sections) ? [...plan.sections] : ["direct_answer"];
  const rest = sections.filter((s) => s !== EXISTENCE_PLAN_SECTION);
  return { ...plan, sections: [EXISTENCE_PLAN_SECTION, ...rest] };
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {string|null}
 */
export function buildExistenceScopedWebQuery(query = "", options = {}) {
  const guard = detectExistenceScopeGuard(query);
  if (!guard) return null;
  const subject = resolveExistenceScopedSubject(query, options.history);
  return subject ? `${subject} ${guard.clause}` : guard.clause;
}

export function buildExistenceScopeComposerAddon(query = "") {
  if (!detectExistenceScopeGuard(query)) return "";
  return [
    "GARDE DE PORTÉE — EXISTENCE ACTUELLE :",
    "- Commencer par l'existence actuelle (existe encore / encore en vente / toujours actif) avant tout développement secondaire.",
  ].join("\n");
}

/**
 * Compression invalide si la garde disparaît d’un des quatre points.
 * @param {{
 *   rawQuery?: string,
 *   effectiveQuery?: string,
 *   composition?: object,
 *   responsePlan?: object,
 *   webQuery?: string,
 *   history?: object[],
 * }} [input]
 */
export function evaluateInputCompleteness(input = {}) {
  const rawQuery = String(input.rawQuery || "");
  const guard = detectExistenceScopeGuard(rawQuery);
  if (!guard) {
    return {
      applicable: false,
      valid: true,
      compression_invalid: false,
      failures: [],
      guard: null,
      rule: INPUT_COMPLETENESS_RULE,
    };
  }

  const failures = [];
  if (!detectExistenceScopeGuard(input.effectiveQuery)) {
    failures.push("effective_query_dropped_existence_clause");
  }
  const guards = input.composition?.execution_constraints?.scope_guards || [];
  if (!guards.includes(EXISTENCE_SCOPE_GUARD)) {
    failures.push("scope_guard_missing");
  }
  if (input.responsePlan?.sections?.[0] !== EXISTENCE_PLAN_SECTION) {
    failures.push("response_plan_existence_not_first");
  }
  const web = String(input.webQuery || "");
  if (!detectExistenceScopeGuard(web)) {
    failures.push("web_query_dropped_existence_bound");
  }
  const subject = resolveExistenceScopedSubject(
    input.effectiveQuery || rawQuery,
    input.history,
  );
  if (subject && !containsNormalized(web, subject)) {
    failures.push("web_query_dropped_resolved_subject");
  }

  return {
    applicable: true,
    valid: failures.length === 0,
    compression_invalid: failures.length > 0,
    failures,
    guard,
    rule: INPUT_COMPLETENESS_RULE,
  };
}
