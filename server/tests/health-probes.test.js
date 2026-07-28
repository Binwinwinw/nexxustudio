import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateLive,
  evaluateStartup,
  evaluateReady,
} from '../src/services/healthProbeService.js';

test('evaluateLive: toujours 200 si le process répond', () => {
  const live = evaluateLive({ uptimeSeconds: 12, bootTraceId: 'boot-1' });
  assert.equal(live.httpStatus, 200);
  assert.equal(live.ok, true);
  assert.equal(live.trace_id, 'boot-1');
});

test('evaluateStartup: 503 pendant tier1_loading', () => {
  const startup = evaluateStartup({
    routerReady: true,
    warmupPhase: 'tier1_loading',
    warmupIsReady: false,
    bootTraceId: 'boot-2',
  });
  assert.equal(startup.httpStatus, 503);
  assert.equal(startup.ok, false);
  assert.match(startup.reasons.join(','), /warmup_phase/);
});

test('evaluateStartup: 200 en partial_ready après routeur', () => {
  const startup = evaluateStartup({
    routerReady: true,
    warmupPhase: 'partial_ready',
    warmupIsReady: false,
    bootTraceId: 'boot-3',
  });
  assert.equal(startup.httpStatus, 200);
  assert.equal(startup.ok, true);
});

test('evaluateReady: 503 si warmup pas terminé', () => {
  const ready = evaluateReady({
    routerReady: true,
    warmupIsReady: false,
    warmupPhase: 'tier2_warming',
    warmupModels: { 'ornith:9b': 'warming' },
    knowledgeHubReady: false,
  });
  assert.equal(ready.httpStatus, 503);
  assert.ok(ready.reasons.includes('warmup_not_ready'));
});

test('evaluateReady: 200 si dépendances critiques OK (knowledge hub optionnel)', () => {
  const ready = evaluateReady({
    routerReady: true,
    warmupIsReady: true,
    warmupPhase: 'ready',
    warmupModels: {
      'ornith:9b': 'ready',
      'nomic-embed-text:latest': 'ready',
    },
    knowledgeHubReady: false,
  });
  assert.equal(ready.httpStatus, 200);
  assert.equal(ready.knowledge_hub, 'degraded');
});
