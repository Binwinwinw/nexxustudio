/**
 * Persistance artefacts Browser Harness — observation JSON, styles, trace JSONL.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '../../data/browser-sessions');

export const BROWSER_SESSION_ARTIFACT_ROOT =
  process.env.BROWSER_HARNESS_ARTIFACT_DIR || DEFAULT_ROOT;

/**
 * @param {string} sessionRoot — ex. browser-sessions/{browser_session_id}
 * @param {object} envelope
 * @param {object} [meta]
 * @param {Array} [meta.events]
 * @param {Array} [meta.computed_styles]
 */
export async function writeBrowserTraceArtifacts(sessionRoot, envelope = {}, meta = {}) {
  await fs.mkdir(sessionRoot, { recursive: true });

  const observationPath = path.join(sessionRoot, 'observation.json');
  const stylesPath = path.join(sessionRoot, 'computed-styles.json');
  const tracePath = path.join(sessionRoot, 'trace.jsonl');

  await fs.writeFile(observationPath, JSON.stringify(envelope, null, 2), 'utf8');

  const computed_styles = meta.computed_styles || envelope.computed_styles || [];
  await fs.writeFile(stylesPath, JSON.stringify(computed_styles, null, 2), 'utf8');

  const events = meta.events || [];
  if (events.length > 0) {
    const lines = events.map((event) => JSON.stringify(event)).join('\n');
    await fs.writeFile(tracePath, `${lines}\n`, 'utf8');
  }

  return {
    outputDir: sessionRoot,
    files: {
      observation_json: observationPath,
      computed_styles_json: stylesPath,
      trace_jsonl: events.length > 0 ? tracePath : null,
    },
  };
}

/**
 * Artefacts partiels en cas d'échec (trace + refusal) — C6 fail-closed auditable.
 * @param {string} sessionRoot
 * @param {object} [payload]
 * @param {Array} [payload.events]
 * @param {object} [payload.refusal]
 * @param {string} [payload.trace_id]
 * @param {string} [payload.job_id]
 * @param {string} [payload.browser_session_id]
 */
export async function writePartialBrowserFailureArtifacts(sessionRoot, payload = {}) {
  await fs.mkdir(sessionRoot, { recursive: true });

  const files = {};
  const events = payload.events || [];

  if (events.length > 0) {
    const tracePath = path.join(sessionRoot, 'trace.jsonl');
    const lines = events.map((event) => JSON.stringify(event)).join('\n');
    await fs.writeFile(tracePath, `${lines}\n`, 'utf8');
    files.trace_jsonl = tracePath;
  }

  const failurePath = path.join(sessionRoot, 'failure.json');
  await fs.writeFile(
    failurePath,
    JSON.stringify(
      {
        code: payload.refusal?.code || payload.code || 'BROWSER_OBSERVE_FAILED',
        message: payload.refusal?.message || payload.message || 'Observation échouée.',
        trace_id: payload.trace_id || null,
        job_id: payload.job_id || null,
        browser_session_id: payload.browser_session_id || null,
        recorded_at: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );
  files.failure_json = failurePath;

  return { outputDir: sessionRoot, files };
}

/**
 * @param {string} browserSessionId
 * @param {string} [artifactRoot]
 */
export function resolveBrowserSessionArtifactDir(browserSessionId, artifactRoot = BROWSER_SESSION_ARTIFACT_ROOT) {
  return path.join(artifactRoot, browserSessionId);
}

export default {
  BROWSER_SESSION_ARTIFACT_ROOT,
  writeBrowserTraceArtifacts,
  writePartialBrowserFailureArtifacts,
  resolveBrowserSessionArtifactDir,
};
