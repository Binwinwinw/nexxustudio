import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  nsToMs,
  buildOllamaCallMetrics,
} from "../src/llm/ollamaCallMetrics.js";

describe("ollamaCallMetrics", () => {
  it("convertit les nanosecondes Ollama en ms", () => {
    assert.equal(nsToMs(17_597_000_000), 17597);
    assert.equal(nsToMs(null), null);
    assert.equal(nsToMs(undefined), null);
  });

  it("n'expose ni prompt ni réponse", () => {
    const payload = buildOllamaCallMetrics({
      model: "qwen3.5:2b",
      attempt: 1,
      kind: "stream",
      durationMs: 14588,
      ttftMs: 12000,
      total_duration: 18_341_000_000,
      load_duration: 17_597_000_000,
      prompt_eval_duration: 740_000_000,
      eval_duration: 1_000_000,
      eval_count: 71,
      status: "ok",
      prompt: "SECRET",
      content: "SECRET",
      messages: [{ role: "user", content: "SECRET" }],
    });
    const json = JSON.stringify(payload);
    assert.equal(json.includes("SECRET"), false);
    assert.equal("prompt" in payload, false);
    assert.equal("content" in payload, false);
    assert.equal("messages" in payload, false);
    assert.equal(payload.model, "qwen3.5:2b");
    assert.equal(payload.load_duration_ms, 17597);
    assert.equal(payload.status, "ok");
  });
});
