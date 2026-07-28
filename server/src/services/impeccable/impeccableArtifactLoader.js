/**
 * Charge artefacts Forge / pipeline pour audit Impeccable.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { DESIGN_PIPELINE_ARTIFACT_ROOT } from '../design-pipeline/designPipelineArtifacts.js';
import { NEXXUS_DESIGN_ARTIFACT_ROOT } from '../nexxus-design/nexxusDesignArtifacts.js';

const PIPELINE_ROOT = DESIGN_PIPELINE_ARTIFACT_ROOT;
const CREATE_ROOT = NEXXUS_DESIGN_ARTIFACT_ROOT;

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * @param {string} artifactDir
 */
export async function loadForgeArtifactsFromDir(artifactDir) {
  const createEnvelope =
    (await readJsonIfExists(path.join(artifactDir, 'design-create.json'))) ||
    (await readJsonIfExists(path.join(artifactDir, 'design_create.json')));

  const extractEnvelope =
    (await readJsonIfExists(path.join(artifactDir, 'extract-envelope.json'))) ||
    (await readJsonIfExists(path.join(artifactDir, 'design-dna.json')));

  const appJsx = await readTextIfExists(path.join(artifactDir, 'src', 'App.jsx'));
  const blueprintMd = await readTextIfExists(path.join(artifactDir, 'blueprint.md'));
  const forgeScaffold = await readJsonIfExists(
    path.join(artifactDir, 'forge-scaffold.json'),
  );
  const componentsManifest = await readJsonIfExists(
    path.join(artifactDir, 'components-manifest.json'),
  );

  return {
    artifactDir,
    createEnvelope,
    extractEnvelope,
    appJsx,
    blueprintMd,
    forgeScaffold,
    componentsManifest,
  };
}

/**
 * @param {string} pipelineJobId
 */
export async function loadArtifactsFromPipelineJob(pipelineJobId) {
  const artifactDir = path.join(PIPELINE_ROOT, pipelineJobId);
  const loaded = await loadForgeArtifactsFromDir(artifactDir);
  return { ...loaded, pipelineJobId, source: 'design.pipeline' };
}

/**
 * @param {string} createJobId
 */
export async function loadArtifactsFromCreateJob(createJobId) {
  const artifactDir = path.join(CREATE_ROOT, createJobId);
  const loaded = await loadForgeArtifactsFromDir(artifactDir);
  return { ...loaded, createJobId, source: 'design.create' };
}

export default {
  loadForgeArtifactsFromDir,
  loadArtifactsFromPipelineJob,
  loadArtifactsFromCreateJob,
};
