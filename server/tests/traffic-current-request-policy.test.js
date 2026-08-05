import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  TRAFFIC_CANONICAL_A1_QUERY,
  TRAFFIC_CANONICAL_HOWTO_QUERY,
  TRAFFIC_CANONICAL_MECHANISM_QUERY,
  TRAFFIC_CANONICAL_NO_FRESHNESS_QUERY,
  TRAFFIC_CANONICAL_PARIS_QUERY,
  TRAFFIC_CANONICAL_PAST_NARRATIVE_QUERY,
  WEATHER_CANONICAL_MIAMI_QUERY,
  buildTrafficCurrentRecoveryMessage,
  buildTrafficCurrentWebQuery,
  isTrafficCurrentRequest,
  parseTrafficCurrentTask,
  resolveTrafficCurrentShortCircuit,
} from "../src/agent/policies/web/index.js";
import {
  isCurrentWebFactMechanismExplanation,
  requiresCurrentWebFactFreshness,
} from "../src/agent/utils/currentWebFactIntentGuards.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/routing/clarificationDecisionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolvePipelineFallback } from "../src/agent/utils/genericGreetingGuards.js";
import { resolveKnowledgeEnrichmentPolicy } from "../src/agent/policies/routing/knowledgeEnrichmentPolicy.js";

describe("trafficCurrentRequestPolicy — batterie #38a", () => {
  it("A1 + maintenant → trafic actuel exploitable", () => {
    assert.equal(isTrafficCurrentRequest(TRAFFIC_CANONICAL_A1_QUERY), true);
    const task = parseTrafficCurrentTask(TRAFFIC_CANONICAL_A1_QUERY);
    assert.equal(task?.factType, "traffic");
    assert.equal(task?.subject, "a1");
    assert.match(
      buildTrafficCurrentWebQuery(TRAFFIC_CANONICAL_A1_QUERY) || "",
      /A1|trafic/i,
    );
  });

  it("Paris + en ce moment → short-circuit web prioritaire", async () => {
    assert.equal(isTrafficCurrentRequest(TRAFFIC_CANONICAL_PARIS_QUERY), true);
    const hit = await runConversationShortCircuit(TRAFFIC_CANONICAL_PARIS_QUERY);
    assert.equal(hit?.path, "simple_factual_lookup");
    assert.equal(hit?.trafficCurrent, true);
    assert.equal(hit?.preferWebResearch, true);
    assert.ok(hit?.currentWebFactWebQuery);
    assert.match(hit?.currentWebFactWebQuery, /Paris|embouteillage/i);
  });

  it("how-to éviter embouteillages → pas current_web_fact", () => {
    assert.equal(isTrafficCurrentRequest(TRAFFIC_CANONICAL_HOWTO_QUERY), false);
    assert.equal(
      isCurrentWebFactMechanismExplanation(TRAFFIC_CANONICAL_HOWTO_QUERY),
      true,
    );
  });

  it("narratif passé → pas current_web_fact", () => {
    assert.equal(
      isTrafficCurrentRequest(TRAFFIC_CANONICAL_PAST_NARRATIVE_QUERY),
      false,
    );
  });

  it("mécanisme / définition → pas current_web_fact", () => {
    assert.equal(
      isTrafficCurrentRequest(TRAFFIC_CANONICAL_MECHANISM_QUERY),
      false,
    );
    assert.equal(
      isCurrentWebFactMechanismExplanation(TRAFFIC_CANONICAL_MECHANISM_QUERY),
      true,
    );
  });

  it("sans fraîcheur explicite → pas current_web_fact", () => {
    assert.equal(
      requiresCurrentWebFactFreshness(TRAFFIC_CANONICAL_NO_FRESHNESS_QUERY),
      false,
    );
    assert.equal(
      isTrafficCurrentRequest(TRAFFIC_CANONICAL_NO_FRESHNESS_QUERY),
      false,
    );
  });

  it("clarification gate → can_answer_now + signal traffic_current_request", () => {
    const decision = evaluateClarificationDecision(
      TRAFFIC_CANONICAL_A1_QUERY,
      [],
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.equal(decision.reason, "traffic_current_request_web_first");
    assert.ok(decision.signals.includes("traffic_current_request"));
  });

  it("enrichissement → preferWebResearch + webQuery trafic", () => {
    const policy = resolveKnowledgeEnrichmentPolicy(TRAFFIC_CANONICAL_A1_QUERY);
    assert.equal(policy.preferWebResearch, true);
    assert.equal(policy.domain, "traffic_current");
    assert.match(policy.webQuery || "", /trafic|A1/i);
  });

  it("recovery web échoué → message honnête ciblé", () => {
    const msg = buildTrafficCurrentRecoveryMessage(
      TRAFFIC_CANONICAL_A1_QUERY,
      "empty_short_circuit_llm",
    );
    assert.match(msg, /trafic actuel/i);
    assert.match(msg, /A1|autoroute/i);
  });

  it("régression météo #36 — Miami toujours routée", async () => {
    const hit = await runConversationShortCircuit(WEATHER_CANONICAL_MIAMI_QUERY);
    assert.equal(hit?.path, "simple_factual_lookup");
    assert.equal(hit?.weatherCurrent, true);
    assert.ok(hit?.currentWebFactWebQuery);
  });

  it("resolveTrafficCurrentShortCircuit — structure", () => {
    const hit = resolveTrafficCurrentShortCircuit(TRAFFIC_CANONICAL_PARIS_QUERY);
    assert.equal(hit?.factType, "traffic");
    assert.ok(hit?.currentWebFactWebQuery);
  });

  it("resolvePipelineFallback → recovery trafic", () => {
    const reply = resolvePipelineFallback({
      query: TRAFFIC_CANONICAL_PARIS_QUERY,
      history: [],
      reason: "empty_short_circuit_llm",
    });
    assert.match(reply, /trafic actuel/i);
  });
});
