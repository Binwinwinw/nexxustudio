import test from "node:test";
import assert from "node:assert/strict";

import {
  computeHealthScore,
  evaluateQualityGate,
  QUALITY_GATE_THRESHOLDS,
} from "../src/agent/telemetry/conversationHealthScore.js";

test("health score: clean metrics yield 100", () => {
  assert.equal(
    computeHealthScore({
      noVisibleTokens: 0,
      fallbackRatePct: 0,
      streamErrorCount: 0,
    }),
    100,
  );
});

test("health score: noVisibleTokens penalizes heavily", () => {
  const score = computeHealthScore({ noVisibleTokens: 1, fallbackRatePct: 0 });
  assert.ok(score < 85);
});

test("health score: fallback rate >= 1 fails gate", () => {
  const evaluation = evaluateQualityGate({
    noVisibleTokens: 0,
    fallbackRatePct: 1.2,
    streamErrorCount: 0,
  });
  assert.equal(evaluation.pass, false);
  assert.ok(evaluation.failures.some((f) => f.rule === "fallback_rate"));
});

test("health score: gate passes on ideal baseline", () => {
  const evaluation = evaluateQualityGate({
    noVisibleTokens: 0,
    fallbackRatePct: 0,
    streamErrorCount: 0,
  });
  assert.equal(evaluation.pass, true);
  assert.equal(evaluation.score, 100);
});

test("health score: thresholds are exported", () => {
  assert.equal(QUALITY_GATE_THRESHOLDS.minScore, 85);
  assert.equal(QUALITY_GATE_THRESHOLDS.maxNoVisibleTokens, 0);
  assert.equal(QUALITY_GATE_THRESHOLDS.maxFallbackRatePct, 1);
});
