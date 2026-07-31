import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWarmToneSemiSocialQuery,
  matchesWarmToneSemiSocialShell,
  isCoveredByDeterministicSocialRail,
  isWarmToneBusinessOrFactualExcluded,
} from '../src/agent/utils/warmToneSemiSocialGuards.js';
import {
  buildZephyrTriggerSignals,
  resolveExecutionBriefTrigger,
} from '../src/agent/policies/execution/index.js';

test('matchesWarmToneSemiSocialShell — transitions conversationnelles', () => {
  assert.equal(matchesWarmToneSemiSocialShell('ok et sinon'), true);
  assert.equal(matchesWarmToneSemiSocialShell('ouais mais du coup'), true);
  assert.equal(matchesWarmToneSemiSocialShell('hmm pas vraiment'), true);
  assert.equal(matchesWarmToneSemiSocialShell('bon et toi t en penses quoi'), true);
  assert.equal(matchesWarmToneSemiSocialShell('et le poker'), false);
});

test('isWarmToneSemiSocialQuery — garde-fou code/métier', () => {
  assert.equal(isWarmToneSemiSocialQuery('ok et sinon génère du code react'), false);
  assert.equal(isWarmToneSemiSocialQuery('ouais mais du coup corrige ce bug'), false);
});

test('isWarmToneSemiSocialQuery — pas factual simple', () => {
  assert.equal(isWarmToneSemiSocialQuery('ok et sinon c est quoi un api'), false);
});

test('isWarmToneSemiSocialQuery — positif', () => {
  assert.equal(isWarmToneSemiSocialQuery('ok et sinon'), true);
  assert.equal(isWarmToneSemiSocialQuery('bon et toi tu en penses quoi'), true);
});

test('resolveExecutionBriefTrigger — TRG_WARM_TONE_SEMI_SOCIAL', () => {
  const signals = buildZephyrTriggerSignals('ok et sinon');
  const trigger = resolveExecutionBriefTrigger(signals);
  assert.equal(trigger?.id, 'TRG_WARM_TONE_SEMI_SOCIAL');
  assert.equal(trigger?.template_id, 'TEMPLATE_WARM_TONE');
  assert.equal(trigger?.stance, 'companion');
});

test('follow-up elliptique reste TRG_FOLLOW_UP pas warm tone', () => {
  const signals = buildZephyrTriggerSignals('et le poker');
  const trigger = resolveExecutionBriefTrigger(signals);
  assert.equal(trigger?.id, 'TRG_FOLLOW_UP_ELLIPSIS');
});

test('gratitude skip — pas de warm tone probe', () => {
  const signals = buildZephyrTriggerSignals('merci beaucoup', { gratitude_closure: true });
  assert.equal(resolveExecutionBriefTrigger(signals), null);
});
