import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifySocialPattern,
  isAgentStateAnthropomorphicIntent,
  isPhaticSocialCheckinIntent,
  isSocialSmallTalkAboutAgent,
} from "../src/agent/policies/social/index.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const CIRCUITS = "comment se portent tes circuits ?";
const CIRCUITS_GREETING = "bonjour, comment se portent tes circuits ???";
const CIRCUITS_WELL = "tes circuits vont bien ?";
const PHATIC = "que fais tu ?";

const TECHNICAL_LEAK =
  /orchestrat|architecture|local-first|firmware|périmètre|perimetre|Je vois la piste|validation locale/i;

const OPERATIONAL_INVITE = {
  role: "assistant",
  content:
    "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
};

describe("SOCIAL_AGENT_STATE_ANTHROPO_V1", () => {
  it("comment se portent tes circuits ? → social court, pas technique", async () => {
    assert.equal(isAgentStateAnthropomorphicIntent(CIRCUITS), true);
    assert.equal(isSocialSmallTalkAboutAgent(CIRCUITS), true);
    assert.equal(classifySocialPattern(CIRCUITS)?.patternName, "social/anthropomorphic_checkin");

    const hit = await runConversationShortCircuit(CIRCUITS);
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/anthropomorphic_checkin");
    assert.ok(!hit?.deferToLlm);
    assert.doesNotMatch(hit?.reply || "", TECHNICAL_LEAK);
    assert.match(hit?.reply || "", /ça va bien|discuter|cadrer/i);
  });

  it("tes circuits vont bien ? → social court, pas technique", async () => {
    assert.equal(isAgentStateAnthropomorphicIntent(CIRCUITS_WELL), true);
    const hit = await runConversationShortCircuit(CIRCUITS_WELL);
    assert.equal(hit?.path, "social_deterministic");
    assert.doesNotMatch(hit?.reply || "", TECHNICAL_LEAK);
  });

  it("bonjour + circuits → salut + état + relance, pas d'architecture", async () => {
    const hit = await runConversationShortCircuit(CIRCUITS_GREETING);
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/anthropomorphic_checkin");
    assert.match(hit?.reply || "", /^Bonjour !/);
    assert.match(hit?.reply || "", /ça va bien|discuter|cadrer/i);
    assert.doesNotMatch(hit?.reply || "", TECHNICAL_LEAK);
  });

  it("fil ouvert après offre papoter → pas exploratory explain", async () => {
    const hit = await runConversationShortCircuit(CIRCUITS, {
      history: [OPERATIONAL_INVITE],
    });
    assert.equal(hit?.path, "social_deterministic");
    assert.notEqual(hit?.path, "exploratory_conversation_light");
    assert.doesNotMatch(hit?.reply || "", TECHNICAL_LEAK);
  });

  it("que fais tu ? reste small talk rôle, pas état circuits", async () => {
    assert.equal(isPhaticSocialCheckinIntent(PHATIC), true);
    assert.equal(isAgentStateAnthropomorphicIntent(PHATIC), false);
    const hit = await runConversationShortCircuit(PHATIC);
    assert.equal(hit?.socialPatternName, "social/phatic_checkin");
    assert.doesNotMatch(hit?.reply || "", TECHNICAL_LEAK);
  });
});
