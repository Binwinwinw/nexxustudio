import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifyConversationTurnFamily,
  CONVERSATION_TURN_FAMILIES,
  shouldSuppressTurnFamilyPath,
} from "../src/agent/micro/classifiers/conversationTurnClassifier.js";
import { resolveConversationTurnFamilyShortCircuit } from "../src/agent/policies/conversation/conversationTurnRoutingPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const SALUT_HISTORY = [
  { role: "user", content: "salut salut" },
  { role: "assistant", content: "Salut ! Je suis là — code, doc, archi ou simple papoter." },
];

const META_REPAIR_HISTORY = [
  ...SALUT_HISTORY,
  { role: "user", content: "quel projet pourrions nous mettre sur pied ???" },
  { role: "assistant", content: "Voici 3 pistes concrètes : RAG local, automatisation, mini-app." },
  { role: "user", content: "je n'ai pas compris ce que tu as dit" },
  { role: "assistant", content: "J'ai mal interprété ta demande précédente." },
  {
    role: "user",
    content:
      "on voit encore que tu ne veut pas réfléchir mais uniquement répondre et à ce moment là tu ne peux pas réfléchir pour répondre correctement",
  },
  { role: "assistant", content: "Tu as raison de pointer ça — ce tour porte sur ma façon de répondre." },
];

describe("G46 — conversation turn classifier", () => {
  it("G46-T01 paraphrase compréhension après méta+repair", () => {
    const c = classifyConversationTurnFamily("tu comprends vraiment ce que je dis ?", {
      history: META_REPAIR_HISTORY,
    });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF);
    assert.ok(c.confidence >= 0.55);
    assert.ok(c.signals.includes("weak_comprehension_wording"));
  });

  it("G46-T02 montre saisi conversation → grounding", async () => {
    const q = "montre moi que tu as saisi la conversation";
    const hit = await runConversationShortCircuit(q, { history: META_REPAIR_HISTORY });
    assert.equal(hit?.path, "comprehension_grounding_deterministic");
    assert.equal(hit?.turnFamily, CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF);
  });

  it("G46-T03 compris mon intention pas simple_factual", async () => {
    const q = "est-ce que tu as compris mon intention";
    const hit = await runConversationShortCircuit(q, { history: META_REPAIR_HISTORY });
    assert.equal(hit?.path, "comprehension_grounding_deterministic");
    assert.notEqual(hit?.path, "simple_factual_lookup");
  });

  it("G46-T04 idéation paraphrase pas social", async () => {
    const q = "on pourrait faire quoi comme projet";
    const c = classifyConversationTurnFamily(q, { history: SALUT_HISTORY });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.IDEATION);
    const hit = await runConversationShortCircuit(q, { history: SALUT_HISTORY });
    assert.equal(hit?.path, "ideation_deterministic");
    assert.notEqual(hit?.path, "social_deterministic");
  });

  it("G46-T05 check-in santé reste social", async () => {
    const hit = await runConversationShortCircuit("comment ca va", { history: [] });
    assert.equal(hit?.path, "social_deterministic");
  });

  it("G46-T06 suppressions bloquent semantic_intent_resolver", () => {
    const c = classifyConversationTurnFamily(
      "tu comprends vraiment ce que je dis ?",
      { history: META_REPAIR_HISTORY },
    );
    assert.equal(
      shouldSuppressTurnFamilyPath(c, "semantic_intent_resolver"),
      true,
    );
  });

  it("G46-T07 resolveConversationTurnFamilyShortCircuit high tier", () => {
    const hit = resolveConversationTurnFamilyShortCircuit(
      "prouve que tu suis le fil",
      { history: META_REPAIR_HISTORY },
    );
    assert.equal(hit?.path, "comprehension_grounding_deterministic");
    assert.equal(hit?.turnFamily, CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF);
  });

  it("G46-T08 check-in + papoter → social_deterministic, pas simple_fast", async () => {
    const q = "on peut papoter alors ?";
    const c = classifyConversationTurnFamily(q, { history: SALUT_HISTORY });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN);
    assert.ok(c.confidence >= 0.78);
    assert.equal(c.tier, "high");
    assert.ok(c.signals.includes("social_acceptance_of_offer"));
    assert.equal(shouldSuppressTurnFamilyPath(c, "simple_fast"), true);
    assert.equal(shouldSuppressTurnFamilyPath(c, "COMPOSER"), true);

    const hit = await runConversationShortCircuit(q, { history: SALUT_HISTORY });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.turnFamily, CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN);
    assert.match(hit?.reply || "", /papoter/i);
    assert.notEqual(hit?.path, "simple_fast");
  });

  it("G46-T09 papoter avec sujet métier ne force pas social_checkin", () => {
    const q = "on peut papoter de mon projet React";
    const c = classifyConversationTurnFamily(q, { history: SALUT_HISTORY });
    assert.notEqual(c.family, CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN);
    assert.ok(!c.signals.includes("social_acceptance_of_offer"));
  });
});
