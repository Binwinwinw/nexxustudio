import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveMemoryGovernanceStatus,
  buildMemoryGovernanceRecommendation,
  computeMemoryTrend,
  buildMemoryGovernanceMarkdown,
} from "../src/agent/memory/guardianship/memoryGovernanceReport.js";

test("memory report: derive status INACTIF when no ingestions", () => {
  const status = deriveMemoryGovernanceStatus({
    kpis: { memoryGateHealthy: true, noStaleActive: true, governanceReady: true },
    today: { ingestAttempts: 0, staleInStore: 0 },
  });
  assert.equal(status, "INACTIF");
});

test("memory report: derive status VIOLATION on contract breach", () => {
  const status = deriveMemoryGovernanceStatus({
    kpis: { memoryGateHealthy: false, noStaleActive: true, governanceReady: false },
    today: { ingestAttempts: 2, staleInStore: 0 },
  });
  assert.equal(status, "VIOLATION");
});

test("memory report: computeMemoryTrend detects improvement", () => {
  const trend = computeMemoryTrend([
    { day: "2026-05-21", globalScore: 80 },
    { day: "2026-05-28", globalScore: 95 },
  ]);
  assert.equal(trend.direction, "up");
  assert.equal(trend.delta, 15);
});

test("memory report: markdown contains KPI table", () => {
  const md = buildMemoryGovernanceMarkdown({
    dateFr: "28/05/2026",
    status: "INACTIF",
    score: 100,
    snapshot: { today: { ingestAttempts: 0, promotionRatePct: 0 }, distribution: {} },
    trend: [],
    trendLabel: "Données insuffisantes",
    trendDelta: 0,
    refusalLines: "- Aucun refus.\n",
    eventLines: "- Aucun événement.\n",
    tierLines: "- Store actif: **0**",
    recommendation: "Pipeline inactif.",
    generatedAt: new Date().toISOString(),
  });
  assert.ok(md.includes("Rapport Gouvernance Mémoire"));
  assert.ok(md.includes("Taux promotion"));
});
