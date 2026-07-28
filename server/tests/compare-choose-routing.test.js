import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isCompareChooseRequest,
  parseCompareChoose,
  extractCompareOptions,
  extractCompareDomain,
} from "../src/agent/utils/compareChooseIntentGuards.js";
import { resolveCompareChooseShortCircuit } from "../src/agent/micro/replies/compareChooseComposer.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/practicalAdviceRoutingGuard.js";
import { isTechnicalOverviewRequest } from "../src/agent/utils/technicalOverviewIntentGuards.js";
import { isDebugDiagnosticRequest } from "../src/agent/utils/debugDiagnosticIntentGuards.js";
import { SELECTIVE_DECISION_TASKS } from "../src/agent/utils/selectiveDecisionIntentGuards.js";

describe("compareChoose — lot 9", () => {
  it("Redis vs Memcached que choisir → compare_choose", async () => {
    const q = "Redis vs Memcached que choisir pour un cache session";
    assert.equal(isCompareChooseRequest(q), true);
    assert.equal(isTechnicalOverviewRequest(q), false);
    assert.equal(extractCompareDomain(q), "tech");
    assert.deepEqual(extractCompareOptions(q), ["redis", "memcached"]);

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "compare_choose");
    assert.equal(hit?.deferToFullPipeline, true);
    assert.equal(hit?.compareChoose, true);
  });

  it("recommandation GPU avec critère → directArbitration dans slots", () => {
    const q =
      "quelle carte graphique 8Go serait un bon achat pour du montage vidéo";
    assert.equal(isCompareChooseRequest(q), true);
    const slots = parseCompareChoose(q);
    assert.equal(slots?.domain, "product");
    assert.ok(slots?.tasks.includes(SELECTIVE_DECISION_TASKS.CONSTRAINED_CHOICE));
    assert.equal(slots?.directArbitration, false);
  });

  it("le plus rapide parmi recettes classiques → compare + defer pipeline", async () => {
    const q =
      "as tu assez de connaissances pour me proposer la recette la plus rapide a servir parmi toute les recettes classiques que tu connais ??";
    assert.equal(isCompareChooseRequest(q), true);
    assert.equal(extractCompareDomain(q), "culinary");

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "compare_choose");
    assert.equal(hit?.deferToFullPipeline, true);
    assert.notEqual(hit?.path, "multi_segment_composite");
  });

  it("explique Redis → technical, pas compare", () => {
    const q = "explique Redis";
    assert.equal(isCompareChooseRequest(q), false);
    assert.equal(isTechnicalOverviewRequest(q), true);
  });

  it("pourquoi Redis crash → debug, pas compare", () => {
    const q = "pourquoi mon Redis crash avec ECONNREFUSED";
    assert.equal(isCompareChooseRequest(q), false);
    assert.equal(isDebugDiagnosticRequest(q), true);
  });

  it("Tu connais l'Italie → pas compare", () => {
    const q = "Tu connais l'Italie ?";
    assert.equal(isCompareChooseRequest(q), false);
  });

  it("defer orchestrateur explicite via compareChoose", () => {
    const hit = resolveCompareChooseShortCircuit(
      "le plus simple a entretenir parmi les chaussures de running que tu connais",
    );
    assert.equal(
      shouldDeferShortCircuitToFullPipeline(
        hit,
        "le plus simple a entretenir parmi les chaussures de running que tu connais",
      ),
      true,
    );
  });

  it("addon compare interdit clarify-first et troncature", () => {
    const hit = resolveCompareChooseShortCircuit("React vs Vue pour une SPA");
    assert.match(hit?.reflectiveHint || "", /COMPARE \/ CHOOSE/i);
    assert.match(hit?.reflectiveHint || "", /sans tronquer|tronqu/i);
    assert.match(hit?.reflectiveHint || "", /Clarify-first/i);
  });
});
