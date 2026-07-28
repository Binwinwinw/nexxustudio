import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MATH_COMPOSITE_CANONICAL_AREA_AND_PERIMETER_QUERY,
  MATH_COMPOSITE_CANONICAL_ROOT_AND_PRIMES_QUERY,
  MATH_COMPOSITE_FAMILIES,
  MATH_COMPOSITE_RESPONSE_MODES,
  buildMathCompositeReply,
  buildMathCompositeResponsePlan,
  detectQueryMathIntents,
  extractPrimeNumbersIntent,
  isMathCompositeRequest,
  isMathCompositeSatisfiable,
  resolveMathCompositeShortCircuit,
  splitMathCompositeSegments,
} from "../src/agent/policies/mathCompositeQueryPolicy.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";

describe("mathCompositeQueryPolicy — G28 segmentation", () => {
  it("split — et aussi sépare deux segments", () => {
    const segments = splitMathCompositeSegments(MATH_COMPOSITE_CANONICAL_ROOT_AND_PRIMES_QUERY);
    assert.equal(segments.length, 2);
    assert.match(segments[0], /racine carr/i);
    assert.match(segments[1], /nombres premiers/i);
  });

  it("detectQueryMathIntents — racine + nombres premiers", () => {
    const { intentCount, intents } = detectQueryMathIntents(
      MATH_COMPOSITE_CANONICAL_ROOT_AND_PRIMES_QUERY,
    );
    assert.equal(intentCount, 2);
    assert.equal(intents[0].family, MATH_COMPOSITE_FAMILIES.MATH_ROOT);
    assert.equal(intents[1].family, MATH_COMPOSITE_FAMILIES.PRIME_NUMBERS);
  });

  it("buildMathCompositeResponsePlan — trois questions", () => {
    const plan = buildMathCompositeResponsePlan(MATH_COMPOSITE_CANONICAL_ROOT_AND_PRIMES_QUERY);
    assert.equal(plan.intentCount, 2);
    assert.equal(plan.satisfiableCount, 2);
    assert.equal(plan.responseMode, MATH_COMPOSITE_RESPONSE_MODES.SEQUENTIAL_ANSWER);
    assert.equal(plan.intents.length, 2);
  });

  it("extractPrimeNumbersIntent — liste sans borne", () => {
    const intent = extractPrimeNumbersIntent("donne la liste des nombres premiers");
    assert.ok(intent);
    assert.equal(intent.kind, "prime_list_explain");
    assert.equal(intent.bound, null);
  });
});

describe("mathCompositeQueryPolicy — G28 réponse composite", () => {
  it("resolveMathCompositeShortCircuit — racine + premiers", () => {
    const hit = resolveMathCompositeShortCircuit(MATH_COMPOSITE_CANONICAL_ROOT_AND_PRIMES_QUERY);
    assert.ok(hit);
    assert.equal(hit.path, "math_composite_deterministic");
    assert.match(hit.reply, /racine carrée/i);
    assert.match(hit.reply, /nombres premiers/i);
    assert.match(hit.reply, /2, 3, 5, 7/i);
    assert.doesNotMatch(hit.reply, /je vois la piste|precise ton objectif/i);
    assert.notEqual(hit.reply, INSUFFICIENT_SIGNAL_REFUSAL);
  });

  it("resolveMathCompositeShortCircuit — aire + périmètre (carryover)", () => {
    const hit = resolveMathCompositeShortCircuit(MATH_COMPOSITE_CANONICAL_AREA_AND_PERIMETER_QUERY);
    assert.ok(hit);
    assert.equal(hit.path, "math_composite_deterministic");
    assert.match(hit.reply, /\*\*Aire/i);
    assert.match(hit.reply, /\*\*Périmètre/i);
    assert.match(hit.reply, /\b15\b/);
    assert.match(hit.reply, /\b16\b/);
  });

  it("mono-intent — ne déclenche pas composite", () => {
    assert.equal(isMathCompositeRequest("calcule la racine carrée de 16"), false);
    assert.equal(isMathCompositeSatisfiable("calcule la racine carrée de 16"), false);
    assert.equal(resolveMathCompositeShortCircuit("calcule la racine carrée de 16"), null);
  });

  it("buildMathCompositeReply — deux sections distinctes", () => {
    const plan = buildMathCompositeResponsePlan(MATH_COMPOSITE_CANONICAL_ROOT_AND_PRIMES_QUERY);
    const reply = buildMathCompositeReply(plan);
    assert.ok(reply);
    const sections = reply.split("\n\n");
    assert.ok(sections.length >= 2);
  });
});

describe("mathCompositeQueryPolicy — intégration short-circuit + clarification", () => {
  it("short-circuit G28 prime sur math_root seul", async () => {
    const hit = await runConversationShortCircuit(MATH_COMPOSITE_CANONICAL_ROOT_AND_PRIMES_QUERY);
    assert.equal(hit?.path, "math_composite_deterministic");
    assert.match(hit?.reply || "", /racine carrée/i);
    assert.match(hit?.reply || "", /nombres premiers/i);
  });

  it("clarification — composite answerable", () => {
    const decision = evaluateClarificationDecision(MATH_COMPOSITE_CANONICAL_ROOT_AND_PRIMES_QUERY);
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.equal(decision.reason, "query_composite_answerable");
  });
});
