import { describe, it } from "node:test";
import assert from "node:assert/strict";
import agent from "../src/agent/agent.js";

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
    assert.match(reply, /appelle/i);
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
    assert.match(reply, /appelle/i);
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
});
