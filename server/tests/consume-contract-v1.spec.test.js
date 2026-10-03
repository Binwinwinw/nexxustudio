/**
 * SPEC-CONSUME-CONTRACT-V1 — tests de contrat.
 * Aucune route runtime. Aucun consume.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CONTRACT_ID,
  CONTRACT_STATUS,
  DECISIONS,
  SHADOW_PROMOTION_FLAG,
  SINGLE_CONSUME_POINT,
  FALLBACK_POLICY,
  SECURITY_MATRIX,
  T2_CONVERSATIONAL_CONSUME,
  T2_AVAILABILITY_CONSUME,
  SHORT_CIRCUIT_MISS,
  FORBIDDEN_CONSUME_SEATS,
  FAMILY_COST_BUDGET,
  evaluateShadowPromotion,
  completeProofs,
  rowById,
} from "./fixtures/consume-contract-v1.js";

describe("SPEC-CONSUME-CONTRACT-V1 — spec, routes inchangées", () => {
  it("contrat versionné, flag défaut off, runtime non branché", () => {
    assert.equal(CONTRACT_ID, "SPEC-CONSUME-CONTRACT-V1");
    assert.equal(CONTRACT_STATUS, "recorded_unconsumed");
    assert.equal(SHADOW_PROMOTION_FLAG.defaultEnabled, false);
    assert.equal(SHADOW_PROMOTION_FLAG.runtimeWired, false);
    assert.equal(SINGLE_CONSUME_POINT.runtimeImplemented, false);
    assert.equal(SINGLE_CONSUME_POINT.functionName, "evaluateShadowPromotion");
    assert.equal(SINGLE_CONSUME_POINT.seat, "before_final_pipeline_choice");
    assert.ok(
      SINGLE_CONSUME_POINT.independentOf.includes(
        "pipelineTelemetryCtx.deliverableContract",
      ),
    );
    assert.deepEqual(
      [...FORBIDDEN_CONSUME_SEATS],
      [
        "simple_fast",
        "deliverableContractPolicy",
        "socialPatternPolicy",
        "turnComprehension",
        "enforceModeContract",
      ],
    );
    assert.equal(FAMILY_COST_BUDGET.social_checkin, "low");
    assert.ok(
      FALLBACK_POLICY.forbidden.includes("llm_default_because_shadow_blocked"),
    );
  });

  it("matrice de sécurité : T2 block, observe block, eligible distinct", () => {
    assert.equal(SECURITY_MATRIX.length, 6);
    assert.equal(rowById("T2_conversational").promotion, DECISIONS.BLOCKED);
    assert.equal(rowById("T2_availability").promotion, DECISIONS.BLOCKED);
    assert.equal(rowById("deterministic_valid_route").promotion, "eligible");
    assert.equal(rowById("observe_only").promotion, DECISIONS.BLOCKED);
    assert.equal(rowById("lexical_candidate").promotion, DECISIONS.BLOCKED);
    assert.equal(rowById("unknown_target").promotion, DECISIONS.BLOCKED);
    assert.equal(T2_CONVERSATIONAL_CONSUME.firstPromotionCase, false);
    assert.equal(T2_CONVERSATIONAL_CONSUME.shadow_consumed, false);
    assert.equal(T2_AVAILABILITY_CONSUME.namedAvailabilityCheck, false);
  });

  it("T2 conversationnel reste non consommé", () => {
    const out = evaluateShadowPromotion({
      ...completeProofs({ feature_flag: true }),
      case_id: "T2_conversational",
      t2_conversational: true,
      short_circuit: null,
      routing_authority_conflict: true,
      runtime_aligned: false,
      cost_class: "high",
    });
    assert.equal(out.decision, DECISIONS.BLOCKED);
    assert.equal(out.reason, "t2_consume_forbidden");
    assert.equal(out.shadow_consumed, false);
    assert.equal(out.runtime_consumed, false);
  });

  it("promotion refusée avec routing_authority_conflict", () => {
    const out = evaluateShadowPromotion(
      completeProofs({
        feature_flag: true,
        routing_authority_conflict: true,
        short_circuit: null,
        runtime_aligned: false,
      }),
    );
    assert.equal(out.decision, DECISIONS.BLOCKED);
    assert.equal(out.reason, "routing_authority_conflict");
    assert.equal(out.shadow_consumed, false);
  });

  it("promotion refusée avec shortCircuit=null", () => {
    const out = evaluateShadowPromotion(
      completeProofs({
        feature_flag: true,
        short_circuit: null,
        candidate_route: "social_deterministic",
      }),
    );
    assert.equal(out.decision, DECISIONS.BLOCKED);
    assert.equal(out.reason, "sc_null");
    assert.equal(out.shadow_consumed, false);
  });

  it("shortCircuit=null sans conflit ni candidate ≠ conflit social", () => {
    const out = evaluateShadowPromotion(
      completeProofs({
        feature_flag: true,
        short_circuit: null,
        candidate_route: "",
      }),
    );
    assert.equal(out.decision, DECISIONS.BLOCKED);
    assert.equal(out.reason, SHORT_CIRCUIT_MISS.WITHOUT_CONFLICT);
    assert.notEqual(out.reason, SHORT_CIRCUIT_MISS.WITH_CONFLICT);
  });

  it("promotion refusée avec runtimeAligned=false", () => {
    const out = evaluateShadowPromotion(
      completeProofs({
        feature_flag: true,
        runtime_aligned: false,
      }),
    );
    assert.equal(out.decision, DECISIONS.BLOCKED);
    assert.equal(out.reason, "runtime_aligned_false");
    assert.equal(out.shadow_consumed, false);
  });

  it("promotion refusée si le flag est désactivé", () => {
    const out = evaluateShadowPromotion(completeProofs({ feature_flag: false }));
    assert.equal(out.decision, DECISIONS.BLOCKED);
    assert.equal(out.reason, "flag_disabled");
    assert.equal(out.shadow_consumed, false);
  });

  it("promotion refusée si une condition est unknown", () => {
    const out = evaluateShadowPromotion(
      completeProofs({
        feature_flag: true,
        target_known: "unknown",
      }),
    );
    assert.equal(out.decision, DECISIONS.UNKNOWN);
    assert.match(out.reason, /^unknown:/);
    assert.notEqual(out.decision, DECISIONS.PROMOTED);
    assert.equal(out.shadow_consumed, false);
  });

  it("promotion refusée sans fallback déterministe", () => {
    const out = evaluateShadowPromotion(
      completeProofs({
        feature_flag: true,
        deterministic_fallback: false,
      }),
    );
    assert.equal(out.decision, DECISIONS.BLOCKED);
    assert.equal(out.reason, "no_deterministic_fallback");
    assert.equal(out.shadow_consumed, false);
  });

  it("promotion éligible uniquement lorsque toutes les preuves sont présentes", () => {
    const blocked = evaluateShadowPromotion(completeProofs());
    assert.equal(blocked.decision, DECISIONS.BLOCKED);
    const out = evaluateShadowPromotion(
      completeProofs({ feature_flag: true }),
    );
    assert.equal(out.decision, DECISIONS.PROMOTED);
    assert.equal(out.reason, "all_proofs_present");
    assert.equal(out.shadow_consumed, false);
    assert.equal(out.runtime_consumed, false);
  });

  it("aucune lecture de deliverableContract comme autorité", () => {
    const out = evaluateShadowPromotion(
      completeProofs({
        feature_flag: true,
        candidate_from_existing_chain: false,
        candidate_source: "deliverable_contract_observe",
        deliverableContract: {
          promisedValue: "social_continuity",
          runtimeAligned: true,
          enforcement: false,
        },
      }),
    );
    assert.equal(out.decision, DECISIONS.BLOCKED);
    assert.equal(out.reason, "observe_contract_only");
    assert.equal(out.shadow_consumed, false);
  });

  it("shadow_consumed=false sur tous les cas bloqués de la matrice", () => {
    const blockedRows = SECURITY_MATRIX.filter(
      (row) => row.promotion === DECISIONS.BLOCKED,
    );
    assert.ok(blockedRows.length >= 5);
    for (const row of blockedRows) {
      const out = evaluateShadowPromotion({
        case_id: row.id,
        t2_conversational: row.id === "T2_conversational",
        t2_availability: row.id === "T2_availability",
        ...completeProofs({
          feature_flag: true,
          observe_contract_only: row.id === "observe_only",
          candidate_source:
            row.id === "observe_only" ? "deliverable_contract_observe" : undefined,
          lexical_token_only: row.id === "lexical_candidate",
          target_known: row.id === "unknown_target" ? false : true,
        }),
      });
      assert.notEqual(out.decision, DECISIONS.PROMOTED, row.id);
      assert.equal(out.shadow_consumed, false, row.id);
    }
  });

  it("coût high sur famille sociale → block ; absence de coût → unknown", () => {
    const over = evaluateShadowPromotion(
      completeProofs({
        feature_flag: true,
        cost_class: "high",
      }),
    );
    assert.equal(over.decision, DECISIONS.BLOCKED);
    assert.equal(over.reason, "cost_over_budget");
    const unknownCost = evaluateShadowPromotion(
      completeProofs({
        feature_flag: true,
        cost_class: "unknown",
        cost_observed: "unknown",
      }),
    );
    assert.equal(unknownCost.decision, DECISIONS.UNKNOWN);
    assert.notEqual(unknownCost.decision, DECISIONS.PROMOTED);
  });
});
