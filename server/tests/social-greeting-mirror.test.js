import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolveLeadingGreetingMirror,
  withLeadingGreetingMirror,
  applyLeadingGreetingMirrorToHit,
  isSocialGreetingMirrorPath,
} from "../src/agent/policies/social/socialGreetingMirrorPolicy.js";

describe("social greeting mirror — règle générale", () => {
  it("détecte tête de tour seulement", () => {
    assert.equal(resolveLeadingGreetingMirror("bonjour ça va ?"), "Bonjour");
    assert.equal(resolveLeadingGreetingMirror("salut qui es tu"), "Salut");
    assert.equal(resolveLeadingGreetingMirror("bonsoir comment ça va"), "Bonsoir");
    assert.equal(resolveLeadingGreetingMirror("hello"), "Salut");
    assert.equal(
      resolveLeadingGreetingMirror("analyse le fichier, bonjour l'équipe"),
      null,
    );
  });

  it("préfixe + conserve le reste de la réponse", () => {
    const out = withLeadingGreetingMirror(
      "bonjour comment t'appelles-tu ?",
      "Je m'appelle NEXXUS, l'assistant de Nexxus Studio.",
    );
    assert.equal(
      out,
      "Bonjour ! Je m'appelle NEXXUS, l'assistant de Nexxus Studio.",
    );
  });

  it("bonsoir → Bonsoir, pas Bonjour", () => {
    const out = withLeadingGreetingMirror(
      "bonsoir tu es prêt ?",
      "Prêt — on lance quoi ?",
    );
    assert.match(out, /^Bonsoir ! /);
    assert.doesNotMatch(out, /^Bonjour/);
    assert.match(out, /Prêt/);
  });

  it("remplace un ouvreur déjà présent s'il ne match pas", () => {
    const out = withLeadingGreetingMirror(
      "bonjour ça va ?",
      "Salut ! Ça va bien, merci.",
    );
    assert.equal(out, "Bonjour ! Ça va bien, merci.");
  });

  it("idempotent si l'ouvreur match déjà", () => {
    const out = withLeadingGreetingMirror(
      "bonjour",
      "Bonjour ! Si tu veux on peut papoter.",
    );
    assert.equal(out, "Bonjour ! Si tu veux on peut papoter.");
  });

  it("tous les rails social_* , pas math", () => {
    assert.equal(isSocialGreetingMirrorPath("social_deterministic"), true);
    assert.equal(isSocialGreetingMirrorPath("social_composite_deterministic"), true);
    assert.equal(isSocialGreetingMirrorPath("math_simple_deterministic"), false);
    assert.equal(isSocialGreetingMirrorPath("meta_conversation_deterministic"), false);

    const social = applyLeadingGreetingMirrorToHit("bonjour ça va ?", {
      path: "social_deterministic",
      reply: "Ça va bien, merci.",
    });
    assert.equal(social.reply, "Bonjour ! Ça va bien, merci.");

    const math = applyLeadingGreetingMirrorToHit("bonjour 2+2", {
      path: "math_simple_deterministic",
      reply: "4",
    });
    assert.equal(math.reply, "4");
  });
});

describe("social greeting mirror — short-circuit social_*", () => {
  it("bonsoir seul → social_deterministic commence par Bonsoir", async () => {
    const { runConversationShortCircuit } = await import(
      "../src/agent/micro/classifiers/intentShortCircuit.js"
    );
    const hit = await runConversationShortCircuit("bonsoir");
    assert.equal(hit?.path, "social_deterministic");
    assert.match(hit?.reply || "", /^Bonsoir ! /);
    assert.doesNotMatch(hit?.reply || "", /^Bonjour/);
    assert.match(hit?.reply || "", /papoter|cadrer|livrables/i);
  });

  it("bonjour + identité reste dans la même réponse après le miroir", async () => {
    const { runConversationShortCircuit } = await import(
      "../src/agent/micro/classifiers/intentShortCircuit.js"
    );
    const hit = await runConversationShortCircuit("bonjour comment t'appelles tu");
    assert.ok(String(hit?.path || "").startsWith("social_"));
    assert.match(hit?.reply || "", /^Bonjour ! /);
    assert.match(hit?.reply || "", /NEXXUS/i);
  });
});
