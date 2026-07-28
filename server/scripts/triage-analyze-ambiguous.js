#!/usr/bin/env node
/**
 * Analyse les patterns ambigus du tri d'intention (local-first).
 *
 * Usage:
 *   npm run triage:analyze-ambiguous
 *   npm run triage:analyze-ambiguous -- --dry-run
 *   npm run triage:analyze-ambiguous -- --json-only
 */
import { analyzeIntentTriageAmbiguous } from "../src/agent/classifiers/intentTriageAmbiguousAnalyzer.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const jsonOnly = args.has("--json-only");

const analysis = analyzeIntentTriageAmbiguous({
  writeReports: !dryRun && !jsonOnly,
});

if (dryRun || jsonOnly) {
  const { replay_details: _details, ...payload } = analysis;
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

console.log(`✅ Analyse triage ambigu`);
console.log(`   JSON : ${analysis.output?.jsonPath}`);
console.log(`   MD   : ${analysis.output?.markdownPath}`);
console.log(
  `   ${analysis.summary.ambiguous_entries}/${analysis.summary.entries_total} cas ambigus · ${analysis.summary.distinct_pairs} paires`,
);

if (analysis.recommendations.length > 0) {
  console.log("   Recommandations :");
  for (const reco of analysis.recommendations.slice(0, 3)) {
    console.log(`   - [${reco.priority}] ${reco.hint}`);
  }
}
