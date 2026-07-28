#!/usr/bin/env node
/**
 * Rapport Ops quotidien fusionné (1 page) — conversation + mémoire.
 *
 * Usage:
 *   node server/src/scripts/daily-ops-report.js
 *   npm run ops:daily-report
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import {
  computeHealthScore,
  evaluateQualityGate,
} from "../agent/telemetry/conversationHealthScore.js";
import {
  readConversationHealthHistory,
  upsertDailySnapshot,
} from "../agent/telemetry/conversationHealthPersistor.js";
import { getSecurityTelemetry } from "../services/securityTelemetryService.js";
import { buildMemoryGovernanceSnapshot } from "../agent/memory/guardianship/memoryGovernanceMetrics.js";
import {
  readMemoryGovernanceHistory,
  upsertMemoryGovernanceDailySnapshot,
} from "../agent/memory/guardianship/memoryGovernancePersistor.js";
import {
  buildMemoryGovernanceRecommendation,
  computeMemoryTrend,
} from "../agent/memory/guardianship/memoryGovernanceReport.js";
import {
  buildDailyOpsMarkdown,
  buildOpsExecutiveSummary,
  buildOpsVerdict,
  computeOpsGlobalScore,
  deriveOpsGlobalStatus,
  OPS_ALERT_THRESHOLDS_V1,
} from "../agent/ops/dailyOpsReportBuilder.js";
import {
  deriveConversationOpsStatus,
  deriveMemoryOpsStatus,
  evaluateOpsAlerts,
} from "../agent/ops/opsAlertThresholds.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const REPORTS_DIR = path.join(
  ROOT,
  "citadelle-vault",
  "Citadelle",
  "04-Operations",
  "reports",
);
const JSON_OPS_DIR = path.join(ROOT, "server", "data", "ops", "reports");

function formatDateFr(date = new Date()) {
  const jj = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const aaaa = date.getFullYear();
  return `${jj}/${mm}/${aaaa}`;
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function isToday(iso) {
  return iso?.slice(0, 10) === dayKey();
}

function deriveConversationStatus(metrics, score, qualityGatePass) {
  return deriveConversationOpsStatus(metrics, score, qualityGatePass);
}

function computeConversationTrend(daily) {
  if (daily.length < 2) {
    return { direction: "stable", delta: 0, label: "Données insuffisantes" };
  }
  const first = daily[0].globalScore ?? 0;
  const last = daily[daily.length - 1].globalScore ?? 0;
  const delta = last - first;
  if (delta > 3) return { direction: "up", delta, label: "Amélioration" };
  if (delta < -3) return { direction: "down", delta, label: "Dérive détectée" };
  return { direction: "stable", delta, label: "Stable" };
}

function buildConversationRecommendation(status, trend, evaluation) {
  if (status === "INCIDENT") {
    return "Incident stream: vérifier parseur thinking et SIMPLE_FAST.";
  }
  if (status === "DEGRADE") {
    return "Dégradation KPI: exécuter quality:gate en live.";
  }
  if (trend.direction === "down") {
    return "Score conversation en baisse sur 7j.";
  }
  if (!evaluation.pass) {
    return "Seuils KPI non conformes malgré statut nominal.";
  }
  return "Conversation stable.";
}

async function main() {
  const now = new Date();
  const day = dayKey(now);
  const dateFr = formatDateFr(now);

  const convHistory = readConversationHealthHistory(7);
  const memHistory = readMemoryGovernanceHistory(7);
  const memSnapshot = buildMemoryGovernanceSnapshot({ eventLimit: 500 });
  const security = getSecurityTelemetry();

  const convMetrics =
    convHistory.daily[convHistory.daily.length - 1]?.metrics || {
      streams: 0,
      noVisibleTokens: 0,
      fallbackTriggered: 0,
      streamErrors: 0,
      fallbackRatePct: 0,
      streamErrorCount: 0,
    };

  const convScore = computeHealthScore(convMetrics);
  const convEvaluation = evaluateQualityGate(convMetrics);
  const convStatus = deriveConversationStatus(
    convMetrics,
    convScore,
    convEvaluation.pass,
  );
  const convTrend = computeConversationTrend(convHistory.daily);

  const curatedMemoryIngest = process.env.CURATED_MEMORY_INGEST === "1";
  const memStatus = deriveMemoryOpsStatus(memSnapshot, { curatedMemoryIngest });
  const memScore = memSnapshot.globalScore ?? 0;
  const memTrend = computeMemoryTrend(memHistory.daily);
  const memoryTodayEvents = memHistory.events.filter((e) => isToday(e.at));

  const opsScore = computeOpsGlobalScore(convScore, memScore);
  const opsStatus = deriveOpsGlobalStatus(convStatus, memStatus, opsScore);
  const opsVerdict = buildOpsVerdict(opsStatus, convStatus, memStatus);
  const alerts = evaluateOpsAlerts({
    conversationMetrics: convMetrics,
    conversationScore: convScore,
    qualityGatePass: convEvaluation.pass,
    memorySnapshot: memSnapshot,
    opsScore,
    curatedMemoryIngest,
  });

  const conversation = {
    status: convStatus,
    score: convScore,
    metrics: convMetrics,
    qualityGateReady: convEvaluation.pass,
    trendLabel: convTrend.label,
    trendDelta: convTrend.delta,
    incidents: convHistory.incidents,
    recommendation: buildConversationRecommendation(
      convStatus,
      convTrend,
      convEvaluation,
    ),
  };

  const memory = {
    status: memStatus,
    score: memScore,
    today: memSnapshot.today,
    distribution: memSnapshot.distribution,
    refusalReasons: memSnapshot.refusalReasons,
    kpis: memSnapshot.kpis,
    trendLabel: memTrend.label,
    trendDelta: memTrend.delta,
    recommendation: buildMemoryGovernanceRecommendation(memSnapshot, memStatus),
  };

  const ops = { status: opsStatus, score: opsScore, verdict: opsVerdict };

  const report = {
    generatedAt: now.toISOString(),
    dateFr,
    day,
    conversation,
    memory,
    ops,
    security: {
      auditPassRate: security.audit?.passRate,
      auditTotalRuns: security.audit?.totalRuns,
    },
    memoryTodayEvents,
    executiveActions: [],
    alerts,
    thresholds: OPS_ALERT_THRESHOLDS_V1,
  };

  report.executiveActions = buildOpsExecutiveSummary(report);

  upsertDailySnapshot({
    day,
    globalScore: convScore,
    status: convStatus,
    streams: convMetrics.streams ?? 0,
    noVisibleTokens: convMetrics.noVisibleTokens ?? 0,
    fallbackRatePct: convMetrics.fallbackRatePct ?? 0,
    streamErrorCount: convMetrics.streamErrorCount ?? convMetrics.streamErrors ?? 0,
    metrics: convMetrics,
  });

  upsertMemoryGovernanceDailySnapshot({
    day,
    globalScore: memScore,
    status: memStatus,
    ingestAttempts: memSnapshot.today.ingestAttempts,
    committed: memSnapshot.today.committed,
    promoted: memSnapshot.today.promoted,
    precheckRefused: memSnapshot.today.precheckRefused,
    promotionRefused: memSnapshot.today.promotionRefused,
    promotionRatePct: memSnapshot.today.promotionRatePct,
    staleInStore: memSnapshot.today.staleInStore,
    contractViolations: memSnapshot.today.contractViolations,
    distribution: memSnapshot.distribution,
    refusalReasons: memSnapshot.refusalReasons,
  });

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.mkdirSync(JSON_OPS_DIR, { recursive: true });

  const mdPath = path.join(REPORTS_DIR, `Rapport-Ops-Quotidien-${day}.md`);
  const jsonPath = path.join(JSON_OPS_DIR, `ops-report-${day}.json`);

  fs.writeFileSync(mdPath, buildDailyOpsMarkdown(report), "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n--- RAPPORT OPS QUOTIDIEN (FUSIONNÉ) ---");
  console.log(`Date: ${dateFr}`);
  console.log(`Ops global: ${opsStatus} (${opsScore}/100)`);
  console.log(`Conversation: ${convStatus} (${convScore}/100)`);
  console.log(`Mémoire: ${memStatus} (${memScore}/100)`);
  console.log(`Markdown: ${mdPath}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Actions: ${report.executiveActions.join(" | ")}\n`);
}

main();
