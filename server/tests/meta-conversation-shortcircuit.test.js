import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { INSUFFICIENT_SIGNAL_REFUSAL, RESPONSE_MODES } from "../src/agent/config/modeResponseContracts.js";
import { resolveMetaConversationRoute } from "../src/agent/micro/replies/metaConversationReplyBuilder.js";
import { classifyMetaConversationIntent } from "../src/agent/utils/metaConversationIntentGuards.js";
import {
  beginSessionWorkTurn,
  commitSessionWorkTurn,
  clearSessionWorkMemoryForTests,
} from "../src/agent/memory/sessionWorkMemory.js";

const Q_OVERVIEW = "qu'est-ce que tu peux m'apprendre sur tes fonctionnalités particulières???";
const Q_GAPS =
  "qu'est-ce que tu peux m'apprendre sur tes fonctionnalités particulières que tu n'as pas encore mais qui pourraient t'être";

describe("metaConversationIntentGuards — nuances", () => {
  it("distingue learn vs gaps", () => {
    assert.equal(classifyMetaConversationIntent(Q_OVERVIEW)?.kind, "capability_learn");
    assert.equal(classifyMetaConversationIntent(Q_GAPS)?.kind, "capability_gaps");
  });

  it("réponses différentes selon sous-intent", () => {
    const learn = resolveMetaConversationRoute(Q_OVERVIEW);
    const gaps = resolveMetaConversationRoute(Q_GAPS);
    assert.ok(learn?.reply);
    assert.ok(gaps?.reply);
    assert.notEqual(learn.reply, gaps.reply);
    assert.match(gaps.reply, /pas encore|n'est pas encore|P1/i);
  });
});

describe("meta — intentShortCircuit", () => {
  it("route learn (overview court) en déterministe", async () => {
    const hit = await runConversationShortCircuit(Q_OVERVIEW);
    assert.equal(hit.path, "meta_conversation_deterministic");
    assert.equal(hit.metaSubKind, "capability_learn");
    assert.equal(hit.mode, RESPONSE_MODES.OPEN_PROPOSITION);
    assert.ok(hit.reply.length > 40);
    assert.ok(!hit.reply.includes(INSUFFICIENT_SIGNAL_REFUSAL));
  });

  it("route gaps en déterministe nuancé (pas le même texte que learn)", async () => {
    const hit = await runConversationShortCircuit(Q_GAPS);
    assert.equal(hit.path, "meta_conversation_deterministic");
    assert.equal(hit.metaSubKind, "capability_gaps");
    assert.match(hit.reply, /pas encore|n'est pas encore/i);
    const learn = await runConversationShortCircuit(Q_OVERVIEW);
    assert.notEqual(hit.reply, learn.reply);
  });

  it("ne route pas une requête technique vers méta-conversation", async () => {
    const hit = await runConversationShortCircuit("corrige le bug dans authMiddleware.js");
    assert.notEqual(hit?.path, "meta_conversation_deterministic");
    assert.notEqual(hit?.metaSubKind, "self_analysis");
  });

  it("route auto-analyse améliorations en déterministe (pas orchestrateur lourd)", async () => {
    const query =
      "hé bien je me demandais si tu voudrais m'aider à lister tes dernières améliorations côté structure, et côté réponse dans la conversation si tu es en capacité de t'auto-analyser";
    const hit = await runConversationShortCircuit(query);
    assert.equal(hit.path, "meta_conversation_deterministic");
    assert.equal(hit.metaSubKind, "self_analysis");
    assert.match(hit.reply, /triage|garde-fous|orchestration/i);
    assert.doesNotMatch(hit.reply, /citadel_indexer/i);
  });

  it("route conscience temporelle avant multi_segment (pas salutation générique)", async () => {
    const query =
      "comment faire pour te faire maitriser le sens de l'heure pour en prendre conscience?";
    const hit = await runConversationShortCircuit(query);
    assert.equal(hit.path, "meta_conversation_deterministic");
    assert.equal(hit.metaSubKind, "temporal_awareness");
    assert.match(hit.reply, /horodatage|conscience|temps/i);
    assert.match(hit.reply, /sessionWorkMemory|turnTimestamp/i);
    assert.ok(!hit.reply.includes("Tout est prêt"));
  });

  it("temporal_awareness cite l'écart si mémoire de session précédente", async () => {
    const sessionId = "meta-temporal-gap-test";
    clearSessionWorkMemoryForTests(sessionId);

    const t0 = new Date("2026-05-27T23:26:27.000Z");
    commitSessionWorkTurn({
      sessionId,
      turnTimestamp: t0.toISOString(),
      query: "premier message",
      intent: "meta_general",
      pipelinePath: "instant",
    });

    const t1 = new Date("2026-05-27T23:57:00.000Z");
    const ctx = beginSessionWorkTurn({ sessionId, now: t1 });
    const query =
      "comment faire pour te faire maitriser le sens de l'heure pour en prendre conscience?";
    const hit = await runConversationShortCircuit(query, {
      sessionId,
      turnTimestamp: ctx.turnTimestamp,
      priorState: ctx.priorState,
    });

    assert.equal(hit.metaSubKind, "temporal_awareness");
    assert.match(hit.reply, /30 min 33s/);
    assert.match(hit.reply, /23:26:27/);
    assert.match(hit.reply, /23:57:00/);

    clearSessionWorkMemoryForTests(sessionId);
  });
});
