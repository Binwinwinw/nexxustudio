import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBrowserNavigationUrl,
  validateBrowserAction,
  validateBrowserActionList,
  validateBrowserViewport,
  validateBrowserSessionPolicy,
  validateBrowserSessionTimeout,
  getBrowserSessionLimits,
  getBrowserTimeoutPolicy,
  BROWSER_SESSION_TIMEOUT_MS,
} from '../src/services/browser-harness/browserPolicy.js';
import {
  validateObserveInput,
  buildObservationEnvelope,
  buildBrowserRefusal,
  OBSERVATION_ENVELOPE_VERSION,
} from '../src/services/browser-harness/browserHarnessContract.js';
import {
  createBrowserCorrelationIds,
  createBrowserSessionContext,
  buildBrowserHarnessLog,
} from '../src/services/browser-harness/browserHarnessObservability.js';

test('validateBrowserNavigationUrl: local-only autorise localhost', () => {
  const result = validateBrowserNavigationUrl('http://127.0.0.1:5173/', 'local-only');
  assert.equal(result.ok, true);
});

test('validateBrowserNavigationUrl: local-only refuse domaine public', () => {
  const result = validateBrowserNavigationUrl('https://example.com', 'local-only');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EGRESS_LOCAL_ONLY');
});

test('validateBrowserAction: refuse click en Phase C', () => {
  const result = validateBrowserAction('click', 'observe');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACTION_FORBIDDEN');
});

test('validateBrowserAction: autorise navigate en observe', () => {
  const result = validateBrowserAction('navigate', 'observe');
  assert.equal(result.ok, true);
});

test('validateBrowserViewport: refuse dimensions invalides', () => {
  const result = validateBrowserViewport({ width: 100, height: 100 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'VIEWPORT_INVALID');
});

test('validateBrowserSessionPolicy: bloque download et upload', () => {
  assert.equal(validateBrowserSessionPolicy({ intent: 'download' }).ok, false);
  assert.equal(validateBrowserSessionPolicy({ intent: 'upload' }).ok, false);
});

test('validateBrowserSessionTimeout: refuse session expirée', () => {
  const result = validateBrowserSessionTimeout(BROWSER_SESSION_TIMEOUT_MS + 1);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SESSION_TIMEOUT');
});

test('getBrowserSessionLimits: downloads et uploads désactivés', () => {
  const limits = getBrowserSessionLimits();
  assert.equal(limits.downloadsAllowed, false);
  assert.equal(limits.uploadsAllowed, false);
  assert.equal(limits.maxPagesPerSession, 1);
});

test('validateObserveInput: accepte requête observe minimale', () => {
  const result = validateObserveInput({
    url: 'http://localhost:5173/',
    traceId: 'trace-browser-test',
  });
  assert.equal(result.ok, true);
  assert.equal(result.normalized.trace_id, 'trace-browser-test');
  assert.ok(result.normalized.browser_session_id.startsWith('bsess-'));
});

test('validateObserveInput: refuse URL manquante', () => {
  const result = validateObserveInput({});
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].code, 'URL_REQUIRED');
});

test('validateObserveInput: refuse action interdite', () => {
  const result = validateObserveInput({
    url: 'http://127.0.0.1:5173/',
    requestedActions: ['navigate', 'click'],
  });
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((v) => v.code === 'ACTION_FORBIDDEN'));
});

test('validateObserveInput: refuse allowDownload explicite', () => {
  const result = validateObserveInput({
    url: 'http://127.0.0.1:5173/',
    allowDownload: true,
  });
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((v) => v.code === 'DOWNLOAD_FORBIDDEN'));
});

test('buildObservationEnvelope: schéma v1.0.0', () => {
  const envelope = buildObservationEnvelope({
    url: 'http://127.0.0.1:5173/',
    trace_id: 'trace-1',
    browser_session_id: 'bsess-1',
    response_status: 200,
    style_summary: { samples_count: 10, unique_colors: 4, unique_font_families: 1 },
  });
  assert.equal(envelope.version, OBSERVATION_ENVELOPE_VERSION);
  assert.equal(envelope.kind, 'nexxus.browser.observation_result');
  assert.equal(envelope.session.trace_id, 'trace-1');
  assert.equal(envelope.source.response_status, 200);
});

test('buildBrowserRefusal: porte trace_id et code explicite', () => {
  const refusal = buildBrowserRefusal({
    code: 'EGRESS_LOCAL_ONLY',
    message: 'Refus test',
    trace_id: 'trace-refusal',
  });
  assert.equal(refusal.ok, false);
  assert.equal(refusal.trace_id, 'trace-refusal');
  assert.equal(refusal.refusal.code, 'EGRESS_LOCAL_ONLY');
});

test('createBrowserCorrelationIds: génère ids corrélés', () => {
  const ids = createBrowserCorrelationIds({ traceId: 'trace-corr' });
  assert.equal(ids.trace_id, 'trace-corr');
  assert.match(ids.browser_session_id, /^bsess-/);
});

test('createBrowserSessionContext: fermeture idempotente', () => {
  const ctx = createBrowserSessionContext(
    createBrowserCorrelationIds({ traceId: 'trace-close' }),
  );
  assert.equal(ctx.isClosed(), false);
  const first = ctx.markClosed('test');
  assert.equal(first.closed, true);
  assert.equal(ctx.isClosed(), true);
});

test('buildBrowserHarnessLog: structure JSON stable', () => {
  const log = buildBrowserHarnessLog({
    trace_id: 'trace-log',
    step: 'browser.observe.validate',
    status: 'ok',
  });
  assert.equal(log.component, 'browser-harness');
  assert.equal(log.trace_id, 'trace-log');
});

test('getBrowserTimeoutPolicy: expose limites navigation et session', () => {
  const policy = getBrowserTimeoutPolicy();
  assert.ok(policy.navigation_ms > 0);
  assert.ok(policy.session_ms >= policy.navigation_ms);
});

test('validateBrowserActionList: autorise pipeline observe par défaut', () => {
  const result = validateBrowserActionList(
    ['navigate', 'snapshot', 'styles', 'close'],
    'observe',
  );
  assert.equal(result.ok, true);
});
