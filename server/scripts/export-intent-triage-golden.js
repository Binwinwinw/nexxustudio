#!/usr/bin/env node
/**
 * Exporte server/data/intent-triage/clarification-feedback.jsonl
 * vers server/tests/fixtures/intentTriageGoldenExported.js
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportIntentTriageGolden } from "../src/agent/classifiers/intentTriageFeedbackExporter.js";
import { INTENT_TRIAGE_BASELINE_QUERIES } from "../tests/fixtures/intentTriageGoldenQueries.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(
  __dirname,
  "../tests/fixtures/intentTriageGoldenExported.js",
);

import {
  loadGoldenCasesFromFeedback,
  mergeGoldenCases,
} from "../src/agent/classifiers/intentTriageFeedbackExporter.js";

const dryRun = process.argv.includes("--dry-run");

if (dryRun) {
  const fromFeedback = loadGoldenCasesFromFeedback();
  const merged = mergeGoldenCases(INTENT_TRIAGE_BASELINE_QUERIES, fromFeedback);
  console.log(
    `[dry-run] ${fromFeedback.length} entrée(s) feedback, ${merged.length} cas golden fusionnés.`,
  );
  for (const item of merged) {
    console.log(`  - ${item.id} → ${item.expectedTopIntent || "?"} (${item.category})`);
  }
  process.exit(0);
}

const result = exportIntentTriageGolden({
  outputPath: OUTPUT_PATH,
  existingCases: INTENT_TRIAGE_BASELINE_QUERIES,
});

console.log(`✅ Export golden triage : ${result.outputPath}`);
console.log(
  `   feedback: ${result.feedbackPath} | importés: ${result.imported} | total: ${result.total}`,
);
