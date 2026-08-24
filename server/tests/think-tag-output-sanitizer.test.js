import { describe, it } from "node:test";
import assert from "node:assert/strict";
import OllamaStreamProcessor from "../src/agent/utils/runtime/ollamaStreamProcessor.js";
import responseThinkingCleaner from "../src/agent/utils/quality-safety/responseThinkingCleaner.js";

function streamVisible(chunks) {
  const visible = [];
  const processor = new OllamaStreamProcessor({
    onChunk: (chunk) => visible.push(chunk),
  });
  for (const chunk of chunks) {
    processor.processToken(chunk);
  }
  processor.finalize();
  return { visible: visible.join(""), result: processor.getResult().currentResponse };
}

describe("think-tag output sanitizer", () => {
  it("A. réponse normale</think> → réponse normale", () => {
    const input = "réponse normale</think>";
    assert.equal(responseThinkingCleaner.clean(input), "réponse normale");
    const streamed = streamVisible([input]);
    assert.equal(streamed.visible, "réponse normale");
    assert.equal(streamed.result, "réponse normale");
    assert.equal(streamed.visible.includes("</think>"), false);
  });

  it("B. <think>raisonnement</think>Réponse → Réponse", () => {
    const input = "<think>raisonnement</think>Réponse";
    assert.equal(responseThinkingCleaner.clean(input), "Réponse");
    const streamed = streamVisible([input]);
    assert.equal(streamed.visible, "Réponse");
    assert.equal(streamed.result, "Réponse");
    assert.equal(streamed.visible.includes("<think>"), false);
    assert.equal(streamed.visible.includes("raisonnement"), false);
  });

  it("C. bloc <think> réparti sur plusieurs chunks", () => {
    const streamed = streamVisible([
      "<th",
      "ink>raison",
      "nement</th",
      "ink>",
      "Réponse",
    ]);
    assert.equal(streamed.visible, "Réponse");
    assert.equal(streamed.result, "Réponse");
    assert.equal(streamed.visible.includes("<"), false);
    assert.equal(streamed.visible.includes("think"), false);
  });

  it("D. balise isolée dans le dernier chunk", () => {
    const streamed = streamVisible([
      "Prêt quand tu le dis — on lance quoi ?",
      "</think>",
    ]);
    assert.equal(streamed.visible, "Prêt quand tu le dis — on lance quoi ?");
    assert.equal(streamed.result, "Prêt quand tu le dis — on lance quoi ?");
    assert.equal(streamed.visible.includes("</think>"), false);
  });

  it("E. symbole inférieur légitime conservé", () => {
    const input = "si a < b alors c";
    assert.equal(responseThinkingCleaner.clean(input), "si a < b alors c");
    const streamed = streamVisible(["si a ", "<", " b alors c"]);
    assert.equal(streamed.visible, "si a < b alors c");
    assert.equal(streamed.result, "si a < b alors c");
  });

  it("F. réponse déterministe inchangée", () => {
    const input = "Prêt quand tu le dis — on lance quoi ?";
    assert.equal(responseThinkingCleaner.clean(input), input);
    const streamed = streamVisible([input]);
    assert.equal(streamed.visible, input);
    assert.equal(streamed.result, input);
  });

  it("G. sortie vide après nettoyage sans crash", () => {
    assert.equal(responseThinkingCleaner.clean(""), "");
    assert.equal(responseThinkingCleaner.clean(null), "");
    assert.doesNotThrow(() => {
      const processor = new OllamaStreamProcessor();
      processor.finalize();
      assert.equal(processor.getResult().currentResponse, "");
    });
    assert.doesNotThrow(() => {
      streamVisible(["<think></think>"]);
    });
  });
});
