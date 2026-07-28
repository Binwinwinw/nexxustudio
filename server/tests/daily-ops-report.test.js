import test from "node:test";
import assert from "node:assert/strict";

import {
  computeOpsGlobalScore,
  deriveOpsGlobalStatus,
  buildDailyOpsMarkdown,
  buildOpsVerdict,
} from "../src/agent/ops/dailyOpsReportBuilder.js";

test("ops report: global score is average of domains", () => {
  assert.equal(computeOpsGlobalScore(100, 90), 95);
});

test("ops report: global status picks worst domain", () => {
  assert.equal(deriveOpsGlobalStatus("OK", "VIOLATION", 95), "INCIDENT");
  assert.equal(deriveOpsGlobalStatus("INCIDENT", "OK", 95), "INCIDENT");
  assert.equal(deriveOpsGlobalStatus("OK", "OK", 95), "OK");
});

test("ops report: fused markdown fits one-page structure", () => {
  const md = buildDailyOpsMarkdown({
    dateFr: "28/05/2026",
    generatedAt: new Date().toISOString(),
    executiveActions: ["Aucune action urgente."],
    memoryTodayEvents: [],
    conversation: {
      status: "OK",
      score: 100,
      metrics: { streams: 0, noVisibleTokens: 0, fallbackRatePct: 0, streamErrorCount: 0 },
      qualityGateReady: true,
      trendLabel: "Stable",
      trendDelta: 0,
      incidents: [],
      recommendation: "Stable.",
    },
    memory: {
      status: "INACTIF",
      score: 100,
      today: { ingestAttempts: 0, promotionRatePct: 0 },
      distribution: { storeActive: 0, episodicFiles: 4, semanticFacts: 0, heritageProposed: 0 },
      refusalReasons: [],
      recommendation: "Activer pipeline.",
    },
    ops: { status: "INACTIF", score: 100, verdict: buildOpsVerdict("INACTIF") },
  });

  assert.ok(md.includes("Rapport Ops Quotidien"));
  assert.ok(md.includes("Synthèse exécutive"));
  assert.ok(md.includes("## Conversation"));
  assert.ok(md.includes("## Mémoire gouvernée"));
  assert.ok(md.includes("Verdict ops"));
  assert.ok(md.split("\n").length < 80, "should stay compact for one-page reading");
});
