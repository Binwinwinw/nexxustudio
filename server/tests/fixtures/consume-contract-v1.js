/**
 * SPEC-CONSUME-CONTRACT-V1 — artefact de conception.
 * PAS un routeur. Interdit d'importer depuis
 * intentShortCircuit / agentPipeline / socialPatternPolicy / deliverableContractPolicy.
 *
 * evaluateShadowPromotion = contrat testable. runtimeWired=false.
 */
export const CONTRACT_ID = "SPEC-CONSUME-CONTRACT-V1";
export const CONTRACT_STATUS = "recorded_unconsumed";
export const PROMOTION_EVENT = "shadow_promotion_decision";

export const DECISIONS = Object.freeze({
  PROMOTED: "promoted",
  BLOCKED: "blocked",
  UNKNOWN: "unknown",
});

export const SHADOW_PROMOTION_FLAG = Object.freeze({
  name: "SHADOW_PROMOTION_CONSUME",
  defaultEnabled: false,
  runtimeWired: false,
});

export const SINGLE_CONSUME_POINT = Object.freeze({
  functionName: "evaluateShadowPromotion",
  seat: "before_final_pipeline_choice",
  event: PROMOTION_EVENT,
  runtimeImplemented: false,
  independentOf: Object.freeze([
    "pipelineTelemetryCtx.deliverableContract",
    "onStep_ui",
    "observe_field_reread",
  ]),
  forbiddenSeats: Object.freeze([
    "simple_fast",
    "deliverableContractPolicy",
    "socialPatternPolicy",
    "turnComprehension",
    "enforceModeContract",
  ]),
});

export const COST = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  VERY_HIGH: "very_high",
  UNKNOWN: "unknown",
});

/** Budget maximal par famille — promotion au-delà = block. */
export const FAMILY_COST_BUDGET = Object.freeze({
  social_checkin: COST.LOW,
  social_continuity: COST.LOW,
  assistant_directed: COST.LOW,
  external_factual: COST.HIGH,
  repo_or_web: COST.VERY_HIGH,
});

const COST_RANK = Object.freeze({
  [COST.LOW]: 1,
  [COST.MEDIUM]: 2,
  [COST.HIGH]: 3,
  [COST.VERY_HIGH]: 4,
});

export const SHORT_CIRCUIT_MISS = Object.freeze({
  WITHOUT_CONFLICT: "sc_null_without_conflict",
  WITH_CONFLICT: "sc_null_with_conflict",
});

export const T2_CONVERSATIONAL_CONSUME = Object.freeze({
  caseId: "T2_conversational",
  candidate: "social_deterministic",
  shortCircuit: null,
  routing_authority_conflict: true,
  runtimeAligned: false,
  cost: COST.HIGH,
  promotion: DECISIONS.BLOCKED,
  firstPromotionCase: false,
  requiresSeparateConflictResolution: true,
  shadow_consumed: false,
});

export const T2_AVAILABILITY_CONSUME = Object.freeze({
  caseId: "T2_availability",
  candidate: "social_deterministic",
  shortCircuit: "simple_factual_lookup",
  routing_authority_conflict: false,
  runtimeAligned: "unknown",
  cost: COST.VERY_HIGH,
  promotion: DECISIONS.BLOCKED,
  namedAvailabilityCheck: false,
  shadow_consumed: false,
});

export const FALLBACK_POLICY = Object.freeze({
  social_deterministic: "keep_current_if_no_proven_safe_option",
  continuation: "short_clarification_if_no_active_context",
  underspecified_action: "clarification_not_freeform_llm",
  suspect_route: "no_meta_refusal_as_consume_policy",
  forbidden: Object.freeze([
    "silent_promotion",
    "llm_default_because_shadow_blocked",
    "reveal_internal_contracts",
    "conflict_to_objective_ask_without_proof",
  ]),
});

export const FORBIDDEN_CONSUME_SEATS = SINGLE_CONSUME_POINT.forbiddenSeats;

/**
 * @type {readonly {
 *   id: string,
 *   candidate: string,
 *   proof: string,
 *   conflict: boolean|string,
 *   runtimeAligned: boolean|string,
 *   cost: string,
 *   promotion: string,
 * }[]}
 */
