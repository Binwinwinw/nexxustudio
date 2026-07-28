import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MATH_ROOT_CANONICAL_COMPUTE_QUERY,
  MATH_ROOT_CANONICAL_EXPLAIN_QUERY,
  MATH_ROOT_CANONICAL_SQUARE_ROOT_QUERY,
  MATH_ROOT_KINDS,
  MATH_ROOT_MODES,
  MATH_ROOT_OPERATIONS,
  buildMathRootReply,
  extractMathRootIntent,
  formatSquareRootResult,
  isMathRootReplyCoherent,
  isMathRootSatisfiable,
  parseMathRootTask,
  resolveMathRootShortCircuit,
} from "../src/agent/policies/mathRootPolicy.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";

describe("mathRootPolicy — G22 extraction", () => {
  it("extract — racine carrée générique (typo carré)", () => {
    const intent = extractMathRootIntent(MATH_ROOT_CANONICAL_SQUARE_ROOT_QUERY);
    assert.deepEqual(intent, {
      operation: MATH_ROOT_OPERATIONS.SQUARE_ROOT,
      mode: MATH_ROOT_MODES.EXPLAIN,
      operand: null,
    });
  });

  it("extract — calcul de 16", () => {
    const intent = extractMathRootIntent(MATH_ROOT_CANONICAL_COMPUTE_QUERY);
    assert.deepEqual(intent, {
      operation: MATH_ROOT_OPERATIONS.SQUARE_ROOT,
      mode: MATH_ROOT_MODES.COMPUTE,
      operand: 16,
    });
  });

  it("formatSquareRootResult — 16 → 4", () => {
    assert.equal(formatSquareRootResult(16), "4");
  });

  it("buildMathRootReply — calcul √16", () => {
    const task = parseMathRootTask(MATH_ROOT_CANONICAL_COMPUTE_QUERY);
    assert.equal(task.kind, MATH_ROOT_KINDS.SQUARE_ROOT_COMPUTED);
    const reply = buildMathRootReply(task);
    assert.match(reply, /\b4\b/);
    assert.match(reply, /racine carrée/i);
  });

  it("buildMathRootReply — explication pédagogique", () => {
    const task = parseMathRootTask(MATH_ROOT_CANONICAL_EXPLAIN_QUERY);
    assert.equal(task.kind, MATH_ROOT_KINDS.SQUARE_ROOT_EXPLAIN);
    const reply = buildMathRootReply(task);
    assert.match(reply, /y²\s*=\s*x|y\^2\s*=\s*x/i);
    assert.match(reply, /√16\s*=\s*4|4\s*×\s*4\s*=\s*16/i);
  });

  it("canonical G22 — pas de template clarification générique", () => {
    const hit = resolveMathRootShortCircuit(MATH_ROOT_CANONICAL_SQUARE_ROOT_QUERY);
    assert.ok(hit);
    assert.equal(hit.path, "math_root_deterministic");
    assert.match(hit.reply, /racine carrée/i);
    assert.doesNotMatch(hit.reply, /je vois la piste|precise ton objectif|cadrer un projet/i);
    assert.notEqual(hit.reply, INSUFFICIENT_SIGNAL_REFUSAL);
    assert.equal(
      isMathRootReplyCoherent(MATH_ROOT_CANONICAL_SQUARE_ROOT_QUERY, hit.reply),
      true,
    );
  });
});

describe("mathRootPolicy — intégration short-circuit + clarification", () => {
  it("short-circuit G22 → math_root_deterministic", async () => {
    const hit = await runConversationShortCircuit(MATH_ROOT_CANONICAL_SQUARE_ROOT_QUERY);
    assert.equal(hit?.path, "math_root_deterministic");
    assert.match(hit?.reply || "", /racine carrée/i);
    assert.doesNotMatch(hit?.reply || "", /je vois la piste|cadrer un projet/i);
  });

  it("short-circuit G22 calcul → √16 = 4", async () => {
    const hit = await runConversationShortCircuit(MATH_ROOT_CANONICAL_COMPUTE_QUERY);
    assert.equal(hit?.path, "math_root_deterministic");
    assert.match(hit?.reply || "", /\b4\b/);
  });

  it("clarification gate → can_answer_now (math_root)", () => {
    const evaluation = evaluateJustIntent(MATH_ROOT_CANONICAL_SQUARE_ROOT_QUERY);
    const decision = evaluateClarificationDecision(
      MATH_ROOT_CANONICAL_SQUARE_ROOT_QUERY,
      evaluation,
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("math_root"));
    assert.equal(isMathRootSatisfiable(MATH_ROOT_CANONICAL_SQUARE_ROOT_QUERY), true);
  });
});
