import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolveDocumentaryDeliverableFirstAct } from "../src/agent/policies/conversation/documentaryDeliverableFirstAct.js";
import { resolveNamedCreateStartShortCircuit } from "../src/agent/policies/conversation/currentTurnAnchoringPolicy.js";
import { RESPONSE_MODES } from "../src/agent/config/modeResponseContracts.js";

function sentenceCount(text = "") {
  return String(text)
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function assertFirstAct(hit, { deliverable, topic = null } = {}) {
  assert.equal(hit?.path, "documentary_deliverable_first_act");
  assert.equal(hit?.mode, RESPONSE_MODES.SIMPLE_FAST);
  assert.equal(Boolean(hit?.deferToLlm), false);
  assert.ok(String(hit?.reply || "").trim());
  assert.ok(sentenceCount(hit.reply) <= 2);
  assert.equal((String(hit.reply).match(/\?/g) || []).length, 1);
  assert.match(hit.reply, new RegExp(deliverable, "i"));
  if (topic) assert.match(hit.reply, new RegExp(topic, "i"));
  assert.doesNotMatch(hit.reply, /objectif en une phrase|reformule|Je vois la piste|destination|prendre la main/i);
}

describe("documentary_deliverable_first_act", () => {
  it("A — fiches sans sujet : ack + question sujet, pas LLM", async () => {
    const q = "je veux faire des fiches";
    const local = resolveDocumentaryDeliverableFirstAct(q);
    assert.equal(local?.path, "documentary_deliverable_first_act");
    assert.match(local.reply, /fiches/i);
    assert.match(local.reply, /sujet/i);
    const hit = await runConversationShortCircuit(q);
    assertFirstAct(hit, { deliverable: "fiches" });
    assert.match(hit.reply, /sujet/i);
  });

  it("B — fiches sur Hermes Agent : ack sujet + une préférence", async () => {
    const q = "je veux faire des fiches sur Hermes Agent";
    const hit = await runConversationShortCircuit(q);
    assertFirstAct(hit, { deliverable: "fiches", topic: "Hermes Agent" });
    assert.match(hit.reply, /bases|usages/i);
  });

  it("C — fiches pédagogiques : même rail, court, pas de fuite", async () => {
    const q =
      "je veux faire des fiches pédagogiques sur Hermes Agent";
    const hit = await runConversationShortCircuit(q);
    assertFirstAct(hit, {
      deliverable: "fiches pédagogiques",
      topic: "Hermes Agent",
    });
  });

  it("D — documentation sur X : contrat borné, pas print", async () => {
    const q = "je veux créer une documentation sur React";
    const hit = await runConversationShortCircuit(q);
    assertFirstAct(hit, { deliverable: "documentation", topic: "React" });
    assert.doesNotMatch(hit.reply, /print|HTML ou PDF/i);
    assert.notEqual(hit.path, "named_create_start");
  });

  it("E — demandes insuffisantes : rail inactif", async () => {
    for (const q of [
      "aide-moi",
      "je veux faire quelque chose",
      "Hermes Agent",
      "je veux une fiche",
    ]) {
      assert.equal(resolveDocumentaryDeliverableFirstAct(q), null, q);
      const hit = await runConversationShortCircuit(q);
      assert.notEqual(hit?.path, "documentary_deliverable_first_act", q);
    }
  });

  it("G — à propos de accentué : sujet présent, pas la question sujet", async () => {
    const q =
      "je veux faire des fiches pédagogiques à propos de l'utilisation du logiciel hermès agent";
    const local = resolveDocumentaryDeliverableFirstAct(q);
    assert.equal(local?.path, "documentary_deliverable_first_act");
    assert.match(local.reply, /hermes agent/i);
    assert.match(local.reply, /bases|usages/i);
    assert.doesNotMatch(local.reply, /Sur quel sujet veux-tu commencer/i);
    const hit = await runConversationShortCircuit(q);
    assertFirstAct(hit, {
      deliverable: "fiches pédagogiques",
      topic: "hermes agent",
    });
    assert.match(hit.reply, /bases|usages/i);
    assert.doesNotMatch(hit.reply, /Sur quel sujet veux-tu commencer/i);
  });

  it("H — jumeau sans accents : même gabarit sujet présent", async () => {
    const q =
      "je veux faire des fiches pedagogiques a propos de l'utilisation du logiciel hermes agent";
    const hit = await runConversationShortCircuit(q);
    assertFirstAct(hit, {
      deliverable: "fiches pédagogiques",
      topic: "hermes agent",
    });
    assert.match(hit.reply, /bases|usages/i);
    assert.doesNotMatch(hit.reply, /Sur quel sujet veux-tu commencer/i);
  });

  it("I — fiches pédagogiques sans sujet : gabarit absent préservé", async () => {
    const q = "je veux faire des fiches pédagogiques";
    const local = resolveDocumentaryDeliverableFirstAct(q);
    assert.equal(local?.path, "documentary_deliverable_first_act");
    assert.match(local.reply, /Sur quel sujet veux-tu commencer/i);
    assert.doesNotMatch(local.reply, /hermes|bases|usages/i);
    const hit = await runConversationShortCircuit(q);
    assertFirstAct(hit, { deliverable: "fiches pédagogiques" });
    assert.match(hit.reply, /Sur quel sujet veux-tu commencer/i);
    assert.doesNotMatch(hit.reply, /hermes|bases|usages/i);
  });

  it("F — named_create print inchangé ; TLP non volé", async () => {
    const card =
      "je veux créer une carte de visite avec mes coordonnées";
    assert.equal(resolveDocumentaryDeliverableFirstAct(card), null);
    const named = resolveNamedCreateStartShortCircuit(card);
    assert.equal(named?.path, "named_create_start");
    const namedHit = await runConversationShortCircuit(card);
    assert.equal(namedHit?.path, "named_create_start");

    const tlp =
      "je veux créer des fiches de connaissances afin maitriser le jsx et ses regles";
    assert.equal(resolveDocumentaryDeliverableFirstAct(tlp), null);
    const tlpHit = await runConversationShortCircuit(tlp);
    assert.notEqual(tlpHit?.path, "documentary_deliverable_first_act");
  });
});
