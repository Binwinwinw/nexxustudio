import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildSocialPatternReply,
  isPhaticSocialCheckinIntent,
  isSocialSmallTalkAboutAgent,
  isSocialTurnWithTaskPreamble,
  isWellbeingCheckinIntent,
} from "../src/agent/policies/social/index.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const SMALL_TALK = "bonjour que fais tu ?";
const TASK_PREAMBLE =
  "bonjour, j'ai besoin de ton aide pour lancer un site, tu peux m'aider ?";
const TASK_PREAMBLE_ANALYSE = "je voudrais analyser un site, tu peux m'aider ?";
const CHECKIN = "salut, comment ça va ?";

describe("SOCIAL_MICRO_DELESTAGE_GUARD_V1", () => {
  it("bonjour que fais tu ? → SOCIAL + rôle, pas de piste", async () => {
    assert.equal(isPhaticSocialCheckinIntent(SMALL_TALK), true);
    assert.equal(isSocialSmallTalkAboutAgent(SMALL_TALK), true);
    assert.equal(isSocialTurnWithTaskPreamble(SMALL_TALK), false);

    const hit = await runConversationShortCircuit(SMALL_TALK);
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/phatic_checkin");
    assert.match(hit?.reply || "", /NEXXUS/i);
    assert.doesNotMatch(hit?.reply || "", /Je vois la piste/i);
    assert.doesNotMatch(
      buildSocialPatternReply("social/phatic_checkin", SMALL_TALK),
      /Je vois la piste/i,
    );
  });

  it("préambule de tâche → small talk off, transition piste autorisée", () => {
    assert.equal(isSocialTurnWithTaskPreamble(TASK_PREAMBLE), true);
    assert.equal(isSocialSmallTalkAboutAgent(TASK_PREAMBLE), false);
    assert.equal(isPhaticSocialCheckinIntent(TASK_PREAMBLE), false);

    assert.equal(isSocialTurnWithTaskPreamble(TASK_PREAMBLE_ANALYSE), true);
    assert.equal(isSocialSmallTalkAboutAgent(TASK_PREAMBLE_ANALYSE), false);
    assert.equal(isPhaticSocialCheckinIntent(TASK_PREAMBLE_ANALYSE), false);
  });

  it("salut comment ça va → check-in, pas de piste", async () => {
    assert.equal(isWellbeingCheckinIntent(CHECKIN), true);
    assert.equal(isSocialTurnWithTaskPreamble(CHECKIN), false);

    const hit = await runConversationShortCircuit(CHECKIN);
    assert.equal(hit?.path, "social_deterministic");
    assert.doesNotMatch(hit?.reply || "", /Je vois la piste/i);
  });
});
