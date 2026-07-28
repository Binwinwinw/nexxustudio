import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import skillLoader from '../agent/utils/skillLoader.js';
import {
  conversationHealthScore,
  evaluateQualityGate,
  QUALITY_GATE_THRESHOLDS,
} from './conversationHealthScore.js';
import { evaluateSkillTriggerAccuracy } from './skillTriggerMatrixData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '../..');

export const STABILITY_TEST_FILES = [
  'tests/conversation-stability.test.js',
  'tests/conversation-health-score.test.js',
  'tests/mode-response-contracts.test.js',
  'tests/intent-contract-registry.test.js',
  'tests/curated-memory-gate.test.js',
  'tests/memory-promotion-policy.test.js',
  'tests/web-candidate-promotion.test.js',
  'tests/memory-governance-metrics.test.js',
  'tests/memory-governance-report.test.js',
  'tests/daily-ops-report.test.js',
  'tests/ops-alert-thresholds.test.js',
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
  'tests/tool-output-sanitizer.test.js',
  'tests/wiki_compiler.test.js',
  'tests/ingest_wiki_adrs.test.js',
  'tests/skillLoader.test.js',
  'tests/skillTriggerMatrix.test.js',
];

export const DEFAULT_ACCURACY_TARGET = 0.88;
export const DEFAULT_HEALTH_SCORE_TARGET = 0.85;

function spawnNode(args, cwd = SERVER_ROOT) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, stdio: 'pipe' });
    let stderr = '';

    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('close', (code) => {
      resolve({
        pass: code === 0,
        exitCode: code ?? 1,
        failures: code === 0 ? [] : [stderr.trim() || `exit ${code}`],
      });
    });

    child.on('error', (err) => {
      resolve({
        pass: false,
        exitCode: 1,
        failures: [err.message],
      });
    });
  });
}

export function baselineGateMetrics() {
  return {
    streams: 0,
    noVisibleTokens: 0,
    fallbackTriggered: 0,
    streamErrors: 0,
    fallbackRatePct: 0,
    streamErrorCount: 0,
  };
}

/**
 * @param {object} [context]
 * @param {boolean} [context.executeTests=true]
 */
export async function testStability(context = {}) {
  if (context.stability) {
    return context.stability;
  }

  if (context.executeTests === false) {
    return { pass: true, failures: [] };
  }

  const testFiles = context.stabilityTestFiles || STABILITY_TEST_FILES;
  const result = await spawnNode(['--test', ...testFiles]);
  return {
    pass: result.pass,
    failures: result.failures,
  };
}

/**
 * @param {object} [context]
 */
export async function testSecurity(context = {}) {
  if (context.security) {
    const vulnerabilities = context.security.vulnerabilities ?? context.security.failures?.length ?? 0;
    return {
      pass: context.security.pass ?? vulnerabilities === 0,
      vulnerabilities,
      failures: context.security.failures || [],
    };
  }

  if (context.executeTests === false) {
    return { pass: true, vulnerabilities: 0, failures: [] };
  }

  const result = await spawnNode(['--test', 'tests/security-routes.test.js']);
  return {
    pass: result.pass,
    vulnerabilities: result.pass ? 0 : result.failures.length,
    failures: result.failures,
  };
}

/**
 * @param {object} [context]
 */
export async function testAccuracy(context = {}) {
  if (context.accuracy) {
    return context.accuracy;
  }

  if (context.executeTests === false) {
    return {
      pass: true,
      accuracy: 1,
      failures: [],
    };
  }

  const minAccuracy = context.minAccuracy ?? DEFAULT_ACCURACY_TARGET;
  const evaluation = await evaluateSkillTriggerAccuracy(skillLoader, minAccuracy);

  return {
    pass: evaluation.pass,
    accuracy: evaluation.accuracy,
    passed: evaluation.passed,
    total: evaluation.total,
    failures: evaluation.failures.map(
      (failure) =>
        `${failure.label}: attendu ${failure.expected}, obtenu ${failure.actual ?? 'null'}`,
    ),
  };
}

/**
 * Orchestration quality gate — stabilité, sécurité, précision, health score.
 * @param {object} [context]
 */
export async function runQualityGate(context = {}) {
  const stability = await testStability(context);
  const security = await testSecurity(context);
  const accuracy = await testAccuracy(context);

  const metrics = context.metrics ?? baselineGateMetrics();
  const healthEvaluation = evaluateQualityGate(metrics, {
    thresholds: context.thresholds,
  });
  const healthScore = conversationHealthScore(metrics);

  const pass =
    healthEvaluation.pass &&
    stability.pass &&
    security.pass &&
    accuracy.pass;

  return {
    pass,
    stability,
    security,
    accuracy,
    healthScore,
    healthEvaluation,
    thresholds: healthEvaluation.thresholds || QUALITY_GATE_THRESHOLDS,
    at: new Date().toISOString(),
  };
}

/**
 * @param {Awaited<ReturnType<typeof runQualityGate>>} results
 */
export function generateGateReport(results) {
  const healthDisplay = results.healthScore.toFixed(2);
  const accuracyDisplay = (results.accuracy.accuracy ?? 0).toFixed(2);
  const stabilityFailures = results.stability.failures?.length ?? 0;
  const securityFailures = results.security.failures?.length ?? 0;

  const lines = [
    '# Quality Gate Report',
    '',
    `## État: ${results.pass ? '✅ PASS' : '❌ FAIL'}`,
    '',
    '### Résultats détaillés',
    '',
    `- **Stabilité**: ${results.stability.pass ? '✅' : '❌'} ${stabilityFailures} échec(s)`,
    `- **Sécurité**: ${results.security.pass ? '✅' : '❌'} ${securityFailures} finding(s)`,
    `- **Précision**: ${results.accuracy.pass ? '✅' : '❌'} ${accuracyDisplay} (cible: ${DEFAULT_ACCURACY_TARGET})`,
    `- **Health Score**: ${healthDisplay} (cible: ${DEFAULT_HEALTH_SCORE_TARGET})`,
    '',
  ];

  if (stabilityFailures > 0) {
    lines.push('### Échecs stabilité');
    for (const failure of results.stability.failures) {
      lines.push(`- ${failure}`);
    }
    lines.push('');
  }

  if (securityFailures > 0) {
    lines.push('### Échecs sécurité');
    for (const failure of results.security.failures) {
      lines.push(`- ${failure}`);
    }
    lines.push('');
  }

  if ((results.accuracy.failures?.length ?? 0) > 0) {
    lines.push('### Échecs précision routing');
    for (const failure of results.accuracy.failures) {
      lines.push(`- ${failure}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export default runQualityGate;
