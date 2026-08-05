import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MATH_ARITHMETIC_ANSWER_MODES,
  evaluateClosedArithmeticExpression,
  isMathArithmeticRequest,
  parseMathArithmeticTask,
  resolveMathArithmeticShortCircuit,
  resolveMathArithmeticAnswerMode,
} from "../src/agent/policies/math/mathArithmeticPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolveRequestWorkloadSignal } from "../src/agent/policies/workload/requestWorkloadSignalPolicy.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/routing/clarificationDecisionPolicy.js";

const LIST_5 = `Effectue les calculs suivants :
1. 12 + 7
2. 45 - 18
3. 9 * 6
4. 84 / 7
5. 3^2 + 4^2`;

describe("mathArithmeticPolicy — calcul fermé", () => {
  it("évalue les opérations de base", () => {
    assert.equal(evaluateClosedArithmeticExpression("12+7"), 19);
    assert.equal(evaluateClosedArithmeticExpression("45-18"), 27);
    assert.equal(evaluateClosedArithmeticExpression("9*6"), 54);
    assert.equal(evaluateClosedArithmeticExpression("84/7"), 12);
    assert.equal(evaluateClosedArithmeticExpression("3^2+4^2"), 25);
  });

  it("calcul simple isolé → strict, une ligne", () => {
    const hit = resolveMathArithmeticShortCircuit("calcule 12 + 7");
    assert.ok(hit);
    assert.equal(hit.path, "math_arithmetic_deterministic");
    assert.equal(hit.answerMode, MATH_ARITHMETIC_ANSWER_MODES.STRICT);
    assert.match(hit.reply, /12\s*[+＋]\s*7\s*=\s*19/);
    assert.equal(hit.reply.includes("\n"), false);
    assert.doesNotMatch(hit.reply, /voici|si tu veux|n'hésite/i);
  });

  it("liste de 5 calculs → strict, une ligne par résultat", () => {
    const task = parseMathArithmeticTask(LIST_5);
    assert.ok(task);
    assert.equal(task.expressions.length, 5);
    assert.equal(task.answerMode, MATH_ARITHMETIC_ANSWER_MODES.STRICT);
    const hit = resolveMathArithmeticShortCircuit(LIST_5);
    assert.ok(hit?.reply);
    const lines = hit.reply.split("\n").filter(Boolean);
    assert.equal(lines.length, 5);
    assert.match(hit.reply, /=\s*19/);
    assert.match(hit.reply, /=\s*27/);
    assert.match(hit.reply, /=\s*54/);
    assert.match(hit.reply, /=\s*12/);
    assert.match(hit.reply, /=\s*25/);
    assert.doesNotMatch(hit.reply, /voici|je peux|n'hésite|si tu veux/i);
  });

  it("même liste + montre les étapes → mode steps", () => {
    const q = `${LIST_5}\n\nMontre les étapes.`;
    assert.equal(
      resolveMathArithmeticAnswerMode(q),
      MATH_ARITHMETIC_ANSWER_MODES.STEPS,
    );
    const hit = resolveMathArithmeticShortCircuit(q);
    assert.ok(hit);
    assert.equal(hit.answerMode, MATH_ARITHMETIC_ANSWER_MODES.STEPS);
    assert.match(hit.reply, /→/);
  });

  it("explique comment faire → mode explain", () => {
    const q = `Explique comment faire ces calculs :
1. 12 + 7
2. 45 - 18`;
    assert.equal(
      resolveMathArithmeticAnswerMode(q),
      MATH_ARITHMETIC_ANSWER_MODES.EXPLAIN,
    );
    const hit = resolveMathArithmeticShortCircuit(q);
    assert.ok(hit);
    assert.equal(hit.answerMode, MATH_ARITHMETIC_ANSWER_MODES.EXPLAIN);
    assert.match(hit.reply, /opération arithmétique fermée/i);
  });

  it("question méta → pas de requête arithmétique", () => {
    const q = "comment tu gères les exercices de calcul ?";
    assert.equal(isMathArithmeticRequest(q), false);
    assert.equal(resolveMathArithmeticShortCircuit(q), null);
  });
});

describe("mathArithmeticPolicy — intégration short-circuit + gate", () => {
  it("SC stoppe la liste avant workload utile", async () => {
    const sc = await runConversationShortCircuit(LIST_5, {
      getDeterministicSocialResponse: () => null,
    });
    assert.equal(sc?.path, "math_arithmetic_deterministic");
    assert.ok(sc?.reply);
    assert.equal(sc?.preferWebResearch, undefined);
    // workload peut encore compter des unités en télémétrie pipeline, mais le SC a déjà une reply
    const wl = resolveRequestWorkloadSignal(LIST_5);
    assert.ok(wl.explicit_unit_count >= 0);
  });

  it("clarification gate → CAN_ANSWER_NOW", () => {
    const decision = evaluateClarificationDecision(LIST_5);
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals?.includes("math_arithmetic"));
  });

  it("méta ne prend pas le rail arithmétique via SC", async () => {
    const sc = await runConversationShortCircuit(
      "comment tu gères les exercices de calcul ?",
      { getDeterministicSocialResponse: () => null },
    );
    assert.notEqual(sc?.path, "math_arithmetic_deterministic");
  });
});
