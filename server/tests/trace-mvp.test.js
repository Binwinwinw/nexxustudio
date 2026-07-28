import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { traceStore } from '../src/agent/telemetry/traceStore.js';
import turnTelemetry from '../src/agent/telemetry/turnTelemetry.js';
import { SPAN_NAMES } from '../src/agent/telemetry/otelSemanticMap.js';
import { traceContextMiddleware } from '../src/middleware/traceContextMiddleware.js';

test('traceStore: FIFO eviction when max traces exceeded', () => {
  traceStore.clear();
  traceStore.maxTraces = 2;

  traceStore.save({
    trace_id: 'trace-a',
    session_id: 'sess-a',
    status: 'ok',
    started_at: new Date().toISOString(),
    spans: [],
    events: [],
  });
  traceStore.save({
    trace_id: 'trace-b',
    session_id: 'sess-b',
    status: 'ok',
    started_at: new Date().toISOString(),
    spans: [],
    events: [],
  });
  traceStore.save({
    trace_id: 'trace-c',
    session_id: 'sess-c',
    status: 'ok',
    started_at: new Date().toISOString(),
    spans: [],
    events: [],
  });

  assert.equal(traceStore.get('trace-a'), null);
  assert.ok(traceStore.get('trace-b'));
  assert.ok(traceStore.get('trace-c'));

  traceStore.maxTraces = 500;
  traceStore.clear();
});

test('traceStore: listBySession returns newest first', () => {
  traceStore.clear();
  traceStore.save({
    trace_id: 't1',
    session_id: 'sess-x',
    status: 'ok',
    started_at: '2026-05-30T10:00:00.000Z',
    spans: [{ name: 'a' }],
    events: [],
  });
  traceStore.save({
    trace_id: 't2',
    session_id: 'sess-x',
    status: 'error',
    started_at: '2026-05-30T11:00:00.000Z',
    spans: [{ name: 'b' }, { name: 'c' }],
    events: [],
  });

  const list = traceStore.listBySession('sess-x', 5);
  assert.equal(list.length, 2);
  assert.equal(list[0].trace_id, 't2');
  assert.equal(list[0].span_count, 2);
});

test('turnTelemetry: startTrace → spans → finishTrace exporte une trace ordonnée', () => {
  const traceId = crypto.randomUUID();
  const sessionId = 'sess-test-1';

  turnTelemetry.startTrace({
    traceId,
    sessionId,
    query: 'bonjour nexxus',
  });

  turnTelemetry.startSpan(SPAN_NAMES.INTENT);
  turnTelemetry.endSpan(SPAN_NAMES.INTENT, { status: 'ok' });

  turnTelemetry.recordEvent('pipeline.route', { path: 'social', status: 'ok' });

  const exported = turnTelemetry.finishTrace({ status: 'ok', responseMode: 'INSTANT' });

  assert.equal(exported.trace_id, traceId);
  assert.equal(exported.session_id, sessionId);
  assert.equal(exported.turn_id, traceId);
  assert.equal(exported.status, 'ok');
  assert.ok(Array.isArray(exported.spans));
  assert.ok(exported.spans.length >= 2);

  const intentSpan = exported.spans.find((s) => s.name === SPAN_NAMES.INTENT);
  assert.ok(intentSpan?.span_id);
  assert.ok(intentSpan?.started_at);
  assert.ok(intentSpan?.ended_at);
  assert.equal(intentSpan.status, 'ok');

  const timeline = exported.timeline || [];
  assert.ok(timeline.length >= 1);
  assert.ok(timeline.every((e) => e.trace_id === traceId));

  const stored = traceStore.get(traceId);
  assert.ok(stored);
  assert.equal(stored.response_mode, 'INSTANT');
});

test('turnTelemetry: erreur conserve trace_id dans export', () => {
  const traceId = crypto.randomUUID();

  turnTelemetry.startTrace({ traceId, sessionId: 'sess-err', query: 'fail test' });
  turnTelemetry.recordError(new Error('LLM timeout'));
  const exported = turnTelemetry.finishTrace({ status: 'error' });

  assert.equal(exported.trace_id, traceId);
  assert.equal(exported.status, 'error');
  assert.match(exported.error?.message || '', /LLM timeout/);
});

test('traceContextMiddleware: propage ou génère X-Trace-Id', () => {
  const existing = crypto.randomUUID();
  const headers = {};
  const req = { headers: { 'x-trace-id': existing } };
  const res = {
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
  };

  traceContextMiddleware(req, res, () => {});
  assert.equal(req.traceId, existing);
  assert.equal(headers['x-trace-id'], existing);

  const req2 = { headers: {} };
  traceContextMiddleware(req2, res, () => {});
  assert.ok(/^[0-9a-f-]{36}$/i.test(req2.traceId));
});
