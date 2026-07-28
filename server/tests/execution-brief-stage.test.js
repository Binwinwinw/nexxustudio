import test from 'node:test';
import assert from 'node:assert/strict';
import { getComposerSystemPrompt } from '../src/agent/config/modeResponseContracts.js';
import {
  resolveExecutionBriefStage,
  attachExecutionBriefToPacket,
  recordExecutionBriefTelemetry,
} from '../src/agent/stages/executionBriefStage.js';

test('resolveExecutionBriefStage — skip si short-circuit terminal', async () => {
  const prev = process.env.EXECUTION_BRIEF_ENABLED;
  process.env.EXECUTION_BRIEF_ENABLED = '1';
  process.env.EXECUTION_BRIEF_ZEPHYR = '0';

  const result = await resolveExecutionBriefStage({
    query: 'et le poker',
    history: [],
    shortCircuit: { reply: 'réponse directe', path: 'social_gratitude' },
  });

  assert.equal(result, null);

  if (prev === undefined) delete process.env.EXECUTION_BRIEF_ENABLED;
  else process.env.EXECUTION_BRIEF_ENABLED = prev;
});

test('resolveExecutionBriefStage — follow-up sans Zephyr (fail-open heuristic)', async () => {
  process.env.EXECUTION_BRIEF_ENABLED = '1';
  process.env.EXECUTION_BRIEF_ZEPHYR = '0';

  const result = await resolveExecutionBriefStage({
    query: 'et le poker',
    history: [{ role: 'user', content: 'jeux de cartes' }],
    shortCircuit: null,
  });

  assert.ok(result);
  assert.equal(result.brief.intent_family, 'follow_up');
  assert.match(result.injection, /^EXECUTION_BRIEF:/);
  assert.equal(result.telemetry.trigger_id, 'TRG_FOLLOW_UP_ELLIPSIS');
  assert.equal(result.telemetry.zephyr_attempted, false);
});

test('resolveExecutionBriefStage — désactivé globalement', async () => {
  process.env.EXECUTION_BRIEF_ENABLED = '0';
  const result = await resolveExecutionBriefStage({ query: 'et le poker' });
  assert.equal(result, null);
  process.env.EXECUTION_BRIEF_ENABLED = '1';
});

test('attachExecutionBriefToPacket — meta injection', () => {
  const packet = { user_query: 'test', meta: {} };
  const stageResult = {
    brief: { version: '1.0.0' },
    injection: 'EXECUTION_BRIEF: {"v":"1.0.0"}',
    telemetry: { trigger_id: 'TRG_FOLLOW_UP_ELLIPSIS' },
  };
  attachExecutionBriefToPacket(packet, stageResult);
  assert.equal(packet.meta.execution_brief_injection, stageResult.injection);
  assert.equal(packet.meta.execution_brief_telemetry.trigger_id, 'TRG_FOLLOW_UP_ELLIPSIS');
});

test('recordExecutionBriefTelemetry — métriques turn', () => {
  const metrics = {};
  const turnTelemetry = {
    setMetric(key, value) {
      metrics[key] = value;
    },
  };
  recordExecutionBriefTelemetry(turnTelemetry, {
    telemetry: {
      invoked: true,
      trigger_id: 'TRG_META_SYSTEM_ARCH',
      template_id: 'TEMPLATE_META_SYSTEM_ARCH',
      recommended_actor: 'ornith_only',
      rigor_level: 'high',
      zephyr_ok: false,
      fail_open: true,
      latency_ms: 12,
    },
  });
  assert.equal(metrics.execution_brief_trigger_id, 'TRG_META_SYSTEM_ARCH');
  assert.equal(metrics.execution_brief_recommended_actor, 'ornith_only');
  assert.equal(metrics.execution_brief_fail_open, true);
});

test('getComposerSystemPrompt — inclut execution_brief_injection', () => {
  const packet = {
    user_query: 'et le poker',
    meta: {
      execution_brief_injection:
        'EXECUTION_BRIEF: {"family":"follow_up"} | HINT: Relance elliptique',
    },
  };
  const prompt = getComposerSystemPrompt(packet);
  assert.match(prompt, /EXECUTION_BRIEF:/);
  assert.match(prompt, /Relance elliptique/);
});

test('resolveExecutionBriefStage — meta system rigor high', async () => {
  process.env.EXECUTION_BRIEF_ENABLED = '1';
  process.env.EXECUTION_BRIEF_ZEPHYR = '0';

  const q =
    'faut-il brancher zephyr après intentShortCircuit pour enrichir ornith avec ExecutionBrief ?';
  const result = await resolveExecutionBriefStage({ query: q, shortCircuit: null });

  assert.ok(result);
  assert.equal(result.brief.recommended_actor, 'ornith_only');
  assert.equal(result.brief.rigor_level, 'high');
  assert.equal(result.telemetry.template_id, 'TEMPLATE_META_SYSTEM_ARCH');
});
