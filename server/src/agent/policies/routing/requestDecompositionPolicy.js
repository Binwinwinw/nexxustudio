/**
 * Décomposition gouvernée des requêtes — avant routage métier.
 * Distingue single | multi_target (même cadre) | multi_unit (cadres hétérogènes).
 */
import { analyzeConversationIntentFrame } from "../intent/conversationIntentFrame.js";
import { isInformationSeekingWithTarget } from "../../utils/informationSeekingIntentGuards.js";
import {
  isTranslationPipelineReady,
  isTranslationShell,
} from "../../utils/translationIntentGuards.js";
import { buildTranslationRequestPlan } from "../../utils/translationRequestPlan.js";
import { normalizeForParse } from "../../micro/parsing/requestSegmentParser.js";
import {
  enrichHowToUnit,
  HOW_TO_QUALIFICATIONS,
} from "../qualification/howToQualificationPolicy.js";
import { shouldBypassLocalDatetimeShortCircuit } from "../../utils/externalCalendarLookupIntentGuards.js";

export const REQUEST_DECOMPOSITION_RULE = "request_decomposition_v1";

export const REQUEST_MODES = Object.freeze({
  SINGLE: "single",
  MULTI_TARGET: "multi_target",
  MULTI_UNIT: "multi_unit",
});

export const EXECUTION_MODES = Object.freeze({
  SINGLE: "single",
  BATCH: "batch",
  MULTI_UNIT: "multi_unit",
});

const MULTI_UNIT_SPLIT_RE =
  /\s*(?:;\s+|\s+puis\s+|\s+ensuite\s+|\s+et puis\s+|\s+apres ca\s+|\s+après ça\s+|\s*,\s+(?=(?:corrige|donne|calcule|traduis|explique|conseil|recommande|infos)\b))/i;

const SOCIAL_GREETING_CLAUSE_RE =
  /^(?:salut|bonjour|hello|coucou|hey|bonsoir)\b/i;

const SOCIAL_GREETING_SIGNAL_RE =
  /(?:^|\s)(?:salut|bonjour|hello|coucou|hey|bonsoir|yo|yop)\b/i;

const SOCIAL_CHECKIN_SIGNAL_RE =
  /(?:comment\s+(?:(?:ça|ca)\s+)?(?:va|se\s+passe|roule)|comment\s+(?:tu\s+)?vas|comment\s+vas[- ]?tu|(?:^|\s)(?:ça|ca)\s+va|tu\s+vas\s+bien)/i;

const SOCIAL_CHECKIN_ACTION_BOUND_RE =
  /\b(?:va|vas|passe|roule)\s+(?:bien\s+)?(?:g[ée]rer|gerer|faire|r[ée]gler|se\s+passer\s+pour|marcher|aider|r[ée]soudre|fonctionner)\b/i;

const EXPLANATORY_COMMENT_SIGNAL_RE =
  /\bcomment\s+(?:fonctionne|marche|cr[ée]er|creer|faire|utiliser|impl[ée]menter|configurer|d[ée]boguer|deboguer|installer|d[ée]ployer|deployer)\b/i;

const TIME_REQUEST_SIGNAL_RE =
  /\b(?:quelle\s+heure|heure\s+actuelle|heure\s+du\s+jour|heure\s+est\s+il|heure\s+est-il|il\s+est\s+quelle\s+heure|besoin\s+de\s+l\s*heure|j\s*ai\s+besoin\s+de\s+l\s*heure)\b/i;

const DATE_REQUEST_SIGNAL_RE =
  /\b(?:quelle\s+date|date\s+du\s+jour|date\s+d\s*aujourd|on\s+est\s+quel\s+jour|nous\s+sommes\s+quel\s+jour|jour\s+actuel|besoin\s+de\s+la\s+date|j\s*ai\s+besoin\s+de\s+la\s+date)\b/i;

const HOW_TO_REQUEST_SIGNAL_RE =
  /\b(?:comment\s+(?:on\s+)?(?:fait|faire|preparer|preparer)|sais\s+tu\s+comment\s+(?:on\s+)?(?:fait|faire)|comment\s+faire|savoir\s+si\s+tu\s+sais\s+comment|voudrais\s+savoir\s+comment|aimerais\s+savoir\s+comment(?:\s+faire)?|tu\s+sais\s+comment\s+(?:on\s+)?(?:fait|faire))\b/i;

