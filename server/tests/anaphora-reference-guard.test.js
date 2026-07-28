import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractRecipeCandidatesFromText,
  extractSalientCandidatesFromText,
  isAnaphoricReferenceFollowup,
  resolveAnaphoraReference,
  isAnaphoraReferenceResolvable,
} from "../src/agent/micro/continuity/anaphoraReferenceResolver.js";
import { isFamiliarityIntent } from "../src/agent/utils/familiarityIntentGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { evaluateEpistemicRefusal } from "../src/agent/config/modeResponseContracts.js";

const HISTORY_CARBONARA = [
  {
    role: "user",
    content: "est-ce que tu connais une recette de pâtes italiennes ?",
  },
  {
    role: "assistant",
    content: "Oui — par exemple la carbonara, classique romaine.",
  },
];

const HISTORY_TWO_RECIPES = [
  { role: "user", content: "des idées de pâtes italiennes ?" },
  {
    role: "assistant",
    content: "Tu peux essayer la carbonara ou l'amatriciana selon ton goût.",
  },
];

const HISTORY_SAGRADA = [
  {
    role: "user",
    content: "est-ce que tu connais des monuments à visiter en espagne ?",
  },
  {
    role: "assistant",
    content:
      "Oui — par exemple la Sagrada Família à Barcelone, incontournable si tu passes en Catalogne.",
  },
];

const HISTORY_TWO_MONUMENTS = [
  { role: "user", content: "monuments à voir en espagne ?" },
  {
    role: "assistant",
    content: "Je te conseille la Sagrada Família à Barcelone ou l'Alhambra à Grenade.",
  },
];

const HISTORY_BOEING = [
  { role: "user", content: "tu connais des avions de ligne emblématiques ?" },
  {
    role: "assistant",
    content: "Oui — par exemple le Boeing 747, surnommé le Queen of the Skies.",
  },
];

const HISTORY_TWO_SHOES = [
  { role: "user", content: "des chaussures de running ?" },
  {
    role: "assistant",
    content: "Tu peux regarder la Nike Air Zoom Pegasus ou l'Adidas Ultraboost.",
  },
];

describe("anaphoraReferenceResolver — détection", () => {
  it("extrait carbonara du tour assistant précédent", () => {
    const candidates = extractRecipeCandidatesFromText(
      "Oui, par exemple la carbonara.",
    );
    assert.deepEqual(candidates, ["carbonara"]);
  });

  it("détecte une relance anaphorique (« tu peux la détailler ? »)", () => {
    assert.equal(isAnaphoricReferenceFollowup("tu peux la détailler ?"), true);
    assert.equal(isAnaphoricReferenceFollowup("détaille la recette"), true);
    assert.equal(isAnaphoricReferenceFollowup("tu peux le détailler ?"), true);
    assert.equal(isAnaphoricReferenceFollowup("détaille le monument"), true);
  });

  it("extrait la Sagrada Família du tour assistant précédent", () => {
    const candidates = extractSalientCandidatesFromText(
      "Par exemple la Sagrada Família à Barcelone.",
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].id, "sagrada familia");
    assert.equal(candidates[0].domain, "landmark");
  });

  it("ne short-circuite pas la question compound monuments + Espagne (tour 1)", () => {
    assert.equal(
      isFamiliarityIntent("est-ce que tu connais des monuments à visiter en espagne"),
      false,
    );
  });

  it("ignore une première question sans antécédent", () => {
    assert.equal(
      resolveAnaphoraReference(
        "est-ce que tu connais une recette de pâtes italiennes ?",
        [],
      ),
      null,
    );
  });
});

