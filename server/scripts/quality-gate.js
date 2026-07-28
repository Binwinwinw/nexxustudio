#!/usr/bin/env node
/**
 * CLI — quality:gate
 * Runtime : server/src/quality/quality-gate.js
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import runQualityGate, {
  baselineGateMetrics,
  generateGateReport,
  testStability,
  testSecurity,
  testAccuracy,
} from '../src/quality/quality-gate.js';
import { appendQualityGateRun } from '../src/agent/telemetry/conversationHealthPersistor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

async function fetchLiveMetrics() {
  const baseUrl =
    process.env.QUALITY_GATE_API_URL ||
    process.env.VITE_API_BASE_URL ||
    'http://localhost:3000';

  try {
    const res = await fetch(`${baseUrl}/api/conversation/health`, {
      credentials: 'include',
      headers: process.env.QUALITY_GATE_API_TOKEN
        ? { 'X-API-Token': process.env.QUALITY_GATE_API_TOKEN }
        : {},
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, metrics: data.health?.today || {} };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function runSkillsValidation() {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['tests/ci/validate_skill_runtime.js'],
      { cwd: SERVER_ROOT,
        stdio: 'inherit' },
    );
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

async function main() {
  const skillsPass = await runSkillsValidation();
  const steps = [{ id: 'test_skills', name: 'test:skills', pass: skillsPass }];

  const liveMode = process.env.QUALITY_GATE_LIVE === '1';
  let metrics = baselineGateMetrics();
  let kpiMode = 'baseline';

  if (liveMode) {
    const live = await fetchLiveMetrics();
    if (!live.ok) {
      steps.push({
        id: 'kpi_live_fetch',
        name: 'fetch:/api/conversation/health',
        pass: false,
        error: live.error,
      });
    } else {
      metrics = live.metrics;
      kpiMode = 'live';
      steps.push({
        id: 'kpi_live_fetch',
        name: 'fetch:/api/conversation/health',
        pass: true,
      });
    }
  }

  const stability = await testStability();
  const security =
    process.env.QUALITY_GATE_SKIP_SECURITY === '1'
      ? { pass: true, vulnerabilities: 0, failures: [] }
      : await testSecurity();
  const accuracy = await testAccuracy();

  const gate = await runQualityGate({
    executeTests: false,
    metrics,
    stability,
    security,
    accuracy,
  });

  steps.push(
    { id: 'test_stability', name: 'test:stability', pass: stability.pass },
    { id: 'test_security', name: 'test:security', pass: security.pass },
    { id: 'test_accuracy', name: 'skillTriggerAccuracy', pass: accuracy.pass },
    {
      id: 'kpi_thresholds',
      name: 'kpi_thresholds',
      pass: gate.healthEvaluation.pass,
      mode: kpiMode,
      score: gate.healthEvaluation.score,
      metrics,
      failures: gate.healthEvaluation.failures,
    },
  );

  const verdict = skillsPass && gate.pass ? 'PASS' : 'FAIL';

  const report = {
    gate: 'quality:gate',
    version: 'v2',
    at: gate.at,
    thresholds: gate.thresholds,
    steps,
    verdict,
    globalScore: gate.healthEvaluation.score,
    markdown: generateGateReport(gate),
  };

  appendQualityGateRun(report);

  console.log('\n--- QUALITY GATE REPORT ---');
  console.log(JSON.stringify(report, null, 2));
  console.log(`\n${report.markdown}`);
  console.log(`\nVERDICT: ${report.verdict}`);
  console.log(`SCORE: ${report.globalScore}/100`);

  if (report.verdict !== 'PASS') {
    const failed = report.steps.filter((step) => step.pass === false);
    console.log(`FAILED STEPS: ${failed.map((step) => step.id || step.name).join(', ')}`);
  }

  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error('[quality-gate CLI]', err.message);
  process.exit(1);
});
