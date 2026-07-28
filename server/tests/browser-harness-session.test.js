import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultBrowserLauncher,
  createMockBrowserLauncher,
  launchBrowserSession,
  closeBrowserSession,
  withBrowserSession,
  assertSessionWithinTimeout,
} from '../src/services/browser-harness/browserSessionService.js';
import { BROWSER_SESSION_TIMEOUT_MS } from '../src/services/browser-harness/browserPolicy.js';

test('defaultBrowserLauncher: fail-closed sans Chromium', async () => {
  const result = await defaultBrowserLauncher();
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CHROMIUM_UNAVAILABLE');
});

test('launchBrowserSession: mock launcher démarre session', async () => {
  const result = await launchBrowserSession({
    traceId: 'trace-launch',
    browserLauncher: createMockBrowserLauncher(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.session.trace_id, 'trace-launch');
  assert.ok(result.session.browser);
  assert.ok(result.session.page);
  assert.equal(result.session.ctx.isClosed(), false);

  await closeBrowserSession(result.session);
  assert.equal(result.session.ctx.isClosed(), true);
});

test('closeBrowserSession: idempotent', async () => {
  const { session } = await launchBrowserSession({
    browserLauncher: createMockBrowserLauncher(),
  });

  const first = await closeBrowserSession(session, 'test');
  const second = await closeBrowserSession(session, 'test');

  assert.equal(first.closed, true);
  assert.equal(second.idempotent, true);
});

test('withBrowserSession: fermeture en finally sur succès', async () => {
  let sessionRef = null;

  const outcome = await withBrowserSession(
    {
      traceId: 'trace-with-success',
      browserLauncher: createMockBrowserLauncher(),
    },
    async (session) => {
      sessionRef = session;
      assert.equal(session.ctx.isClosed(), false);
      return { observed: true };
    },
  );

  assert.equal(outcome.ok, true);
  assert.equal(outcome.result.observed, true);
  assert.equal(sessionRef.ctx.isClosed(), true);
});

test('withBrowserSession: fermeture en finally sur erreur runner', async () => {
  let sessionRef = null;

  const outcome = await withBrowserSession(
    {
      browserLauncher: createMockBrowserLauncher(),
    },
    async (session) => {
      sessionRef = session;
      throw new Error('Runner failure');
    },
  );

  assert.equal(outcome.ok, false);
  assert.equal(outcome.refusal.code, 'SESSION_ERROR');
  assert.equal(sessionRef.ctx.isClosed(), true);
});

test('assertSessionWithinTimeout: refuse session expirée', async () => {
  const { session } = await launchBrowserSession({
    browserLauncher: createMockBrowserLauncher(),
  });

  session.launched_at = Date.now() - BROWSER_SESSION_TIMEOUT_MS - 100;

  assert.throws(
    () => assertSessionWithinTimeout(session),
    (error) => error.code === 'SESSION_TIMEOUT',
  );

  await closeBrowserSession(session);
});

test('withBrowserSession: propage SESSION_TIMEOUT', async () => {
  const outcome = await withBrowserSession(
    {
      browserLauncher: createMockBrowserLauncher(),
    },
    async (session) => {
      session.launched_at = Date.now() - BROWSER_SESSION_TIMEOUT_MS - 50;
      assertSessionWithinTimeout(session);
    },
  );

  assert.equal(outcome.ok, false);
  assert.equal(outcome.refusal.code, 'SESSION_TIMEOUT');
});

test('launchBrowserSession: propage échec launcher', async () => {
  const result = await launchBrowserSession({
    browserLauncher: async () => ({
      ok: false,
      code: 'LAUNCH_DENIED',
      message: 'Refus test',
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.refusal.code, 'LAUNCH_DENIED');
});

test('withBrowserSession: refuse sans launcher réel par défaut', async () => {
  const outcome = await withBrowserSession({}, async () => ({}));
  assert.equal(outcome.ok, false);
  assert.equal(outcome.refusal.code, 'CHROMIUM_UNAVAILABLE');
});
