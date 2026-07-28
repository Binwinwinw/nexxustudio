import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SIMPLE_FACTUAL_TYPES,
  classifySimpleFactualQuestionType,
  isBareFactualFragment,
  isWellFormedSimpleFactualSentence,
  polishSimpleFactualAnswer,
  renderSimpleFactualAnswer,
  buildSimpleFactualSystemAddon,
  resolveLocalSimpleFactualAnswer,
  isSimpleFactualClarificationLeak,
  finalizeSimpleFactualAnswer,
  tryResolveDeterministicSimpleFactual,
  buildSimpleFactualDirectFallback,
  enforceSimpleFactualDirectness,
  isSimpleFactualOverRefusal,
} from "../src/agent/micro/replies/simpleFactualComposer.js";
import {
  INSUFFICIENT_SIGNAL_REFUSAL,
  getSimpleFactualSystemPrompt,
} from "../src/agent/config/modeResponseContracts.js";
import { resolvePipelineFallback } from "../src/agent/utils/genericGreetingGuards.js";
import { buildInformationRecoveryMessage } from "../src/agent/utils/genericGreetingGuards.js";
import { isSimpleFactualQuestion } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { detectSimpleFactualDirectnessViolation } from "../src/agent/telemetry/conversationMoveShadowTelemetry.js";

describe("simpleFactualComposer — classification", () => {
  it("détecte les questions de lieu", () => {
    assert.equal(
      classifySimpleFactualQuestionType("Dans quelle ville se trouve le Parc Astérix ?"),
      SIMPLE_FACTUAL_TYPES.LOCATION,
    );
  });

  it("détecte les questions de date", () => {
    assert.equal(
      classifySimpleFactualQuestionType("Quelle est la date du jour ?"),
      SIMPLE_FACTUAL_TYPES.DATE,
    );
  });

  it("détecte les questions de définition", () => {
    assert.equal(
      classifySimpleFactualQuestionType("Qu'est-ce qu'un octet ?"),
      SIMPLE_FACTUAL_TYPES.DEFINITION,
    );
  });
});

