import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../../../data/memory/governance");
const EVENTS_PATH = path.join(DATA_DIR, "governance-events.jsonl");
const DAILY_PATH = path.join(DATA_DIR, "governance-daily.jsonl");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function appendJsonl(filePath, entry) {
  ensureDir();
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf8");
}

function readJsonl(filePath, limit = 300) {
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

/**
 * Journalise un événement de gouvernance mémoire.
 */
export function recordMemoryGovernanceEvent(event) {
  appendJsonl(EVENTS_PATH, {
    at: new Date().toISOString(),
    ...event,
  });
}

export function readMemoryGovernanceEvents(limit = 200) {
  return readJsonl(EVENTS_PATH, limit).reverse();
}

export function upsertMemoryGovernanceDailySnapshot(snapshot) {
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

export function readMemoryGovernanceHistory(days = 7) {
  const daily = readJsonl(DAILY_PATH, days * 2).slice(-days);
  const events = readMemoryGovernanceEvents(100);
  return { daily, events };
}

export default {
  recordMemoryGovernanceEvent,
  readMemoryGovernanceEvents,
  upsertMemoryGovernanceDailySnapshot,
  readMemoryGovernanceHistory,
};
