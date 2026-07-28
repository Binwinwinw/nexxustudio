import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isIdeationIntent,
  classifyIdeationSignal,
  getIdeationDeterministicReply,
  IDEATION_FRAMING_REPLY,
} from "../src/agent/utils/ideationIntentGuards.js";
import { isIdeationRequest } from "../src/agent/utils/conversationGuards.js";
import { isOpenProjectIdeation } from "../src/agent/config/modeResponseContracts.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { RESPONSE_MODES } from "../src/agent/config/modeResponseContracts.js";
import { enforceModeContract, INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";

describe("contrat idéation — détection", () => {
  it("détecte une requête IA ouverte exploitable", () => {
    const query = "Quel projet IA je pourrais lancer ?";
    assert.equal(isIdeationIntent(query), true);
    assert.equal(isIdeationRequest(query), true);
    assert.equal(classifyIdeationSignal(query), "explorable");
    assert.equal(isOpenProjectIdeation(query), true);
  });

  it("détecte les variantes de cadrage ouvert", () => {
    for (const query of [
      "Que construire avec l'IA ?",
      "Par quoi commencer ?",
      "Quelle piste IA me conseilles-tu ?",
    ]) {
      assert.equal(isIdeationIntent(query), true, query);
    }
  });

  it("classifie une requête trop vague", () => {
    assert.equal(classifyIdeationSignal("Fais-moi un truc bien"), "vague");
    assert.equal(
      classifyIdeationSignal("Je veux créer quelque chose d'utile"),
      "vague",
    );
  });

  it("exclut les requêtes techniques", () => {
    assert.equal(
      isIdeationIntent("corrige ce bug dans mon api endpoint"),
      false,
    );
  });
});

describe("contrat idéation — réponses déterministes", () => {
  it("retourne 3 pistes pour une idéation exploitable", () => {
    const reply = getIdeationDeterministicReply(
      "Quel projet IA je pourrais lancer ?",
    );
    assert.ok(reply);
    assert.match(reply, /Voici 3 pistes concrètes/);
    assert.match(reply, /1\. \*\*/);
    assert.match(reply, /Laquelle t'intéresse \?/);
    assert.ok(!reply.includes(INSUFFICIENT_SIGNAL_REFUSAL));
  });

  it("retourne une question de cadrage pour une requête floue", () => {
    const reply = getIdeationDeterministicReply("Fais-moi un truc bien");
    assert.equal(reply, IDEATION_FRAMING_REPLY);
    assert.match(reply, /\?/);
  });

  it("retourne une question de cadrage pour « quelque chose d'utile »", () => {
    const reply = getIdeationDeterministicReply(
      "Je veux créer quelque chose d'utile",
    );
    assert.equal(reply, IDEATION_FRAMING_REPLY);
  });

  it("respecte le contrat OPEN_PROPOSITION à l'enforcement", () => {
    const reply = getIdeationDeterministicReply("Par quoi commencer en IA ?");
    const out = enforceModeContract(RESPONSE_MODES.OPEN_PROPOSITION, reply, {
      allowRefusal: false,
    });
    assert.notEqual(out, INSUFFICIENT_SIGNAL_REFUSAL);
    assert.match(out, /Laquelle t'intéresse \?/);
  });
});

describe("contrat idéation — routage registry", () => {
  it("G44 : idéation surface → short-circuit, pas contrat IDEATION_OPEN lourd", async () => {
    const query = "Quel projet IA je pourrais lancer ?";
    assert.equal(isIdeationIntent(query), true);
    const { contract, matchedBy } = resolveIntentContract(query, {});
    // SIL G44 bloque IDEATION_OPEN ; la réponse vient du short-circuit G46.
    assert.equal(matchedBy, "g44_sil_meta_ideation_block");
    assert.notEqual(contract.id, "IDEATION_OPEN");

    const { runConversationShortCircuit } = await import(
      "../src/agent/micro/classifiers/intentShortCircuit.js"
    );
    const hit = await runConversationShortCircuit(query);
    assert.equal(hit?.path, "ideation_deterministic");
    assert.match(hit?.reply || "", /pistes|repère|outil/i);
  });
});