export const SECURITY_MATRIX = Object.freeze([
  {
    id: "T2_conversational",
    candidate: "social",
    proof: "insufficient",
    conflict: true,
    runtimeAligned: false,
    cost: COST.HIGH,
    promotion: DECISIONS.BLOCKED,
  },
  {
    id: "T2_availability",
    candidate: "social",
    proof: "insufficient",
    conflict: "other_family",
    runtimeAligned: COST.UNKNOWN,
    cost: COST.VERY_HIGH,
    promotion: DECISIONS.BLOCKED,
  },
  {
    id: "deterministic_valid_route",
    candidate: "social_deterministic",
    proof: "complete",
    conflict: false,
    runtimeAligned: true,
    cost: COST.LOW,
    promotion: "eligible",
  },
  {
    id: "observe_only",
    candidate: "observe",
    proof: "absent",
    conflict: COST.UNKNOWN,
    runtimeAligned: COST.UNKNOWN,
    cost: COST.UNKNOWN,
    promotion: DECISIONS.BLOCKED,
  },
  {
    id: "lexical_candidate",
    candidate: "variable",
    proof: "weak",
    conflict: "variable",
    runtimeAligned: COST.UNKNOWN,
    cost: "variable",
    promotion: DECISIONS.BLOCKED,
  },
  {
    id: "unknown_target",
    candidate: "variable",
    proof: "absent",
    conflict: "variable",
    runtimeAligned: COST.UNKNOWN,
    cost: COST.UNKNOWN,
    promotion: DECISIONS.BLOCKED,
  },
]);

const POSITIVE_DEFINED = Object.freeze([
  "candidate_from_existing_chain",
  "candidate_reason",
  "candidate_route",
  "expected_response",
  "deterministic_fallback",
  "logged_before_execution",
  "runtime_aligned",
  "target_known",
  "feature_flag",
  "superior_authority_contradicts",
  "routing_authority_conflict",
  "observe_contract_only",
  "lexical_token_only",
  "multiple_plausible_candidates",
  "llm_freeform_only",
  "family",
  "cost_class",
]);

function isUnknown(value) {
  return value === undefined || value === null || value === "unknown" || value === "";
}

function result(decision, reason) {
  return Object.freeze({
    decision,
    reason,
    shadow_consumed: false,
    runtime_consumed: false,
    contract: CONTRACT_ID,
  });
}

function exceedsFamilyBudget(family, costClass) {
  const budget = FAMILY_COST_BUDGET[family];
  if (!budget || isUnknown(costClass)) return null;
  const got = COST_RANK[costClass];
  const max = COST_RANK[budget];
  if (got == null || max == null) return null;
  return got > max;
}

/**
 * Contrat de promotion — spec only. Ne lit pas deliverableContract comme autorité.
 * @param {object} input
 */
