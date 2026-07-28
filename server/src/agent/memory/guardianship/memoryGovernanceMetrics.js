import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { isRetentionStale } from "./memoryPromotionPolicy.js";
import { readMemoryGovernanceEvents } from "./memoryGovernancePersistor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_ROOT = path.resolve(__dirname, "../../../../data/memory");
const STORE_PATH = path.resolve(__dirname, "../../../../data/citadel_memory.jsonl");

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function countJsonFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
}

/** Compte uniquement les principes issus de la promotion auto v1 (pas l'historique procedural). */
export function countAutoPromotedHeritageFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    if (file.includes("_PROMOTED_")) {
      count++;
      continue;
    }
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      if (
        data.promotion_tier === "heritage" &&
        data.policyVersion === "memory_promotion_v1"
      ) {
        count++;
      }
    } catch {
      // ignore invalid json
    }
  }
  return count;
}

function readStoreMemories(limit = 500) {
  if (!fs.existsSync(STORE_PATH)) return [];
  return fs
    .readFileSync(STORE_PATH, "utf8")
    .split("\n")
    .filter(Boolean)
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function aggregateRefusalReasons(events) {
  const counts = {};
  for (const ev of events) {
    const reasons = ev.reasons || [];
    for (const reason of reasons) {
      counts[reason] = (counts[reason] || 0) + 1;
    }
    if (ev.reason && !reasons.length) {
      counts[ev.reason] = (counts[ev.reason] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count }));
}

function computeGovernanceScore(today) {
  let score = 100;
  if (today.contractViolations > 0) score -= today.contractViolations * 15;
  if (today.streamLikeErrors > 0) score -= today.streamLikeErrors * 10;
  const attempts = today.ingestAttempts || 0;
  if (attempts > 0) {
    const refuseRate =
      ((today.precheckRefused + today.promotionRefused) / attempts) * 100;
    if (refuseRate > 80) score -= 10;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Agrège métriques mémoire pour observabilité cockpit.
 */
export function buildMemoryGovernanceSnapshot(options = {}) {
  const eventLimit = options.eventLimit || 200;
  const allEvents = readMemoryGovernanceEvents(eventLimit);
  const todayEvents = allEvents.filter((e) => isToday(e.at));

  const today = {
    ingestAttempts: 0,
    committed: 0,
    skipped: 0,
    precheckRefused: 0,
    promotionRefused: 0,
    promoted: 0,
    contractViolations: 0,
    staleRefusals: 0,
    streamLikeErrors: 0,
  };

  const tierCounts = { episodic: 0, semantic: 0, heritage: 0 };

  for (const ev of todayEvents) {
    switch (ev.status) {
      case "rejected_precheck":
        today.precheckRefused++;
        today.ingestAttempts++;
        break;
      case "skipped":
        today.skipped++;
        today.ingestAttempts++;
        break;
      case "committed":
        today.committed++;
        today.ingestAttempts++;
        break;
      case "promotion_refused":
        today.promotionRefused++;
        break;
      case "promoted":
        today.promoted++;
        if (ev.target && tierCounts[ev.target] !== undefined) {
          tierCounts[ev.target]++;
        }
        break;
      case "contract_violation":
        today.contractViolations++;
        today.ingestAttempts++;
        break;
      default:
        break;
    }

    if ((ev.reasons || []).includes("retention_stale")) {
      today.staleRefusals++;
    }
  }

  const promotionDenominator = today.promoted + today.promotionRefused;
  const promotionRatePct =
    promotionDenominator > 0
      ? Number(((today.promoted / promotionDenominator) * 100).toFixed(1))
      : 0;

  const storeMemories = readStoreMemories();
  const staleInStore = storeMemories.filter(
    (m) => m.status === "active" && isRetentionStale(m.retention),
  ).length;

  const distribution = {
    storeActive: storeMemories.filter((m) => m.status === "active").length,
    episodicFiles: countJsonFiles(path.join(MEMORY_ROOT, "episodic")),
    semanticFacts: countJsonFiles(path.join(MEMORY_ROOT, "semantic", "facts")),
    heritageProposed: countAutoPromotedHeritageFiles(
      path.join(MEMORY_ROOT, "procedural"),
    ),
    proceduralTotal: countJsonFiles(path.join(MEMORY_ROOT, "procedural")),
    promotedToday: tierCounts,
  };

  const globalScore = computeGovernanceScore(today);

  return {
    at: new Date().toISOString(),
    today: {
      ...today,
      promotionRatePct,
      staleInStore,
    },
    distribution,
    refusalReasons: aggregateRefusalReasons(
      todayEvents.filter(
        (e) =>
          e.status === "rejected_precheck" || e.status === "promotion_refused",
      ),
    ),
    recentEvents: allEvents.slice(0, 12).map((e) => ({
      at: e.at,
      status: e.status,
      target: e.target || null,
      reasons: e.reasons || (e.reason ? [e.reason] : []),
      memoryId: e.memoryId || null,
      pipelineMode: e.pipelineMode || null,
    })),
    globalScore,
    kpis: {
      memoryGateHealthy: today.contractViolations === 0,
      promotionFlowActive: today.promoted > 0 || today.promotionRefused > 0,
      noStaleActive: staleInStore === 0,
      governanceReady: globalScore >= 85,
    },
  };
}

export default { buildMemoryGovernanceSnapshot };
