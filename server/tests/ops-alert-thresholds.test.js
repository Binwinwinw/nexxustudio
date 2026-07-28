import test from "node:test";
import assert from "node:assert/strict";

import {
  OPS_ALERT_THRESHOLDS_V1,
  deriveConversationOpsStatus,
  deriveMemoryOpsStatus,
  deriveOpsGlobalStatus,
  evaluateOpsAlerts,
} from "../src/agent/ops/opsAlertThresholds.js";

test("ops alerts: conversation INCIDENT on no visible tokens", () => {
  assert.equal(
    deriveConversationOpsStatus({ noVisibleTokens: 1, streamErrors: 0, fallbackRatePct: 0 }, 75, false),
    "INCIDENT",
  );
});

test("ops alerts: conversation DEGRADE on fallback rate", () => {
  assert.equal(
    deriveConversationOpsStatus({ noVisibleTokens: 0, streamErrors: 0, fallbackRatePct: 2 }, 90, true),
    "DEGRADE",
  );
});

test("ops alerts: memory VIOLATION on contract breach", () => {
  assert.equal(
    deriveMemoryOpsStatus({ today: { contractViolations: 1, ingestAttempts: 5 }, globalScore: 90 }),
    "VIOLATION",
  );
});

test("ops alerts: memory STALE when review_at expired in store", () => {
  assert.equal(
    deriveMemoryOpsStatus({ today: { staleInStore: 2, ingestAttempts: 5 }, globalScore: 90 }),
    "STALE",
  );
});

test("ops alerts: ops global score floor triggers INCIDENT", () => {
  assert.equal(deriveOpsGlobalStatus("OK", "OK", 65), "INCIDENT");
  assert.equal(deriveOpsGlobalStatus("OK", "OK", 80), "DEGRADE");
});

test("ops alerts: evaluateOpsAlerts lists triggered rules", () => {
  const alerts = evaluateOpsAlerts({
    conversationMetrics: { noVisibleTokens: 2, fallbackRatePct: 0, streamErrors: 0 },
    conversationScore: 50,
    qualityGatePass: false,
    memorySnapshot: { today: { contractViolations: 0, staleInStore: 0, ingestAttempts: 0 } },
    opsScore: 60,
    curatedMemoryIngest: true,
  });
  assert.ok(alerts.some((a) => a.rule === "no_visible_tokens"));
  assert.ok(alerts.some((a) => a.rule === "ops_score_critical"));
  assert.ok(alerts.some((a) => a.rule === "pipeline_inactif"));
});

test("ops alerts: thresholds exported", () => {
  assert.equal(OPS_ALERT_THRESHOLDS_V1.conversation.degrade.minScore, 85);
  assert.equal(OPS_ALERT_THRESHOLDS_V1.opsGlobal.incidentScoreBelow, 70);
});
