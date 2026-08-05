import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isGeneralKnowledgeRequest,
  extractGeneralKnowledgeSubject,
  isCulturalArtifactSubject,
  isPureGeographicFamiliarity,
} from "../src/agent/utils/generalKnowledgeIntentGuards.js";
import { isRecipeKnowledgeRequest } from "../src/agent/utils/recipeKnowledgeIntentGuards.js";
import {
  requiresGeneralKnowledgeComposerContract,
  resolveLocalGeneralKnowledgeDetail,
  resolveGeneralKnowledgeShortCircuit,
  isGeneralKnowledgeContractViolation,
  buildGeneralKnowledgeUserPrompt,
} from "../src/agent/micro/replies/generalKnowledgeComposerContract.js";
import {
  requiresGenerousComposerResponse,
  shouldBypassMultiSegmentShortCircuit,
  shouldDeferShortCircuitToFullPipeline,
} from "../src/agent/policies/routing/practicalAdviceRoutingGuard.js";
import { shouldBypassSimpleFast } from "../src/agent/config/intentContractRegistry.js";
import { evaluateEpistemicRefusal } from "../src/agent/config/modeResponseContracts.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  resolveQueryEntityUnderstanding,
  shouldBypassForgeSubjectClarification,
} from "../src/agent/utils/queryEntityUnderstanding.js";
import { resolveGeneralKnowledgeEnrichmentPolicy } from "../src/agent/policies/routing/generalKnowledgeEnrichmentPolicy.js";
import { buildFamiliarityReply } from "../src/agent/micro/replies/familiarityReplyBuilder.js";
import { buildSubjectClarificationReply } from "../src/agent/micro/subject/subjectResponseBuilder.js";

const BOEUF_RECIPE_QUERY = "connais tu la recette du boeuf bourguignon";
const BOEUF_DISH_QUERY = "tu connais le boeuf bourguignon";
const CARBONARA_QUERY = "connais tu la recette de la carbonara";
const TOUR_EIFFEL_QUERY = "c'est quoi la Tour Eiffel";
const COMPARATIVE_QUERY =
  "as tu assez de connaissances pour me proposer la recette la plus rapide a servir parmi toute les recettes classiques que tu connais ??";
const ITALY_QUERY = "Tu connais l'Italie ?";
const NISSAN_QUERY =
  "connais tu la nissan skyline gtr et quelle est l annee du premier modele chez nissan";

describe("generalKnowledgeIntentGuards — détection culture générale", () => {
  it("détecte recette nommée", () => {
    assert.equal(isGeneralKnowledgeRequest(BOEUF_RECIPE_QUERY), true);
    assert.equal(isRecipeKnowledgeRequest(BOEUF_RECIPE_QUERY), true);
    assert.equal(extractGeneralKnowledgeSubject(BOEUF_RECIPE_QUERY), "boeuf bourguignon");
  });

  it("détecte plat classique sans mot recette", () => {
    assert.equal(isGeneralKnowledgeRequest(BOEUF_DISH_QUERY), true);
    assert.equal(isCulturalArtifactSubject("boeuf bourguignon"), true);
    assert.match(
      extractGeneralKnowledgeSubject(BOEUF_DISH_QUERY) || "",
      /boeuf bourguignon/i,
    );
  });

  it("détecte monument / classique connu", () => {
    assert.equal(isGeneralKnowledgeRequest(TOUR_EIFFEL_QUERY), true);
    assert.equal(isCulturalArtifactSubject("tour eiffel"), true);
  });

  it("conserve familiarité pays brève", () => {
    assert.equal(isPureGeographicFamiliarity(ITALY_QUERY), true);
    assert.equal(isGeneralKnowledgeRequest(ITALY_QUERY), false);
  });

  it("ignore comparatif avec critère explicite", () => {
    assert.equal(isGeneralKnowledgeRequest(COMPARATIVE_QUERY), false);
  });

  it("détecte automobile composée (Nissan Skyline GT-R)", () => {
    assert.equal(isGeneralKnowledgeRequest(NISSAN_QUERY), true);
    assert.equal(extractGeneralKnowledgeSubject(NISSAN_QUERY), "nissan skyline gtr");
    const understanding = resolveQueryEntityUnderstanding(NISSAN_QUERY);
    assert.equal(understanding.domain, "automotive");
    assert.ok(understanding.ambiguityScore < 0.2);
    assert.equal(shouldBypassForgeSubjectClarification(NISSAN_QUERY), true);
  });
});