const INVENTORY_SIGNALS = Object.freeze([
  {
    unitType: "social_greeting",
    test: (normalized) => SOCIAL_GREETING_SIGNAL_RE.test(normalized),
    absorbable: true,
    satisfiable: true,
    familyHint: "social_deterministic",
    priority: 0,
  },
  {
    unitType: "social_checkin",
    test: (normalized) =>
      SOCIAL_CHECKIN_SIGNAL_RE.test(normalized) &&
      !SOCIAL_CHECKIN_ACTION_BOUND_RE.test(normalized) &&
      !EXPLANATORY_COMMENT_SIGNAL_RE.test(normalized),
    absorbable: true,
    satisfiable: true,
    familyHint: "social_deterministic",
    priority: 0,
  },
  {
    unitType: "time_request",
    test: (normalized) =>
      TIME_REQUEST_SIGNAL_RE.test(normalized) &&
      !shouldBypassLocalDatetimeShortCircuit(normalized),
    absorbable: false,
    satisfiable: true,
    familyHint: "datetime_deterministic",
    priority: 10,
  },
  {
    unitType: "date_request",
    test: (normalized) =>
      DATE_REQUEST_SIGNAL_RE.test(normalized) &&
      !shouldBypassLocalDatetimeShortCircuit(normalized),
    absorbable: false,
    satisfiable: true,
    familyHint: "datetime_deterministic",
    priority: 11,
  },
  {
    unitType: "how_to_request",
    test: (normalized) => HOW_TO_REQUEST_SIGNAL_RE.test(normalized),
    absorbable: false,
    satisfiable: false,
    familyHint: "general_knowledge_full_pipeline",
    priority: 12,
  },
]);

const HTML_TRANSFORM_RE =
  /\b(?:corrige|corriger|repare|répare|ameliore|améliore|transforme|convertis).{0,50}\bhtml\b|\bhtml\b.{0,50}(?:corrige|corriger|repare|répare)\b/i;

const ADVICE_RE =
  /\b(?:conseil|conseille|recommande|recommand|quel(?:le)?s?\s+(?:options?|choix)|meilleur choix)\b/i;

const CALCULATE_RE =
  /\b(?:calcule|calculer|masse de|poids de|volume de|combien pese|combien pèse)\b/i;

/**
 * @typedef {{
 *   id: string,
 *   unitType: string,
 *   taskKind: string|null,
 *   familyHint: string|null,
 *   payload: string,
 *   priority: number,
 *   absorbable: boolean,
 *   satisfiable?: boolean,
 *   dependsOn: string[],
 * }} RequestUnit
 */

/**
 * Inventaire multi-signaux sur la requête complète (pas seulement les clauses).
 * @param {string} query
 * @returns {RequestUnit[]}
 */
export function inventoryRequestUnits(query = "") {
  const payload = String(query || "").trim();
  const normalized = normalizeForParse(payload);
  if (!normalized) return [];

  const units = [];
  let index = 0;

  for (const signal of INVENTORY_SIGNALS) {
    if (!signal.test(normalized)) continue;
    units.push(
      enrichHowToUnit({
        id: `unit_${signal.unitType}_${index}`,
        unitType: signal.unitType,
        taskKind: signal.absorbable ? "social" : "explain",
        familyHint: signal.familyHint,
        payload,
        priority: signal.priority,
        absorbable: signal.absorbable,
        satisfiable: signal.satisfiable,
        dependsOn: [],
      }),
    );
    index += 1;
  }

  return units;
}

/**
 * @param {RequestUnit[]} inventoryUnits
 * @param {RequestUnit[]} clauseUnits
 * @returns {RequestUnit[]}
 */
function mergeInventoryAndClauseUnits(inventoryUnits = [], clauseUnits = []) {
  if (inventoryUnits.length >= 2) return inventoryUnits;
  if (clauseUnits.length > 1) return clauseUnits;
  return inventoryUnits.length ? inventoryUnits : clauseUnits;
}

/**
 * @param {string} clause
 * @param {number} index
 * @returns {RequestUnit}
 */
