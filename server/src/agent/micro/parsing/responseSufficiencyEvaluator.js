/**
 * Évaluation de suffisance — voir autoReplySufficiencyRule.js (règle transversale).
 */
import {
  AUTO_REPLY_SUFFICIENCY_FORMULA,
  AUTO_REPLY_SUFFICIENCY_RULE,
} from "./autoReplySufficiencyRule.js";
import { resolveQueryGoals } from "./goalRoleResolver.js";
import { GOAL_LINKER_PATTERN, parseRequestSegments } from "./requestSegmentParser.js";
import { isUiNavigationRestructureFeedback } from "../../utils/uiNavigationFeedbackGuards.js";

export const SUFFICIENCY_TIER = {
  INSTANT_OK: "instant_ok",
  COMPOSED: "composed",
  DEFER_PIPELINE: "defer_pipeline",
};

const GOAL_MARKER_PATTERN =
  /\b(?:afin de|pour pouvoir|pour trouver|pour savoir|en vue de|histoire de|de facon a|de façon a|de maniere a|de manière a)\b/i;

const SECONDARY_ACTION_PATTERN =
  /\b(trouver|choisir|comparer|acheter|creer|créer|corriger|recommand|conseill|decider|décider|evaluer|évaluer|analyser|optimiser)\b/i;

const RECOMMENDATION_PATTERN =
  /\b(bon achat|meilleur|recommand|conseil|quel .* choisir|quelle .* choisir|serait un bon)\b/i;

const REFLECTIVE_PRIMARY = new Set([
  "purchase_advice",
  "recommendation",
  "how_to",
  "general",
]);

/**
 * @param {string} rawQuery
 */
export function buildParseState(rawQuery = "") {
  const goals = resolveQueryGoals(rawQuery);
  const wordCount = goals.parsed?.normalized
    ? goals.parsed.normalized.split(/\s+/).filter(Boolean).length
    : 0;

  return {
    ...goals,
    wordCount,
    hasGoalMarker: GOAL_MARKER_PATTERN.test(goals.parsed?.normalized || ""),
    segmentCount: goals.parsed?.segments?.length ?? 0,
  };
}

function hasSecondaryActionBeyondSignal(parseState, detectedSignal) {
  const normalized = parseState.parsed?.normalized || "";
  if (!normalized || !detectedSignal) return false;

  const segments = parseState.parsed?.segments || [];
  const primary = parseState.primarySegment?.text || normalized;
  const supportTexts = segments
    .filter((s) => s.type === detectedSignal)
    .map((s) => s.text)
    .join(" ");

  let remainder = normalized;
  for (const frag of [supportTexts, detectedSignal]) {
    if (frag) remainder = remainder.replace(frag, " ");
  }
  remainder = remainder.replace(GOAL_MARKER_PATTERN, " ").trim();

  return SECONDARY_ACTION_PATTERN.test(remainder) && remainder.length > 8;
}

/**
 * @param {{
 *   query?: string,
 *   detectedSignal?: string|null,
 *   parseState?: ReturnType<typeof buildParseState>|null,
 *   candidateReply?: string|null,
 *   shortCircuitPath?: string|null,
 * }} input
 */
export function evaluateAutoReplySufficiency(input = {}) {
  const query = String(input.query || "");
  const parseState = input.parseState || buildParseState(query);
  const detectedSignal = input.detectedSignal || null;
  const reasons = [];

  if (input.shortCircuitPath === "react_audit_clarify") {
    reasons.push("react_audit_clarify_requires_confirmation");
    if (isUiNavigationRestructureFeedback(query)) {
      reasons.push("clarify_competing_ui_intent");
    }
  }

  if (parseState.hasGoalMarker || parseState.parsed?.linker) {
    reasons.push("goal_marker_present");
  }
  if (parseState.isMultiIntent) {
    reasons.push("multi_intent_segments");
  }
  if ((parseState.segmentCount ?? 0) > 1) {
    reasons.push("multiple_segments");
  }
  if (
    detectedSignal &&
    parseState.primaryGoal &&
    parseState.primaryGoal !== detectedSignal &&
    REFLECTIVE_PRIMARY.has(parseState.primaryGoal)
  ) {
    reasons.push("primary_goal_exceeds_signal");
  }
  if (RECOMMENDATION_PATTERN.test(parseState.parsed?.normalized || "")) {
    if (
      !detectedSignal ||
      detectedSignal === "time_lookup" ||
      parseState.primaryGoal !== detectedSignal
    ) {
      reasons.push("recommendation_or_arbitrage");
    }
  }
  if (hasSecondaryActionBeyondSignal(parseState, detectedSignal)) {
    reasons.push("secondary_action_verbs");
  }
  if (parseState.wordCount > 14 && parseState.isMultiIntent) {
    reasons.push("extended_compound_query");
  }

  const sufficient = reasons.length === 0;

  let tier = SUFFICIENCY_TIER.INSTANT_OK;
  if (!sufficient) {
    const needsPipeline =
      REFLECTIVE_PRIMARY.has(parseState.primaryGoal) ||
      reasons.includes("recommendation_or_arbitrage") ||
      reasons.includes("primary_goal_exceeds_signal");
    tier = needsPipeline
      ? SUFFICIENCY_TIER.DEFER_PIPELINE
      : SUFFICIENCY_TIER.COMPOSED;
  }

  return {
    sufficient,
    tier,
    reasons,
    parseState,
    rule: AUTO_REPLY_SUFFICIENCY_RULE,
    formula: AUTO_REPLY_SUFFICIENCY_FORMULA,
    doctrine: "detection_not_sufficiency",
  };
}

