import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  understandQuery,
  buildRequestWorkup,
} from "../src/agent/policies/conversation/conversationQueryUnderstanding.js";
import { isBeginnerTopicOverviewRequest } from "../src/agent/utils/intent-guards/beginnerTopicOverviewIntentGuards.js";

const RESPONSE_TYPES = new Set(["direct", "clarify", "overview", "scoping"]);

const BEGINNER_OVERVIEW_POSITIVES = [
  "Pour Teams 365, je pense à un cours d'initiation",
  "Je pense à un cours d'initiation sur Excel",
  "Je voudrais une initiation à Git pour débuter",
  "Je pense à un cours d'initiation à la photographie",
];

function cycleOf(query) {
  return buildRequestWorkup(query, understandQuery(query));
}

function commitmentOf(query) {
  const understanding = understandQuery(query);
  return buildRequestWorkup(query, understanding).response_commitment;
}

describe("C4_RESPONSE_TYPE_ON_COMMITMENT_V1", () => {
  it("salut → direct ; canal deterministic inchangé", () => {
    const c = commitmentOf("salut");
    assert.equal(c.responseType, "direct");
    assert.equal(c.renderMode, "deterministic");
  });

  it("site web sans type → scoping (PARTIAL_CLARIFY webapp reste visible)", () => {
    const query = "je veux créer un site web";
    const understanding = understandQuery(query);
    const cycle = buildRequestWorkup(query, understanding);
    assert.equal(cycle.response_commitment.responseType, "scoping");
    assert.equal(cycle.intent_assessment.primaryDomain, "webapp");
  });

  it("aperçu pédagogique → overview", () => {
    const c = commitmentOf(
      "que doit apprendre un élève de 6e sur les fractions simples ?",
    );
    assert.equal(c.responseType, "overview");
  });

  it("initiation générique multi-domaines → même famille beginner + overview", () => {
    for (const query of BEGINNER_OVERVIEW_POSITIVES) {
      assert.equal(isBeginnerTopicOverviewRequest(query), true);
      const cycle = cycleOf(query);
      assert.equal(cycle.intent_assessment.familyId, "beginner_topic_overview");
      assert.equal(cycle.response_commitment.responseType, "overview");
    }
  });

  it("factuel / marqueur isolé / social → pas d'overview beginner", () => {
    const negatives = [
      "C'est quoi Teams 365 ?",
      "initiation demain matin",
      "salut, qu'est-ce que tu fais de beau ?",
    ];
    for (const query of negatives) {
      const cycle = cycleOf(query);
      assert.notEqual(cycle.intent_assessment.familyId, "beginner_topic_overview");
      assert.notEqual(cycle.response_commitment.responseType, "overview");
    }
  });

  it("plan explicite : cycle suit le guard, sans conversion artificielle", () => {
    const query = "Fais-moi le plan complet d'un cours d'initiation à Excel";
    const cycle = cycleOf(query);
    if (isBeginnerTopicOverviewRequest(query)) {
      assert.equal(cycle.intent_assessment.familyId, "beginner_topic_overview");
    } else {
      assert.notEqual(cycle.intent_assessment.familyId, "beginner_topic_overview");
    }
  });

  it("multi-unités incomplet → clarify, pas scoping", () => {
    const c = commitmentOf("quelle heure est-il et traduis bonjour en anglais");
    assert.equal(c.responseType, "clarify");
    assert.equal(c.renderMode, "clarify");
  });

  it("phpMyAdmin : responseType suit le cycle, pas de réparation webapp", () => {
    const query =
      "comment créer une base dans phpMyAdmin l'application web";
    const understanding = understandQuery(query);
    const cycle = buildRequestWorkup(query, understanding);
    const { responseType } = cycle.response_commitment;
    assert.ok(RESPONSE_TYPES.has(responseType));
    const webappClarify =
      cycle.intent_assessment.primaryDomain === "webapp" &&
      cycle.intent_assessment.responseStrategy === "partial_clarify";
    if (webappClarify) {
      assert.equal(responseType, "scoping");
    } else {
      assert.equal(responseType, "direct");
    }
  });
});