function buildUnitFromClause(clause = "", index = 0) {
  const payload = String(clause || "").trim();
  const normalized = normalizeForParse(payload);

  if (SOCIAL_GREETING_CLAUSE_RE.test(normalized)) {
    return {
      id: `unit_social_${index}`,
      unitType: "social_greeting",
      taskKind: "social",
      familyHint: "social_deterministic",
      payload,
      priority: 0,
      absorbable: true,
      satisfiable: true,
      dependsOn: [],
    };
  }

  if (isTranslationShell(payload)) {
    return {
      id: `unit_translate_${index}`,
      unitType: "translate",
      taskKind: "translate",
      familyHint: "translation_request",
      payload,
      priority: 10 + index,
      absorbable: false,
      dependsOn: [],
    };
  }

  if (HTML_TRANSFORM_RE.test(normalized)) {
    return {
      id: `unit_html_${index}`,
      unitType: "html_transform",
      taskKind: "build",
      familyHint: "html_project",
      payload,
      priority: 10 + index,
      absorbable: false,
      dependsOn: [],
    };
  }

  if (isInformationSeekingWithTarget(payload)) {
    return {
      id: `unit_info_${index}`,
      unitType: "information_seeking",
      taskKind: "explain",
      familyHint: "information_seeking_full_pipeline",
      payload,
      priority: 10 + index,
      absorbable: false,
      dependsOn: [],
    };
  }

  if (ADVICE_RE.test(normalized)) {
    return {
      id: `unit_advice_${index}`,
      unitType: "advice",
      taskKind: "explain",
      familyHint: "general_knowledge_full_pipeline",
      payload,
      priority: 10 + index,
      absorbable: false,
      dependsOn: [],
    };
  }

  if (CALCULATE_RE.test(normalized)) {
    return {
      id: `unit_calculate_${index}`,
      unitType: "calculate",
      taskKind: "explain",
      familyHint: "simple_factual_lookup",
      payload,
      priority: 10 + index,
      absorbable: false,
      dependsOn: [],
    };
  }

  return {
    id: `unit_general_${index}`,
    unitType: "general",
    taskKind: "explain",
    familyHint: null,
    payload,
    priority: 10 + index,
    absorbable: false,
    dependsOn: [],
  };
}

/**
 * @param {string} query
 * @returns {string[]}
 */
export function splitRequestClauses(query = "") {
  const raw = String(query || "").trim();
  if (!raw) return [];

  const translationPlan = buildTranslationRequestPlan(raw);
  if (translationPlan.multiTarget && translationPlan.ready) {
    return [raw];
  }

  const parts = raw
    .split(MULTI_UNIT_SPLIT_RE)
    .map((p) => p.trim())
    .filter(Boolean);

  return parts.length ? parts : [raw];
}

/**
 * @param {RequestUnit[]} units
 * @returns {boolean}
 */
function detectCrossUnitDependencies(units = []) {
  return units.some((unit) => (unit.dependsOn || []).length > 0);
}

/**
 * @param {RequestUnit[]} units
 * @returns {RequestUnit|null}
 */
function pickPrimaryWorkUnit(units = []) {
  const workUnits = units.filter((u) => !u.absorbable);
  if (!workUnits.length) return units[0] || null;
  return workUnits.sort((a, b) => a.priority - b.priority)[0];
}

/**
 * @param {ReturnType<typeof buildTranslationRequestPlan>} plan
 * @returns {RequestUnit[]}
 */
