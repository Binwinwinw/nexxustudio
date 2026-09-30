import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isBeginnerTopicOverviewRequest,
  extractBeginnerTopicSubject,
} from "../src/agent/utils/intent-guards/beginnerTopicOverviewIntentGuards.js";
import {
  isPedagogicalOverviewRequest,
  hasSchoolCurriculumContext,
} from "../src/agent/utils/intent-guards/pedagogicalOverviewIntentGuards.js";
import { resolveBeginnerTopicOverviewShortCircuit } from "../src/agent/micro/replies/beginnerTopicOverviewComposer.js";
import {
  assertPreEmitCoherence,
  inferShortCircuitPathResponseType,
  runConversationShortCircuit,
  shouldEmitForResponseType,
} from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  buildRequestWorkup,
  understandQuery,
} from "../src/agent/policies/conversation/conversationQueryUnderstanding.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/routing/practicalAdviceRoutingGuard.js";

const BEGINNER_OVERVIEW_POSITIVES = [
  "Pour Teams 365, je pense à un cours d'initiation",
  "Je pense à un cours d'initiation sur Excel",
  "Je voudrais une initiation à Git pour débuter",
  "Je pense à un cours d'initiation à la photographie",
];

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

  it("cycle overview + path beginner → PRE_EMIT autorise l'emit", async () => {
    assert.equal(
      inferShortCircuitPathResponseType("beginner_topic_overview"),
      "overview",
    );

    for (const query of BEGINNER_OVERVIEW_POSITIVES) {
      const cycle = buildRequestWorkup(query, understandQuery(query));
      assert.equal(isBeginnerTopicOverviewRequest(query), true);
      assert.equal(cycle.intent_assessment.familyId, "beginner_topic_overview");
      assert.equal(cycle.response_commitment.responseType, "overview");
      assert.equal(
        shouldEmitForResponseType(
          "beginner_topic_overview",
          cycle.response_commitment,
        ),
        true,
      );
      assert.equal(
        assertPreEmitCoherence({
          path: "beginner_topic_overview",
          response_commitment: cycle.response_commitment,
        }).reason,
        null,
      );
    }

    const cryptoCycle = buildRequestWorkup(CRYPTO_Q, understandQuery(CRYPTO_Q));
    const cryptoHit = await runConversationShortCircuit(CRYPTO_Q, {
      response_commitment: cryptoCycle.response_commitment,
    });
    assert.equal(cryptoHit?.path, "beginner_topic_overview");
  });

  it("mismatch C4 overview/direct forcé reste bloqué", async () => {
    const blockedCommitment = { responseType: "direct" };
    assert.equal(
      shouldEmitForResponseType("beginner_topic_overview", blockedCommitment),
      false,
    );
    assert.equal(
      assertPreEmitCoherence({
        path: "beginner_topic_overview",
        response_commitment: blockedCommitment,
      }).reason,
      "job_rail_mismatch",
    );

    const hit = await runConversationShortCircuit(BEGINNER_OVERVIEW_POSITIVES[0], {
      response_commitment: blockedCommitment,
    });
    assert.notEqual(hit?.path, "beginner_topic_overview");
    assert.equal(/overview/i.test(hit?.path || ""), false);
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
