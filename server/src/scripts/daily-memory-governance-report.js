#!/usr/bin/env node
/**
 * Rapport quotidien — gouvernance mémoire La Citadelle v1.
 *
 * Usage:
 *   node server/src/scripts/daily-memory-governance-report.js
 *   npm run memory:daily-report
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { buildMemoryGovernanceSnapshot } from "../agent/memory/guardianship/memoryGovernanceMetrics.js";
import {
  readMemoryGovernanceHistory,
  upsertMemoryGovernanceDailySnapshot,
} from "../agent/memory/guardianship/memoryGovernancePersistor.js";
import {
  buildMemoryGovernanceMarkdown,
  buildMemoryGovernanceRecommendation,
  computeMemoryTrend,
  deriveMemoryGovernanceStatus,
} from "../agent/memory/guardianship/memoryGovernanceReport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const REPORTS_DIR = path.join(
  ROOT,
  "citadelle-vault",
  "Citadelle",
  "04-Operations",
  "reports",
);
const JSON_REPORTS_DIR = path.join(
  ROOT,
  "server",
  "data",
  "memory",
  "governance",
  "reports",
);

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

async function main() {
  const now = new Date();
  const day = dayKey(now);
  const dateFr = formatDateFr(now);
  const history = readMemoryGovernanceHistory(7);
  const snapshot = buildMemoryGovernanceSnapshot({ eventLimit: 500 });
  const status = deriveMemoryGovernanceStatus(snapshot);
  const score = snapshot.globalScore ?? 0;
  const trend = computeMemoryTrend(history.daily);
  const todayEvents = history.events.filter((e) => isToday(e.at));

  const refusalLines =
    snapshot.refusalReasons.length === 0
      ? "- Aucun refus enregistré aujourd'hui.\n"
      : snapshot.refusalReasons
          .slice(0, 8)
          .map((r) => `- \`${r.reason}\` · ${r.count} occurrence(s)`)
          .join("\n");

  const eventLines =
    todayEvents.length === 0
      ? "- Aucun événement mémoire aujourd'hui.\n"
      : todayEvents
          .slice(0, 12)
          .map(
            (e) =>
              `- \`${e.status}\`${e.target ? ` → ${e.target}` : ""}${e.reasons?.length ? ` · ${e.reasons.slice(0, 2).join(", ")}` : ""} · ${new Date(e.at).toLocaleString("fr-FR")}`,
          )
          .join("\n");

  const dist = snapshot.distribution || {};
  const tierLines = [
    `- Store actif: **${dist.storeActive ?? 0}**`,
    `- Episodic: **${dist.episodicFiles ?? 0}**`,
    `- Semantic: **${dist.semanticFacts ?? 0}**`,
    `- Heritage proposés (auto v1): **${dist.heritageProposed ?? 0}**`,
    `- Promotions du jour: episodic ${dist.promotedToday?.episodic ?? 0}, semantic ${dist.promotedToday?.semantic ?? 0}, heritage ${dist.promotedToday?.heritage ?? 0}`,
  ].join("\n");

  const recommendation = buildMemoryGovernanceRecommendation(snapshot, status);

  const report = {
    generatedAt: now.toISOString(),
    dateFr,
    day,
    status,
    score,
    globalScore: score,
    snapshot,
    trend: history.daily,
    trendLabel: trend.label,
    trendDelta: trend.delta,
    todayEvents,
    recommendation,
    refusalLines,
    eventLines,
    tierLines,
  };

  upsertMemoryGovernanceDailySnapshot({
    day,
    globalScore: score,
    status,
    ingestAttempts: snapshot.today.ingestAttempts,
    committed: snapshot.today.committed,
    promoted: snapshot.today.promoted,
    precheckRefused: snapshot.today.precheckRefused,
    promotionRefused: snapshot.today.promotionRefused,
    promotionRatePct: snapshot.today.promotionRatePct,
    staleInStore: snapshot.today.staleInStore,
    contractViolations: snapshot.today.contractViolations,
    distribution: snapshot.distribution,
    refusalReasons: snapshot.refusalReasons,
  });

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.mkdirSync(JSON_REPORTS_DIR, { recursive: true });

  const mdPath = path.join(
    REPORTS_DIR,
    `Rapport-Gouvernance-Memoire-${day}.md`,
  );
  const jsonPath = path.join(JSON_REPORTS_DIR, `memory-governance-report-${day}.json`);

  fs.writeFileSync(mdPath, buildMemoryGovernanceMarkdown(report), "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n--- RAPPORT QUOTIDIEN GOUVERNANCE MÉMOIRE ---");
  console.log(`Date: ${dateFr}`);
  console.log(`Statut: ${status}`);
  console.log(`Score: ${score}/100`);
  console.log(`Promotions: ${snapshot.today.promoted} | Refus precheck: ${snapshot.today.precheckRefused} | Refus promo: ${snapshot.today.promotionRefused}`);
  console.log(`Markdown: ${mdPath}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Recommandation: ${recommendation}\n`);
}

main();
