import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const Q1 =
  "qu'est-ce que tu peux m'apprendre sur tes fonctionnalités particulières???";
const Q2 =
  "qu'est-ce que tu peux m'apprendre sur tes fonctionnalités particulières que tu n'as pas encore mais qui pourraient t'être utiles ?";
const Q_FORGE = "la forge est elle fonctionnelle ??";

describe("terrain utilisateur v2", () => {
  it("Q1 learn ≠ Q2 gaps", () => {
    const h1 = runConversationShortCircuit(Q1);
    const h2 = runConversationShortCircuit(Q2);
    assert.equal(h1.metaSubKind, "capability_learn");
    assert.equal(h2.metaSubKind, "capability_gaps");
    assert.notEqual(h1.reply, h2.reply);
    assert.match(h2.reply, /pas encore|n'est pas encore|P1/i);
  });

  it("Q1 ne contient pas l'ancien template à puces", () => {
    const h1 = runConversationShortCircuit(Q1);
    assert.ok(!h1.reply.includes("options structurées, sans sur-promesse"));
  });

  it("forge fonctionnelle — pas de refus", () => {
    const hit = runConversationShortCircuit(Q_FORGE);
    assert.ok(hit);
    assert.equal(hit.metaSubKind, "forge_status");
    assert.match(hit.reply, /partiellement|opérationnel/i);
    assert.ok(!hit.reply.includes("pas assez d'éléments fiables"));
  });
});
