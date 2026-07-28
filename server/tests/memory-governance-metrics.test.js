import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { buildMemoryGovernanceSnapshot, countAutoPromotedHeritageFiles } from "../src/agent/memory/guardianship/memoryGovernanceMetrics.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROCEDURAL_DIR = path.resolve(__dirname, "../data/memory/procedural");

test("memory governance: snapshot exposes core KPI shape", () => {
  const snap = buildMemoryGovernanceSnapshot();
  assert.ok(snap.today);
  assert.ok(snap.distribution);
  assert.ok(Array.isArray(snap.refusalReasons));
  assert.ok(Array.isArray(snap.recentEvents));
  assert.equal(typeof snap.globalScore, "number");
  assert.equal(typeof snap.kpis.governanceReady, "boolean");
});

test("memory governance: today counters are non-negative", () => {
  const { today } = buildMemoryGovernanceSnapshot();
  assert.ok(today.ingestAttempts >= 0);
  assert.ok(today.promotionRatePct >= 0);
  assert.ok(today.staleInStore >= 0);
});

test("memory governance: distribution includes tier buckets", () => {
  const { distribution } = buildMemoryGovernanceSnapshot();
  assert.equal(typeof distribution.storeActive, "number");
  assert.equal(typeof distribution.episodicFiles, "number");
  assert.equal(typeof distribution.semanticFacts, "number");
  assert.equal(typeof distribution.heritageProposed, "number");
  assert.equal(typeof distribution.proceduralTotal, "number");
  assert.ok(distribution.heritageProposed <= distribution.proceduralTotal);
});

test("memory governance: heritageProposed excludes legacy procedural files", () => {
  const autoCount = countAutoPromotedHeritageFiles(PROCEDURAL_DIR);
  const total = fs.readdirSync(PROCEDURAL_DIR).filter((f) => f.endsWith(".json")).length;
  assert.ok(autoCount <= total);
  assert.equal(autoCount, 0, "no auto-promoted heritage v1 files yet in fixture data");
});
