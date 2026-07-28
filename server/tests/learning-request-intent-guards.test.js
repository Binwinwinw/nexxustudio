import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractLearningRequestTarget,
  isLearningRequestShell,
  isLearningRequestWithTarget,
  isLearningRequestForTechnicalDomain,
  suppressesCompareChooseForLearningRequest,
  isPureInformationSeekingNotLearningRequest,
} from "../src/agent/utils/learningRequestIntentGuards.js";
import { isCompareChooseRequest } from "../src/agent/utils/compareChooseIntentGuards.js";
import { isInformationSeekingWithTarget } from "../src/agent/utils/informationSeekingIntentGuards.js";
import { analyzeRequestIntentFrame } from "../src/agent/policies/requestIntentFrame.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { isTechnicalLearningPathRequest } from "../src/agent/utils/technicalLearningPathIntentGuards.js";

describe("learningRequestIntentGuards", () => {
  it("détecte apprentissage du poker + conseil", () => {
    const q = "pour un apprentissage du poker que me conseillerais-tu";
    assert.equal(isLearningRequestShell(q), true);
    assert.equal(isLearningRequestWithTarget(q), true);
    assert.match(extractLearningRequestTarget(q), /poker/i);
    assert.equal(isLearningRequestForTechnicalDomain(q), false);
  });

  it("apprentissage React → pont domaine technique", () => {
    const q = "pour un apprentissage de react que me conseillerais-tu";
    assert.equal(isLearningRequestWithTarget(q), true);
    assert.equal(isLearningRequestForTechnicalDomain(q), true);
    assert.equal(isTechnicalLearningPathRequest(q), true);
  });

  it("info-seeking Teams — pas learning_request", () => {
    const q = "je cherche des informations sur teams 365";
    assert.equal(isInformationSeekingWithTarget(q), true);
    assert.equal(isLearningRequestWithTarget(q), false);
    assert.equal(isPureInformationSeekingNotLearningRequest(q), true);
  });

  it("plan d apprentissage sur React — learning_request, pas info-seeking", () => {
    const q = "je cherche un plan d apprentissage sur react";
    assert.equal(isLearningRequestWithTarget(q), true);
    assert.equal(isInformationSeekingWithTarget(q), false);
  });

  it("compare_choose preempté par learning_request poker", () => {
    const q = "pour un apprentissage du poker que me conseillerais-tu";
    assert.equal(suppressesCompareChooseForLearningRequest(q), true);
    assert.equal(isCompareChooseRequest(q), false);
  });

  it("compare_choose conservé sans ancre apprentissage", () => {
    const q = "que me conseillerais-tu entre redis et memcached";
    assert.equal(isLearningRequestWithTarget(q), false);
    assert.equal(isCompareChooseRequest(q), true);
  });

  it("frame — task.kind learn + domaine general pour poker", () => {
    const q = "pour un apprentissage du poker que me conseillerais-tu";
    const frame = analyzeRequestIntentFrame(q);
    assert.equal(frame.task.kind, "learn");
    assert.equal(frame.domain.kind, "general");
    assert.match(frame.domain.target, /poker/i);
    assert.equal(frame.familyHint, null);
  });

  it("justIntent — plan + signal preempt learning_request", () => {
    const q = "pour un apprentissage du poker que me conseillerais-tu";
    const ji = evaluateJustIntent(q);
    assert.equal(ji.action, "plan");
    assert.ok(ji.signals.includes("preempt:learning_request"));
  });
});
