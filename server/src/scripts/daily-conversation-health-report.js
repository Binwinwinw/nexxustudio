#!/usr/bin/env node
/**
 * Rapport quotidien synthétique — santé conversationnelle La Citadelle.
 *
 * Usage:
 *   node server/src/scripts/daily-conversation-health-report.js
 *   npm run conversation:daily-report
 *
 * Optionnel: QUALITY_GATE_LIVE=1 pour inclure métriques runtime live.
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const REPORTS_DIR = path.join(
  ROOT,
  "citadelle-vault",
  "Citadelle",
  "04-Operations",
  "reports",
);
const JSON_REPORTS_DIR = path.join(ROOT, "server", "data", "conversation", "reports");

function formatDateFr(date = new Date()) {
  const jj = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const aaaa = date.getFullYear();
  return `${jj}/${mm}/${aaaa}`;
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function deriveGlobalStatus(metrics, score) {
  const noVisible = metrics.noVisibleTokens ?? 0;
  const streamErrors = metrics.streamErrorCount ?? metrics.streamErrors ?? 0;
  const fallbackRate = metrics.fallbackRatePct ?? 0;

  if (noVisible > 0 || streamErrors > 0) return "INCIDENT";
  if (fallbackRate >= 1 || score < 85) return "DEGRADE";
  return "OK";
}

function computeTrend(daily) {
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

async function fetchLiveMetrics() {
  if (process.env.QUALITY_GATE_LIVE !== "1") return null;
  const baseUrl =
    process.env.QUALITY_GATE_API_URL ||
    process.env.VITE_API_BASE_URL ||
    "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/conversation/health`, {
      credentials: "include",
      headers: process.env.QUALITY_GATE_API_TOKEN
        ? { "X-API-Token": process.env.QUALITY_GATE_API_TOKEN }
        : {},
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      source: "live",
      today: data.health?.today || {},
      globalScore: data.globalScore,
      recentIncidents: data.health?.recentIncidents || [],
    };
  } catch {
    return null;
  }
}

function buildMarkdown(report) {
  const { dateFr, status, score, metrics, trend, incidents, gateRuns, security } =
    report;

  const incidentLines =
    incidents.length === 0
      ? "- Aucun incident récent.\n"
      : incidents
          .slice(0, 5)
          .map(
            (i) =>
              `- \`${i.type}\` · ${i.mode || "unknown"} · ${i.reason || "n/a"} · ${new Date(i.at || i.ts).toLocaleString("fr-FR")}`,
          )
          .join("\n");

  const trendLines =
    report.dailyTrend.length === 0
      ? "- Historique insuffisant.\n"
      : report.dailyTrend
          .map(
            (d) =>
              `- ${d.day}: score **${d.globalScore}** · streams ${d.streams} · fallback ${d.fallbackRatePct}%`,
          )
          .join("\n");

  const gateLines =
    gateRuns.length === 0
      ? "- Aucune exécution quality:gate persistée.\n"
      : gateRuns
          .slice(0, 5)
          .map(
            (g) =>
              `- ${new Date(g.ts).toLocaleString("fr-FR")}: **${g.verdict}** (score ${g.globalScore})`,
          )
          .join("\n");

  return `# Rapport Santé Conversationnelle — ${dateFr}

**Statut global** : ${status}  
**Score santé** : ${score}/100  
**Source métriques** : ${report.metricsSource}  
**Tendance 7j** : ${trend.label} (${trend.delta >= 0 ? "+" : ""}${trend.delta})

## KPI du jour

| Indicateur | Valeur | Seuil |
|---|---:|---|
| Streams | ${metrics.streams ?? 0} | — |
| No visible tokens | ${metrics.noVisibleTokens ?? 0} | 0 |
| Fallback rate | ${metrics.fallbackRatePct ?? 0}% | < 1% |
| Stream errors | ${metrics.streamErrorCount ?? metrics.streamErrors ?? 0} | 0 |
| Quality gate ready | ${report.qualityGateReady ? "oui" : "non"} | oui |

## Tendance scores (7 derniers jours)

${trendLines}

## 5 derniers incidents conversationnels

${incidentLines}

## Exécutions quality:gate récentes

${gateLines}

## Signal sécurité (audit local)

- Taux PASS audit: **${security.audit.passRate ?? "n/a"}%**
- Runs totaux: ${security.audit.totalRuns}
- Dernier PASS: ${security.audit.lastPass?.ts || "n/a"}
- Dernier FAIL: ${security.audit.lastFail?.ts || "n/a"}

## Recommandation

${report.recommendation}

---
*Généré automatiquement par \`npm run conversation:daily-report\` — ${report.generatedAt}*
`;
}

function buildRecommendation(status, trend, evaluation) {
  if (status === "INCIDENT") {
    return "Incident actif: investiguer le parseur stream/thinking et vérifier SIMPLE_FAST avant toute évolution pipeline.";
  }
  if (status === "DEGRADE") {
    return "Dégradation détectée: exécuter `npm run quality:gate` en mode live et contrôler fallbackRate + contrat de réponse.";
  }
  if (trend.direction === "down") {
    return "Score en baisse sur 7j: surveiller les incidents récurrents et renforcer les tests de non-régression.";
  }
  if (!evaluation.pass) {
    return "Seuils KPI non conformes malgré un statut nominal: ajuster prompts ou runtime avant release.";
  }
  return "Système stable. Continuer le suivi quotidien et conserver quality:gate dans la chaîne pre-commit.";
}

async function main() {
  const now = new Date();
  const day = dayKey(now);
  const dateFr = formatDateFr(now);
  const history = readConversationHealthHistory(7);
  const live = await fetchLiveMetrics();
  const security = getSecurityTelemetry();

  const metrics = live?.today ||
    history.daily[history.daily.length - 1]?.metrics || {
      streams: 0,
      noVisibleTokens: 0,
      fallbackTriggered: 0,
      streamErrors: 0,
      fallbackRatePct: 0,
      streamErrorCount: 0,
    };

  const score = live?.globalScore ?? computeHealthScore(metrics);
  const evaluation = evaluateQualityGate(metrics);
  const status = deriveGlobalStatus(metrics, score);
  const trend = computeTrend(history.daily);

  const report = {
    generatedAt: now.toISOString(),
    dateFr,
    day,
    status,
    score,
    globalScore: score,
    metrics,
    metricsSource: live ? "live" : "persisted_or_baseline",
    qualityGateReady: evaluation.pass,
    trend,
    dailyTrend: history.daily,
    incidents: live?.recentIncidents?.length
      ? live.recentIncidents
      : history.incidents,
    gateRuns: history.gateRuns,
    security,
    recommendation: buildRecommendation(status, trend, evaluation),
  };

  upsertDailySnapshot({
    day,
    globalScore: score,
    status,
    streams: metrics.streams ?? 0,
    noVisibleTokens: metrics.noVisibleTokens ?? 0,
    fallbackRatePct: metrics.fallbackRatePct ?? 0,
    streamErrorCount: metrics.streamErrorCount ?? metrics.streamErrors ?? 0,
    metrics,
  });

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.mkdirSync(JSON_REPORTS_DIR, { recursive: true });

  const mdPath = path.join(
    REPORTS_DIR,
    `Rapport-Sante-Conversationnelle-${day}.md`,
  );
  const jsonPath = path.join(JSON_REPORTS_DIR, `health-report-${day}.json`);

  fs.writeFileSync(mdPath, buildMarkdown(report), "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n--- RAPPORT QUOTIDIEN SANTÉ CONVERSATIONNELLE ---");
  console.log(`Date: ${dateFr}`);
  console.log(`Statut: ${status}`);
  console.log(`Score: ${score}/100`);
  console.log(`Tendance: ${trend.label} (${trend.delta >= 0 ? "+" : ""}${trend.delta})`);
  console.log(`Markdown: ${mdPath}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Recommandation: ${report.recommendation}\n`);
}

main();
