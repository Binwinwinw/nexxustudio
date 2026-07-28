import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  tryOcrServiceFallbackForVisionFailure,
  buildVisionInfrastructureFailureReply,
} from "../src/agent/capabilities/ocr/ocrVisionFallback.js";
import {
  isOllamaUnreachableError,
  buildLlmUnreachableUserMessage,
} from "../src/agent/utils/llmConnectionErrors.js";

describe("vision + OCR fallback", () => {
  it("buildVisionInfrastructureFailureReply mentionne Ollama", () => {
    const msg = buildVisionInfrastructureFailureReply("http://127.0.0.1:11434");
    assert.match(msg, /Ollama/i);
    assert.match(msg, /11434/);
  });

  it("isOllamaUnreachableError détecte ECONNREFUSED", () => {
    assert.equal(isOllamaUnreachableError({ code: "ECONNREFUSED" }), true);
    assert.equal(
      isOllamaUnreachableError(new Error("connect ECONNREFUSED 127.0.0.1:11434")),
      true,
    );
  });

  it("buildLlmUnreachableUserMessage vision_failed", () => {
    const msg = buildLlmUnreachableUserMessage(
      { code: "ECONNREFUSED" },
      { visionFailed: true },
    );
    assert.match(msg, /vision local/i);
  });

  it("OCR fallback skip sans OCR_SERVICE_URL", async () => {
    const prev = process.env.OCR_SERVICE_URL;
    delete process.env.OCR_SERVICE_URL;
    try {
      const hit = await tryOcrServiceFallbackForVisionFailure(
        "transcris cette photo",
        [{ path: "/tmp/x.png", mimetype: "image/png", originalname: "x.png" }],
      );
      assert.equal(hit, null);
    } finally {
      if (prev !== undefined) process.env.OCR_SERVICE_URL = prev;
    }
  });
});
