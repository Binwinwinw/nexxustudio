import { describe, it } from "node:test";
import assert from "node:assert/strict";
import agent from "../src/agent/agent.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  isIdentitySpecialtiesIntent,
  isIdentityRoleIntent,
  IDENTITY_SPECIALTIES_REPLY,
  IDENTITY_ROLE_REPLY,
} from "../src/agent/utils/intent-guards/identityIntentGuards.js";

describe("agent deterministic social — identité", () => {
  it('répond sans LLM à "salut qui es tu ?"', () => {
    const reply = agent.getDeterministicSocialResponse("salut qui es tu ?");
    assert.ok(reply);
    assert.match(reply, /NEXXUS/i);
    assert.ok(!reply.includes("La réponse visible"));
  });

  it('répond sans LLM à "salut salut qui es tu ?"', () => {
    const reply = agent.getDeterministicSocialResponse("salut salut qui es tu ?");
    assert.ok(reply);
    assert.match(reply, /NEXXUS/i);
  });

  it("laisse passer une tâche technique mixte", () => {
    const reply = agent.getDeterministicSocialResponse("salut, analyse ce repo");
    assert.strictEqual(reply, undefined);
  });

  it('répond sans LLM à "Comment t\'appelles tu ??"', () => {
    const reply = agent.getDeterministicSocialResponse("Comment t'appelles tu ??");
    assert.ok(reply);
    assert.match(reply, /NEXXUS/i);
  });

  it('bonjour en tête + identité → préfixe Bonjour !', () => {
    const reply = agent.getDeterministicSocialResponse("bonjour comment t'appelles tu");
    assert.ok(reply);
    assert.match(reply, /^Bonjour ! /);
    assert.match(reply, /NEXXUS/i);
    assert.doesNotMatch(reply, /^Bonjour ! Bonjour/i);
  });

  it('salut en tête + qui es tu → salutation déjà là ou Salut !', () => {
    const reply = agent.getDeterministicSocialResponse("salut qui es tu ?");
    assert.ok(reply);
    assert.match(reply, /NEXXUS/i);
    assert.match(reply, /^(?:Salut ! |Bonjour ! )/);
  });

  it('répond sans LLM à "Qui es tu ??"', () => {
    const reply = agent.getDeterministicSocialResponse("Qui es tu ??");
    assert.ok(reply);
    assert.match(reply, /NEXXUS/i);
  });

  it('répond sans LLM à "Comment tu t\'appelles ??"', () => {
    const reply = agent.getDeterministicSocialResponse("Comment tu t'appelles ??");
    assert.ok(reply);
    assert.match(reply, /NEXXUS/i);
  });

  it('répond sans LLM à "Ton nom c\'est quoi ??"', () => {
    const reply = agent.getDeterministicSocialResponse("Ton nom c'est quoi ??");
    assert.ok(reply);
    assert.match(reply, /NEXXUS/i);
  });

  it('répond sans LLM à "C\'est qui NEXXUS ??"', () => {
    const reply = agent.getDeterministicSocialResponse("C'est qui NEXXUS ??");
    assert.ok(reply);
    assert.match(reply, /NEXXUS/i);
  });

  it('répond sans LLM à "quelles sont tes spécialités ?"', () => {
    assert.equal(isIdentitySpecialtiesIntent("quelles sont tes spécialités ?"), true);
    const reply = agent.getDeterministicSocialResponse(
      "quelles sont tes spécialités ?",
    );
    assert.ok(reply);
    assert.match(reply, /NEXXUS/i);
    assert.match(reply, /sp[eé]cialit/i);
    assert.match(reply, /Forge|cadrage|documents|code/i);
    assert.ok(reply.length < 800);
    assert.equal(reply, IDENTITY_SPECIALTIES_REPLY);
  });

  it('répond sans LLM à "quel est ton rôle ?"', () => {
    assert.equal(isIdentityRoleIntent("quel est ton rôle ?"), true);
    const reply = agent.getDeterministicSocialResponse("quel est ton rôle ?");
    assert.ok(reply);
    assert.match(reply, /r[oô]le|assistant|orchestre/i);
    assert.ok(reply.length < 800);
    assert.equal(reply, IDENTITY_ROLE_REPLY);
  });
});

