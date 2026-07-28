import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const MEMOIRE_PATH = path.join(
  ROOT,
  "citadelle-vault",
  "Citadelle",
  "05-Knowledge",
  "heritage",
  "Memoire-des-Erreurs.md",
);
const AUDIT_HISTORY_PATH = path.join(
  ROOT,
  "server",
  "data",
  "security",
  "audit-history.jsonl",
);

const SECURITY_MOTIFS = new Set([
  "security_regression",
  "failed_security_audit",
]);

function parseMotifsFromLine(line) {
  const raw = line.replace("- **Motif de Rejet** :", "").trim();
  return raw
    .split("/")
    .map((m) => m.trim().replace(/`/g, ""))
    .filter(Boolean);
}

function parseMemoire(content) {
  const incidents = [];
  const motifCounts = {};
  const blocks = content.split(/^### Incident :/m).slice(1);

  for (const block of blocks) {
    const headerLine = block.split("\n")[0] || "";
    const isSecurity =
      block.includes("security_regression") ||
      block.includes("failed_security_audit") ||
      headerLine.includes("Régression audit sécurité");

    let commit = null;
    const commitMeta = block.match(/commit `?([a-f0-9]+)`?/i);
    if (commitMeta) commit = commitMeta[1];

    const dateMatch = headerLine.match(/^(.+?)\s*-\s*(.+)$/);
    const dateLabel = dateMatch ? dateMatch[1].trim() : headerLine.trim();
    const title = dateMatch ? dateMatch[2].trim() : headerLine.trim();

    const motifs = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("- **Motif de Rejet**")) {
        motifs.push(...parseMotifsFromLine(line));
      }
    }
    motifs.forEach((m) => {
      motifCounts[m] = (motifCounts[m] || 0) + 1;
    });

    incidents.push({
      dateLabel,
      title,
      isSecurity,
      commit,
      motifs,
    });
  }

  return {
    totalIncidents: incidents.length,
    securityIncidents: incidents.filter((i) => i.isSecurity).length,
    incidents: incidents.slice(-15).reverse(),
    motifCounts,
  };
}

function readAuditHistory(limit = 50) {
  if (!fs.existsSync(AUDIT_HISTORY_PATH)) {
    return { runs: [], passRate: null };
  }

  const lines = fs
    .readFileSync(AUDIT_HISTORY_PATH, "utf8")
    .split("\n")
    .filter(Boolean);

  const runs = lines
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const passCount = runs.filter((r) => r.pass).length;
  const passRate =
    runs.length > 0 ? Math.round((passCount / runs.length) * 100) : null;

  return {
    runs: runs.reverse(),
    passRate,
    totalRuns: runs.length,
    passCount,
    failCount: runs.length - passCount,
  };
}

export function appendAuditHistory(entry) {
  const dir = path.dirname(AUDIT_HISTORY_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(AUDIT_HISTORY_PATH, `${JSON.stringify(entry)}\n`, "utf8");
}

export function getSecurityTelemetry() {
  let memoire = {
    totalIncidents: 0,
    securityIncidents: 0,
    incidents: [],
    motifCounts: {},
  };

  if (fs.existsSync(MEMOIRE_PATH)) {
    memoire = parseMemoire(fs.readFileSync(MEMOIRE_PATH, "utf8"));
  }

  const audit = readAuditHistory(80);
  const lastPass = audit.runs.find((r) => r.pass);
  const lastFail = audit.runs.find((r) => !r.pass);

  const securityMotifs = Object.entries(memoire.motifCounts)
    .filter(([k]) => SECURITY_MOTIFS.has(k) || k.includes("security"))
    .map(([name, value]) => ({ name, value }));

  const topMotifs = Object.entries(memoire.motifCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  return {
    generatedAt: new Date().toISOString(),
    memoire: {
      path: "citadelle-vault/Citadelle/05-Knowledge/heritage/Memoire-des-Erreurs.md",
      totalIncidents: memoire.totalIncidents,
      securityIncidents: memoire.securityIncidents,
      recentIncidents: memoire.incidents,
    },
    audit: {
      passRate: audit.passRate,
      totalRuns: audit.totalRuns,
      passCount: audit.passCount,
      failCount: audit.failCount,
      lastPass: lastPass || null,
      lastFail: lastFail || null,
      recentRuns: audit.runs.slice(0, 20),
    },
    charts: {
      topMotifs,
      securityMotifs,
    },
  };
}

export default { getSecurityTelemetry, appendAuditHistory };
