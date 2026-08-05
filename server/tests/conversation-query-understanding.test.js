import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  QUERY_UNDERSTANDING_CANONICAL_MATH_COMPOSITE,
  INTENT_MODES,
  QUERY_DOMAINS,
  RESPONSE_STRATEGIES,
  understandQuery,
  buildExecutionPlan,
  resolveQueryCompositeShortCircuit,
  splitQuerySegments,
} from "../src/agent/policies/conversation/conversationQueryUnderstanding.js";
import {
  MATH_COMPOSITE_CANONICAL_AREA_AND_PERIMETER_QUERY,
} from "../src/agent/policies/math/index.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/routing/clarificationDecisionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

describe("conversationQueryUnderstanding — segmentation universelle", () => {
  it("splitQuerySegments — et aussi sur requête math", () => {
    const segments = splitQuerySegments(QUERY_UNDERSTANDING_CANONICAL_MATH_COMPOSITE);
    assert.equal(segments.length, 2);
  });

  it("understandQuery — identifie domaine math multi-intent", () => {
    const understanding = understandQuery(QUERY_UNDERSTANDING_CANONICAL_MATH_COMPOSITE);
    assert.equal(understanding.intentMode, INTENT_MODES.MULTI);
    assert.equal(understanding.workIntentCount, 2);
    assert.ok(understanding.domains.includes(QUERY_DOMAINS.MATH));
    assert.equal(understanding.responseStrategy, RESPONSE_STRATEGIES.COMPOSITE_DETERMINISTIC);
  });

  it("buildExecutionPlan — liste sous-buts et stratégies", () => {
    const understanding = understandQuery(QUERY_UNDERSTANDING_CANONICAL_MATH_COMPOSITE);
    const plan = buildExecutionPlan(understanding);
    assert.equal(plan.composite, true);
    assert.equal(plan.steps.length, 2);
    assert.match(plan.executionHint, /MULTI-INTENT/);
    assert.match(plan.executionHint, /math/);
  });
});

describe("conversationQueryUnderstanding — composite déterministe", () => {
  it("resolveQueryCompositeShortCircuit — math → math_composite_deterministic", () => {
    const hit = resolveQueryCompositeShortCircuit(QUERY_UNDERSTANDING_CANONICAL_MATH_COMPOSITE);
    assert.ok(hit);
    assert.equal(hit.path, "math_composite_deterministic");
    assert.match(hit.reply, /racine carrée/i);
    assert.match(hit.reply, /nombres premiers/i);
  });

  it("resolveQueryCompositeShortCircuit — aire + périmètre", () => {
    const hit = resolveQueryCompositeShortCircuit(MATH_COMPOSITE_CANONICAL_AREA_AND_PERIMETER_QUERY);
    assert.ok(hit);
    assert.equal(hit.path, "math_composite_deterministic");
    assert.match(hit.reply, /\*\*Aire/i);
    assert.match(hit.reply, /\*\*Périmètre/i);
  });

  it("mono-intent — pas de composite", () => {
    assert.equal(resolveQueryCompositeShortCircuit("calcule la racine carrée de 16"), null);
  });
});

describe("conversationQueryUnderstanding — intégration", () => {
  it("short-circuit — query understanding prime sur math_root seul", async () => {
    const hit = await runConversationShortCircuit(QUERY_UNDERSTANDING_CANONICAL_MATH_COMPOSITE);
    assert.equal(hit?.path, "math_composite_deterministic");
    assert.ok(hit?.queryUnderstanding);
    assert.ok(hit?.executionPlan);
  });

  it("clarification — query_composite_answerable", () => {
    const decision = evaluateClarificationDecision(QUERY_UNDERSTANDING_CANONICAL_MATH_COMPOSITE);
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.equal(decision.reason, "query_composite_answerable");
  });
});
