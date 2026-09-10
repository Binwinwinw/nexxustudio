import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  understandQuery,
  buildRequestWorkup,
} from "../src/agent/policies/conversation/conversationQueryUnderstanding.js";

const RESPONSE_TYPES = new Set(["direct", "clarify", "overview", "scoping"]);

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
