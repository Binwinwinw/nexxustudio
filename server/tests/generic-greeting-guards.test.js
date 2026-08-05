import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isSubstantiveWorkRequest,
  resolvePipelineFallback,
  resolveLocalDeterministicFallback,
  isInformationSeekingRequest,
  GENERIC_READY_GREETING,
  isGenericReadyGreeting,
  recoverVisibleFromFullResponse,
} from "../src/agent/utils/genericGreetingGuards.js";

describe("genericGreetingGuards", () => {
  it("détecte une demande de génération de code substantielle", () => {
    const query =
      "Génère une application console en JavaScript : une calculatrice avec addition, " +
      "soustraction, multiplication, division. Niveau débutant. Code complet commenté en français.";
    assert.equal(isSubstantiveWorkRequest(query), true);
  });

  it("n'interdit pas la salutation sur un message social court", () => {
    assert.equal(isSubstantiveWorkRequest("Salut, ça va ?"), false);
  });

  it("remplace la salutation par un message de récupération sur demande substantielle", () => {
    const query =
      "Écris un script Python complet pour lire un CSV et produire un résumé JSON. Format commenté en français.";
    const out = resolvePipelineFallback({ query, reason: "empty_composer_output" });
    assert.notEqual(out, GENERIC_READY_GREETING);
    assert.match(out, /pas pu finaliser|réponse exploitable/i);
  });

  it("conserve la salutation uniquement hors demande de travail", () => {
    const out = resolvePipelineFallback({ query: "Bonjour", reason: "empty_output" });
    assert.equal(out, GENERIC_READY_GREETING);
  });

  it("récupère du code depuis une réponse brute streamée", () => {
    const full = '**Thinking Process:** plan...\n```js\nfunction add(a,b){return a+b}\n```';
    const recovered = recoverVisibleFromFullResponse(full);
    assert.match(recovered, /function add/);
  });

  it("identifie la salutation générique", () => {
    assert.equal(isGenericReadyGreeting(GENERIC_READY_GREETING), true);
  });

  it("yop + comment ça va — small talk, pas question factuelle", async () => {
    const { isSimpleFactualQuestion } = await import(
      "../src/agent/policies/intent/justIntentDetectionPolicy.js"
    );
    const { isCasualSocialCheckInQuery } = await import(
      "../src/agent/utils/genericGreetingGuards.js"
    );
    const q = "yop yop comment ça va là dedans ???";
    assert.equal(isCasualSocialCheckInQuery(q), true);
    assert.equal(isSimpleFactualQuestion(q), false);
  });

  it("question d'information → fiche locale ou récupération, pas greeting", () => {
    const query = "que sais tu du pays appelé Italie ?";
    assert.equal(isInformationSeekingRequest(query), true);
    const local = resolveLocalDeterministicFallback(query);
    assert.ok(local);
    assert.match(local, /Italie/i);
    const out = resolvePipelineFallback({ query, reason: "no_visible_tokens" });
    assert.notEqual(out, GENERIC_READY_GREETING);
    assert.match(out, /Italie/i);
  });

  it("question factuelle sans fiche → récupération explicite, pas greeting", () => {
    const query = "Quelle est la capitale du pays inventé Zorgonia ?";
    const out = resolvePipelineFallback({ query, reason: "no_visible_tokens" });
    assert.notEqual(out, GENERIC_READY_GREETING);
    assert.match(out, /pas pu finaliser|réponse pour cette question/i);
  });
});
