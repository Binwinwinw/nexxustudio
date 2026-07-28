import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolveSimpleFastResponseMode,
  resolveSimpleFastAllowRefusal,
  resolveSimpleFastIntentFlags,
  shouldRunWordGuardSimpleFast,
  SIMPLE_FAST_ORIGINS,
} from "../src/agent/paths/simpleFastPath.js";
import { RESPONSE_MODES } from "../src/agent/config/modeResponseContracts.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

describe("simpleFastPath — lot 3 chemin unique", () => {
  it("résout le mode OPEN_PROPOSITION pour pédagogique", () => {
    const q = "que dois apprendre un élève de 6eme sur les fractions simples ?";
    const flags = resolveSimpleFastIntentFlags(q);
    assert.equal(flags.pedagogicalOverview, true);
    assert.equal(
      resolveSimpleFastResponseMode(flags),
      RESPONSE_MODES.OPEN_PROPOSITION,
    );
    assert.equal(resolveSimpleFastAllowRefusal(flags), false);
  });

  it("word guard skip si simpleFast déjà consommé", () => {
    assert.equal(
      shouldRunWordGuardSimpleFast({
        wordsCount: 8,
        simpleFastConsumed: true,
      }),
      false,
    );
  });

  it("word guard skip si defer full pipeline", () => {
    assert.equal(
      shouldRunWordGuardSimpleFast({
        wordsCount: 8,
        shortCircuitEvaluated: true,
        shortCircuitDeferredFull: true,
      }),
      false,
    );
  });

  it("word guard actif si short-circuit null et requête courte", () => {
    assert.equal(
      shouldRunWordGuardSimpleFast({
        wordsCount: 8,
        shortCircuitEvaluated: true,
        shortCircuitDeferredFull: false,
        simpleFastConsumed: false,
      }),
      true,
    );
  });

  it("Italie → familiarity déterministe, pas defer simpleFast", async () => {
    const q = "que sais tu du pays appelé Italie ?";
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "familiarity_deterministic");
    assert.notEqual(hit?.deferToLlm, true);
  });

  it("fractions 6e → pedagogical déterministe, pas defer full", async () => {
    const q = "que dois apprendre un élève de 6eme sur les fractions simples ?";
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "pedagogical_overview_deterministic");
    assert.notEqual(hit?.deferToFullPipeline, true);
  });

  it("Parc Astérix → simple_factual defer LLM (origine short_circuit)", async () => {
    const q = "Dans quelle ville se trouve le Parc Astérix ?";
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "simple_factual_lookup");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.simpleFactual, true);
    assert.equal(SIMPLE_FAST_ORIGINS.SHORT_CIRCUIT, "short_circuit");
  });
});