export { AUTO_REPLY_SUFFICIENCY_RULE, AUTO_REPLY_SUFFICIENCY_FORMULA };

/** Chemins dont la réponse auto est intrinsèquement complète (clarification, confirmation). */
export const SUFFICIENCY_BYPASS_PATHS = new Set([
  "request_interpreter_clarify",
  "request_interpreter_confirm",
  "procedure_deterministic",
  "procedure_subject_nature_gate",
  "procedure_subject_mini_deliberation",
  "procedure_subject_reasoned_gate",
  "forge_project_scoping_ready",
  "forge_handoff_ready",
  "familiarity_deterministic",
  "launcher_guide_deterministic",
  "launcher_guide_clarify",
  "meta_feedback_deterministic",
  "meta_assistant_behavior_deterministic",
  "comprehension_grounding_deterministic",
  "react_audit_deterministic",
  "react_audit_diff",
  "react_audit_score",
  "assistant_utterance_clarify_deterministic",
  "exploratory_conversation_light",
  "existing_source_analysis_clarify_access",
  "existing_source_analysis_deterministic",
  "existing_source_analysis_not_found",
  "repo_analysis_deterministic",
  "repo_analysis_not_found",
  "repo_analysis_llm",
  "web_search_help_clarify",
  "lexicon_explain_light",
  "lexicon_science_format_deterministic",
  "lexicon_science_format_detailed_deterministic",
  "lexicon_science_format_table_deterministic",
  "lexicon_science_format_table_multi_deterministic",
  "lexicon_science_format_table_multi_batch_deterministic",
  "lexicon_science_format_table_budget_confirm",
  "lexicon_science_format_table_llm",
  "lexicon_science_format_table_multi_llm",
  "lexicon_science_format_table_multi_hybrid_llm",
  "lexicon_science_format_llm",
  "lexicon_science_takeaway_deterministic",
  "ideation_deterministic",
  "open_prompt_continuity",
  "social_composite_deterministic",
  "code_concept_glossary_direct",
  "architecture_design_deterministic",
  "web_project_scoping_clarify",
  "web_project_scoping_direct",
  "social_deterministic",
  "guided_choice_deterministic",
  "epistemic_honesty_deterministic",
  "epistemic_verify_external",
  "conversation_continuity_deterministic",
  "meta_conversation_deterministic",
  "meta_capabilities_deterministic",
  "meta_capabilities_model_stack_deterministic",
  "meta_capabilities_prediction_limits_deterministic",
  "meta_capabilities_peer_assistants_deterministic",
  "meta_capabilities_runtime_progress_deterministic",
  "meta_capabilities_modalities_deterministic",
  "information_seeking_light_deterministic",
  "casual_explanation_light_deterministic",
  "self_modification_deterministic",
  "anaphora_reference_deterministic",
  "anaphora_reference_carryover",
  "general_knowledge_deterministic",
  "pedagogical_overview_deterministic",
  "technical_learning_path",
  "recipe_knowledge_deterministic",
  "assistant_repair_deterministic",
  "simple_factual_abstain",
  "simple_factual_clarify",
  "translation_clarify",
  "translation_pipeline",
  "translation_multi_target",
  "multi_unit_deterministic",
  "multi_unit_partial_clarify",
  "how_to_simple_local",
  "how_to_clarify",
  "how_to_complex_clarify",
  "subject_type_clarify",
  "subject_type_resolved",
  "math_simple_deterministic",
  "math_arithmetic_deterministic",
  "math_root_deterministic",
  "math_geometry_deterministic",
  "math_explain_deterministic",
  "math_percent_deterministic",
  "math_composite_deterministic",
  "query_composite_deterministic",
  "governance_explain_deterministic",
  "document_synthesis_deterministic",
  "document_synthesis_clarify",
  "document_synthesis_llm",
  "familiarity_domain_overview_deterministic",
  "subject_reference_resume_deterministic",
  "subject_reference_clarify",
  "subject_reference_entity_clarify",
  "formal_letter_template_deterministic",
  "prompt_for_artifact_deterministic",
  "pedagogy_soft_overview_deterministic",
  "weather_current_web",
  "datetime_deterministic",
]);

/**
 * Infère le type de signal dominé pour l'évaluation.
 * @param {string} path
 */
export function inferDetectedSignalFromPath(path, query = "") {
  if (path === "social_deterministic") {
    const goals = resolveQueryGoals(query);
    if (
      goals.primaryGoal === "time_lookup" ||
      goals.parsed?.segments?.some((segment) => segment.type === "time_lookup")
    ) {
      return "time_lookup";
    }
    if (/(citadelle|nexxus).*(agent|forge)/i.test(query)) return "architecture_fact";
    return "social";
  }
  if (path === "meta_assistant_behavior_deterministic") return "meta";
  if (path === "comprehension_grounding_deterministic") return "meta";
  if (path === "react_audit_deterministic" || path === "react_audit_diff" || path === "react_audit_score" || path === "react_audit_clarify") {
    return "code_review";
  }
  if (path === "meta_conversation_deterministic") return "meta";
  if (path === "conversation_continuity_deterministic") return "continuity";
  if (path === "familiarity_deterministic") return "familiarity";
  if (path === "familiarity_domain_overview_deterministic") return "familiarity";
  if (
    path === "launcher_guide_deterministic" ||
    path === "launcher_guide_clarify"
  ) {
    return "how_to";
  }
  if (path === "architecture_design_deterministic") return "architecture";
  if (path === "ideation_deterministic") return "ideation";
  return "unknown";
}
