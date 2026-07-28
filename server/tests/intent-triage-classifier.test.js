import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  triageUserIntent,
  TRIAGE_INTENTS,
  TRIAGE_CONFIDENCE,
  TRIAGE_ROUTING_ACTION,
  resolveWantsAnalysisFromTriage,
  shouldBlockDocumentAnalysisRoute,
  buildIntentClarificationMessage,
} from "../src/agent/classifiers/intentTriageClassifier.js";
import {
  CODE_REVIEW_PRODUCTION_BUG_QUERIES,
} from "./fixtures/codeReviewGoldenQueries.js";

describe("intentTriageClassifier", () => {
  const scenario = CODE_REVIEW_PRODUCTION_BUG_QUERIES[0];

  it("produit le schéma 5 champs + routing_action", () => {
    const triage = triageUserIntent(scenario.query);
    assert.ok(triage.top_intent);
    assert.ok("runner_up" in triage);
    assert.ok(triage.confidence);
    assert.equal(typeof triage.confidence_score, "number");
    assert.equal(typeof triage.needs_clarification, "boolean");
    assert.ok(triage.routing_action);
  });

  it("classe la calculatrice en code_review avec confiance haute", () => {
    const triage = triageUserIntent(scenario.query);
    assert.equal(triage.top_intent, TRIAGE_INTENTS.CODE_REVIEW);
    assert.equal(triage.confidence, TRIAGE_CONFIDENCE.HIGH);
    assert.equal(triage.needs_clarification, false);
    assert.equal(triage.routing_action, TRIAGE_ROUTING_ACTION.ROUTE_DIRECT);
    assert.ok(triage.confidence_score >= 0.5);
  });

  it("bloque le routage documentaire pour une intention code fiable", () => {
    const triage = triageUserIntent(scenario.query);
    assert.equal(shouldBlockDocumentAnalysisRoute(triage), true);
    assert.equal(resolveWantsAnalysisFromTriage(triage, scenario.query), false);
  });

  it("favorise document_analysis pour un résumé sans code", () => {
    const docQuery =
      "Résume ce passage et extrais les points clés :\n\nLa Citadelle est un système local-first conçu pour l'orchestration souveraine.";
    const triage = triageUserIntent(docQuery);
    assert.equal(triage.top_intent, TRIAGE_INTENTS.DOCUMENT_ANALYSIS);
    assert.equal(resolveWantsAnalysisFromTriage(triage, docQuery), true);
  });

  it("distingue explication explicite de revue", () => {
    const explainQ =
      "Explique ce code Python : def addition(a, b): return a + b\nprint(addition(1,2))";
    const triage = triageUserIntent(explainQ);
    assert.equal(triage.top_intent, TRIAGE_INTENTS.CODE_EXPLAIN);
    assert.notEqual(triage.top_intent, TRIAGE_INTENTS.CODE_REVIEW);
  });

  it("produit une clarification pour ambiguïté analyse + snippet faible", () => {
    const triage = triageUserIntent(
      "analyse ceci :\n" + "lorem ipsum ".repeat(40),
    );
    if (triage.needs_clarification) {
      assert.equal(triage.routing_action, TRIAGE_ROUTING_ACTION.ASK_CLARIFICATION);
      const msg = buildIntentClarificationMessage(triage);
      assert.match(msg, /1\.|2\./);
    }
  });

  it("reconnaît formulation explicite revue orientée exécution", () => {
    const triage = triageUserIntent(
      "Fais une revue de code Python orientée exécution : commence par les erreurs bloquantes.\ndef broken( return 1",
    );
    assert.equal(triage.top_intent, TRIAGE_INTENTS.CODE_REVIEW);
    assert.equal(triage.confidence, TRIAGE_CONFIDENCE.HIGH);
  });

  it("classe l'auto-analyse assistant en self_analysis (pas document_analysis)", () => {
    const query =
      "hé bien je me demandais si tu voudrais m'aider à lister tes dernières améliorations côté structure, et côté réponse dans la conversation si tu es en capacité de t'auto-analyser";
    const triage = triageUserIntent(query);
    assert.equal(triage.top_intent, TRIAGE_INTENTS.SELF_ANALYSIS);
    assert.notEqual(triage.top_intent, TRIAGE_INTENTS.DOCUMENT_ANALYSIS);
    assert.equal(resolveWantsAnalysisFromTriage(triage, query), false);
    assert.equal(shouldBlockDocumentAnalysisRoute(triage), true);
  });

  it("classe la conscience temporelle en self_analysis via garde méta", () => {
    const query =
      "comment faire pour te faire maitriser le sens de l'heure pour en prendre conscience?";
    const triage = triageUserIntent(query);
    assert.equal(triage.top_intent, TRIAGE_INTENTS.SELF_ANALYSIS);
    assert.equal(resolveWantsAnalysisFromTriage(triage, query), false);
  });
});
