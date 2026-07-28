import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import TelemetryObservability, {
  TelemetryObservability as NamedTelemetryObservability,
  generateAlerts,
  hashQuery,
} from '../src/ops/telemetry-observability.js';

describe('telemetry-observability ESM', () => {
  /** @type {string} */
  let tempDir;
  /** @type {TelemetryObservability} */
  let telemetry;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'citadelle-telemetry-'));
    telemetry = await new TelemetryObservability({
      persistDir: tempDir,
      retentionDays: 30,
    }).initialize();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exporte TelemetryObservability comme classe', () => {
    assert.equal(typeof NamedTelemetryObservability, 'function');
    assert.ok(telemetry instanceof TelemetryObservability);
  });

  it('exporte default TelemetryObservability', () => {
    assert.equal(typeof TelemetryObservability, 'function');
  });

  it('hashQuery anonymise la requête', () => {
    const hash = hashQuery('extraire PDF');
    assert.equal(hash.length, 16);
    assert.equal(hashQuery('extraire PDF'), hash);
    assert.notEqual(hashQuery('autre requête'), hash);
  });

  it('enregistre une décision agent', () => {
    const metric = telemetry.recordAgentDecision(
      'agent-1',
      { outcome: 'success' },
      {
        intent: 'search',
        skillId: 'skill-pdf-extraction',
        tokens: { usage: { totalTokens: 500 } },
        latencyMs: 120,
      },
    );
    assert.equal(metric.agentId, 'agent-1');
    assert.equal(metric.decision.outcome, 'success');
    assert.equal(metric.context.skillUsed, 'skill-pdf-extraction');
  });

  it('enregistre un trigger de skill', () => {
    const metric = telemetry.recordSkillTrigger(
      'skill-pdf-extraction',
      'extraire PDF',
      true,
      0.92,
    );
    assert.equal(metric.skillId, 'skill-pdf-extraction');
    assert.equal(metric.triggered, true);
    assert.equal(metric.accuracy, 0.92);
    assert.equal(metric.queryHash, hashQuery('extraire PDF'));
  });

  it('enregistre la santé de conversation', () => {
    const metric = telemetry.recordConversationHealth(0.88, [
      'stable',
      'no-hallucination',
    ]);
    assert.equal(metric.score, 0.88);
    assert.equal(metric.type, 'conversationHealth');
  });

  it('persiste et relit les métriques', async () => {
    telemetry.recordSkillTrigger('skill-pdf-extraction', 'test', true, 0.9);
    telemetry.recordError('timeout', 'API timeout', { endpoint: '/api/search' });

    await telemetry.persist();

    const summary = await telemetry.getMetricsSummary('24h');
    assert.ok(summary.totalMetrics >= 2);
    assert.equal(summary.errors.length, 1);
    assert.ok(summary.bySkill['skill-pdf-extraction'] >= 1);
  });

  it('génère des alertes quand erreur > 5%', async () => {
    telemetry.recordError('test', 'error', {});
    telemetry.recordError('test', 'error', {});
    telemetry.recordError('test', 'error', {});
    telemetry.recordAgentDecision('agent', { outcome: 'ok' }, {});

    const summary = await telemetry.getMetricsSummary('24h');
    const alerts = generateAlerts(summary);
    assert.ok(alerts.length > 0);
    assert.equal(alerts[0].level, 'warning');
  });

  it('alerte si accuracy moyenne < 0.85', () => {
    const summary = {
      totalMetrics: 4,
      errors: [],
      avgAccuracy: 0.72,
    };
    const alerts = generateAlerts(summary);
    assert.ok(alerts.some((alert) => alert.message.includes('Accuracy')));
  });
});
