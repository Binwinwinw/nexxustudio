import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DOCUMENT_LATENCY_KEYS,
  buildDocumentLatencyBreakdown,
  applyDocumentLatencyMetrics,
} from "../src/agent/telemetry/documentLatencyTelemetry.js";

describe("documentLatencyTelemetry — décomposition TTFT", () => {
  it("sépare load / prompt_eval / génération des ns Ollama", () => {
    const breakdown = buildDocumentLatencyBreakdown({
      document_extract_ms: 120,
      prompt_build_ms: 8,
      first_token_ms: 44762,
      sanitize_ms: 3,
      delivery_ms: 12,
      ollamaDone: {
        load_duration: 40_000_000_000,
        prompt_eval_duration: 3_500_000_000,
        eval_duration: 24_000_000_000,
      },
    });
    for (const key of DOCUMENT_LATENCY_KEYS) {
      assert.equal(key in breakdown, true, key);
    }
    assert.equal(breakdown.dominant, "model_load_ms");
    assert.equal(breakdown.dominant_ms, 40000);
    assert.equal(breakdown.document_extract_ms, 120);
    assert.equal(breakdown.prompt_build_ms, 8);
    assert.equal(breakdown.model_load_ms, 40000);
    assert.equal(breakdown.prompt_eval_ms, 3500);
    assert.equal(breakdown.first_token_ms, 44762);
    assert.equal(breakdown.generation_ms, 24000);
    assert.equal(breakdown.sanitize_ms, 3);
    assert.equal(breakdown.delivery_ms, 12);
    assert.notEqual(breakdown.first_token_ms, breakdown.model_load_ms);
    assert.notEqual(breakdown.first_token_ms, breakdown.prompt_eval_ms);
  });

  it("écrit les 8 clés sur turnTelemetry", () => {
    const metrics = {};
    applyDocumentLatencyMetrics(
      { setMetric: (k, v) => { metrics[k] = v; } },
      buildDocumentLatencyBreakdown({
        document_extract_ms: 10,
        ollamaDone: { load_duration: 1_000_000_000 },
      }),
    );
    assert.equal(metrics.document_extract_ms, 10);
    assert.equal(metrics.model_load_ms, 1000);
    assert.equal("first_token_ms" in metrics, false);
  });
});
