import test from "node:test";
import assert from "node:assert/strict";

import { enforceSimpleFastContract } from "../src/agent/utils/responseContract.js";
import OllamaStreamProcessor from "../src/agent/utils/ollamaStreamProcessor.js";
import responseThinkingCleaner from "../src/agent/utils/responseThinkingCleaner.js";
import conversationHealth from "../src/agent/telemetry/conversationHealth.js";

test("stability: SIMPLE_FAST contract keeps response to max two sentences", () => {
  const raw = "Bonjour. Voici une deuxième phrase utile. Et une troisième en trop.";
  const out = enforceSimpleFastContract(raw);
  const count = out
    .split(/[.!?]+/)
    .map((x) => x.trim())
    .filter(Boolean).length;

  assert.equal(count, 2);
});

test("stability: SIMPLE_FAST contract strips thinking blocks", () => {
  const THINK_OPEN = "<" + "redacted_thinking" + ">";
  const THINK_CLOSE = "</" + "redacted_thinking" + ">";
  const raw = "Salut, je vais bien. Et vous ?" + THINK_OPEN + "raisonnement interne" + THINK_CLOSE;
  const out = enforceSimpleFastContract(raw);

  assert.equal(out.includes("<think>"), false);
  assert.equal(out.includes("raisonnement interne"), false);
  assert.equal(out.includes("Salut"), true);
});

test("stability: stream processor keeps visible text when think closes in same chunk", () => {
  const THINK_OPEN = "<" + "redacted_thinking" + ">";
  const THINK_CLOSE = "</" + "redacted_thinking" + ">";
  const processor = new OllamaStreamProcessor();
  processor.processToken(`Bonjour${THINK_OPEN}interne${THINK_CLOSE} visible`);
  processor.finalize();

  const result = processor.getResult();
  assert.equal(result.currentResponse, "Bonjour visible");
});

test("stability: stream processor strips trailing think block after visible answer", () => {
  const THINK_OPEN = "<" + "redacted_thinking" + ">";
  const THINK_CLOSE = "</" + "redacted_thinking" + ">";
  const processor = new OllamaStreamProcessor();
  processor.processToken(
    `Je propose un assistant IA.${THINK_OPEN} Le choix de cet assistant suggère un intérêt.${THINK_CLOSE}`,
  );
  processor.finalize();

  const result = processor.getResult();
  assert.equal(result.currentResponse, "Je propose un assistant IA.");
  assert.equal(result.currentResponse.includes(THINK_OPEN), false);
});

test("stability: stream processor supports legacy think close tag", () => {
  const THINK_OPEN = "<" + "redacted_thinking" + ">";
  const THINK_CLOSE_LEGACY = "</" + "think" + ">";
  const processor = new OllamaStreamProcessor();
  processor.processToken(
    `Réponse finale.${THINK_OPEN} analyse interne${THINK_CLOSE_LEGACY}`,
  );
  processor.finalize();
  assert.equal(processor.getResult().currentResponse, "Réponse finale.");
});

test("stability: cleaner removes leaked markers", () => {
  const cleaned = responseThinkingCleaner.clean(
    "Intro\n\n**Thinking Process:** plan interne\n\nConclusion.",
  );
  assert.equal(cleaned.includes("Thinking Process"), false);
  assert.equal(cleaned.includes("Conclusion"), true);
});

test("stability: health tracker records incidents and exposes fallback rate", () => {
  const before = conversationHealth.snapshot();
  conversationHealth.markStreamStart();
  conversationHealth.recordIncident("no_visible_tokens", { sessionId: "test" });
  conversationHealth.recordIncident("fallback_triggered", { reason: "test" });
  const after = conversationHealth.snapshot();

  assert.equal(after.today.streams >= before.today.streams + 1, true);
  assert.equal(
    after.today.noVisibleTokens >= before.today.noVisibleTokens + 1,
    true,
  );
  assert.equal(
    after.today.fallbackTriggered >= before.today.fallbackTriggered + 1,
    true,
  );
});

