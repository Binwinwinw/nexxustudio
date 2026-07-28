import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateSemanticIntentResolution,
  shouldUseSemanticResolution,
} from "../src/agent/micro/classifiers/semanticIntentResolver.js";

describe("semanticIntentResolver - Validation and Fallback", () => {
  it("rejects invalid JSON structures", () => {
    const res = validateSemanticIntentResolution(null);
    assert.equal(res, null);

    const res2 = validateSemanticIntentResolution({ noIntent: true });
    assert.equal(res2, null);

    const res3 = validateSemanticIntentResolution({ intent: "unknown_intent", confidence: 0.9 });
    assert.equal(res3, null); // "unknown_intent" is not in VALID_INTENTS
  });

  it("validates and normalizes correct JSON output", () => {
    const raw = {
      intent: "time_lookup",
      subIntent: "date_only",
      confidence: 0.92,
      entities: { datetimeKind: "date" },
      multiIntent: false,
      needsClarification: false,
      recommendedPipeline: "deterministic_reply"
    };
    
    const validated = validateSemanticIntentResolution(raw);
    assert.ok(validated);
    assert.equal(validated.intent, "time_lookup");
    assert.equal(validated.confidence, 0.92);
    assert.equal(validated.recommendedPipeline, "deterministic_reply");
    assert.equal(validated.entities.datetimeKind, "date");
    assert.equal(validated.version, "1.0"); // default
  });

  it("shouldUseSemanticResolution respects shadow mode", () => {
    const resolution = { intent: "time_lookup", confidence: 0.95 };
    assert.equal(shouldUseSemanticResolution(resolution, { mode: "shadow" }), false);
  });

  it("shouldUseSemanticResolution enforces high confidence rule", () => {
    const resolution = { intent: "how_to", confidence: 0.86 };
    // Should pass if not in shadow mode
    assert.equal(shouldUseSemanticResolution(resolution, { mode: "assist" }), true);
  });

  it("shouldUseSemanticResolution allows cheap intents on medium confidence", () => {
    const resolution = { intent: "social_checkin", confidence: 0.70 };
    assert.equal(shouldUseSemanticResolution(resolution, { mode: "assist" }), true);
  });

  it("shouldUseSemanticResolution rejects complex intents on medium confidence", () => {
    const resolution = { intent: "general_explain", confidence: 0.75 };
    assert.equal(shouldUseSemanticResolution(resolution, { mode: "assist" }), false);
  });

  it("shouldUseSemanticResolution rejects all on low confidence", () => {
    const resolution = { intent: "time_lookup", confidence: 0.59 };
    assert.equal(shouldUseSemanticResolution(resolution, { mode: "assist" }), false);
  });
});
