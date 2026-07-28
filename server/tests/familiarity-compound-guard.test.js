import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isFamiliarityIntent,
  isPureSubjectFamiliarityQuery,
  hasCompoundIntentBeyondSubject,
  resolveFamiliaritySubject,
} from "../src/agent/utils/familiarityIntentGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

describe("familiarité compound — garde sujet pur", () => {
  it("autorise une reconnaissance pure (« Tu connais l'Italie ? »)", () => {
    const query = "Tu connais l'Italie ?";
    assert.equal(isFamiliarityIntent(query), true);
    assert.equal(isPureSubjectFamiliarityQuery(query), true);
  });

  it("bloque intention + sujet (« recette de pâtes italienne »)", () => {
    const query = "recette de pâtes italienne";
    assert.equal(isFamiliarityIntent(query), false);
    assert.equal(hasCompoundIntentBeyondSubject(query, "italie"), true);
  });

  it("bloque familiarité shell + intention (« tu connais la recette… »)", () => {
    const query = "tu connais la recette de pâtes italienne";
    assert.equal(isFamiliarityIntent(query), false);
  });

  it("bloque sujet + contexte (« italie avec enfants »)", () => {
    const query = "tu connais l'italie avec enfants";
    assert.equal(isFamiliarityIntent(query), false);
  });

  it("bloque sujet + domaine (« italie et sa cuisine »)", () => {
    const query = "tu connais l'italie et sa cuisine";
    assert.equal(isFamiliarityIntent(query), false);
  });

  it("ne résout pas « italienne » comme pays Italie (lexique borné)", () => {
    const subject = resolveFamiliaritySubject("recette de pates italienne");
    assert.notEqual(subject.label, "l'Italie");
    assert.equal(subject.known, false);
  });
});

describe("familiarité compound — short-circuit", () => {
  it("route toujours l'Italie pure", async () => {
    const hit = await runConversationShortCircuit("Tu connais l'Italie ?");
    assert.equal(hit?.path, "familiarity_deterministic");
    assert.match(hit.reply, /l'Italie/i);
  });

  it("ne short-circuite pas une requête compound cuisine", async () => {
    const hit = await runConversationShortCircuit("recette de pâtes italienne");
    assert.notEqual(hit?.path, "familiarity_deterministic");
  });

  it("ne short-circuite pas « tu connais la recette de pâtes italienne »", async () => {
    const hit = await runConversationShortCircuit(
      "tu connais la recette de pâtes italienne",
    );
    assert.notEqual(hit?.path, "familiarity_deterministic");
  });
});
