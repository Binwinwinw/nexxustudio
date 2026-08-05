import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isCareerLearningPathRequest,
  isCareerLearningPathSignal,
  parseCareerLearningPath,
  extractTargetRole,
  extractCareerDomain,
} from "../src/agent/utils/careerLearningPathIntentGuards.js";
import { resolveCareerLearningPathShortCircuit } from "../src/agent/micro/replies/careerLearningPathComposer.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/routing/practicalAdviceRoutingGuard.js";
import { isBeginnerTopicOverviewRequest } from "../src/agent/utils/beginnerTopicOverviewIntentGuards.js";
import { isTechnicalOverviewRequest } from "../src/agent/utils/technicalOverviewIntentGuards.js";
import { isPedagogicalOverviewRequest } from "../src/agent/utils/pedagogicalOverviewIntentGuards.js";
import { isAdminProcedureRequest } from "../src/agent/utils/adminProcedureIntentGuards.js";
import { isCompareChooseRequest } from "../src/agent/utils/compareChooseIntentGuards.js";

describe("careerLearningPath — lot 11", () => {
  it("comment devenir développeur web → career_learning_path", async () => {
    const q = "comment devenir développeur web en reconversion";
    assert.equal(isCareerLearningPathSignal(q), true);
    assert.equal(isCareerLearningPathRequest(q), true);
    assert.match(extractTargetRole(q) || "", /developpeur/i);
    assert.equal(extractCareerDomain(q), "tech");

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "career_learning_path");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.careerLearningPath, true);
  });

  it("roadmap data analyst → career + scope roadmap", () => {
    const q = "roadmap pour devenir data analyst en 18 mois";
    assert.equal(isCareerLearningPathRequest(q), true);
    assert.equal(parseCareerLearningPath(q)?.scope, "roadmap");
    assert.equal(parseCareerLearningPath(q)?.horizon, "medium");
  });

  it("débutant crypto reste beginner, pas career", () => {
    const q = "que doit apprendre un débutant qui veut se lancer dans la cryptomonnaie";
    assert.equal(isBeginnerTopicOverviewRequest(q), true);
    assert.equal(isCareerLearningPathRequest(q), false);
  });

  it("débutant pour devenir dev → career, pas beginner", () => {
    const q = "que doit apprendre un débutant pour devenir développeur Python";
    assert.equal(isBeginnerTopicOverviewRequest(q), false);
    assert.equal(isCareerLearningPathRequest(q), true);
  });

  it("fractions 6e → pédagogique, pas career", () => {
    const q = "que doit apprendre un élève de 6e sur les fractions";
    assert.equal(isPedagogicalOverviewRequest(q), true);
    assert.equal(isCareerLearningPathRequest(q), false);
  });

  it("explique Redis → technical, pas career", () => {
    const q = "explique Redis";
    assert.equal(isTechnicalOverviewRequest(q), true);
    assert.equal(isCareerLearningPathRequest(q), false);
  });

  it("Redis vs Memcached → compare, pas career", () => {
    const q = "Redis vs Memcached que choisir";
    assert.equal(isCompareChooseRequest(q), true);
    assert.equal(isCareerLearningPathRequest(q), false);
  });

  it("comment déclarer impôts → admin, pas career", () => {
    const q = "comment déclarer mes impôts en ligne";
    assert.equal(isAdminProcedureRequest(q), true);
    assert.equal(isCareerLearningPathRequest(q), false);
  });

  it("pas de defer orchestrateur implicite", () => {
    const hit = resolveCareerLearningPathShortCircuit(
      "parcours pour devenir infirmier en reconversion",
    );
    assert.equal(
      shouldDeferShortCircuitToFullPipeline(
        hit,
        "parcours pour devenir infirmier en reconversion",
      ),
      false,
    );
    assert.match(hit?.reflectiveHint || "", /PARCOURS CARRIÈRE/i);
  });
});
