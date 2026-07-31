import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MATH_PERCENT_CANONICAL_DECREASE_QUERY,
  MATH_PERCENT_CANONICAL_GENERIC_QUERY,
  MATH_PERCENT_CANONICAL_INCREASE_QUERY,
  MATH_PERCENT_CANONICAL_PART_OF_QUERY,
  MATH_PERCENT_KINDS,
  MATH_PERCENT_MODES,
  MATH_PERCENT_OPERATIONS,
  buildMathPercentReply,
  extractMathPercentIntent,
  isMathPercentReplyCoherent,
  isMathPercentSatisfiable,
  parseMathPercentTask,
  resolveMathPercentShortCircuit,
} from "../src/agent/policies/math/index.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

describe("mathPercentPolicy — G23 extraction", () => {
  it("extract — partie 15 % de 200", () => {
    const intent = extractMathPercentIntent(MATH_PERCENT_CANONICAL_PART_OF_QUERY);
    assert.deepEqual(intent, {
      operation: MATH_PERCENT_OPERATIONS.PART_OF,
      mode: MATH_PERCENT_MODES.COMPUTE,
      rate: 15,
      base: 200,
    });
  });

  it("extract — augmentation 80 de 25 %", () => {
    const intent = extractMathPercentIntent(MATH_PERCENT_CANONICAL_INCREASE_QUERY);
    assert.deepEqual(intent, {
      operation: MATH_PERCENT_OPERATIONS.INCREASE,
      mode: MATH_PERCENT_MODES.COMPUTE,
      rate: 25,
      base: 80,
    });
  });

  it("extract — réduction 200 de 10 %", () => {
    const intent = extractMathPercentIntent(MATH_PERCENT_CANONICAL_DECREASE_QUERY);
    assert.deepEqual(intent, {
      operation: MATH_PERCENT_OPERATIONS.DECREASE,
      mode: MATH_PERCENT_MODES.COMPUTE,
      rate: 10,
      base: 200,
    });
  });

  it("extract — pourcentage générique → explain", () => {
    const intent = extractMathPercentIntent(MATH_PERCENT_CANONICAL_GENERIC_QUERY);
    assert.equal(intent.mode, MATH_PERCENT_MODES.EXPLAIN);
  });
});

describe("mathPercentPolicy — G23 réponses", () => {
  it("15 % de 200 → 30", () => {
    const task = parseMathPercentTask(MATH_PERCENT_CANONICAL_PART_OF_QUERY);
    assert.equal(task.kind, MATH_PERCENT_KINDS.PART_OF_COMPUTED);
    const reply = buildMathPercentReply(task);
    assert.match(reply, /\b30\b/);
    assert.match(reply, /15\s*%/);
  });

  it("augmente 80 de 25 % → 100", () => {
    const task = parseMathPercentTask(MATH_PERCENT_CANONICAL_INCREASE_QUERY);
    const reply = buildMathPercentReply(task);
    assert.match(reply, /\b100\b/);
    assert.match(reply, /augment/i);
  });

  it("réduis 200 de 10 % → 180", () => {
    const task = parseMathPercentTask(MATH_PERCENT_CANONICAL_DECREASE_QUERY);
    const reply = buildMathPercentReply(task);
    assert.match(reply, /\b180\b/);
    assert.match(reply, /réduit|redui/i);
  });

  it("garde — augmentation ≠ réponse réduction", () => {
    const reply = buildMathPercentReply(parseMathPercentTask(MATH_PERCENT_CANONICAL_INCREASE_QUERY));
    assert.equal(isMathPercentReplyCoherent(MATH_PERCENT_CANONICAL_INCREASE_QUERY, reply), true);
    assert.equal(isMathPercentReplyCoherent(MATH_PERCENT_CANONICAL_DECREASE_QUERY, reply), false);
  });
});

describe("mathPercentPolicy — intégration short-circuit", () => {
  it("short-circuit G23 → math_percent_deterministic", async () => {
    const hit = await runConversationShortCircuit(MATH_PERCENT_CANONICAL_PART_OF_QUERY);
    assert.equal(hit?.path, "math_percent_deterministic");
    assert.match(hit?.reply || "", /\b30\b/);
    assert.doesNotMatch(hit?.reply || "", /je vois la piste|cadrer un projet/i);
  });

  it("clarification gate → can_answer_now", () => {
    const evaluation = evaluateJustIntent(MATH_PERCENT_CANONICAL_PART_OF_QUERY);
    const decision = evaluateClarificationDecision(
      MATH_PERCENT_CANONICAL_PART_OF_QUERY,
      evaluation,
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("math_percent"));
    assert.equal(isMathPercentSatisfiable(MATH_PERCENT_CANONICAL_PART_OF_QUERY), true);
  });
});
