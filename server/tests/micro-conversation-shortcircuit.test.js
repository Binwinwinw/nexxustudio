import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  runConversationShortCircuit,
  classifyShortCircuitIntent,
  formatSubjectSurfaceForm,
  buildClarificationQuestion,
} from "../src/agent/micro/index.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";

describe("micro — intentShortCircuit", () => {
  it("route familiarité avant LLM", async () => {
    const hit = await runConversationShortCircuit("Tu connais l'Italie ?");
    assert.ok(hit);
    assert.equal(hit.path, "familiarity_deterministic");
    assert.match(hit.reply, /l'Italie/i);
    assert.ok(!hit.reply.includes(INSUFFICIENT_SIGNAL_REFUSAL));
  });

  it("route idéation avant LLM", async () => {
    const hit = await runConversationShortCircuit("Quel projet IA je pourrais lancer ?");
    assert.ok(hit);
    assert.equal(hit.path, "ideation_deterministic");
    assert.match(hit.reply, /pistes concrètes/i);
  });

  it("route architecture design avant LLM", async () => {
    const hit = await runConversationShortCircuit(
      "comment créer un code-reviewer qui analyse tout le code d'un projet",
    );
    assert.ok(hit);
    assert.equal(hit.path, "architecture_design_deterministic");
    assert.match(hit.reply, /3 approches/i);
  });

  it("route social via callback agent", async () => {
    const hit = await runConversationShortCircuit("bonjour comment vas tu", {
      getDeterministicSocialResponse: (q) =>
        q.includes("bonjour") ? "Bonjour ! Tout va bien ici." : null,
    });
    assert.ok(hit);
    assert.equal(hit.path, "social_deterministic");
  });

  it("distingue check-in social pur et verbe d'action pour prévenir les faux positifs", async () => {
    const pure1 = await runConversationShortCircuit("comment tu vas ?");
    assert.equal(pure1?.path, "social_deterministic");

    const pure2 = await runConversationShortCircuit("salut comment tu vas ?");
    assert.equal(pure2?.path, "social_deterministic");

    const pure3 = await runConversationShortCircuit("tu vas bien en ce moment ?");
    assert.equal(pure3?.path, "social_deterministic");

    const mixed1 = await runConversationShortCircuit("comment tu vas gérer ça ?");
    assert.notEqual(mixed1?.path, "social_deterministic");

    const mixed2 = await runConversationShortCircuit("ça va régler le problème ?");
    assert.notEqual(mixed2?.path, "social_deterministic");

    const mixed3 = await runConversationShortCircuit("comment tu vas régler ça pour moi ?");
    assert.notEqual(mixed3?.path, "social_deterministic");

    const mixed4 = await runConversationShortCircuit("ça va marcher si on change ça ?");
    assert.notEqual(mixed4?.path, "social_deterministic");

    const yopHit = await runConversationShortCircuit(
      "yop yop comment ça va là dedans ???",
    );
    assert.equal(yopHit?.path, "social_deterministic");
    assert.ok(yopHit?.reply);
    assert.doesNotMatch(yopHit.reply, /empty_short_circuit_llm/i);
    assert.notEqual(yopHit?.path, "simple_factual_lookup");
  });

  it("classifie sans répondre", async () => {
    const cls = await classifyShortCircuitIntent("Tu connais Docker ?");
    assert.equal(cls.matched, true);
    assert.equal(cls.path, "familiarity_deterministic");
  });

  it("laisse passer une requête technique (pas familiarité)", async () => {
    const hit = await runConversationShortCircuit("corrige ce bug api");
    assert.notEqual(hit?.path, "familiarity_deterministic");
  });
});

describe("micro — normalization & clarification", () => {
  it("surfaceFormNormalizer reconstruit l'Italie", () => {
    assert.equal(formatSubjectSurfaceForm("l italie"), "l'Italie");
  });

  it("clarificationBuilder produit une question de cadrage", () => {
    const q = buildClarificationQuestion({ kind: "ideation_vague" });
    assert.match(q, /repère|outil perso|projet pro/i);
  });

  it("extractMainEntity isole Michael Jackson du complément chansons", async () => {
    const { extractMainEntity } = await import(
      "../src/agent/micro/normalization/subjectEntityExtractor.js"
    );
    const { main, complement } = extractMainEntity(
      "mickael jackson et quelques-unes de ses chansons",
    );
    assert.equal(main, "mickael jackson");
    assert.match(complement, /chansons/i);
  });
});