describe("generalKnowledgeRouting — pipeline généreux", () => {
  it("bypass multi_segment et SIMPLE_FAST (recette + plat)", () => {
    for (const q of [BOEUF_RECIPE_QUERY, BOEUF_DISH_QUERY, TOUR_EIFFEL_QUERY]) {
      assert.equal(requiresGenerousComposerResponse(q), true, q);
      assert.equal(shouldBypassMultiSegmentShortCircuit(q), true, q);
      assert.equal(shouldBypassSimpleFast(q), true, q);
    }
  });

  it("épistémique : pas de refus pour culture générale", () => {
    const verdict = evaluateEpistemicRefusal({
      query: BOEUF_DISH_QUERY,
      hasReliableContext: false,
      responseText: "",
    });
    assert.equal(verdict.shouldRefuse, false);
    assert.equal(verdict.reason, "general_knowledge_generous_response");
  });
});

describe("generalKnowledgeShortCircuit — fiche locale humaine", () => {
  it("résout bœuf bourguignon (recette ou plat)", () => {
    for (const q of [BOEUF_RECIPE_QUERY, BOEUF_DISH_QUERY]) {
      const local = resolveLocalGeneralKnowledgeDetail(q);
      assert.ok(local, q);
      assert.match(local, /Oui, je connais bien le/i);
      assert.match(local, /Bourgogne|bourguignon/i);
      assert.ok(local.length > 200, q);
    }
  });

  it("short-circuit déterministe pour bœuf bourguignon", async () => {
    for (const q of [BOEUF_RECIPE_QUERY, BOEUF_DISH_QUERY]) {
      const hit = await runConversationShortCircuit(q, {
        getDeterministicSocialResponse: () => null,
        history: [],
      });
      assert.equal(hit?.path, "general_knowledge_deterministic", q);
      assert.match(hit?.reply || "", /Oui, je connais bien/i);
      assert.notEqual(hit?.path, "multi_segment_composite", q);
      assert.notEqual(hit?.path, "familiarity_deterministic", q);
    }
  });

  it("rejette liste de mots-clés sans contenu", () => {
    const bad =
      "Tu veux critere ou carbonara ou cacio e pepe ou pates traditionnelles bolognaise";
    assert.equal(isGeneralKnowledgeContractViolation(BOEUF_DISH_QUERY, bad), true);
  });
});

describe("generalKnowledge — pas de clarify Forge sur entité claire", () => {
  it("pas de réponse Forge/logiciel/jeu pour Nissan", () => {
    assert.equal(buildFamiliarityReply(NISSAN_QUERY), null);
    const clarify = buildSubjectClarificationReply(
      {
        nature: "unresolved_proper_name",
        target: "nissan skyline gtr",
        confidence: "low",
      },
      { mustClarify: true, allowDirectAnswer: false },
      { query: NISSAN_QUERY },
    );
    assert.equal(clarify, null);
  });

  it("enrichissement web recommandé sans fiche locale", () => {
    const policy = resolveGeneralKnowledgeEnrichmentPolicy(NISSAN_QUERY);
    assert.equal(policy.preferWebResearch, true);
    assert.equal(policy.domain, "automotive");
  });

  it("short-circuit → pipeline complet (pas familiarity)", async () => {
    const hit = await runConversationShortCircuit(NISSAN_QUERY, {
      getDeterministicSocialResponse: () => null,
      history: [],
    });
    assert.equal(hit?.path, "general_knowledge_full_pipeline");
    assert.equal(hit?.deferToFullPipeline, true);
    assert.notEqual(hit?.path, "familiarity_deterministic");
  });
});

describe("generalKnowledgeShortCircuit — sans fiche locale", () => {
  it("défère au pipeline complet pour carbonara", () => {
    const hit = resolveGeneralKnowledgeShortCircuit(CARBONARA_QUERY);
    assert.equal(hit?.deferToFullPipeline, true);
    assert.equal(hit?.path, "general_knowledge_full_pipeline");
  });

  it("short-circuit defer → pipeline complet", async () => {
    const hit = await runConversationShortCircuit(CARBONARA_QUERY, {
      getDeterministicSocialResponse: () => null,
      history: [],
    });
    assert.equal(hit?.path, "general_knowledge_full_pipeline");
    assert.equal(
      shouldDeferShortCircuitToFullPipeline(hit, CARBONARA_QUERY),
      true,
    );
  });

  it("prompt user généreux sans menu d'options", () => {
    const prompt = buildGeneralKnowledgeUserPrompt(CARBONARA_QUERY, {});
    assert.match(prompt, /carbonara/i);
    assert.match(prompt, /Pas de menu d'options/i);
    assert.equal(requiresGeneralKnowledgeComposerContract(CARBONARA_QUERY), true);
  });
});
