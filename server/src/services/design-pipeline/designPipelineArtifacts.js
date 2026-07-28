/**
 * Persistance artefacts pipeline D4 — dossier job unifié.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '../../data/design-pipeline-jobs');

export const DESIGN_PIPELINE_ARTIFACT_ROOT =
  process.env.DESIGN_PIPELINE_ARTIFACT_DIR || DEFAULT_ROOT;

/**
 * @param {string} outputDir
 * @param {object} payload
 */
export async function writeDesignPipelineSuccessArtifacts(outputDir, payload = {}) {
  await fs.mkdir(outputDir, { recursive: true });
  const files = { ...(payload.existingFiles || {}) };

  if (payload.extractEnvelope) {
    const extractPath = path.join(outputDir, 'extract-envelope.json');
    await fs.writeFile(extractPath, JSON.stringify(payload.extractEnvelope, null, 2), 'utf8');
    files.extract_envelope_json = extractPath;
  }

  if (payload.orchestrationEvents?.length > 0) {
    const tracePath = path.join(outputDir, 'pipeline-trace.jsonl');
    const lines = payload.orchestrationEvents
      .map((event) => JSON.stringify(event))
      .join('\n');
    await fs.writeFile(tracePath, `${lines}\n`, 'utf8');
    files.pipeline_trace_jsonl = tracePath;
  }

  return { outputDir, files };
}

/**
 * @param {string} outputDir
 * @param {object} payload
 */
export async function writePartialPipelineFailureArtifacts(outputDir, payload = {}) {
  await fs.mkdir(outputDir, { recursive: true });
  const files = {};

  if (payload.extractEnvelope) {
    const extractPath = path.join(outputDir, 'extract-envelope.json');
    await fs.writeFile(extractPath, JSON.stringify(payload.extractEnvelope, null, 2), 'utf8');
    files.extract_envelope_json = extractPath;
  }

  if (payload.createEnvelope) {
    const createPath = path.join(outputDir, 'design-create.json');
    await fs.writeFile(createPath, JSON.stringify(payload.createEnvelope, null, 2), 'utf8');
    files.design_create_json = createPath;
  }

  if (payload.orchestrationEvents?.length > 0) {
    const tracePath = path.join(outputDir, 'pipeline-trace.jsonl');
    const lines = payload.orchestrationEvents
      .map((event) => JSON.stringify(event))
      .join('\n');
    await fs.writeFile(tracePath, `${lines}\n`, 'utf8');
    files.pipeline_trace_jsonl = tracePath;
  }

  const failurePath = path.join(outputDir, 'failure.json');
  await fs.writeFile(
    failurePath,
    JSON.stringify(
      {
        phase: payload.phase || 'unknown',
        code: payload.code || payload.violations?.[0]?.code || 'PIPELINE_FAILED',
        message:
          payload.message ||
          payload.refusal?.message ||
          payload.violations?.[0]?.message ||
          'Pipeline design refusé (fail-closed).',
        trace_id: payload.trace_id || null,
        job_id: payload.job_id || null,
        recorded_at: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );
  files.failure_json = failurePath;

  return { outputDir, files };
}

export default {
  DESIGN_PIPELINE_ARTIFACT_ROOT,
  writeDesignPipelineSuccessArtifacts,
  writePartialPipelineFailureArtifacts,
};