function mapTranslationPlanToUnits(plan) {
  return plan.requestUnits.map((unit, index) => ({
    id: unit.id || `unit_translate_${index}`,
    unitType: "translate",
    taskKind: "translate",
    familyHint: "translation_request",
    payload: plan.effectiveQuery,
    priority: 10 + index,
    absorbable: false,
    dependsOn: index > 0 ? [plan.requestUnits[index - 1]?.id].filter(Boolean) : [],
    targetLanguage: unit.targetLanguage,
    targetLanguageLabel: unit.targetLanguageLabel,
    sourceText: unit.sourceText,
  }));
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
export function decomposeRequest(query = "", history = []) {
  const translationPlan = buildTranslationRequestPlan(query, history);

  if (translationPlan.multiTarget && translationPlan.ready) {
    const units = mapTranslationPlanToUnits(translationPlan);
    return {
      rule: REQUEST_DECOMPOSITION_RULE,
      requestMode: REQUEST_MODES.MULTI_TARGET,
      executionMode: EXECUTION_MODES.BATCH,
      unitCount: units.length,
      unitTypes: units.map((u) => u.unitType),
      containsSocialPreamble: false,
      hasCrossUnitDependencies: false,
      units,
      primaryUnitId: units[0]?.id || null,
      primaryRoutingQuery: translationPlan.effectiveQuery,
      translationPlan,
    };
  }

  const clauses = splitRequestClauses(query);
  const clauseUnits = clauses.map((clause, index) => buildUnitFromClause(clause, index));
  const inventoryUnits = inventoryRequestUnits(query);
  const units = mergeInventoryAndClauseUnits(inventoryUnits, clauseUnits);
  const workUnits = units.filter((u) => !u.absorbable);
  const uniqueWorkTypes = new Set(workUnits.map((u) => u.unitType));
  const conversation = analyzeConversationIntentFrame(query);

  let requestMode = REQUEST_MODES.SINGLE;
  let executionMode = EXECUTION_MODES.SINGLE;

  if (workUnits.length > 1 && uniqueWorkTypes.size > 1) {
    requestMode = REQUEST_MODES.MULTI_UNIT;
    executionMode = EXECUTION_MODES.MULTI_UNIT;
  } else if (
    translationPlan.ready &&
    !translationPlan.multiTarget &&
    workUnits.length <= 1
  ) {
    requestMode = REQUEST_MODES.SINGLE;
    executionMode = EXECUTION_MODES.SINGLE;
  } else if (conversation.composite && workUnits.length >= 1) {
    requestMode = REQUEST_MODES.MULTI_UNIT;
    executionMode = EXECUTION_MODES.MULTI_UNIT;
  }

  const primaryUnit = pickPrimaryWorkUnit(units);

  return {
    rule: REQUEST_DECOMPOSITION_RULE,
    requestMode,
    executionMode,
    unitCount: units.length,
    unitTypes: units.map((u) => u.unitType),
    containsSocialPreamble: units.some((u) => u.unitType === "social_greeting"),
    hasCrossUnitDependencies: detectCrossUnitDependencies(units),
    units,
    primaryUnitId: primaryUnit?.id || null,
    primaryRoutingQuery:
      requestMode === REQUEST_MODES.MULTI_UNIT
        ? primaryUnit?.payload || query
        : query,
    translationPlan: translationPlan.ready ? translationPlan : null,
  };
}

/**
 * @param {ReturnType<typeof decomposeRequest>} decomposition
 * @returns {boolean}
 */
export function isMultiUnitRequest(decomposition) {
  return decomposition?.requestMode === REQUEST_MODES.MULTI_UNIT;
}

/**
 * @param {ReturnType<typeof decomposeRequest>} decomposition
 * @returns {boolean}
 */
export function isMultiTargetRequest(decomposition) {
  return decomposition?.requestMode === REQUEST_MODES.MULTI_TARGET;
}

/**
 * @param {ReturnType<typeof decomposeRequest>} decomposition
 * @returns {string}
 */
export function buildMultiUnitExecutionHint(decomposition) {
  if (!isMultiUnitRequest(decomposition)) return "";
  const lines = decomposition.units.map((unit, index) => {
    const label = unit.unitType.replace(/_/g, " ");
    return `${index + 1}. [${label}] ${unit.payload.slice(0, 100)}`;
  });
  return [
    "REQUÊTE MULTI-UNITÉS — réponds en sections distinctes, une par sous-demande.",
    "Le social en tête seulement s'il est présent (1 phrase max), puis chaque unité métier.",
    "Unités détectées :",
    ...lines,
  ].join("\n");
}

/**
 * La gate de clarification ne doit pas bloquer une requête composite explicite.
 * @param {ReturnType<typeof decomposeRequest>} decomposition
 */
export function suppressesClarificationForDecomposedRequest(decomposition) {
  if (!decomposition) return false;
  if (isMultiTargetRequest(decomposition)) return true;
  if (isMultiUnitRequest(decomposition) && decomposition.unitCount >= 2) {
    if (allWorkUnitsSatisfiable(decomposition)) return true;
    if (canServeMultiUnitPartialDecomposition(decomposition)) return true;
    return decomposition.units.some((u) => !u.absorbable && u.taskKind);
  }
  return false;
}

/**
 * @param {ReturnType<typeof decomposeRequest>} decomposition
 * @returns {boolean}
 */
export function allWorkUnitsSatisfiable(decomposition) {
  const workUnits = decomposition?.units?.filter((unit) => !unit.absorbable) || [];
  if (workUnits.length < 2) return false;
  return workUnits.every((unit) => unit.satisfiable !== false);
}

/**
 * @param {ReturnType<typeof decomposeRequest>} decomposition
 * @returns {boolean}
 */
export function canServeMultiUnitPartialDecomposition(decomposition) {
  const workUnits = decomposition?.units?.filter((unit) => !unit.absorbable) || [];
  if (workUnits.length < 2) return false;
  const howTo = workUnits.find((unit) => unit.unitType === "how_to_request");
  if (!howTo || howTo.howToQualification !== HOW_TO_QUALIFICATIONS.AMBIGUOUS) {
    return false;
  }
  const others = workUnits.filter((unit) => unit.unitType !== "how_to_request");
  return others.length >= 1 && others.every((unit) => unit.satisfiable !== false);
}

/**
 * @param {ReturnType<typeof decomposeRequest>} decomposition
 * @returns {boolean}
 */
export function shouldPreemptMultiSegment(decomposition) {
  if (!isMultiUnitRequest(decomposition)) return false;
  return (
    allWorkUnitsSatisfiable(decomposition) ||
    canServeMultiUnitPartialDecomposition(decomposition)
  );
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
export function isRequestDecompositionReady(query = "", history = []) {
  const decomposition = decomposeRequest(query, history);
  if (decomposition.requestMode === REQUEST_MODES.MULTI_TARGET) {
    return Boolean(decomposition.translationPlan?.ready);
  }
  if (decomposition.requestMode === REQUEST_MODES.MULTI_UNIT) {
    return decomposition.units.filter((u) => !u.absorbable).length >= 2;
  }
  return isTranslationPipelineReady(query, history);
}
