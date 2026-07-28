import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  buildIntentTriageDashboardPayload,
  loadLatestAnalysisReport,
} from "../src/services/intentTriageDashboardService.js";
import { analyzeIntentTriageAmbiguous } from "../src/agent/classifiers/intentTriageAmbiguousAnalyzer.js";

describe("intentTriageDashboardService", () => {
  it("produit un payload dashboard structuré", () => {
    const payload = buildIntentTriageDashboardPayload({ refresh: true });
    assert.ok(payload.summary);
    assert.ok(payload.confidence_distribution);
    assert.ok(Array.isArray(payload.ambiguous_pairs));
    assert.ok(Array.isArray(payload.recommendations));
    assert.ok(Array.isArray(payload.recent_feedback));
    assert.equal(payload.question, "Où enrichir les règles ensuite ?");
  });

  it("charge le dernier rapport JSON si présent", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-report-"));
    const report = analyzeIntentTriageAmbiguous({
      feedbackPath: path.join(tmpDir, "missing.jsonl"),
      jsonOutputDir: tmpDir,
      writeReports: true,
    });

    const loaded = loadLatestAnalysisReport(tmpDir);
    assert.ok(loaded);
    assert.equal(loaded.schema_version, "intent_triage_ambiguous_v1");
    assert.ok(report.output?.jsonPath);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
