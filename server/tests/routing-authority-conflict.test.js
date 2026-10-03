/**
 * AUDIT-ROUTING-AUTHORITY-CONFLICTS — observabilité only.
 * Ne consomme rien. Ne change aucune route.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ROUTING_AUTHORITY_CONFLICT_EVENT,
  hasRoutingAuthorityConflict,
  buildRoutingAuthorityConflictEvent,
  recordRoutingAuthorityConflictTelemetry,
} from "../src/agent/telemetry/routingObserveTelemetry.js";
import { SIMPLE_FAST_ORIGINS } from "../src/agent/paths/simpleFastPath.js";

describe("routing_authority_conflict — shadow only", () => {
  it("T2 conversationnel : social vs general/workPresent/SC null", () => {
    const ctx = {
      justIntent: { domain: "social", action: "social_checkin" },
      composedPrimary: "social_checkin",
      socialPattern: "social/casual_status",
      decompositionUnit: "general",
      workPresent: true,
      socialGateDecision: "social_over_work",
      shortCircuitSelected: null,
      downstreamPipeline: "simple_fast",
      downstreamReason: SIMPLE_FAST_ORIGINS.WORD_GUARD,
      responseContract: "INSUFFICIENT_SIGNAL_REFUSAL",
    };
    assert.equal(hasRoutingAuthorityConflict(ctx), true);
    const event = buildRoutingAuthorityConflictEvent(ctx);
    assert.equal(event.event, ROUTING_AUTHORITY_CONFLICT_EVENT);
    assert.deepEqual(event, {
      event: "routing_authority_conflict",
      initial_intent: "social/social_checkin",
      composed_primary: "social_checkin",
      social_pattern: "social/casual_status",
      decomposition_unit: "general",
      work_present: true,
      social_gate_decision: "social_over_work",
      short_circuit_selected: null,
      downstream_pipeline: "simple_fast",
      downstream_reason: "word_guard",
      response_contract: "INSUFFICIENT_SIGNAL_REFUSAL",
      runtime_aligned: false,
      shadow_consumed: false,
    });
    assert.equal("score" in event, false);
    assert.equal(event.shadow_consumed, false);
  });

  it("bonjour check-in : pas de conflit (SC social présent)", () => {
    assert.equal(
      hasRoutingAuthorityConflict({
        justIntent: { domain: "social", action: "social_checkin" },
        composedPrimary: "social_checkin",
        socialPattern: null,
        workPresent: false,
        shortCircuitSelected: "social_deterministic",
      }),
      false,
    );
    assert.equal(
      recordRoutingAuthorityConflictTelemetry({
        justIntent: { domain: "social", action: "social_checkin" },
        composedPrimary: "social_checkin",
        workPresent: false,
        shortCircuitSelected: "social_deterministic",
      }),
      null,
    );
  });

  it("ok, c'est cool : conflit sans pattern catalogue", () => {
    const ctx = {
      justIntent: { domain: "social", action: "social_checkin" },
      composedPrimary: "social_checkin",
      socialPattern: null,
      decompositionUnit: "general",
      workPresent: true,
      socialGateDecision: "social_over_work",
      shortCircuitSelected: null,
      downstreamPipeline: "simple_fast",
      downstreamReason: "word_guard",
      responseContract: "INSUFFICIENT_SIGNAL_REFUSAL",
    };
    assert.equal(hasRoutingAuthorityConflict(ctx), true);
    const event = recordRoutingAuthorityConflictTelemetry(ctx);
    assert.equal(event.social_pattern, null);
    assert.equal(event.shadow_consumed, false);
    assert.equal(event.runtime_aligned, false);
  });

  it("d'accord / disponibilité : pas ce conflit (JUST non social_checkin)", () => {
    assert.equal(
      hasRoutingAuthorityConflict({
        justIntent: { domain: "general", action: "explain" },
        composedPrimary: "explain",
        socialPattern: null,
        workPresent: true,
        shortCircuitSelected: null,
      }),
      false,
    );
  });
});
