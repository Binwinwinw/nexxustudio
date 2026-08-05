import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY,
  HARDWARE_UPGRADE_GUIDED_QUERY,
  detectCompareChooseIntent,
  extractProductRecommendationSlots,
  getMissingProductRecommendationSlots,
  hasHardwareUpgradeRecommendationContext,
  isCompareChooseSegment,
} from "../src/agent/policies/compareChooseCompositePolicy.js";
import {
  understandQuery,
  buildRequestWorkup,
} from "../src/agent/policies/conversation/conversationQueryUnderstanding.js";
import { resolveGuidedProductIntentContractId } from "../src/agent/policies/guided/index.js";
import { resolveClarificationGate } from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { classifySelectiveDecisionIntent } from "../src/agent/utils/selectiveDecisionIntentGuards.js";
import { isCompareChooseRequest } from "../src/agent/utils/compareChooseIntentGuards.js";
import { resolveStrategyExecution } from "../src/agent/telemetry/strategyExecutionTelemetry.js";

describe("compareChooseCompositePolicy — G31.1 patterns", () => {
  it("classifySelectiveDecisionIntent — conseilles-tu indicatif", () => {
    const hit = classifySelectiveDecisionIntent(COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY);
    assert.equal(hit.detected, true);
    assert.ok(hit.tasks.includes("recommendation"));
  });

  it("isCompareChooseRequest — smartphone achat", () => {
    assert.equal(isCompareChooseRequest(COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY), true);
  });

  it("detectCompareChooseIntent — slots manquants → clarify", () => {
    const intent = detectCompareChooseIntent(COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY);
    assert.equal(intent?.path, "compare_choose_clarify");
    assert.equal(intent?.strategy, "partial_clarify");
    assert.match(intent?.reply || "", /budget/i);
    assert.match(intent?.reply || "", /usage/i);
  });
});

describe("compareChooseCompositePolicy — G31.2 slots", () => {
  it("getMissingProductRecommendationSlots — budget + usage absents", () => {
    const missing = getMissingProductRecommendationSlots(
      COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY,
      "product",
    );
    assert.deepEqual(missing, ["budget", "usage"]);
  });

  it("extractProductRecommendationSlots — budget et usage présents", () => {
    const slots = extractProductRecommendationSlots(
      "meilleur smartphone 2026 budget 500 euros pour photo et jeux",
    );
    assert.equal(slots.budget, 500);
    assert.equal(slots.usage, "photo");
  });

  it("detectCompareChooseIntent — slots remplis → guided_recommendation", () => {
    const intent = detectCompareChooseIntent(
      "meilleur smartphone 2026 budget 500 euros pour photo",
    );
    assert.equal(intent?.path, "compare_choose");
    assert.equal(intent?.strategy, "guided_recommendation");
    assert.equal(intent?.reply, null);
  });

  it("hardware upgrade GPU — budget optionnel si contexte machine + qualité/prix", () => {
    assert.equal(hasHardwareUpgradeRecommendationContext(HARDWARE_UPGRADE_GUIDED_QUERY), true);
    assert.deepEqual(
      getMissingProductRecommendationSlots(HARDWARE_UPGRADE_GUIDED_QUERY, "product"),
      [],
    );
    const intent = detectCompareChooseIntent(HARDWARE_UPGRADE_GUIDED_QUERY);
    assert.equal(intent?.path, "compare_choose");
    assert.equal(intent?.strategy, "guided_recommendation");
  });
});

describe("compareChooseCompositePolicy — G31 intégration", () => {
  it("understandQuery — smartphone → compare_choose partial_clarify", () => {
    const u = understandQuery(COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY);
    assert.equal(u.primaryDomain, "compare_choose");
    assert.ok(u.domains.includes("compare_choose"));
    assert.equal(u.responseStrategy, "partial_clarify");
    assert.equal(u.unqualifiedSegmentCount, 0);
  });

  it("resolveClarificationGate — NEEDS_CLARIFICATION si slots manquants", () => {
    const ji = evaluateJustIntent(COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY);
    const gate = resolveClarificationGate(COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY, {
      justIntent: ji,
    });
    assert.equal(gate.shouldClarify, true);
    assert.equal(gate.decision.reason, "compare_choose_missing_slots");
    assert.match(gate.message, /budget/i);
  });

  it("resolveStrategyExecution — compare_choose override visible", () => {
    const u = understandQuery(COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY);
    const ji = evaluateJustIntent(COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY);
    const gate = resolveClarificationGate(COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY, {
      justIntent: ji,
    });
    const exec = resolveStrategyExecution({
      justIntent: ji,
      clarificationGate: gate,
      queryUnderstanding: u,
    });
    assert.equal(exec.strategy_declared, "build_v1");
    assert.equal(exec.strategy_effective, "partial_clarify");
    assert.equal(exec.strategy_override_reason, "compare_choose_missing_slots");
  });

  it("upgrade RTX 4060 contextuel — guided_recommendation + contrat + web", () => {
    const fullQuery =
      "ben papotage on dira donc voici ma demande : j'ai 4 barrettes DDR4 de 16GB en 1200MHz " +
      "sur un chipset coffee lake et Z370 avec un i7 8700 overclocké à 4200MHz et j'ai une " +
      "GIGABYTES rtx 4060 8GB donc le projet c'est de changer de carte graphique avec le " +
      "meilleure rapport qualité/prix qu'est-ce que tu pourrais me conseiller ????";
    const u = understandQuery(fullQuery);
    assert.equal(u.primaryDomain, "compare_choose");
    assert.equal(u.responseStrategy, "guided_recommendation");
    assert.equal(resolveGuidedProductIntentContractId(u), "GUIDED_PRODUCT_RECOMMENDATION");

    const cycle = buildRequestWorkup(fullQuery, u);
    assert.equal(cycle.intent_assessment.intentContractId, "GUIDED_PRODUCT_RECOMMENDATION");
    assert.equal(cycle.evidence_requirement.level, "high");
    assert.equal(cycle.retrieval_decision.needsExternalInfo, true);
    assert.equal(cycle.retrieval_decision.sourceKind, "web");
    assert.equal(cycle.action_decision.capabilities.web, true);
    assert.equal(cycle.response_commitment.kind, "guided_product_comparison");
    assert.equal(cycle.response_commitment.minItems, 3);

    const gate = resolveClarificationGate(fullQuery, {
      justIntent: evaluateJustIntent(fullQuery),
    });
    assert.equal(gate.shouldClarify, false);
  });
});
