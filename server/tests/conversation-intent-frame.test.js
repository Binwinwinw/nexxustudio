import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  analyzeConversationIntentFrame,
  isConversationSocialOnlyQuery,
} from "../src/agent/policies/conversationIntentFrame.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isSimpleFactualQuestion } from "../src/agent/policies/justIntentDetectionPolicy.js";

describe("conversationIntentFrame — axes structurels", () => {
  const socialOnlyCases = [
    "yop yop comment ça va là dedans ???",
    "yo, comment ça se passe là dedans ?",
    "salut, ça va ?",
    "yop, tout roule ?",
    "comment tu vas ?",
    "comment ça va chez vous ?",
    "ça roule ?",
    "tout roule de ton côté ?",
    "comment ça se passe la dedans ?",
    "hey ça va bien ?",
    "tu vas bien en ce moment ?",
    "je me suis trompé de discussion désolé",
    "pardon, mauvaise conversation",
    "désolé",
  ];

  for (const q of socialOnlyCases) {
    it(`socialOnly: ${q.slice(0, 40)}`, () => {
      const frame = analyzeConversationIntentFrame(q);
      assert.equal(frame.socialOnly, true, JSON.stringify(frame));
      assert.equal(frame.composite, false);
      assert.equal(isConversationSocialOnlyQuery(q), true);
      assert.equal(isSimpleFactualQuestion(q), false);
    });
  }

  const notSocialCases = [
    "Comment fonctionne HTTP/2 ?",
    "comment tu vas gérer ça ?",
    "ça va régler le problème ?",
    "comment tu vas régler ça pour moi ?",
    "ça va marcher si on change ça ?",
    "désolé, peux-tu traduire en anglais : bonjour",
    "comment ça se passe si je veux ton aide de bout en bout pour un projet de SAAS",
  ];

  for (const q of notSocialCases) {
    it(`pas socialOnly: ${q.slice(0, 40)}`, () => {
      const frame = analyzeConversationIntentFrame(q);
      assert.equal(frame.socialOnly, false);
      assert.equal(isConversationSocialOnlyQuery(q), false);
    });
  }

  it("composite: salut + demande technique → pas socialOnly", () => {
    const q = "salut, tu peux m'aider sur React ?";
    const frame = analyzeConversationIntentFrame(q);
    assert.equal(frame.composite, true);
    assert.equal(frame.socialOnly, false);
  });

  it("routing: reformulations sociales → social_deterministic", async () => {
    for (const q of socialOnlyCases.slice(0, 6)) {
      const hit = await runConversationShortCircuit(q);
      assert.equal(hit?.path, "social_deterministic", q);
    }
  });

  it("routing: composite → pas social_deterministic seul", async () => {
    const mixed = [
      "salut, tu peux m'aider sur React ?",
      "salut comment ça va, tu peux m'expliquer les hooks ?",
    ];
    for (const q of mixed) {
      const hit = await runConversationShortCircuit(q);
      assert.notEqual(hit?.path, "social_deterministic", q);
    }
  });

  it("routing: SaaS bout en bout → méta help_scope, pas social", async () => {
    const q =
      "comment ça se passe si je veux ton aide de bout en bout pour un projet de SAAS";
    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, "social_deterministic", q);
    assert.equal(hit?.path, "meta_conversation_deterministic", q);
    assert.match(hit?.reply || "", /SaaS|Forge|cadrage/i);
  });

  it("routing: excuse / mauvais fil → social_deterministic, pas clarification", async () => {
    const q = "je me suis trompé de discussion désolé";
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "social_deterministic", q);
    assert.match(hit?.reply || "", /pas de souci/i);
  });
});