describe("P0 identity_questions — short-circuit social_deterministic", () => {
  const scOpts = { getDeterministicSocialResponse: (q) => agent.getDeterministicSocialResponse(q) };

  it("comment t'appelles-tu → social_deterministic", async () => {
    const sc = await runConversationShortCircuit("comment t'appelles-tu ?", scOpts);
    assert.equal(sc?.path, "social_deterministic");
    assert.match(sc.reply, /NEXXUS/i);
    assert.ok(sc.reply.length < 800);
    assert.notEqual(sc.path, "information_seeking_full_pipeline");
  });

  it("bonjour comment t'appelles tu → social_deterministic + miroir Bonjour", async () => {
    const sc = await runConversationShortCircuit(
      "bonjour comment t'appelles tu",
      scOpts,
    );
    assert.equal(sc?.path, "social_deterministic");
    assert.match(sc.reply, /^Bonjour ! /);
    assert.match(sc.reply, /NEXXUS/i);
    assert.doesNotMatch(sc.reply, /^Bonjour ! Bonjour/i);
  });

  it("quelles sont tes spécialités → social_deterministic (pas COMPOSER/explain)", async () => {
    const sc = await runConversationShortCircuit(
      "quelles sont tes spécialités ?",
      scOpts,
    );
    assert.equal(sc?.path, "social_deterministic");
    assert.match(sc.reply, /sp[eé]cialit/i);
    assert.match(sc.reply, /cadrage|Forge|documents/i);
    assert.ok(sc.reply.length < 800);
    assert.notEqual(sc?.forcedIntentContractId, "DIRECT_EXPLANATION");
    assert.notEqual(sc.path, "information_seeking_full_pipeline");
  });

  it("quel est ton rôle → social_deterministic", async () => {
    const sc = await runConversationShortCircuit("quel est ton rôle ?", scOpts);
    assert.equal(sc?.path, "social_deterministic");
    assert.match(sc.reply, /assistant|Citadelle|orchestre/i);
    assert.ok(sc.reply.length < 800);
  });
});

describe("SOCIAL_CHECKIN_IDENTITY_FIX — greeting + identité", () => {
  const scOpts = {
    getDeterministicSocialResponse: (q) => agent.getDeterministicSocialResponse(q),
  };

  it("bonjour + nom + comment vas tu → état et identité, pas santé seule", async () => {
    const q = "bonjour, quel est ton nom et comment vas tu ?";
    const sc = await runConversationShortCircuit(q, scOpts);
    assert.equal(sc?.path, "social_deterministic");
    assert.match(sc.reply, /NEXXUS/i);
    assert.match(sc.reply, /tout va bien|ça va bien|ça va, merci/i);
    assert.match(sc.reply, /^Bonjour ! /);
    assert.doesNotMatch(sc.reply, /^Bonjour ! Bonjour/i);
    assert.notEqual(sc?.socialCheckinPriority, true);
  });

  it("salut, comment ça va ? → social seul, pas d'identité", async () => {
    const sc = await runConversationShortCircuit("salut, comment ça va ?", scOpts);
    assert.equal(sc?.path, "social_deterministic");
    assert.match(sc.reply, /va bien|tout va bien|ça va/i);
    assert.doesNotMatch(sc.reply, /NEXXUS/i);
    assert.doesNotMatch(sc.reply, /je m['']appelle|mon rôle/i);
  });

  it("quel est ton nom ? → identité seule, pas d'état santé", async () => {
    const sc = await runConversationShortCircuit("quel est ton nom ?", scOpts);
    assert.equal(sc?.path, "social_deterministic");
    assert.match(sc.reply, /NEXXUS/i);
    assert.doesNotMatch(sc.reply, /tout va bien ici|ça va bien, merci/i);
  });
});