describe("simpleFactualComposer — formulation", () => {
  it("transforme un fragment nu de lieu en phrase complète", () => {
    const out = polishSimpleFactualAnswer(
      "Orléans !",
      "Dans quelle ville se trouve le Parc Astérix ?",
    );
    assert.match(out, /Parc Asterix se trouve à Orléans\./i);
    assert.equal(isBareFactualFragment(out), false);
  });

  it("accepte une phrase déjà bien formée", () => {
    const sentence =
      "Le Parc Astérix se trouve à Plailly, dans l'Oise, au nord de Paris.";
    assert.equal(isWellFormedSimpleFactualSentence(sentence), true);
    assert.equal(
      polishSimpleFactualAnswer(
        sentence,
        "Dans quelle ville se trouve le Parc Astérix ?",
      ),
      sentence,
    );
  });

  it("formate une définition courte", () => {
    const out = renderSimpleFactualAnswer("8 bits", "Qu'est-ce qu'un octet ?", SIMPLE_FACTUAL_TYPES.DEFINITION);
    assert.match(out, /octet.*8 bits/i);
    assert.match(out, /\.$/);
  });

  it("formate une identité courte", () => {
    const out = renderSimpleFactualAnswer(
      "Besançon",
      "Où est né Victor Hugo ?",
      SIMPLE_FACTUAL_TYPES.IDENTITY,
    );
    assert.match(out, /Besançon/);
    assert.match(out, /\.$/);
  });

  it("pose une consigne système anti-fragment", () => {
    const addon = buildSimpleFactualSystemAddon(
      "Dans quelle ville se trouve le Parc Astérix ?",
    );
    assert.match(addon, /SIMPLE_FACTUAL_LOOKUP/);
    assert.match(addon, /INTERDIT.*Orléans/i);
    assert.match(addon, /Parc Astérix/);
  });

  it("détecte une fuite clarify-first", () => {
    assert.equal(isSimpleFactualClarificationLeak(INSUFFICIENT_SIGNAL_REFUSAL), true);
    assert.equal(
      isSimpleFactualClarificationLeak("Le Parc Astérix se trouve à Plailly, dans l'Oise."),
      false,
    );
  });

  it("fiche locale Parc Astérix", () => {
    const q = "dans quelle ville de France se trouve le parc Astérix ?";
    const local = resolveLocalSimpleFactualAnswer(q);
    assert.match(local, /Plailly/i);
    assert.match(local, /Oise/i);
  });

  it("finalize remplace une clarification par la fiche locale", () => {
    const q = "dans quelle ville de France se trouve le parc Astérix ?";
    const out = finalizeSimpleFactualAnswer(INSUFFICIENT_SIGNAL_REFUSAL, q);
    assert.match(out, /Plailly/i);
    assert.equal(isSimpleFactualClarificationLeak(out), false);
  });

  it("prompt dédié sans REFUS PROPRE", () => {
    const prompt = getSimpleFactualSystemPrompt();
    assert.match(prompt, /SIMPLE_FACTUAL_LOOKUP/);
    assert.doesNotMatch(prompt, /REFUS PROPRE:/);
    assert.match(prompt, /INTERDIT.*je n'ai pas pu finaliser/i);
  });
});

const BROCOLI_QUERY = "combien de l dans brocoli ?";

describe("simpleFactualComposer — P3 directness (G12)", () => {
  it("classifie brocoli comme factuel simple", () => {
    assert.equal(isSimpleFactualQuestion(BROCOLI_QUERY), true);
    assert.equal(
      classifySimpleFactualQuestionType(BROCOLI_QUERY),
      SIMPLE_FACTUAL_TYPES.QUANTITY,
    );
  });

  it("résout déterministement le comptage de lettres — brocoli", () => {
    const out = tryResolveDeterministicSimpleFactual(BROCOLI_QUERY);
    assert.ok(out);
    assert.match(out, /brocoli/i);
    assert.match(out, /une seule lettre.*l/i);
    assert.match(out, /broccoli/i);
    assert.equal(isSimpleFactualClarificationLeak(out), false);
  });

  it("enforce remplace refus / recovery par réponse directe", () => {
    const leak = buildInformationRecoveryMessage(BROCOLI_QUERY, "empty_short_circuit_llm");
    assert.equal(isSimpleFactualOverRefusal(leak), true);

    const fixed = enforceSimpleFactualDirectness(leak, BROCOLI_QUERY);
    assert.equal(isSimpleFactualClarificationLeak(fixed), false);
    assert.match(fixed, /brocoli/i);
    assert.doesNotMatch(fixed, /géographie, histoire/i);
  });

  it("resolvePipelineFallback — pas d'angle géographie sur factuel", () => {
    const out = resolvePipelineFallback({
      query: BROCOLI_QUERY,
      reason: "empty_short_circuit_llm",
    });
    assert.doesNotMatch(out, /géographie, histoire, contexte/i);
    assert.match(out, /brocoli/i);
  });

  it("shadow détecte violation sur recovery message", () => {
    const leak = buildInformationRecoveryMessage(BROCOLI_QUERY, "empty_short_circuit_llm");
    const hit = detectSimpleFactualDirectnessViolation(leak, "simple_factual_lookup");
    assert.equal(hit.applicable, true);
    assert.equal(hit.contract_violation_simple_fact_directness, true);
    assert.ok(hit.signals.includes("pseudo_clarify_or_recovery"));

    const ok = detectSimpleFactualDirectnessViolation(
      tryResolveDeterministicSimpleFactual(BROCOLI_QUERY),
      "simple_factual_lookup",
    );
    assert.equal(ok.contract_violation_simple_fact_directness, false);
  });

  it("corpus quantity — lettres dans Paris", () => {
    const q = "combien de lettres dans Paris ?";
    const out = tryResolveDeterministicSimpleFactual(q);
    assert.match(out, /Paris/i);
    assert.match(out, /5 lettres/i);
  });
});
