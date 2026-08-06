import { describe, it } from "node:test";
import assert from "node:assert/strict";
import agent from "../src/agent/agent.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  isIdentitySpecialtiesIntent,
  isIdentityRoleIntent,
  IDENTITY_SPECIALTIES_REPLY,
  IDENTITY_ROLE_REPLY,
} from "../src/agent/utils/identityIntentGuards.js";

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

