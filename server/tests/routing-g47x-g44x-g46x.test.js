import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifyConversationTurnFamily,
  CONVERSATION_TURN_FAMILIES,
} from "../src/agent/micro/classifiers/conversationTurnClassifier.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isMetaAssistantBehaviorRequest } from "../src/agent/utils/metaAssistantBehaviorGuards.js";
import { isDebugDiagnosticRequest } from "../src/agent/utils/debugDiagnosticIntentGuards.js";

const CRITIQUE_HISTORY = [
  { role: "user", content: "salut" },
  { role: "assistant", content: "Salut ! code, doc, archi ou papoter." },
  { role: "user", content: "on pourrait faire quoi comme projet" },
  { role: "assistant", content: "Voici trois pistes : RAG local, mini-app, automatisation." },
];

describe("G47.x / G44.x / G46.x — extensions routage", () => {
  it("G46.x mood check-in → social_deterministic", async () => {
    const q = "yo, ça roule ? t'es dans quel mood ce soir ?";
    const c = classifyConversationTurnFamily(q, { history: [] });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN);
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "social_deterministic");
    assert.notEqual(hit?.path, "COMPOSER");
  });

  it("G46.x papoter citadelle → social_deterministic", async () => {
    const q = "on papote un peu de ta journée dans la Citadelle ?";
    const c = classifyConversationTurnFamily(q, { history: [] });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN);
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "social_deterministic");
    assert.match(hit?.reply || "", /Citadelle|papoter/i);
  });

  it("G46.x attaquer nouveau truc → ideation", async () => {
    const q = "si on devait attaquer un nouveau truc ensemble, tu proposerais quoi ?";
    const c = classifyConversationTurnFamily(q, { history: [] });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.IDEATION);
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "ideation_deterministic");
  });

  it("G44.x sans réfléchir → meta_assistant_behavior", async () => {
    const q = "là, on dirait que tu réponds sans réfléchir";
    assert.equal(isMetaAssistantBehaviorRequest(q), true);
    const c = classifyConversationTurnFamily(q, { history: CRITIQUE_HISTORY });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.META_CRITIQUE_ASSISTANT);
    const hit = await runConversationShortCircuit(q, { history: CRITIQUE_HISTORY });
    assert.equal(hit?.path, "meta_assistant_behavior_deterministic");
  });

  it("G44.x mauvais rail → meta_assistant_behavior", async () => {
    const q = "tu as l'air de prendre un mauvais rail là, tu en es conscient ?";
    assert.equal(isMetaAssistantBehaviorRequest(q), true);
    const hit = await runConversationShortCircuit(q, { history: CRITIQUE_HISTORY });
    assert.equal(hit?.path, "meta_assistant_behavior_deterministic");
  });

  it("G44.x trop COMPOSER → meta_assistant_behavior", async () => {
    const q = "je trouve que tu pars trop vite sur COMPOSER pour des petites questions";
    assert.equal(isMetaAssistantBehaviorRequest(q), true);
    const hit = await runConversationShortCircuit(q, { history: CRITIQUE_HISTORY });
    assert.equal(hit?.path, "meta_assistant_behavior_deterministic");
  });

  it("G47.x vue honnête bloque debug_diagnostic guard", () => {
    const q =
      "explique-moi honnêtement ce que tu vois de toi-même dans La Citadelle (fichiers, registres, logs).";
    assert.equal(isDebugDiagnosticRequest(q), false);
  });

  it("G46.x gratitude après info → social/gratitude (pas greeting)", async () => {
    const history = [
      { role: "user", content: "cherche des infos sur Mistral OCR4" },
      {
        role: "assistant",
        content:
          "Mistral OCR 4 a été lancé le 23 juin 2026. Ses capacités principales incluent la détection d'éléments graphiques complexes — tableaux, équations mathématiques, figures dans des papiers scientifiques.",
      },
    ];
    const q = "merci pour ces informations";
    const c = classifyConversationTurnFamily(q, { history });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.SOCIAL_CHECKIN);
    assert.ok(c.signals.includes("social_gratitude_closure"));
    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/gratitude");
    assert.match(hit?.reply || "", /Avec plaisir|De rien/i);
    assert.doesNotMatch(hit?.reply || "", /Sur quoi veux-tu travailler/i);
  });
});
