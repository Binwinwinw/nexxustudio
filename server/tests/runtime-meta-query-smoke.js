import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

/** Formulations exactes terrain (copiées depuis le chat utilisateur). */
const RUNTIME_QUERIES = [
  "qu'est-ce que tu peux m'apprendre sur tes fonctionnalités particulières???",
  "quel est le projet?*",
];

describe("runtime meta queries (terrain)", () => {
  for (const query of RUNTIME_QUERIES) {
    it(`short-circuit: ${query.slice(0, 48)}`, () => {
      const hit = runConversationShortCircuit(query);
      assert.ok(hit, `aucun match pour: ${query}`);
      assert.equal(hit.path, "meta_conversation_deterministic");
    });
  }
});
