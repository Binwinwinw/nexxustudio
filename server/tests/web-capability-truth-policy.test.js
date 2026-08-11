import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildWebCapabilityAvailableReply,
  buildWebCapabilityUnavailableReply,
  containsFalseWebCapabilityDenial,
  isProductWebSearchAvailable,
  isWebCapabilityChallenge,
  resolveWebCapabilityTruthShortCircuit,
  sanitizeFalseWebCapabilityDenial,
} from "../src/agent/policies/web/webCapabilityTruthPolicy.js";
import { classifyConversationTurn } from "../src/agent/micro/classifiers/conversationTurnType.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const CAPABILITY_CHALLENGE =
  "tu devrais avoir la capacité de naviguer et trouver des sources officielles que tu pourras analyser";

const FALSE_DENIAL =
  "Tu me demandes de naviguer vers Météo-France — mais je dois te l'être clair : dans ce contexte, je n'ai pas accès à un navigateur web actif. Je ne peux donc pas aller chercher ces infos moi-même ici.";

const WEATHER_HISTORY = [
  {
    role: "user",
    content: "quel temps fait il en martinique à l'heure actuelle?",
  },
  {
    role: "assistant",
    content: "Météo actuelle en Martinique : environ 26°C.",
  },
];

describe("webCapabilityTruthPolicy", () => {
  it("détecte le challenge capacité naviguer / sources officielles", () => {
    assert.equal(isWebCapabilityChallenge(CAPABILITY_CHALLENGE), true);
    assert.equal(isWebCapabilityChallenge("quelle est la météo à Paris ?"), false);
  });

  it("ne classe plus « tu devrais avoir la capacité… » en meta_feedback", () => {
    const turn = classifyConversationTurn(CAPABILITY_CHALLENGE);
    assert.notEqual(turn.turnType, "meta_feedback");
    assert.equal(turn.shortCircuit, false);
  });

  it("web disponible → pas de déni navigateur ; reprise météo si fil actif", async () => {
    assert.equal(isProductWebSearchAvailable(), true);

    const resolved = resolveWebCapabilityTruthShortCircuit(CAPABILITY_CHALLENGE, {
      history: WEATHER_HISTORY,
    });
    assert.equal(resolved?.webSearchAvailable, true);
    assert.equal(resolved?.preferWebResearch, true);
    assert.equal(resolved?.weatherCurrent, true);
    assert.match(String(resolved?.weatherWebQuery || ""), /martinique/i);
    assert.equal(containsFalseWebCapabilityDenial(String(resolved?.reply || "")), false);

    const hit = await runConversationShortCircuit(CAPABILITY_CHALLENGE, {
      history: WEATHER_HISTORY,
    });
    assert.notEqual(hit?.path, "meta_feedback_deterministic");
    assert.equal(hit?.preferWebResearch, true);
    assert.equal(hit?.weatherCurrent, true);
    assert.match(String(hit?.weatherWebQuery || ""), /martinique/i);
    assert.equal(containsFalseWebCapabilityDenial(String(hit?.reply || "")), false);
  });

  it("sanitize — jamais de dénégation générique navigateur si capacité existe", () => {
    assert.equal(containsFalseWebCapabilityDenial(FALSE_DENIAL), true);
    const cleaned = sanitizeFalseWebCapabilityDenial(FALSE_DENIAL);
    assert.equal(containsFalseWebCapabilityDenial(cleaned), false);
    assert.match(cleaned, /recherche web/i);
    assert.doesNotMatch(cleaned, /navigateur web actif/i);
  });

  it("web indisponible → refus honnête borné au tour", () => {
    const resolved = resolveWebCapabilityTruthShortCircuit(CAPABILITY_CHALLENGE, {
      webSearchAvailable: false,
    });
    assert.equal(resolved?.webSearchAvailable, false);
    assert.equal(resolved?.preferWebResearch, false);
    assert.equal(resolved?.reply, buildWebCapabilityUnavailableReply());
    assert.doesNotMatch(resolved?.reply || "", /pas accès à un navigateur/i);
  });

  it("sans fil météo — vérité capacité + invitation recherche", () => {
    const resolved = resolveWebCapabilityTruthShortCircuit(CAPABILITY_CHALLENGE, {
      history: [],
    });
    assert.equal(resolved?.path, "web_capability_truth_deterministic");
    assert.equal(resolved?.reply, buildWebCapabilityAvailableReply());
    assert.equal(containsFalseWebCapabilityDenial(resolved.reply), false);
  });
});
