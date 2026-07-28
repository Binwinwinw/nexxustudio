#!/usr/bin/env node
/**
 * Internalise les cas golden stables (N passages CI) vers la baseline manuelle.
 *
 * Usage:
 *   npm run triage:promote-golden
 *   npm run triage:promote-golden -- --min-count=3 --dry-run
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promoteStableGoldenCases } from "../src/agent/classifiers/intentTriageGoldenPromotion.js";
import { INTENT_TRIAGE_BASELINE_QUERIES } from "../tests/fixtures/intentTriageGoldenQueries.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORTED_FIXTURE = path.resolve(
  __dirname,
  "../tests/fixtures/intentTriageGoldenExported.js",
);

function parseArg(name, fallback) {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.split("=")[1];
}

const minCount = parseArg("min-count", "5");
const dryRun = process.argv.includes("--dry-run");

let exportedCases = [];
try {
  const mod = await import(pathToFileURL(EXPORTED_FIXTURE).href);
  exportedCases = mod.INTENT_TRIAGE_EXPORTED_QUERIES || [];
} catch {
  exportedCases = [];
}

const result = promoteStableGoldenCases({
  minCount,
  dryRun,
  baselineCases: INTENT_TRIAGE_BASELINE_QUERIES,
  exportedCases,
});

if (dryRun) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.log(`✅ Promotion golden triage (${result.promoted_count} cas)`);
if (result.report_path) {
  console.log(`   Rapport : ${result.report_path}`);
}
console.log(`   Baseline : ${result.baseline_path} (${result.next_baseline_count} cas)`);
console.log(`   Exporté  : ${result.exported_path} (${result.remaining_exported_count} cas)`);

if (result.promoted_count === 0) {
  console.log(
    `   Aucun cas éligible (seuil ci_pass_count >= ${result.min_count}).`,
  );
}
