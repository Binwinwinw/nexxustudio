import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/routing/practicalAdviceRoutingGuard.js";

const LEISURE_ASSISTANT = {
  role: "assistant",
  content:
    "On peut discuter, jouer, ou tester un truc léger — tu préfères quoi ?",
};

const GLOSS_QUERY = `qu'est-ce que tu entends par "un truc léger" ?`;

function scOptions(history) {
  return {
    history,
    getDeterministicSocialResponse: () => null,
  };
}

function assertNotGlossHit(hit) {
  assert.notEqual(hit?.assistantPhraseGloss, true);
  assert.doesNotMatch(hit?.reply || "", /j['']entendais une activit/i);
}

describe("assistant-phrase-gloss — dernier tour assistant", () => {
  it("glose « un truc léger » avant le pipeline GK", async () => {
    const hit = await runConversationShortCircuit(
      GLOSS_QUERY,
      scOptions([LEISURE_ASSISTANT]),
    );

    assert.equal(hit?.assistantPhraseGloss, true);
    assert.ok(hit?.reply);
    assert.match(hit.reply, /un truc l[eé]ger/i);
    assert.match(hit.reply, /discuter|jouer|d[eé]fi|jeu de mots|discussion courte/i);
    assert.notEqual(hit.path, "general_knowledge_full_pipeline");
    assert.notEqual(hit.path, "general_knowledge_deterministic");
    assert.equal(hit.deferToLlm, false);
    assert.equal(hit.deferToFullPipeline, false);
    assert.equal(hit.skipSovereign, true);
    assert.equal(hit.skipPlanner, true);
    assert.equal(hit.skipWeb, true);
    assert.equal(hit.skipComposer, true);
    assert.equal(shouldDeferShortCircuitToFullPipeline(hit, GLOSS_QUERY), false);
    assert.doesNotMatch(hit.reply, /https?:\/\//i);
    assert.doesNotMatch(hit.reply, /recyclait|entity_miss|reformule/i);
  });

  it("ne capture pas une vraie connaissance générale", async () => {
    const query = "Qu'est-ce que la photosynthèse ?";
    const hit = await runConversationShortCircuit(
      query,
      scOptions([LEISURE_ASSISTANT]),
    );
    assertNotGlossHit(hit);
    assert.equal(hit?.path, "general_knowledge_full_pipeline");
    assert.equal(hit?.deferToFullPipeline, true);
  });

  it("ne capture pas une expression absente du dernier assistant", async () => {
    const query = "Qu'est-ce que tu entends par démocratie ?";
    const hit = await runConversationShortCircuit(
      query,
      scOptions([LEISURE_ASSISTANT]),
    );
    assertNotGlossHit(hit);
    assert.equal(hit?.path, "general_knowledge_full_pipeline");
    assert.equal(hit?.deferToFullPipeline, true);
  });

  it("ne capture pas une question sans cible après « par »", async () => {
    const query = "Qu'est-ce que tu entends ?";
    const hit = await runConversationShortCircuit(
      query,
      scOptions([LEISURE_ASSISTANT]),
    );
    assertNotGlossHit(hit);
  });

  it("ne remonte pas à un assistant plus ancien que le dernier", async () => {
    const query = `Qu'est-ce que tu entends par "un truc léger" ?`;
    const hit = await runConversationShortCircuit(
      query,
      scOptions([
        { role: "assistant", content: "On peut tester un truc léger." },
        { role: "user", content: "ok" },
        { role: "assistant", content: "Très bien, je reste disponible." },
      ]),
    );
    assertNotGlossHit(hit);
    assert.equal(hit?.path, "general_knowledge_full_pipeline");
    assert.equal(hit?.deferToFullPipeline, true);
  });
});
