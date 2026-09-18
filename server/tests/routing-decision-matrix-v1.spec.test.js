/**
 * Lot MATRIX-ROUTING-DECISION-V1 — tests de spécification / audit.
 * Siège DECIDE-TARGET-SEAT-AND-CONTRACT : Option C provisoire.
 * N'exigent pas que le runtime adopte la politique. Conservent T1, GitHub, RTS, Pack 6.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MATRIX_ID,
  REVIEW_ID,
  SEAT_DECISION_ID,
  REVIEW_LOT3_ID,
  MATRIX_STATUS,
  PRODUCT_DECISIONS_STATUS,
  TARGET_SEAT_STATUS,
  PRIORITY_HYPOTHESIS,
  FAMILIES,
  EXCLUSIONS,
  DECISION_ROWS,
  CONFLICTS,
  PRODUCT_DECISIONS,
  SECOND_PERSON_POLICY,
  TARGET_CONTRACT_OPTIONS,
  TARGET_SEAT_GUARDRAILS,
  ACTIVE_CONTEXT_DEFINITION,
  CONTEXT_STATES,
  RESULT_USABILITY,
  TEMPORAL_POLICY,
  CONTEXT_CRITERIA_SAMPLES,
  deriveContextState,
  deriveResultUsability,
  T2_FUTURE_SHADOW_RULE,
  LOT3_SHADOW_SCOPE,
  PERSIST_ROUTING_METADATA_V1,
  CLARIFY_INTERRUPT,
  rowById,
  RTS_CANONICAL,
} from "./fixtures/routing-decision-matrix-v1.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { runAgentUnderstandingPhase } from "../src/agent/nexxusAgentCycle.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { getIdentityDeterministicReply } from "../src/agent/utils/intent-guards/identityIntentGuards.js";
import { isWellbeingCheckinIntent } from "../src/agent/policies/social/index.js";
import { isRepoAnalysisRequest } from "../src/agent/utils/intent-guards/repoAnalysisIntentGuards.js";
import { isResearchThenSummarizeRequest } from "../src/agent/policies/routing/researchThenSummarizePolicy.js";

async function sc(query) {
  const { turnComprehension, turnLoop, understanding } =
    runAgentUnderstandingPhase(query, []);
  return runConversationShortCircuit(query, {
    history: [],
    turnComprehension,
    turnLoop,
    justIntent: evaluateJustIntent(query),
    queryUnderstanding: understanding,
    getDeterministicSocialResponse: (q) => getIdentityDeterministicReply(q),
  });
}

describe("MATRIX-ROUTING-DECISION-V1 — spec, routes inchangées", () => {
  it("artefact versionné, hypothèse non adoptée, familles A–H", () => {
    assert.equal(MATRIX_ID, "MATRIX-ROUTING-DECISION-V1");
    assert.equal(REVIEW_ID, "REVIEW-MATRIX-ROUTING-DECISION-V1");
    assert.equal(SEAT_DECISION_ID, "DECIDE-TARGET-SEAT-AND-CONTRACT");
    assert.equal(REVIEW_LOT3_ID, "REVIEW-LOT3-SHADOW-CONTEXT");
    assert.equal(MATRIX_STATUS, "hypothesis_unadopted");
    assert.equal(PRODUCT_DECISIONS_STATUS, "recorded");
    assert.equal(TARGET_SEAT_STATUS, "option_c_provisional");
    assert.equal(PRIORITY_HYPOTHESIS.length, 8);
    assert.deepEqual(
      PRIORITY_HYPOTHESIS.map((p) => p.id),
      [
        "security_or_action_constraint",
        "contextual_continuation",
        "specified_explicit_action",
        "assistant_directed_deterministic",
        "specialized_locator_compatible_act",
        "external_factual",
        "general_explain",
        "clarify_or_fallback_by_precondition",
      ],
    );
    for (const key of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
      assert.ok(FAMILIES[key], key);
    }
    assert.equal(CLARIFY_INTERRUPT.isPrecondition, true);
    assert.equal(CLARIFY_INTERRUPT.notLastCategoryOnly, true);
    assert.equal(rowById("M7").priority, 2);
    assert.equal(rowById("M7").clarify, true);
    assert.equal(rowById("M8").priority, 3);
    assert.equal(rowById("M8").clarify, true);
  });

  it("cas obligatoires et exclusions présentes", () => {
    const ids = DECISION_ROWS.map((r) => r.id);
    for (const id of [
      "M1", "T2", "T1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9",
      "T9", "T10", "RTS", "TU_DATETIME", "ESTCE_FACTUAL", "ACTION_EXPLICIT",
      "ACTION_ADDRESSED", "REPO_ADDRESSED",
    ]) {
      assert.ok(ids.includes(id), id);
    }
    const exclusionIds = EXCLUSIONS.map((e) => e.id);
    for (const id of [
      "server_dispo_not_social",
      "repo_available_not_analysis",
      "page_summary_not_repo",
      "keep_research_then_summarize",
      "tu_insufficient_for_social",
      "dispo_insufficient_for_target",
      "url_insufficient_for_act",
      "est_ce_que_insufficient_for_factual",
      "social_miss_not_factual_proof",
      "help_offer_not_action",
      "state_question_not_analysis_or_action",
      "second_person_insufficient_for_rail",
    ]) {
      assert.ok(exclusionIds.includes(id), id);
    }
  });

  it("frontières assistant / ressource / dépôt / page / workspace", () => {
    assert.equal(rowById("T2").target, "assistant");
    assert.equal(rowById("T2").expectedDecision, "social_deterministic");
    assert.ok(rowById("T2").exclusions.includes("simple_factual_lookup"));
    assert.equal(rowById("M2").target, "server");
    assert.ok(rowById("M2").exclusions.includes("social_deterministic"));
    assert.equal(rowById("T9").target, "repository");
    assert.ok(rowById("T9").exclusions.includes("REPO_ANALYSIS"));
    assert.ok(rowById("T9").exclusions.includes("social_deterministic"));
    assert.equal(rowById("M5").expectedDecision, "repo_analysis_llm");
    assert.equal(rowById("M6").expectedDecision, "document_synthesis_llm");
    assert.ok(rowById("M6").exclusions.includes("REPO_ANALYSIS"));
    assert.equal(rowById("M8").target, "workspace");
    assert.equal(rowById("M9").expectedDecision, "clarify");
    assert.ok(rowById("TU_DATETIME").exclusions.includes("tu_insufficient_for_social"));
  });

  it("M3/M7/M8/T9 : décisions produit figées", () => {
    const recordedIds = PRODUCT_DECISIONS.map((d) => d.id);
    assert.deepEqual(recordedIds, ["M3", "M7", "M8", "T9"]);

    const m3 = rowById("M3");
    assert.equal(m3.productRecorded, true);
    assert.equal(m3.expectedDecision, "social_deterministic");
    assert.equal(m3.isAction, false);
    assert.equal(m3.clarify, false);
    assert.ok(m3.exclusions.includes("help_offer_not_action"));
    assert.equal(m3.productOpen, undefined);

    const m7 = rowById("M7");
    assert.equal(m7.productRecorded, true);
    assert.equal(m7.continuationRequiresActiveContext, true);
    assert.equal(m7.inventTarget, false);
    assert.equal(m7.expectedDecision, "clarify");
    assert.equal(m7.candidateRoute, "continuation_if_active_context_else_clarify");
    assert.equal(m7.productOpen, undefined);

    const m8 = rowById("M8");
    assert.equal(m8.productRecorded, true);
    assert.equal(m8.expectedDecision, "clarify");
    assert.deepEqual(m8.actionPreconditions, ["name", "content", "context"]);
    assert.equal(m8.keepExistingControls, true);
    assert.equal(m8.isAction, false);
    assert.equal(m8.maxCost, "clarify");
    assert.equal(m8.productOpen, undefined);

    const t9 = rowById("T9");
    assert.equal(t9.productRecorded, true);
    assert.equal(t9.resourceKind, "state");
    assert.equal(t9.isAction, false);
    assert.ok(t9.exclusions.includes("social_deterministic"));
    assert.ok(t9.exclusions.includes("REPO_ANALYSIS"));
    assert.ok(t9.exclusions.includes("state_question_not_analysis_or_action"));
    assert.notEqual(t9.expectedDecision, "social_deterministic");
    assert.notEqual(t9.expectedDecision, "repo_analysis_llm");
  });

  it("pronom 2e personne n'élit pas le rail", () => {
    const m3 = SECOND_PERSON_POLICY.find((p) => p.id === "M3");
    const tests = SECOND_PERSON_POLICY.find((p) => p.id === "ACTION_ADDRESSED");
    const repo = SECOND_PERSON_POLICY.find((p) => p.id === "REPO_ADDRESSED");
    assert.equal(m3.isAction, false);
    assert.equal(m3.rail, "social_deterministic");
    assert.equal(tests.isAction, true);
    assert.equal(tests.rail, "action_pipeline");
    assert.equal(repo.isAnalysis, true);
    assert.equal(repo.isAction, false);
    assert.equal(rowById("ACTION_ADDRESSED").expectedDecision, "action_pipeline");
    assert.equal(rowById("REPO_ADDRESSED").expectedDecision, "repo_analysis_llm");
    assert.ok(rowById("ACTION_ADDRESSED").exclusions.includes("social_deterministic"));
  });

  it("siège Option C provisoire ; A labels non autoritaires ; B différée", () => {
    assert.equal(TARGET_CONTRACT_OPTIONS.length, 3);
    const byId = Object.fromEntries(TARGET_CONTRACT_OPTIONS.map((o) => [o.id, o]));
    assert.equal(byId.outside_frame_selection_policy.adopted, true);
    assert.equal(byId.outside_frame_selection_policy.role, "provisional_reversible_seat");
    assert.equal(byId.derived_nondecisional_projection.adopted, false);
    assert.equal(byId.derived_nondecisional_projection.role, "diagnostic_or_policy_label_only");
    assert.equal(byId.future_controlled_task_extension.adopted, false);
    assert.equal(TARGET_SEAT_GUARDRAILS.provisional, true);
    assert.equal(TARGET_SEAT_GUARDRAILS.reversible, true);
    assert.equal(TARGET_SEAT_GUARDRAILS.targetInEntities, false);
    assert.equal(TARGET_SEAT_GUARDRAILS.newTaskField, false);
    assert.equal(TARGET_SEAT_GUARDRAILS.secondNlu, false);
    assert.equal(TARGET_SEAT_GUARDRAILS.independentTargetDetector, false);
    assert.equal(TARGET_SEAT_GUARDRAILS.projectionsAuthoritative, false);
    assert.equal(TARGET_SEAT_GUARDRAILS.absentSignal, "unknown");
    assert.ok(TARGET_SEAT_GUARDRAILS.projectionSources.includes("existing_guards"));
    assert.equal(LOT3_SHADOW_SCOPE.opened, true);
    assert.ok(LOT3_SHADOW_SCOPE.out.includes("independent_target_detector"));
    assert.ok(LOT3_SHADOW_SCOPE.out.includes("consume_matrix_in_short_circuit"));
    assert.equal(PERSIST_ROUTING_METADATA_V1.opened, true);
    assert.equal(PERSIST_ROUTING_METADATA_V1.consumeForbidden, true);
    assert.equal(PERSIST_ROUTING_METADATA_V1.inferActFromAssistantText, false);
    assert.equal(PERSIST_ROUTING_METADATA_V1.rewriteEntities, false);
    assert.equal(PERSIST_ROUTING_METADATA_V1.rewriteTask, false);
    assert.equal(PERSIST_ROUTING_METADATA_V1.namedAvailabilityCheck, false);
    assert.equal(PERSIST_ROUTING_METADATA_V1.ignoreLegacyWithoutMetadata, true);
    assert.equal(PERSIST_ROUTING_METADATA_V1.lastAssistantOnly, true);
    assert.equal(T2_FUTURE_SHADOW_RULE.consumed, false);
  });

  it("contexte M7 : NO_CONTEXT / ACTIVE_CONTEXT / CONTEXT_AMBIGUOUS", () => {
    assert.deepEqual(
      Object.values(CONTEXT_STATES),
      ["NO_CONTEXT", "ACTIVE_CONTEXT", "CONTEXT_AMBIGUOUS"],
    );
    assert.equal(ACTIVE_CONTEXT_DEFINITION.historyAloneInsufficient, true);
    assert.equal(ACTIVE_CONTEXT_DEFINITION.requireAll, true);
    assert.equal(ACTIVE_CONTEXT_DEFINITION.lastAssistantNonEmptyInsufficient, true);
    assert.equal(ACTIVE_CONTEXT_DEFINITION.criteria.length, 5);
    assert.equal(rowById("M7").continuationRequiresActiveContext, true);
    assert.equal(rowById("M7").inventTarget, false);
    assert.equal(rowById("M7").expectedDecision, "clarify");

    const byId = Object.fromEntries(
      ACTIVE_CONTEXT_DEFINITION.examples.map((e) => [e.id, e]),
    );
    assert.equal(byId.continue_same_repo_summary.state, CONTEXT_STATES.ACTIVE_CONTEXT);
    assert.equal(byId.append_section_named_file.state, CONTEXT_STATES.ACTIVE_CONTEXT);
    assert.equal(byId.rerun_tests_after_result.state, CONTEXT_STATES.ACTIVE_CONTEXT);
    assert.equal(byId.M7_isolated.state, CONTEXT_STATES.NO_CONTEXT);
    assert.equal(byId.social_then_continue.state, CONTEXT_STATES.NO_CONTEXT);
    assert.equal(byId.history_only.state, CONTEXT_STATES.NO_CONTEXT);
    assert.equal(byId.repo_then_server_state.state, CONTEXT_STATES.NO_CONTEXT);
    assert.equal(byId.repo_then_server_state.newerIncompatible, true);
    assert.equal(byId.ambiguous_locator.state, CONTEXT_STATES.CONTEXT_AMBIGUOUS);
    assert.equal(byId.unknown_compatibility_after_repo.state, CONTEXT_STATES.CONTEXT_AMBIGUOUS);
    assert.equal(byId.M7_isolated.query, rowById("M7").query);

    for (const sample of CONTEXT_CRITERIA_SAMPLES) {
      assert.equal(deriveContextState(sample.criteria), sample.expected, sample.id);
    }
    assert.equal(
      deriveContextState(CONTEXT_CRITERIA_SAMPLES.find((s) => s.id === "active_all_true").criteria),
      CONTEXT_STATES.ACTIVE_CONTEXT,
    );
  });

  it("résultat exploitable : pipeline + acte, pas un message assistant non vide", () => {
    assert.equal(RESULT_USABILITY.lastAssistantNonEmptyInsufficient, true);
    assert.ok(RESULT_USABILITY.requirements.includes("identifiable_pipeline"));
    assert.ok(RESULT_USABILITY.requirements.includes("not_purely_social"));
    assert.ok(RESULT_USABILITY.requirements.includes("not_purely_meta"));
    for (const row of RESULT_USABILITY.positives) {
      assert.equal(row.usable, true, row.id);
    }
    for (const row of RESULT_USABILITY.negatives) {
      assert.equal(row.usable, false, row.id);
    }
    const labels = RESULT_USABILITY.positives.map((r) => r.id);
    for (const id of ["repo_summary", "file_analysis", "test_result", "confirmed_create_or_edit"]) {
      assert.ok(labels.includes(id), id);
    }
    const bad = RESULT_USABILITY.negatives.map((r) => r.id);
    for (const id of [
      "greeting",
      "availability_reply",
      "clarify_only",
      "generic_error",
      "internal_diagnostic",
      "interrupted_reply",
      "no_identifiable_pipeline",
    ]) {
      assert.ok(bad.includes(id), id);
    }
    const unk = RESULT_USABILITY.unknowns.map((r) => r.id);
    for (const id of [
      "assistant_nonempty_without_metadata",
      "legacy_turn_without_act",
      "task_status_absent",
      "pipeline_without_act",
    ]) {
      assert.ok(unk.includes(id), id);
    }
    const allTrue = Object.fromEntries(
      RESULT_USABILITY.criterionKeys.map((key) => [key, true]),
    );
    assert.equal(deriveResultUsability(allTrue), "exploitable");
    assert.equal(deriveResultUsability({ ...allTrue, not_social: false }), "non_exploitable");
    assert.equal(deriveResultUsability({ ...allTrue, act_or_task_associated: "unknown" }), "unknown");
    assert.equal(
      deriveResultUsability({ ...allTrue, act_or_task_associated: "unknown", not_social: false }),
      "non_exploitable",
    );
    assert.equal(LOT3_SHADOW_SCOPE.in.includes("align_result_usability_shadow"), true);
    assert.equal(TEMPORAL_POLICY.noMinuteWindow, true);
    assert.equal(TEMPORAL_POLICY.unavailable, "unknown");
    assert.deepEqual(
      [...TEMPORAL_POLICY.order],
      [
        "existing_task_status",
        "turn_id_or_conversational_order",
        "semantic_compatibility",
        "no_newer_incompatible_task",
      ],
    );
  });

  it("règle T2 : shadow observé suspect, non consommé", () => {
    assert.equal(T2_FUTURE_SHADOW_RULE.implemented, false);
    assert.equal(T2_FUTURE_SHADOW_RULE.observed, true);
    assert.equal(T2_FUTURE_SHADOW_RULE.consumed, false);
    assert.equal(T2_FUTURE_SHADOW_RULE.shadowOnly, true);
    assert.equal(T2_FUTURE_SHADOW_RULE.namedAvailabilityCheck, false);
    assert.equal(T2_FUTURE_SHADOW_RULE.promoteCandidateRoute, false);
    assert.equal(T2_FUTURE_SHADOW_RULE.secondPersonAloneInsufficient, true);
    assert.equal(T2_FUTURE_SHADOW_RULE.observedValue, "suspect");
    assert.equal(T2_FUTURE_SHADOW_RULE.covers, "assistant_directed_act");
    assert.equal(T2_FUTURE_SHADOW_RULE.tuDatetimeExclusionIncomplete, true);
    assert.ok(T2_FUTURE_SHADOW_RULE.mustNotMatch.includes("TU_DATETIME"));
    assert.ok(T2_FUTURE_SHADOW_RULE.mustNotMatch.includes("M2"));
    assert.ok(T2_FUTURE_SHADOW_RULE.mustNotMatch.includes("T9"));
    assert.ok(T2_FUTURE_SHADOW_RULE.mustNotMatch.includes("M4"));
    assert.equal(rowById("T2").gap, true);
    assert.equal(rowById("T2").currentObserved, "simple_factual_lookup");
  });

  it("ambiguïté distincte du déterministe ; coût A interdit very_high", () => {
    assert.equal(rowById("M9").ambiguity, "high");
    assert.equal(rowById("T2").ambiguity, "low");
    assert.equal(rowById("T2").maxCost, "low");
    assert.notEqual(rowById("T2").maxCost, "very_high");
    assert.equal(rowById("M9").clarify, true);
    assert.equal(rowById("T1").clarify, false);
    assert.equal(rowById("M3").ambiguity, "low");
  });

  it("Pack 6 / T1 : wellbeing + social_deterministic inchangés", async () => {
    const t1 = rowById("T1");
    assert.equal(isWellbeingCheckinIntent(t1.query), true);
    const hit = await sc(t1.query);
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.path, t1.expectedDecision);
    assert.equal(t1.gap, false);
  });

  it("GitHub conservé : M5/T10/REPO_ADDRESSED REPO ; M6 page ; T9 pas REPO", async () => {
    const m5 = await sc(rowById("M5").query);
    assert.equal(m5?.path, "repo_analysis_llm");
    assert.equal(m5?.forcedIntentContractId, "REPO_ANALYSIS");
    const t10 = await sc(rowById("T10").query);
    assert.equal(t10?.path, "repo_analysis_llm");
    const addressed = await sc(rowById("REPO_ADDRESSED").query);
    assert.equal(addressed?.path, "repo_analysis_llm");
    const m6 = await sc(rowById("M6").query);
    assert.equal(m6?.path, "document_synthesis_llm");
    assert.ok(m6?.webSummary);
    assert.equal(isRepoAnalysisRequest(rowById("M6").query), false);
    assert.equal(isRepoAnalysisRequest(rowById("T9").query), false);
    const t9 = await sc(rowById("T9").query);
    assert.notEqual(t9?.path, "repo_analysis_llm");
    assert.notEqual(t9?.forcedIntentContractId, "REPO_ANALYSIS");
    assert.notEqual(t9?.path, "social_deterministic");
  });

  it("research-then-summarize conservé, pas REPO_ANALYSIS", async () => {
    assert.equal(isResearchThenSummarizeRequest(RTS_CANONICAL), true);
    assert.equal(isRepoAnalysisRequest(RTS_CANONICAL), false);
    const hit = await sc(RTS_CANONICAL);
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.notEqual(hit?.path, "repo_analysis_llm");
  });

  it("écarts ouverts documentés, runtime non « corrigé »", async () => {
    const t2 = rowById("T2");
    assert.equal(t2.gap, true);
    assert.equal(t2.expectedDecision, "social_deterministic");
    const t2hit = await sc(t2.query);
    assert.equal(t2hit?.path, "simple_factual_lookup");
    assert.equal(t2hit?.path, t2.currentObserved);
    assert.notEqual(t2hit?.path, t2.expectedDecision);

    for (const id of ["M1", "M3", "M7", "M8"]) {
      const row = rowById(id);
      assert.equal(row.gap, true);
      const hit = await sc(row.query);
      assert.equal(hit, null, id);
    }

    const t9hit = await sc(rowById("T9").query);
    assert.equal(rowById("T9").gap, true);
    assert.notEqual(t9hit?.path, "social_deterministic");
    assert.notEqual(t9hit?.path, "repo_analysis_llm");
  });

  it("conflits : produit tranché vs architecture encore ouverte", () => {
    const byId = Object.fromEntries(CONFLICTS.map((c) => [c.id, c]));
    assert.equal(byId.assistant_vs_workspace.resolved, true);
    assert.equal(byId.continuation_vs_new_request.resolved, true);
    assert.equal(byId.github_locator_vs_general.resolved, true);
    assert.equal(byId.assistant_vs_external_resource.resolved, true);
    assert.equal(byId.ambiguity_vs_deterministic.resolved, true);
    assert.equal(byId.factual_without_source.resolved, false);
    assert.equal(byId.tu_shadow_noise.resolved, false);
  });
});
