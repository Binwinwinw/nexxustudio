import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateBoundedSubjectDeepening,
  needsBoundedSubjectDeepening,
  SUBJECT_DEEPENING_PATH,
} from "../src/agent/micro/deepening/boundedSubjectDeepeningPolicy.js";
import { synthesizeBoundedSubjectDeepening } from "../src/agent/micro/deepening/boundedSubjectDeepeningSynthesizer.js";
import {
  SUBJECT_RESOLUTION_MODES,
  SUBJECT_SHAPES,
} from "../src/agent/micro/classifiers/subjectUnderstanding.js";
import { getFamiliarityDeterministicReply } from "../src/agent/utils/familiarityIntentGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

function genericSubject(label = "Zorbulax") {
  return {
    label,
    known: false,
    category: "unknown_subject",
    subjectShape: SUBJECT_SHAPES.GENERIC,
    resolutionMode: SUBJECT_RESOLUTION_MODES.GENERIC,
    definition:
      "sujet que je peux aborder simplement — dis-moi l'angle qui t'intresse (définition, contexte, exemples).",
  };
}

describe("P3 — politique d'approfondissement", () => {
  it("n'active pas le LLM pour sujet inféré (carnaval)", () => {
    const subject = {
      label: "Le carnaval",
      resolutionMode: SUBJECT_RESOLUTION_MODES.INFERRED,
      subjectShape: SUBJECT_SHAPES.CULTURAL_EVENT,
    };
    assert.equal(needsBoundedSubjectDeepening(subject), false);
  });

  it("active le LLM pour sujet generic_topic", () => {
    assert.equal(needsBoundedSubjectDeepening(genericSubject()), true);
  });

  it("évalue le follow-up oui sur sujet générique", () => {
    const proposal = getFamiliarityDeterministicReply("Tu connais Zorbulax ?");
    assert.match(proposal, /je connais/i);

    const history = [
      { role: "user", content: "Tu connais Zorbulax ?" },
      { role: "assistant", content: proposal },
    ];

    const ctx = evaluateBoundedSubjectDeepening("oui", history);
    assert.ok(ctx);
    assert.equal(ctx.path, SUBJECT_DEEPENING_PATH);
    assert.equal(ctx.subject.resolutionMode, SUBJECT_RESOLUTION_MODES.GENERIC);
    assert.match(ctx.fallbackReply, /aperçu rapide/i);
  });

  it("laisse le short-circuit local pour pétanque (inféré)", () => {
    const proposal = getFamiliarityDeterministicReply("Tu connais la pétanque ?");
    const history = [
      { role: "user", content: "Tu connais la pétanque ?" },
      { role: "assistant", content: proposal },
    ];
    assert.equal(evaluateBoundedSubjectDeepening("oui", history), null);

    const hit = runConversationShortCircuit("oui", { history });
    assert.equal(hit.path, "conversation_continuity_deterministic");
    assert.match(hit.reply, /sport de boules|pétanque/i);
  });
});

describe("P3 — synthèse bornée", () => {
  it("utilise le LLM mocké pour un sujet générique", async () => {
    const mockClient = {
      chat: async () => ({
        message: {
          content:
            "Zorbulax est un sujet peu courant que l'on peut aborder comme une notion fictive ou un placeholder de test. Je reste généraliste faute de cadre précis. Quel angle t'intéresse ?",
        },
      }),
    };

    const out = await synthesizeBoundedSubjectDeepening(genericSubject("Zorbulax"), {
      llmClient: mockClient,
      fallbackReply: "fallback",
    });

    assert.match(out, /aperçu rapide/i);
    assert.match(out, /Zorbulax/i);
    assert.notEqual(out, "fallback");
  });

  it("fallback déterministe si LLM renvoie un refus", async () => {
    const mockClient = {
      chat: async () => ({
        message: {
          content: "Je n'ai pas assez d'éléments fiables pour répondre.",
        },
      }),
    };

    const fallbackReply = "D'accord, voici un aperçu rapide sur Zorbulax.\nFallback local.";
    const out = await synthesizeBoundedSubjectDeepening(genericSubject("Zorbulax"), {
      llmClient: mockClient,
      fallbackReply,
    });

    assert.equal(out, fallbackReply);
  });
});
