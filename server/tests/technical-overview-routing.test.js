import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isTechnicalOverviewRequest,
  isDebugDiagnosticSignal,
  parseTechnicalOverview,
  extractTechnicalSubject,
} from "../src/agent/utils/technicalOverviewIntentGuards.js";
import { resolveTechnicalOverviewShortCircuit } from "../src/agent/micro/replies/technicalOverviewComposer.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/practicalAdviceRoutingGuard.js";
import { isBeginnerTopicOverviewRequest } from "../src/agent/utils/beginnerTopicOverviewIntentGuards.js";

describe("technicalOverview — lot 7", () => {
  it("explique Redis → technical_overview", () => {
    const q = "explique Redis";
    assert.equal(isTechnicalOverviewRequest(q), true);
    assert.match(extractTechnicalSubject(q) || "", /redis/i);
    assert.ok(["intro", "standard"].includes(parseTechnicalOverview(q)?.scope));
  });

  it("c'est quoi Kubernetes → slots tech + scope intro", () => {
    const q = "c'est quoi Kubernetes ?";
    assert.equal(isTechnicalOverviewRequest(q), true);
    assert.match(parseTechnicalOverview(q)?.techLabel || "", /kubernetes/i);
  });

  it("bases d'InnoDB → technical_overview", async () => {
    const q = "que faut-il savoir sur les bases d'InnoDB";
    assert.equal(isTechnicalOverviewRequest(q), true);
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "technical_overview");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.technicalOverview, true);
  });

  it("erreur Redis → pas technical_overview (frontière debug)", () => {
    const q = "pourquoi mon Redis crash avec cette erreur ECONNREFUSED";
    assert.equal(isDebugDiagnosticSignal(q), true);
    assert.equal(isTechnicalOverviewRequest(q), false);
  });

  it("comment installer Redis → pas technical_overview (procédural)", () => {
    const q = "comment installer Redis sur Ubuntu";
    assert.equal(isTechnicalOverviewRequest(q), false);
  });

  it("Redis vs Memcached → pas technical_overview (comparatif)", () => {
    const q = "Redis vs Memcached que choisir";
    assert.equal(isTechnicalOverviewRequest(q), false);
  });

  it("débutant crypto reste beginner, pas technical", () => {
    const q = "que doit apprendre un débutant qui veut se lancer dans la cryptomonnaie";
    assert.equal(isBeginnerTopicOverviewRequest(q), true);
    assert.equal(isTechnicalOverviewRequest(q), false);
  });

  it("créer agent Python → pas technical_overview (indice techno seul)", () => {
    const q =
      "j'aimerais créer un agent IA en langage python tu pourrais m'aider à le faire ?";
    assert.equal(isTechnicalOverviewRequest(q), false);
  });

  it("pas de defer orchestrateur implicite", () => {
    const hit = resolveTechnicalOverviewShortCircuit("explique Docker");
    assert.equal(
      shouldDeferShortCircuitToFullPipeline(hit, "explique Docker"),
      false,
    );
  });
});
