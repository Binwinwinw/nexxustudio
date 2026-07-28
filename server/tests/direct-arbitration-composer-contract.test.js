import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  hasExplicitDecisionCriterion,
  requiresDirectArbitrationContract,
  buildDirectArbitrationUserPrompt,
  isDirectArbitrationContractViolation,
  extractExplicitDecisionCriterion,
} from "../src/agent/micro/replies/directArbitrationComposerContract.js";
import { evaluateEpistemicRefusal } from "../src/agent/config/modeResponseContracts.js";
import { sanitizeUnverifiedToolExecutionClaims } from "../src/agent/utils/toolExecutionClaimGuard.js";

const RECIPE_QUERY =
  "as tu assez de connaissances pour me proposer la recette la plus rapide a servir parmi toute les recettes classiques que tu connais ??";

describe("directArbitrationComposerContract — détection critère", () => {
  it("extrait le critère rapidité explicite", () => {
    const criterion = extractExplicitDecisionCriterion(RECIPE_QUERY);
    assert.equal(criterion?.id, "speed");
  });

  it("active le contrat arbitrage direct", () => {
    assert.equal(requiresDirectArbitrationContract(RECIPE_QUERY), true);
    assert.equal(hasExplicitDecisionCriterion("Tu connais l'Italie ?"), false);
  });

  it("prompt user sans exiger contexte expert", () => {
    const prompt = buildDirectArbitrationUserPrompt(RECIPE_QUERY, {});
    assert.match(prompt, /Contexte expert : vide/i);
    assert.match(prompt, /Pas de question de clarification/i);
    assert.match(prompt, /rapidité de service/i);
  });
});

describe("directArbitrationComposerContract — violations", () => {
  it("détecte clarify-first + refus épistémique", () => {
    const bad =
      "Je n'ai pas assez d'éléments fiables. Veuillez préciser si vous avez une préférence entre les options.";
    assert.equal(isDirectArbitrationContractViolation(RECIPE_QUERY, bad), true);
  });

  it("épistémique : pas de refus si critère explicite", () => {
    const verdict = evaluateEpistemicRefusal({
      query: RECIPE_QUERY,
      hasReliableContext: false,
      responseText: "",
    });
    assert.equal(verdict.shouldRefuse, false);
    assert.equal(verdict.reason, "direct_arbitration_explicit_criterion");
  });
});

describe("toolExecutionClaimGuard", () => {
  it("retire une promesse webSummarize non exécutée", () => {
    const raw =
      "Voici trois options. Je pourrai procéder ensuite avec webSummarize pour documenter officiellement.";
    const out = sanitizeUnverifiedToolExecutionClaims(raw, []);
    assert.doesNotMatch(out, /webSummarize/i);
  });

  it("conserve webSummarize si outil réellement utilisé", () => {
    const raw = "Synthèse via webSummarize sur la source officielle.";
    const out = sanitizeUnverifiedToolExecutionClaims(raw, ["webSummarize"]);
    assert.match(out, /webSummarize/i);
  });
});
