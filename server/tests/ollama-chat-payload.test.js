import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  stripThinkOption,
  buildNativeOllamaChatPayload,
  summarizeOllamaChatPayload,
} from "../src/llm/ollamaChatPayload.js";
import {
  buildDocumentOllamaChatOptions,
  resolveDocumentRailPath,
} from "../src/agent/policies/document/documentOllamaOptions.js";

describe("payload /api/chat natif — think top-level", () => {
  it("think=false hors options, pas dans options", () => {
    const { think, rest } = stripThinkOption(
      buildDocumentOllamaChatOptions({ think: false }),
    );
    assert.equal(think, false);
    assert.equal("think" in rest, false);
    const payload = buildNativeOllamaChatPayload({
      model: "qwen3.5:2b",
      messages: [{ role: "user", content: "SECRET_DOCUMENT_TEXT" }],
      stream: true,
      keepAlive: 1800,
      chatOptions: { temperature: 0.3, num_ctx: 8192 },
      think,
    });
    assert.equal(payload.think, false);
    assert.equal(payload.stream, true);
    assert.equal(payload.model, "qwen3.5:2b");
    assert.equal("think" in (payload.options || {}), false);
    assert.equal(payload.options.temperature, 0.3);
  });

  it("sans think : champ absent (baseline A)", () => {
    const { think, rest } = stripThinkOption({ temperature: 0.3 });
    assert.equal(think, undefined);
    const payload = buildNativeOllamaChatPayload({
      model: "qwen3.5:2b",
      messages: [],
      stream: true,
      chatOptions: rest,
      think,
    });
    assert.equal(Object.prototype.hasOwnProperty.call(payload, "think"), false);
  });

  it("summary sans contenu sensible", () => {
    const payload = buildNativeOllamaChatPayload({
      model: "qwen3.5:2b",
      messages: [{ role: "system", content: "SECRET_PROMPT" }],
      stream: true,
      keepAlive: 1800,
      chatOptions: { temperature: 0.3 },
      think: false,
    });
    const summary = summarizeOllamaChatPayload(payload);
    const dumped = JSON.stringify(summary);
    assert.equal(summary.endpoint, "/api/chat");
    assert.equal(summary.think, false);
    assert.equal(summary.stream, true);
    assert.equal(summary.message_count, 1);
    assert.doesNotMatch(dumped, /SECRET/);
    assert.equal("messages" in summary, false);
  });
});

describe("DOCUMENT rail path — nominal / retry / fallback", () => {
  it("classe les 3 chemins", () => {
    assert.equal(resolveDocumentRailPath({}), "nominal");
    assert.equal(
      resolveDocumentRailPath({ thinkRetry: true }),
      "think_rejected_retry",
    );
    assert.equal(
      resolveDocumentRailPath({ usedFallback: true }),
      "invalid_fallback",
    );
    assert.equal(
      resolveDocumentRailPath({ thinkRetry: true, usedFallback: true }),
      "invalid_fallback",
    );
  });
});