export function evaluateShadowPromotion(input = {}) {
  void input.deliverableContract;

  if (SHADOW_PROMOTION_FLAG.defaultEnabled !== false) {
    return result(DECISIONS.BLOCKED, "default_flag_must_stay_off");
  }
  if (SHADOW_PROMOTION_FLAG.runtimeWired !== false) {
    return result(DECISIONS.BLOCKED, "runtime_must_stay_unwired");
  }

  const t2 =
    input.case_id === T2_CONVERSATIONAL_CONSUME.caseId ||
    input.t2_conversational === true;
  if (t2) {
    return result(DECISIONS.BLOCKED, "t2_consume_forbidden");
  }

  if (input.case_id === T2_AVAILABILITY_CONSUME.caseId || input.t2_availability === true) {
    return result(DECISIONS.BLOCKED, "t2_availability_consume_forbidden");
  }

  if (input.routing_authority_conflict === true) {
    return result(DECISIONS.BLOCKED, "routing_authority_conflict");
  }

  if (input.short_circuit === null) {
    if (!input.candidate_route) {
      return result(DECISIONS.BLOCKED, SHORT_CIRCUIT_MISS.WITHOUT_CONFLICT);
    }
    return result(DECISIONS.BLOCKED, "sc_null");
  }

  if (input.runtime_aligned === false) {
    return result(DECISIONS.BLOCKED, "runtime_aligned_false");
  }

  if (input.feature_flag === false) {
    return result(DECISIONS.BLOCKED, "flag_disabled");
  }

  if (
    input.observe_contract_only === true ||
    input.candidate_source === "deliverable_contract_observe"
  ) {
    return result(DECISIONS.BLOCKED, "observe_contract_only");
  }

  if (input.lexical_token_only === true) {
    return result(DECISIONS.BLOCKED, "lexical_token_only");
  }

  if (input.multiple_plausible_candidates === true) {
    return result(DECISIONS.BLOCKED, "multiple_candidates");
  }

  if (input.llm_freeform_only === true) {
    return result(DECISIONS.BLOCKED, "llm_freeform_only");
  }

  if (input.deterministic_fallback === false) {
    return result(DECISIONS.BLOCKED, "no_deterministic_fallback");
  }

  if (input.superior_authority_contradicts === true) {
    return result(DECISIONS.BLOCKED, "superior_authority_contradicts");
  }

  if (
    input.short_circuit &&
    input.candidate_route &&
    input.short_circuit !== input.candidate_route
  ) {
    return result(DECISIONS.BLOCKED, "incompatible_short_circuit");
  }

  const over = exceedsFamilyBudget(input.family, input.cost_class);
  if (over === true) {
    return result(DECISIONS.BLOCKED, "cost_over_budget");
  }

  for (const key of POSITIVE_DEFINED) {
    if (isUnknown(input[key])) {
      return result(DECISIONS.UNKNOWN, `unknown:${key}`);
    }
  }

  if (input.short_circuit === undefined) {
    return result(DECISIONS.UNKNOWN, "unknown:short_circuit");
  }

  if (isUnknown(input.cost_observed) && isUnknown(input.cost_class)) {
    return result(DECISIONS.UNKNOWN, "unknown:cost");
  }

  if (input.feature_flag !== true) {
    return result(DECISIONS.UNKNOWN, "unknown:feature_flag");
  }
  if (input.candidate_from_existing_chain !== true) {
    return result(DECISIONS.BLOCKED, "candidate_not_from_existing_chain");
  }
  if (input.logged_before_execution !== true) {
    return result(DECISIONS.BLOCKED, "not_logged_before_execution");
  }
  if (input.runtime_aligned !== true) {
    return result(DECISIONS.BLOCKED, "runtime_aligned_not_true");
  }
  if (input.target_known !== true) {
    return result(DECISIONS.BLOCKED, "target_unknown");
  }
  if (input.routing_authority_conflict !== false) {
    return result(DECISIONS.BLOCKED, "conflict_not_false");
  }
  if (input.observe_contract_only !== false) {
    return result(DECISIONS.BLOCKED, "observe_contract_only");
  }
  if (input.lexical_token_only !== false) {
    return result(DECISIONS.BLOCKED, "lexical_token_only");
  }
  if (input.multiple_plausible_candidates !== false) {
    return result(DECISIONS.BLOCKED, "multiple_candidates");
  }
  if (input.llm_freeform_only !== false) {
    return result(DECISIONS.BLOCKED, "llm_freeform_only");
  }
  if (input.superior_authority_contradicts !== false) {
    return result(DECISIONS.BLOCKED, "superior_authority_contradicts");
  }

  return result(DECISIONS.PROMOTED, "all_proofs_present");
}

/** Preuves complètes hors T2 — flag à passer explicitement. */
export function completeProofs(overrides = {}) {
  return {
    candidate_from_existing_chain: true,
    candidate_reason: "routingCase:social_wellbeing_checkin",
    candidate_route: "social_deterministic",
    candidate_source: "routing_case:social_wellbeing_checkin",
    expected_response: "SOCIAL_CHECKIN_REPLY_PANEL",
    deterministic_fallback: "SOCIAL_CHECKIN_REPLY_PANEL",
    logged_before_execution: true,
    runtime_aligned: true,
    target_known: true,
    feature_flag: false,
    superior_authority_contradicts: false,
    routing_authority_conflict: false,
    observe_contract_only: false,
    lexical_token_only: false,
    multiple_plausible_candidates: false,
    llm_freeform_only: false,
    family: "social_checkin",
    cost_class: COST.LOW,
    cost_observed: 80,
    cost_before: 80,
    cost_expected: COST.LOW,
    cost_after: null,
    short_circuit: "social_deterministic",
    ...overrides,
  };
}

export function rowById(id) {
  return SECURITY_MATRIX.find((row) => row.id === id) || null;
}
