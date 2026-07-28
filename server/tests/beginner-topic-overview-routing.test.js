import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isBeginnerTopicOverviewRequest,
  extractBeginnerTopicSubject,
} from "../src/agent/utils/beginnerTopicOverviewIntentGuards.js";
import {
  isPedagogicalOverviewRequest,
  hasSchoolCurriculumContext,
} from "../src/agent/utils/pedagogicalOverviewIntentGuards.js";
import { resolveBeginnerTopicOverviewShortCircuit } from "../src/agent/micro/replies/beginnerTopicOverviewComposer.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/practicalAdviceRoutingGuard.js";

const CRYPTO_Q =
  "que doit apprendre un débutant qui veut se lancer dans la cryptomonnaie";
const PRIMAIRE_ARITH =
  "que doit apprendre un élève de primaire en arithmétique?";
const SECONDE_HG =
  "que doit apprendre un élève de seconde en histoire géographie?";

describe("beginnerTopicOverview — lot 6", () => {
  it("crypto débutant → beginner overview, pas pédagogique", () => {
    assert.equal(isBeginnerTopicOverviewRequest(CRYPTO_Q), true);
    assert.equal(isPedagogicalOverviewRequest(CRYPTO_Q), false);
    assert.match(extractBeginnerTopicSubject(CRYPTO_Q) || "", /crypto/i);
  });

  it("short-circuit → beginner_topic_overview sans launcher clarify", async () => {
    const hit = await runConversationShortCircuit(CRYPTO_Q);
    assert.equal(hit?.path, "beginner_topic_overview");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.beginnerTopicOverview, true);
    assert.notEqual(hit?.path, "launcher_guide_clarify");
  });

  it("primaire / seconde restent pédagogiques", () => {
    assert.equal(hasSchoolCurriculumContext(PRIMAIRE_ARITH), true);
    assert.equal(isPedagogicalOverviewRequest(PRIMAIRE_ARITH), true);
    assert.equal(isBeginnerTopicOverviewRequest(PRIMAIRE_ARITH), false);
    assert.equal(isPedagogicalOverviewRequest(SECONDE_HG), true);
  });

  it("generative pédagogique / beginner → pas de defer orchestrateur implicite", async () => {
    const pedHit = await runConversationShortCircuit(PRIMAIRE_ARITH);
    assert.equal(pedHit?.path, "pedagogical_overview");
    assert.equal(
      shouldDeferShortCircuitToFullPipeline(pedHit, PRIMAIRE_ARITH),
      false,
    );

    const begHit = resolveBeginnerTopicOverviewShortCircuit(CRYPTO_Q);
    assert.equal(
      shouldDeferShortCircuitToFullPipeline(begHit, CRYPTO_Q),
      false,
    );
  });
});
