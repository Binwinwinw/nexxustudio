import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXECUTION_BRIEF_VERSION,
  buildZephyrTriggerSignals,
  shouldInvokeZephyrPreprocessor,
  shouldSkipZephyrPreprocessor,
  resolveExecutionBriefTrigger,
  validateExecutionBrief,
  buildExecutionBriefFromTrigger,
  formatExecutionBriefInjection,
  bridgeSemanticOutputToExecutionBrief,
  isFollowUpEllipsisQuery,
  isMetaSystemArchitectureQuery,
} from '../src/agent/policies/executionBriefPolicy.js';

test('isFollowUpEllipsisQuery — relances courtes', () => {
  assert.equal(isFollowUpEllipsisQuery('et le poker'), true);
  assert.equal(isFollowUpEllipsisQuery('de football'), true);
  assert.equal(isFollowUpEllipsisQuery('explique-moi en détail le fonctionnement de React hooks'), false);
});

test('isMetaSystemArchitectureQuery — questions système', () => {
  assert.equal(
    isMetaSystemArchitectureQuery('je me demande si zephyr devrait analyser la requête pour ornith'),
    true,
  );
  assert.equal(isMetaSystemArchitectureQuery('bonjour'), false);
});

test('shouldSkipZephyrPreprocessor — social_only', () => {
  const signals = buildZephyrTriggerSignals('salut', { social_only: true });
  assert.equal(shouldSkipZephyrPreprocessor(signals), true);
  assert.equal(shouldInvokeZephyrPreprocessor(signals), false);
});

test('shouldInvokeZephyrPreprocessor — follow-up ellipsis', () => {
  const signals = buildZephyrTriggerSignals('et le poker');
  assert.equal(shouldSkipZephyrPreprocessor(signals), false);
  assert.equal(shouldInvokeZephyrPreprocessor(signals), true);
  const trigger = resolveExecutionBriefTrigger(signals);
  assert.equal(trigger?.id, 'TRG_FOLLOW_UP_ELLIPSIS');
});

test('shouldInvokeZephyrPreprocessor — meta system arch', () => {
  const q =
    'faut-il brancher zephyr après intentShortCircuit pour enrichir ornith avec un ExecutionBrief ?';
  const signals = buildZephyrTriggerSignals(q);
  const trigger = resolveExecutionBriefTrigger(signals);
  assert.equal(trigger?.id, 'TRG_META_SYSTEM_ARCH');
  assert.equal(trigger?.recommended_actor, 'ornith_only');
  assert.equal(trigger?.rigor_level, 'high');
});

test('shouldInvokeZephyrPreprocessor — short-circuit bloque', () => {
  const signals = buildZephyrTriggerSignals('et le poker', { short_circuit_matched: true });
  assert.equal(shouldInvokeZephyrPreprocessor(signals), false);
});

test('validateExecutionBrief — schéma Ajv', () => {
  const signals = buildZephyrTriggerSignals('et le poker');
  const trigger = resolveExecutionBriefTrigger(signals);
  const brief = buildExecutionBriefFromTrigger(trigger, 'et le poker aussi ?');
  const validated = validateExecutionBrief(brief);
  assert.ok(validated);
  assert.equal(validated.version, EXECUTION_BRIEF_VERSION);
  assert.equal(validated.intent_family, 'follow_up');
  assert.equal(validated.recommended_actor, 'ornith');
});

test('formatExecutionBriefInjection — ligne compacte', () => {
  const signals = buildZephyrTriggerSignals('et le poker');
  const brief = buildExecutionBriefFromTrigger(
    resolveExecutionBriefTrigger(signals),
    'quelles sont les règles du poker ?',
  );
  const line = formatExecutionBriefInjection(brief);
  assert.match(line, /^EXECUTION_BRIEF: \{/);
  assert.match(line, /HINT:/);
  assert.match(line, /TRG_FOLLOW_UP_ELLIPSIS/);
});

test('bridgeSemanticOutputToExecutionBrief — pont semanticPreProcessor', () => {
  const semantic = {
    canonical_query: 'quelles sont les règles du poker ?',
    current_subject: 'jeux de cartes',
    follow_up_reference: 'et le poker',
    ambiguity_level: 'low',
    confidence: 'high',
  };
  const signals = buildZephyrTriggerSignals('et le poker');
  const brief = bridgeSemanticOutputToExecutionBrief(semantic, signals, 'et le poker');
  assert.equal(brief.source, 'zephyr_semantic_preprocessor');
  assert.equal(brief.canonical_query, 'quelles sont les règles du poker ?');
  assert.equal(brief.context.current_subject, 'jeux de cartes');
});

test('meta assistant behavior — template dédié', () => {
  const q = 'tu ne réfléchis pas avant de répondre, c est bizarre ton comportement';
  const signals = buildZephyrTriggerSignals(q);
  const trigger = resolveExecutionBriefTrigger(signals);
  assert.equal(trigger?.id, 'TRG_META_ASSISTANT_BEHAVIOR');
  assert.equal(trigger?.template_id, 'TEMPLATE_ASSISTANT_BEHAVIOR');
});
