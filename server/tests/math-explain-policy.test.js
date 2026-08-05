import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MATH_EXPLAIN_CANONICAL_NEGATIVE_DISCRIMINANT_QUERY,
  MATH_EXPLAIN_KINDS,
  buildMathExplainReply,
  isMathExplainRequest,
  isMathExplainSatisfiable,
  parseMathExplainTask,
  resolveMathExplainLocalFallback,
  resolveMathExplainShortCircuit,
} from "../src/agent/policies/math/index.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolveSimpleFastLocalCatchFallback } from "../src/agent/paths/simpleFastPath.js";
import { resolvePipelineFallback } from "../src/agent/utils/genericGreetingGuards.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";

const CANONICAL_QUERY = MATH_EXPLAIN_CANONICAL_NEGATIVE_DISCRIMINANT_QUERY;

describe("mathExplainPolicy — batterie #31", () => {
  it("détecte discriminant négatif + shell comment", () => {
    assert.equal(isMathExplainRequest(CANONICAL_QUERY), true);
    const task = parseMathExplainTask(CANONICAL_QUERY);
    assert.equal(task?.kind, MATH_EXPLAIN_KINDS.DISCRIMINANT_NEGATIVE);
  });

  it("réponse canonique — pas de racines réelles, factorisation sur ℂ", () => {
    const task = parseMathExplainTask(CANONICAL_QUERY);
    const reply = buildMathExplainReply(task);
    assert.ok(reply);
    assert.match(reply, /discriminant/i);
    assert.match(reply, /négatif|negatif|réels|reels/i);
    assert.match(reply, /complexes/i);
    assert.doesNotMatch(reply, /géographie|histoire/i);
    assert.notEqual(reply, INSUFFICIENT_SIGNAL_REFUSAL);
  });

  it("discriminant nul et positif — gabarits distincts", () => {
    const zero = parseMathExplainTask("que se passe-t-il si le discriminant est nul");
    assert.equal(zero?.kind, MATH_EXPLAIN_KINDS.DISCRIMINANT_ZERO);
    assert.match(buildMathExplainReply(zero), /racine double/i);

    const pos = parseMathExplainTask("discriminant positif factorisation");
    assert.equal(pos?.kind, MATH_EXPLAIN_KINDS.DISCRIMINANT_POSITIVE);
    assert.match(buildMathExplainReply(pos), /deux racines/i);
  });

  it("isMathExplainSatisfiable — true pour discriminant négatif", () => {
    assert.equal(isMathExplainSatisfiable(CANONICAL_QUERY), true);
  });
});

describe("mathExplainPolicy — intégration routage + fallback", () => {
  it("clarification gate → can_answer_now (math_explain)", () => {
    const evaluation = evaluateJustIntent(CANONICAL_QUERY);
    const decision = evaluateClarificationDecision(CANONICAL_QUERY, evaluation);
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("math_explain"));
  });

  it("short-circuit → math_explain_deterministic (avant simple_factual_lookup)", async () => {
    const hit = await runConversationShortCircuit(CANONICAL_QUERY);
    assert.equal(hit?.path, "math_explain_deterministic");
    assert.match(hit?.reply, /réels/i);
    assert.doesNotMatch(hit?.reply, /géographie|histoire/i);
  });

  it("resolveSimpleFastLocalCatchFallback — template math, pas géographie", () => {
    const local = resolveSimpleFastLocalCatchFallback(CANONICAL_QUERY);
    assert.ok(local);
    assert.match(local, /discriminant/i);
    assert.doesNotMatch(local, /géographie|histoire/i);
  });

  it("resolvePipelineFallback empty LLM — recovery math, pas angles géo", () => {
    const fallback = resolvePipelineFallback({
      query: CANONICAL_QUERY,
      rawResponse: "",
      reason: "empty_short_circuit_llm",
    });
    assert.ok(fallback);
    assert.match(fallback, /discriminant|réels|reels|math/i);
    assert.doesNotMatch(fallback, /géographie|histoire/i);
  });

  it("factorisation concrète reste sur math_simple, pas math_explain", async () => {
    const hit = await runConversationShortCircuit(
      "quelle est la forme factorisée de x²+5x+6 ?",
    );
    assert.equal(hit?.path, "math_simple_deterministic");
    assert.equal(resolveMathExplainShortCircuit("x²+5x+6"), null);
  });
});

describe("mathExplainPolicy — batterie #32 factorisation générale", () => {
  it("parle moi des factorisations en générale → overview + soft clarify", async () => {
    const q = "parle moi des factorisations en générale";
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "math_explain_deterministic");
    assert.match(hit?.reply, /factoriser|facteurs/i);
    assert.match(hit?.reply, /nombres|trinômes|exemple/i);
    assert.doesNotMatch(hit?.reply, /On se rate|géographie|histoire/i);
  });

  it("clarification gate → can_answer_now (pas repeated_fallback)", () => {
    const q = "parle moi des factorisations en générale";
    const decision = evaluateClarificationDecision(q, evaluateJustIntent(q));
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("math_explain"));
  });
});
