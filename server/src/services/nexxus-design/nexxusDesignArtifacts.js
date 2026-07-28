/**
 * Persistance artefacts Nexxus Design + bridge Forge.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '../../data/nexxus-design-jobs');

export const NEXXUS_DESIGN_ARTIFACT_ROOT =
  process.env.NEXXUS_DESIGN_ARTIFACT_DIR || DEFAULT_ROOT;

/**
 * @param {string} outputDir
 * @param {object} envelope
 * @param {object} [forgeScaffold]
 */
export async function writeNexxusDesignArtifacts(outputDir, envelope = {}, forgeScaffold = null) {
  await fs.mkdir(outputDir, { recursive: true });

  const createJsonPath = path.join(outputDir, 'design-create.json');
  await fs.writeFile(createJsonPath, JSON.stringify(envelope, null, 2), 'utf8');

  const files = {
    design_create_json: createJsonPath,
  };

  if (forgeScaffold?.files) {
    for (const [relativePath, content] of Object.entries(forgeScaffold.files)) {
      const targetPath = path.join(outputDir, relativePath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, 'utf8');
      const key = relativePath.replace(/[/\\]/g, '_').replace(/\./g, '_');
      files[key] = targetPath;
    }
    files.blueprint_md = path.join(outputDir, 'blueprint.md');
    files.app_jsx = path.join(outputDir, 'src', 'App.jsx');
    files.components_manifest_json = path.join(outputDir, 'components-manifest.json');
  }

  return { outputDir, files };
}

/**
 * Artefacts partiels en cas d'échec job (trace SSE + refusal).
 * @param {string} outputDir
 * @param {object} payload
 */
export async function writePartialDesignFailureArtifacts(outputDir, payload = {}) {
  await fs.mkdir(outputDir, { recursive: true });
  const files = {};

  if (payload.events?.length > 0) {
    const tracePath = path.join(outputDir, 'trace.jsonl');
    const lines = payload.events.map((event) => JSON.stringify(event)).join('\n');
    await fs.writeFile(tracePath, `${lines}\n`, 'utf8');
    files.trace_jsonl = tracePath;
  }

  const failurePath = path.join(outputDir, 'failure.json');
  await fs.writeFile(
    failurePath,
    JSON.stringify(
      {
        code: payload.code || payload.violations?.[0]?.code || 'DESIGN_CREATE_FAILED',
        message:
          payload.message ||
          payload.violations?.[0]?.message ||
          payload.refusal?.message ||
          'Création design refusée.',
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
  NEXXUS_DESIGN_ARTIFACT_ROOT,
  writeNexxusDesignArtifacts,
  writePartialDesignFailureArtifacts,
};
