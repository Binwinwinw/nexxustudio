/**
 * Initialise audit-history.jsonl avec des entrées de démonstration (PASS/FAIL).
 * N'écrase pas un fichier existant sauf si --force est passé.
 *
 * Usage:
 *   node server/src/scripts/seed-security-audit-history.js
 *   node server/src/scripts/seed-security-audit-history.js --force
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const HISTORY_PATH = path.join(ROOT, "server", "data", "security", "audit-history.jsonl");

const force = process.argv.includes("--force");

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10 + (n % 8), 30, 0, 0);
  return d.toISOString();
}

const SAMPLE_RUNS = [
  {
    ts: daysAgo(14),
    pass: true,
    git: { sha: "a1b2c3d", branch: "main" },
    steps: [
      { label: "citadel:audit", ok: true, status: 0 },
      { label: "test:security", ok: true, status: 0 },
    ],
    seed: true,
  },
  {
    ts: daysAgo(12),
    pass: true,
    git: { sha: "b2c3d4e", branch: "main" },
    steps: [
      { label: "citadel:audit", ok: true, status: 0 },
      { label: "test:security", ok: true, status: 0 },
    ],
    seed: true,
  },
  {
    ts: daysAgo(10),
    pass: false,
    git: { sha: "c3d4e5f", branch: "feat/security-hardening" },
    steps: [
      { label: "citadel:audit", ok: true, status: 0 },
      { label: "test:security", ok: false, status: 1 },
    ],
    seed: true,
  },
  {
    ts: daysAgo(8),
    pass: false,
    git: { sha: "c3d4e5f", branch: "feat/security-hardening" },
    steps: [
      { label: "citadel:audit", ok: false, status: 1 },
      { label: "test:security", ok: true, status: 0 },
    ],
    seed: true,
  },
  {
    ts: daysAgo(6),
    pass: true,
    git: { sha: "d4e5f6a", branch: "feat/security-hardening" },
    steps: [
      { label: "citadel:audit", ok: true, status: 0 },
      { label: "test:security", ok: true, status: 0 },
    ],
    seed: true,
  },
  {
    ts: daysAgo(4),
    pass: true,
    git: { sha: "e5f6a7b", branch: "main" },
    steps: [
      { label: "citadel:audit", ok: true, status: 0 },
      { label: "test:security", ok: true, status: 0 },
    ],
    seed: true,
  },
  {
    ts: daysAgo(2),
    pass: true,
    git: { sha: "f6a7b8c", branch: "main" },
    steps: [
      { label: "citadel:audit", ok: true, status: 0 },
      { label: "test:security", ok: true, status: 0 },
    ],
    seed: true,
  },
];

function main() {
  if (fs.existsSync(HISTORY_PATH) && !force) {
    const lines = fs.readFileSync(HISTORY_PATH, "utf8").trim().split("\n").filter(Boolean);
    console.log(
      `[seed-security] Historique existant (${lines.length} entrées) — rien à faire.`,
    );
    console.log("  Relancez avec --force pour remplacer par les données de démo.");
    process.exit(0);
  }

  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  const content = SAMPLE_RUNS.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.writeFileSync(HISTORY_PATH, content, "utf8");

  const pass = SAMPLE_RUNS.filter((r) => r.pass).length;
  const fail = SAMPLE_RUNS.length - pass;
  console.log(`[seed-security] ${SAMPLE_RUNS.length} entrées écrites → ${HISTORY_PATH}`);
  console.log(`  PASS: ${pass} · FAIL: ${fail} · taux: ${Math.round((pass / SAMPLE_RUNS.length) * 100)}%`);
}

main();
