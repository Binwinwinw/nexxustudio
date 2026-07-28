import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHybridScore,
  evaluateConfidence,
  computeRetrievalConfidence,
  attachSourceRelevance,
} from '../src/retrieval/confidenceThresholds.js';
import applyRagConfidenceGate from '../src/retrieval/ragResponseGate.js';

test('normalizeHybridScore: borne les scores RRF bruts vers [0,1]', () => {
  const normalized = normalizeHybridScore(0.005);
  assert.ok(normalized > 0);
  assert.ok(normalized <= 1);
});

test('evaluateConfidence: reject sous le seuil minimum', () => {
  const evaluation = evaluateConfidence(0.42);
  assert.equal(evaluation.level, 'reject');
  assert.equal(evaluation.action, 'fallback_epistemic');
});

test('computeRetrievalConfidence: agrège le meilleur candidat', () => {
  const evaluation = computeRetrievalConfidence([
    { score: 0.012 },
    { score: 0.004 },
  ]);
  assert.ok(evaluation.score >= 0);
  assert.ok(['reject', 'acceptable', 'high'].includes(evaluation.level));
});

test('attachSourceRelevance: ajoute relevance normalisée', () => {
  const enriched = attachSourceRelevance([
    { id: 'a', score: 0.01, document: 'doc a' },
    { id: 'b', score: 0.005, document: 'doc b' },
  ]);
  assert.equal(enriched[0].relevance, 1);
  assert.ok(enriched[1].relevance < enriched[0].relevance);
});

test('applyRagConfidenceGate: refuse si confiance insuffisante', () => {
  const gate = applyRagConfidenceGate({
    query: 'SMAC',
    confidence: { level: 'reject', score: 0.2, reason: 'low' },
    results: [],
  });
  assert.equal(gate.type, 'epistemic_refusal');
  assert.match(gate.message, /éléments fiables/i);
});

test('applyRagConfidenceGate: proceed si confiance acceptable', () => {
  const gate = applyRagConfidenceGate({
    query: 'SMAC',
    confidence: { level: 'acceptable', score: 0.75, reason: 'ok' },
    results: [{ id: 'a', document: 'SMAC consensus' }],
  });
  assert.equal(gate.type, 'proceed');
  assert.equal(gate.results.length, 1);
});
