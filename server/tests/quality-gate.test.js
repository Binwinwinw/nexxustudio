import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import runQualityGateModule, {
  runQualityGate,
  generateGateReport,
  testStability,
  testSecurity,
  testAccuracy,
  DEFAULT_HEALTH_SCORE_TARGET,
} from '../src/quality/quality-gate.js';
import { conversationHealthScore } from '../src/quality/conversationHealthScore.js';

describe('quality-gate ESM', () => {
  it('exporte runQualityGate comme fonction nommée', () => {
    assert.equal(typeof runQualityGate, 'function');
  });

  it('exporte generateGateReport comme fonction nommée', () => {
    assert.equal(typeof generateGateReport, 'function');
  });

  it('exporte runQualityGate comme default', () => {
    assert.equal(typeof runQualityGateModule, 'function');
    assert.equal(runQualityGateModule, runQualityGate);
  });

  it('passe le gate quand healthScore >= 0.85', async () => {
    const result = await runQualityGate({
      executeTests: false,
      metrics: { noVisibleTokens: 0, fallbackRatePct: 0, streamErrorCount: 0 },
      stability: { pass: true, failures: [] },
      security: { pass: true, vulnerabilities: 0, failures: [] },
      accuracy: { pass: true, accuracy: 0.92, failures: [] },
    });
    assert.equal(result.pass, true);
    assert.ok(result.healthScore >= DEFAULT_HEALTH_SCORE_TARGET);
  });

  it('échoue le gate quand healthScore < 0.85', async () => {
    const result = await runQualityGate({
      executeTests: false,
      metrics: { noVisibleTokens: 2, fallbackRatePct: 0, streamErrorCount: 0 },
      stability: { pass: true, failures: [] },
      security: { pass: true, vulnerabilities: 0, failures: [] },
      accuracy: { pass: true, accuracy: 0.92, failures: [] },
    });
    assert.equal(result.pass, false);
  });

  it('échoue le gate quand vulnérabilités > 0', async () => {
    const result = await runQualityGate({
      executeTests: false,
      metrics: { noVisibleTokens: 0, fallbackRatePct: 0, streamErrorCount: 0 },
      stability: { pass: true, failures: [] },
      security: {
        pass: false,
        vulnerabilities: 2,
        failures: ['route /api/admin non protégée'],
      },
      accuracy: { pass: true, accuracy: 0.92, failures: [] },
    });
    assert.equal(result.pass, false);
  });

  it('échoue le gate quand triggerAccuracy < 0.88', async () => {
    const result = await runQualityGate({
      executeTests: false,
      metrics: { noVisibleTokens: 0, fallbackRatePct: 0, streamErrorCount: 0 },
      stability: { pass: true, failures: [] },
      security: { pass: true, vulnerabilities: 0, failures: [] },
      accuracy: {
        pass: false,
        accuracy: 0.75,
        failures: ['routing drift'],
      },
    });
    assert.equal(result.pass, false);
  });

  it('génère rapport Markdown complet', () => {
    const report = generateGateReport({
      pass: true,
      stability: { pass: true, failures: [] },
      security: { pass: true, failures: [] },
      accuracy: { pass: true, accuracy: 0.92, failures: [] },
      healthScore: 0.9,
    });
    assert.match(report, /# Quality Gate Report/);
    assert.match(report, /✅ PASS/);
    assert.match(report, /\*\*Health Score\*\*: 0\.90/);
  });

  it('conversationHealthScore normalise le score 0-1', () => {
    assert.equal(
      conversationHealthScore({
        noVisibleTokens: 0,
        fallbackRatePct: 0,
        streamErrorCount: 0,
      }),
      1,
    );
  });

  it('testStability respecte executeTests=false', async () => {
    const result = await testStability({ executeTests: false });
    assert.equal(result.pass, true);
  });

  it('testSecurity respecte le mock context.security', async () => {
    const result = await testSecurity({
      security: { pass: false, vulnerabilities: 1, failures: ['x'] },
    });
    assert.equal(result.pass, false);
    assert.equal(result.vulnerabilities, 1);
  });

  it('testAccuracy respecte le mock context.accuracy', async () => {
    const result = await testAccuracy({
      accuracy: { pass: true, accuracy: 0.95, failures: [] },
    });
    assert.equal(result.pass, true);
    assert.equal(result.accuracy, 0.95);
  });
});
