import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildShortCircuitCognitiveContribution,
  annotateShortCircuitCognitiveCycle,
  mergeAgentCycleWithShortCircuit,
} from "../src/agent/policies/routing/shortCircuitCognitiveCyclePolicy.js";
import { buildRequestWorkup } from "../src/agent/policies/conversation/conversationQueryUnderstanding.js";
import { understandQuery } from "../src/agent/policies/conversation/conversationQueryUnderstanding.js";

describe("shortCircuitCognitiveCycle — lot 1 social/datetime/math/meta", () => {
  it("social_deterministic — écrit dans les 4 blocs", () => {
    const contribution = buildShortCircuitCognitiveContribution({
      path: "social_deterministic",
      reply: "Salut ! Sur quoi veux-tu travailler ?",
    });
    assert.equal(contribution.migrationBatch, "social");
    assert.equal(contribution.evidence_requirement.level, "none");
    assert.equal(contribution.retrieval_decision.needsExternalInfo, false);
    assert.equal(contribution.response_commitment.renderMode, "deterministic");
    assert.match(contribution.response_commitment.terminalReply, /Salut/);
  });

  it("datetime_deterministic — preuve none", () => {
    const contribution = buildShortCircuitCognitiveContribution({
      path: "datetime_deterministic",
      reply: "Il est 14:30.",
    });
    assert.equal(contribution.migrationBatch, "datetime");
    assert.equal(contribution.intent_assessment.primaryDomain, "datetime");
    assert.equal(contribution.response_commitment.renderMode, "deterministic");
  });

  it("math_simple_deterministic — lot math", () => {
    const contribution = buildShortCircuitCognitiveContribution({
      path: "math_simple_deterministic",
      reply: "(x+2)(x+3)",
    });
    assert.equal(contribution.migrationBatch, "math_simple");
    assert.equal(contribution.intent_assessment.primaryDomain, "math");
  });

  it("meta_assistant_behavior — lot meta", () => {
    const contribution = buildShortCircuitCognitiveContribution({
      path: "meta_assistant_behavior_deterministic",
      reply: "Je suis Nexxus, agent de La Citadelle.",
    });
    assert.equal(contribution.migrationBatch, "meta");
    assert.equal(contribution.response_commitment.renderMode, "deterministic");
  });

  it("deferToFullPipeline — pas terminal, pas de reply obligatoire", () => {
    const contribution = buildShortCircuitCognitiveContribution({
      path: "compare_choose",
      deferToFullPipeline: true,
      preferWebResearch: true,
    });
    assert.equal(contribution.response_commitment.renderMode, "defer_full_pipeline");
    assert.equal(contribution.retrieval_decision.needsExternalInfo, true);
    assert.equal(contribution.response_commitment.terminalReply, undefined);
  });

  it("annotateShortCircuitCognitiveCycle — attache cognitive_cycle", () => {
    const hit = annotateShortCircuitCognitiveCycle({
      path: "social_deterministic",
      reply: "Coucou !",
    });
    assert.ok(hit.cognitive_cycle);
    assert.equal(hit.cognitiveCycleAuthoritative, true);
  });

  it("mergeAgentCycleWithShortCircuit — short-circuit prime sur commitment", () => {
    const understanding = understandQuery("salut");
    const base = buildRequestWorkup("salut", understanding);
    const sc = buildShortCircuitCognitiveContribution({
      path: "social_deterministic",
      reply: "Salut !",
    });
    const merged = mergeAgentCycleWithShortCircuit(base, sc);
    assert.equal(merged.short_circuit_authoritative, true);
    assert.equal(merged.response_commitment.renderMode, "deterministic");
    assert.equal(merged.response_commitment.terminalReply, "Salut !");
  });
});
