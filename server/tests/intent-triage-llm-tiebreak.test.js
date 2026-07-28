import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  triageUserIntent,
  triageUserIntentAsync,
  TRIAGE_INTENTS,
  TRIAGE_CONFIDENCE,
  TRIAGE_ROUTING_ACTION,
} from "../src/agent/classifiers/intentTriageClassifier.js";
import {
  applyIntentTriageLlmTiebreak,
  shouldAttemptLlmTiebreak,
  isIntentTriageLlmEnabled,
} from "../src/agent/classifiers/intentTriageLlmTiebreak.js";

const ORIGINAL_ENV = process.env.INTENT_TRIAGE_OLLAMA;

describe("intentTriageLlmTiebreak", () => {
  before(() => {
    process.env.INTENT_TRIAGE_OLLAMA = "1";
  });

  after(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.INTENT_TRIAGE_OLLAMA;
    } else {
      process.env.INTENT_TRIAGE_OLLAMA = ORIGINAL_ENV;
    }
  });

  it("reste désactivé par défaut sans variable d'environnement explicite au boot", () => {
    const saved = process.env.INTENT_TRIAGE_OLLAMA;
    delete process.env.INTENT_TRIAGE_OLLAMA;
    assert.equal(isIntentTriageLlmEnabled(), false);
    process.env.INTENT_TRIAGE_OLLAMA = saved;
  });

  it("n'appelle le LLM que pour confidence low", () => {
    const high = triageUserIntent(
      "Fais une revue de code Python orientée exécution : commence par les erreurs bloquantes.\ndef broken( return 1",
    );
    assert.equal(high.confidence, TRIAGE_CONFIDENCE.HIGH);
    assert.equal(shouldAttemptLlmTiebreak(high), false);

    const low = triageUserIntent("analyse ceci :\n" + "lorem ipsum ".repeat(40));
    if (low.confidence === TRIAGE_CONFIDENCE.LOW) {
      assert.equal(shouldAttemptLlmTiebreak(low), true);
    }
  });

  it("fail-closed vers le tri règles si le LLM renvoie un JSON invalide", async () => {
    const query = "analyse ceci :\n" + "lorem ipsum ".repeat(40);
    const ruleTriage = triageUserIntent(query);
    assert.equal(ruleTriage.confidence, TRIAGE_CONFIDENCE.LOW);

    const mockClient = {
      chat: async () => "pas du json",
    };

    const { triage, usedLlm, source } = await applyIntentTriageLlmTiebreak({
      query,
      ruleTriage,
      llmClient: mockClient,
    });

    assert.equal(usedLlm, false);
    assert.equal(source, "rule_fallback");
    assert.equal(triage.top_intent, ruleTriage.top_intent);
    assert.equal(triage.runner_up, ruleTriage.runner_up);
  });

  it("applique un tie-break local valide et route sans clarification", async () => {
    const query = "analyse ceci :\n" + "lorem ipsum ".repeat(40);
    const ruleTriage = triageUserIntent(query);

    const mockClient = {
      chat: async () =>
        JSON.stringify({
          top_intent: TRIAGE_INTENTS.CODE_REVIEW,
          runner_up: TRIAGE_INTENTS.DOCUMENT_ANALYSIS,
          confidence: TRIAGE_CONFIDENCE.HIGH,
          confidence_score: 0.82,
          needs_clarification: false,
        }),
    };

    const { triage, usedLlm, source } = await applyIntentTriageLlmTiebreak({
      query,
      ruleTriage,
      llmClient: mockClient,
    });

    assert.equal(usedLlm, true);
    assert.equal(source, "ollama_tiebreak");
    assert.equal(triage.top_intent, TRIAGE_INTENTS.CODE_REVIEW);
    assert.equal(triage.confidence, TRIAGE_CONFIDENCE.HIGH);
    assert.equal(triage.routing_action, TRIAGE_ROUTING_ACTION.ROUTE_DIRECT);
    assert.ok(triage.signals.includes("llm_tiebreak"));
  });

  it("triageUserIntentAsync conserve le chemin règles-only avec skipLlm", async () => {
    const scenario =
      "analyse le code suivant c'est du python :\ndef add(a,b): return a+b\nprint(add(1,2))";
    const triage = await triageUserIntentAsync(scenario, [], { skipLlm: true });
    assert.equal(triage.top_intent, TRIAGE_INTENTS.CODE_REVIEW);
    assert.equal(triage.tiebreak.usedLlm, false);
    assert.equal(triage.tiebreak.source, "rules_only");
  });
});
