import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifySelectiveDecisionIntent,
  requiresFullPipelineForDecision,
  resolveDecisionRouting,
  SELECTIVE_DECISION_TASKS,
} from "../src/agent/utils/selectiveDecisionIntentGuards.js";
import { isCulinaryPracticalAdviceQuery } from "../src/agent/utils/culinaryPracticalIntentGuards.js";
import {
  shouldBypassMultiSegmentShortCircuit,
  shouldDeferShortCircuitToFullPipeline,
} from "../src/agent/policies/routing/practicalAdviceRoutingGuard.js";
import { shouldBypassSimpleFast } from "../src/agent/config/intentContractRegistry.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { enforceModeContract, RESPONSE_MODES } from "../src/agent/config/modeResponseContracts.js";

const RECIPE_COMPARATIVE_QUERY =
  "as tu assez de connaissances pour me proposer la recette la plus rapide a servir parmi toute les recettes classiques que tu connais ??";

const GPU_RECOMMENDATION_QUERY =
  "pourrais tu trouver quelle date nous sommes afin de trouver quelle carte graphique 8Go serait un bon achat ??";

const VEHICLE_CHOICE_QUERY =
  "qu est ce que tu choisirais pour un premier vehicule electrique fiable parmi ceux que tu connais";

const SHOES_QUERY = "le plus simple a entretenir parmi les chaussures de running que tu connais";

describe("selectiveDecisionIntentGuards — classification", () => {
  it("détecte arbitrage implicite + comparatif (recette)", () => {
    const hit = classifySelectiveDecisionIntent(RECIPE_COMPARATIVE_QUERY);
    assert.equal(hit.detected, true);
    assert.ok(hit.tasks.includes(SELECTIVE_DECISION_TASKS.ARBITRATION));
    assert.ok(
      hit.tasks.some((t) =>
        [SELECTIVE_DECISION_TASKS.RANKING, SELECTIVE_DECISION_TASKS.COMPARATIVE].includes(t),
      ),
    );
  });

  it("détecte recommandation implicite (GPU / bon achat)", () => {
    const hit = classifySelectiveDecisionIntent(GPU_RECOMMENDATION_QUERY);
    assert.equal(hit.detected, true);
    assert.ok(hit.tasks.includes(SELECTIVE_DECISION_TASKS.CONSTRAINED_CHOICE));
  });

  it("détecte choix contraint véhicule sans mot compare", () => {
    const hit = classifySelectiveDecisionIntent(VEHICLE_CHOICE_QUERY);
    assert.equal(hit.detected, true);
    assert.ok(hit.tasks.includes(SELECTIVE_DECISION_TASKS.CONSTRAINED_CHOICE));
    assert.ok(hit.tasks.includes(SELECTIVE_DECISION_TASKS.RECOMMENDATION));
  });

  it("détecte classement implicite chaussures", () => {
    const hit = classifySelectiveDecisionIntent(SHOES_QUERY);
    assert.equal(hit.detected, true);
    assert.ok(hit.tasks.includes(SELECTIVE_DECISION_TASKS.RANKING));
    assert.ok(hit.tasks.includes(SELECTIVE_DECISION_TASKS.COMPARATIVE));
  });

  it("ignore familiarité pure", () => {
    assert.equal(requiresFullPipelineForDecision("Tu connais l'Italie ?"), false);
    assert.equal(resolveDecisionRouting("Tu connais l'Italie ?").route, "simple_fast");
  });

  it("ignore lookup factuel simple (heure)", () => {
    assert.equal(requiresFullPipelineForDecision("quelle heure est il"), false);
  });
});

describe("selectiveDecisionRouting — pipeline complet", () => {
  it("route full_pipeline pour toutes les requêtes à charge décisionnelle", () => {
    for (const q of [
      RECIPE_COMPARATIVE_QUERY,
      GPU_RECOMMENDATION_QUERY,
      VEHICLE_CHOICE_QUERY,
      SHOES_QUERY,
    ]) {
      assert.equal(requiresFullPipelineForDecision(q), true, q);
      assert.equal(resolveDecisionRouting(q).route, "full_pipeline", q);
    }
  });

  it("bypass multi_segment (recette + GPU + véhicule)", () => {
    assert.equal(shouldBypassMultiSegmentShortCircuit(RECIPE_COMPARATIVE_QUERY), true);
    assert.equal(shouldBypassMultiSegmentShortCircuit(GPU_RECOMMENDATION_QUERY), true);
    assert.equal(shouldBypassMultiSegmentShortCircuit(VEHICLE_CHOICE_QUERY), true);
  });

  it("bypass SIMPLE_FAST direct via intent contract", () => {
    assert.equal(shouldBypassSimpleFast(RECIPE_COMPARATIVE_QUERY), true);
    assert.equal(shouldBypassSimpleFast(GPU_RECOMMENDATION_QUERY), true);
  });

  it("short-circuit : compare_choose explicite (pas multi_segment)", async () => {
    for (const q of [RECIPE_COMPARATIVE_QUERY, GPU_RECOMMENDATION_QUERY]) {
      const hit = await runConversationShortCircuit(q, {
        getDeterministicSocialResponse: () => null,
        history: [],
      });
      assert.equal(hit?.path, "compare_choose", q);
      assert.equal(hit?.deferToFullPipeline, true, q);
      assert.notEqual(hit?.path, "multi_segment_composite", q);
    }
  });

  it("culinaire : détection domaine + charge décisionnelle", () => {
    assert.equal(isCulinaryPracticalAdviceQuery(RECIPE_COMPARATIVE_QUERY), true);
    assert.equal(isCulinaryPracticalAdviceQuery(GPU_RECOMMENDATION_QUERY), false);
  });

  it("anaphora carryover → defer pipeline complet", () => {
    const hit = {
      path: "anaphora_reference_carryover",
      deferToLlm: true,
      deferToFullPipeline: true,
    };
    assert.equal(shouldDeferShortCircuitToFullPipeline(hit, "tu peux le detailler ?"), true);
  });
});

describe("selectiveDecisionRouting — contrat non tronqué", () => {
  it("DOCUMENT ne tronque pas une réponse structurée", () => {
    const longReply = `Oui, je connais plusieurs options.
Parmi elles, la plus rapide est le pesto (≈10 min).
Carbonara : 400 g spaghetti, 120 g guanciale, émulsion hors du feu.`;
    const out = enforceModeContract(RESPONSE_MODES.DOCUMENT, longReply, {
      allowRefusal: false,
    });
    assert.match(out, /400 g spaghetti/i);
    assert.ok(out.split("\n").length > 2);
  });
});