describe("anaphoraReferenceResolver — résolution", () => {
  it("répond directement si une seule recette candidate (carbonara)", () => {
    const hit = resolveAnaphoraReference("tu peux la détailler ?", HISTORY_CARBONARA);
    assert.equal(hit?.kind, "anaphora_recipe_detail");
    assert.match(hit.reply, /carbonara/i);
    assert.match(hit.reply, /400 g de spaghetti/i);
    assert.match(hit.reply, /guanciale/i);
    assert.doesNotMatch(hit.reply, /je n ai pas assez d elements/i);
  });

  it("demande clarification si plusieurs recettes citées", () => {
    const hit = resolveAnaphoraReference("détaille la recette", HISTORY_TWO_RECIPES);
    assert.equal(hit?.kind, "anaphora_entity_clarify");
    assert.match(hit.reply, /carbonara/i);
    assert.match(hit.reply, /amatriciana/i);
  });

  it("répond directement si un seul monument candidate (Sagrada Família)", () => {
    const hit = resolveAnaphoraReference("tu peux le détailler ?", HISTORY_SAGRADA);
    assert.equal(hit?.kind, "anaphora_landmark_detail");
    assert.match(hit.reply, /Sagrada Família/i);
    assert.match(hit.reply, /Barcelone/i);
    assert.match(hit.reply, /Gaudí/i);
    assert.doesNotMatch(hit.reply, /je n ai pas assez d elements/i);
  });

  it("demande clarification si plusieurs monuments cités", () => {
    const hit = resolveAnaphoraReference("détaille le monument", HISTORY_TWO_MONUMENTS);
    assert.equal(hit?.kind, "anaphora_entity_clarify");
    assert.match(hit.reply, /Sagrada Família/i);
    assert.match(hit.reply, /Alhambra/i);
  });

  it("résout un avion sans lexique local → defer LLM (pas d'insuffisance)", () => {
    const hit = resolveAnaphoraReference("tu peux le détailler ?", HISTORY_BOEING);
    assert.equal(hit?.kind, "anaphora_carryover_defer");
    assert.equal(hit?.reply, null);
    assert.equal(hit?.hasLocalDetail, false);
    assert.match(hit.resolvedLabel, /boeing 747/i);
  });

  it("clarifie deux chaussures citées sans lexique métier", () => {
    const hit = resolveAnaphoraReference("détaille ça", HISTORY_TWO_SHOES);
    assert.equal(hit?.kind, "anaphora_entity_clarify");
    assert.match(hit.reply, /Nike Air Zoom Pegasus/i);
    assert.match(hit.reply, /Adidas Ultraboost/i);
  });
});

describe("anaphoraReferenceResolver — intégration pipeline", () => {
  it("short-circuit avant insuffisance sur relance carbonara", async () => {
    const hit = await runConversationShortCircuit("tu peux la détailler ?", {
      history: HISTORY_CARBONARA,
    });
    assert.equal(hit?.path, "anaphora_reference_deterministic");
    assert.match(hit.reply, /carbonara/i);
  });

  it("defer carryover avion sans fiche locale → pipeline complet", async () => {
    const hit = await runConversationShortCircuit("tu peux le détailler ?", {
      history: HISTORY_BOEING,
    });
    assert.equal(hit?.path, "anaphora_reference_carryover");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.deferToFullPipeline, true);
    assert.match(hit.reflectiveHint, /boeing 747/i);
  });

  it("short-circuit monuments Espagne sur relance anaphorique", async () => {
    const hit = await runConversationShortCircuit("tu peux le détailler ?", {
      history: HISTORY_SAGRADA,
    });
    assert.equal(hit?.path, "anaphora_reference_deterministic");
    assert.match(hit.reply, /Sagrada Família/i);
  });

  it("épistémique : pas de refus si antécédent résolvable", () => {
    assert.equal(
      isAnaphoraReferenceResolvable("tu peux la détailler ?", HISTORY_CARBONARA),
      true,
    );
    const verdict = evaluateEpistemicRefusal({
      query: "tu peux la détailler ?",
      history: HISTORY_CARBONARA,
      hasReliableContext: false,
      responseText: "",
    });
    assert.equal(verdict.shouldRefuse, false);
    assert.equal(verdict.reason, "anaphora_reference_carryover");
  });
});
