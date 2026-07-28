#!/usr/bin/env node
/**
 * Pre-merge local — skills runtime + stabilité minimale.
 * Usage: cd server && npm run premerge
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

function run(label, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: SERVER_ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`\n✗ ${label} — FAIL`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ ${label} — PASS`);
}

run('test:skills', ['tests/ci/validate_skill_runtime.js']);
run('test:code-delivery (policy + sentinels)', [
  '--test',
  'tests/code-delivery-conversation-regression.test.js',
  'tests/code-delivery-policy.test.js',
  'tests/code-delivery-sentinel.test.js',
  'tests/generic-greeting-guards.test.js',
  'tests/code-review-regression.test.js',
]);
run('gate:impeccable', ['scripts/premerge-impeccable-gate.js']);
run('test:stability (subset skills)', [
  '--test',
  'tests/skillLoader.test.js',
  'tests/skillTriggerMatrix.test.js',
  'tests/mode-response-contracts.test.js',
  'tests/tool-output-sanitizer.test.js',
  'tests/pdf-extractor.test.js',
  'tests/document-capability-contract.test.js',
  'tests/subject-typing-policy.test.js',
  'tests/document-web-compare-policy.test.js',
  'tests/math-simple-policy.test.js',
  'tests/math-explain-policy.test.js',
  'tests/document-synthesis-policy.test.js',
  'tests/familiarity-domain-overview-policy.test.js',
  'tests/subject-reference-resume-policy.test.js',
  'tests/weather-current-request-policy.test.js',
  'tests/prompt-for-artifact-policy.test.js',
  'tests/pedagogy-soft-overview-policy.test.js',
  'tests/traffic-current-request-policy.test.js',
  'tests/wiki_compiler.test.js',
  'tests/ingest_wiki_adrs.test.js',
  'tests/quality-gate.test.js',
  'tests/dashboard-skills.test.js',
  'tests/vault-skills-sync.test.js',
  'tests/mcp-bridge.test.js',
  'tests/hybrid-retrieval.test.js',
  'tests/telemetry-observability.test.js',
  'tests/pipeline-telemetry-integration.test.js',
  'tests/trace-mvp.test.js',
  'tests/health-probes.test.js',
  'tests/warmup-matrix.test.js',
  'tests/warmup-cockpit-snapshot.test.js',
  'tests/recall-grounding-validator.test.js',
  'tests/inference-provider.test.js',
  'tests/conversation-recall-synthesizer.test.js',
  'tests/session-history.test.js',
  'tests/design-suite-contract.test.js',
  'tests/design-extract-worker.test.js',
  'tests/design-extract-hybrid.test.js',
  'tests/nexxus-design-worker.test.js',
  'tests/design-create-api.test.js',
  'tests/design-pipeline-api.test.js',
  'tests/impeccable-worker.test.js',
  'tests/impeccable-api.test.js',
  'tests/browser-harness-contract.test.js',
  'tests/browser-harness-session.test.js',
  'tests/browser-harness-observation.test.js',
  'tests/browser-harness-worker.test.js',
  'tests/browser-harness-api.test.js',
  'tests/golden/browser-harness/browser-harness-golden.test.js',
  'tests/video-upload-job.test.js',
  'tests/makers-checker.test.js',
  'tests/makers-checker-pipeline-integration.test.js',
  'tests/e2e/makers-checker-critical-packet.test.js',
]);

console.log('\n✅ Pre-merge OK — skills v1.6 + régressions critiques');
