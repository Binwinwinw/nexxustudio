import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../../data/conversation");
const INCIDENTS_PATH = path.join(DATA_DIR, "health-incidents.jsonl");
const DAILY_PATH = path.join(DATA_DIR, "health-daily.jsonl");
const GATE_HISTORY_PATH = path.join(DATA_DIR, "quality-gate-history.jsonl");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function appendJsonl(filePath, entry) {
  ensureDir();
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf8");
}

function readJsonl(filePath, limit = 200) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
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

export function appendHealthIncident(incident) {
  appendJsonl(INCIDENTS_PATH, {
    ts: new Date().toISOString(),
    ...incident,
  });
}

export function appendQualityGateRun(report) {
  appendJsonl(GATE_HISTORY_PATH, {
    ts: report.at || new Date().toISOString(),
    verdict: report.verdict,
    globalScore: report.globalScore,
    steps: (report.steps || []).map((s) => ({
      id: s.id,
      pass: s.pass,
      score: s.score,
    })),
    failures: report.steps?.find((s) => s.id === "kpi_thresholds")?.failures || [],
  });
}

export function upsertDailySnapshot(snapshot) {
  ensureDir();
  const day = snapshot.day;
  const history = readJsonl(DAILY_PATH, 500).filter((row) => row.day !== day);
  history.push({ ...snapshot, recordedAt: new Date().toISOString() });
  fs.writeFileSync(
    DAILY_PATH,
    `${history.map((row) => JSON.stringify(row)).join("\n")}\n`,
    "utf8",
  );
}

export function readConversationHealthHistory(days = 7) {
  const daily = readJsonl(DAILY_PATH, days * 2).slice(-days);
  const incidents = readJsonl(INCIDENTS_PATH, 100).reverse();
  const gateRuns = readJsonl(GATE_HISTORY_PATH, 50).reverse();

  return { daily, incidents, gateRuns };
}

export default {
  appendHealthIncident,
  appendQualityGateRun,
  upsertDailySnapshot,
  readConversationHealthHistory,
};
