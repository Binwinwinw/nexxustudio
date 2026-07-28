import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MATH_SIMPLE_CANONICAL_FACTORIZE_QUERY,
  MATH_SIMPLE_CANONICAL_IRRATIONAL_FACTORIZE_QUERY,
  MATH_SIMPLE_KINDS,
  buildMathSimpleReply,
  factorizeMonicQuadratic,
  factorizeMonicQuadraticSymbolic,
  isMathSimpleSatisfiable,
  parseMathSimpleTask,
  resolveMathSimpleShortCircuit,
  solveMathSimpleTask,
} from "../src/agent/policies/mathSimplePolicy.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";

const CANONICAL_QUERY = MATH_SIMPLE_CANONICAL_FACTORIZE_QUERY;

describe("mathSimplePolicy — batterie #30", () => {
  it("parse x²+5x+6 → coefficients moniques", () => {
    const task = parseMathSimpleTask(CANONICAL_QUERY);
    assert.ok(task);
    assert.equal(task.kind, MATH_SIMPLE_KINDS.FACTORIZE_QUADRATIC);
    assert.deepEqual(task.coefficients, { a: 1, b: 5, c: 6 });
  });

  it("factorizeMonicQuadratic(5, 6) → (2, 3)", () => {
    assert.deepEqual(factorizeMonicQuadratic(5, 6), { p: 2, q: 3 });
  });

  it("solve → (x+2)(x+3)", () => {
    const task = parseMathSimpleTask(CANONICAL_QUERY);
    const result = solveMathSimpleTask(task);
    assert.ok(result);
    assert.equal(result.factored, "(x+2)(x+3)");
  });

  it("x^2-1 → (x+1)(x-1)", () => {
    const task = parseMathSimpleTask("factorise x^2-1");
    const result = solveMathSimpleTask(task);
    assert.ok(result);
    assert.ok(
      result.factored === "(x+1)(x-1)" || result.factored === "(x-1)(x+1)",
    );
  });

  it("x^2+1 → non satisfiable localement", () => {
    assert.equal(isMathSimpleSatisfiable("factorise x^2+1"), false);
    assert.equal(resolveMathSimpleShortCircuit("factorise x^2+1"), null);
  });

  it("buildMathSimpleReply — pas de clarification générique", () => {
    const task = parseMathSimpleTask(CANONICAL_QUERY);
    const result = solveMathSimpleTask(task);
    const reply = buildMathSimpleReply(task, result);
    assert.match(reply, /x²\+5x\+6/i);
    assert.match(reply, /\(x\+2\)\(x\+3\)/);
    assert.doesNotMatch(reply, /Je vois la piste/i);
    assert.notEqual(reply, INSUFFICIENT_SIGNAL_REFUSAL);
  });
});

describe("mathSimplePolicy — intégration clarification + short-circuit", () => {
  it("clarification gate → can_answer_now (math_simple)", () => {
    const evaluation = evaluateJustIntent(CANONICAL_QUERY);
    const decision = evaluateClarificationDecision(CANONICAL_QUERY, evaluation);
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("math_simple"));
  });

  it("short-circuit → math_simple_deterministic", async () => {
    const hit = await runConversationShortCircuit(CANONICAL_QUERY);
    assert.equal(hit?.path, "math_simple_deterministic");
    assert.match(hit?.reply, /\(x\+2\)\(x\+3\)/);
    assert.doesNotMatch(hit?.reply, /Je vois la piste/i);
  });

  it("variante x^2+5x+6 — même réponse", async () => {
    const hit = await runConversationShortCircuit(
      "quelle est la forme factorisée de x^2+5x+6",
    );
    assert.equal(hit?.path, "math_simple_deterministic");
    assert.match(hit?.reply, /\(x\+2\)\(x\+3\)/);
  });
});

describe("mathSimplePolicy — batterie #32 racines irrationnelles", () => {
  it("x²+25x-46 → factorisation symbolique (Δ=809)", () => {
    const task = parseMathSimpleTask(MATH_SIMPLE_CANONICAL_IRRATIONAL_FACTORIZE_QUERY);
    assert.ok(task);
    const symbolic = factorizeMonicQuadraticSymbolic(25, -46);
    assert.ok(symbolic);
    assert.equal(symbolic.delta, 809);
    assert.match(symbolic.factored, /√809/);

    const result = solveMathSimpleTask(task);
    assert.ok(result);
    assert.equal(result.style, "symbolic");
    assert.match(result.factored, /√809/);
  });

  it("short-circuit → math_simple_deterministic (pas simple_fast)", async () => {
    const hit = await runConversationShortCircuit(
      MATH_SIMPLE_CANONICAL_IRRATIONAL_FACTORIZE_QUERY,
    );
    assert.equal(hit?.path, "math_simple_deterministic");
    assert.match(hit?.reply, /√809|809/);
    assert.doesNotMatch(hit?.reply, /Je vois la piste/i);
  });

  it("isMathSimpleSatisfiable — true pour irrationnel", () => {
    assert.equal(
      isMathSimpleSatisfiable(MATH_SIMPLE_CANONICAL_IRRATIONAL_FACTORIZE_QUERY),
      true,
    );
  });
});
