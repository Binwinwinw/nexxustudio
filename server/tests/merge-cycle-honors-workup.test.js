import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { mergeAgentCycleWithShortCircuit } from "../src/agent/policies/routing/shortCircuitCognitiveCyclePolicy.js";

describe("MERGE_CYCLE_HONORS_WORKUP_V1", () => {
  it("SC annote sans écraser response_commitment du cycle", () => {
    const base = {
      rule: "cognitive_cycle_factorized_v2",
      intent_assessment: { familyId: "how_to", primaryDomain: "procedure" },
      evidence_requirement: { level: "low" },
      retrieval_decision: { needsExternalInfo: false },
      action_decision: { profile: "chat" },
      response_commitment: { kind: "how_to", renderMode: "llm_direct" },
      plan: { steps: 1 },
    };
    const sc = {
      source: "short_circuit_deterministic",
      shortCircuitPath: "web_project_scoping_clarify",
      migrationBatch: "generic",
      intent_assessment: { familyId: "web_project_scoping", primaryDomain: "web" },
      evidence_requirement: { level: "none" },
      retrieval_decision: { needsExternalInfo: false },
      response_commitment: {
        kind: "web_project_scoping",
        renderMode: "deterministic",
        terminalReply: "Tu veux un site vitrine ?",
      },
    };

    const merged = mergeAgentCycleWithShortCircuit(base, sc);

    assert.equal(merged.response_commitment.renderMode, "llm_direct");
    assert.equal(merged.response_commitment.kind, "how_to");
    assert.equal(merged.intent_assessment.familyId, "how_to");
    assert.equal(merged.short_circuit_authoritative, false);
    assert.equal(merged.shortCircuitPath, "web_project_scoping_clarify");
    assert.equal(
      merged.short_circuit.response_commitment.terminalReply,
      "Tu veux un site vitrine ?",
    );
    assert.equal(merged.action_decision.profile, "chat");
    assert.equal(merged.plan.steps, 1);
  });
});
