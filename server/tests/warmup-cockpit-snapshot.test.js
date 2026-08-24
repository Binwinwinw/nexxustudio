import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWarmupCockpitSnapshot,
  buildWarmupTimeline,
  getSystemHeadline,
  getTier2DisplayLabel,
} from '../src/services/warmupCockpitSnapshot.js';

test('getTier2DisplayLabel: libellés doctrine reactive', () => {
  assert.equal(getTier2DisplayLabel('disabled'), 'Tier 2 désactivé — reasoner = Tier 1');
  assert.equal(getTier2DisplayLabel('deferred'), 'Raisonnement en attente');
  assert.equal(getTier2DisplayLabel('warming'), 'Préparation raisonneur');
  assert.equal(getTier2DisplayLabel('ready'), 'Raisonneur prêt');
});

test('getSystemHeadline: tempo visible pour opérateur', () => {
  assert.equal(
    getSystemHeadline({
      isReady: true,
    }),
    'Système prêt',
  );
});

test('buildWarmupTimeline: boot → tier1 → ready → tier2 deferred', () => {
  const timeline = buildWarmupTimeline({
    isReady: true,
    latency: { tiers: { tier1: 4600 } },
  });
  assert.equal(timeline.length, 4);
  assert.equal(timeline[0].id, 'boot');
  assert.equal(timeline[1].id, 'tier1');
  assert.equal(timeline[2].id, 'system_ready');
  assert.equal(timeline[3].id, 'tier2');
  assert.equal(timeline[3].status, 'pending');
  assert.equal(timeline[1].duration_ms, 4600);
});

test('buildWarmupCockpitSnapshot: payload Cockpit complet', () => {
  const snapshot = buildWarmupCockpitSnapshot({
    phase: 'ready',
    isReady: true,
    tier2_deferred: true,
    latency: { total: 5100, tiers: { tier1: 4600 } },
    models: {
      'qwen3.5:2b': 'ready',
      'nomic-embed-text:latest': 'ready',
      'granite4.1:8b': 'deferred',
      'qwen2.5-coder:7b': 'lazy',
    },
  });

  assert.equal(snapshot.boot_profile, 'reactive');
  assert.equal(snapshot.headline, 'Système prêt');
  assert.equal(snapshot.tier2.state, 'deferred');
  assert.equal(snapshot.tier2.label, 'Raisonnement en attente');
  assert.equal(snapshot.tier2.model, 'granite4.1:8b');
  assert.equal(snapshot.tier1.chat_model, 'qwen3.5:2b');
  assert.ok(snapshot.boot_trace_id);
  assert.ok(Array.isArray(snapshot.timeline));
  assert.equal(snapshot.tier1.ready, true);
});
