/**
 * Worker Impeccable — audit artefacts Forge + rendu observé optionnel (E1/E4).
 */
import {
  validateDesignAuditInput,
  buildImpeccableAuditEnvelope,
} from './impeccableContract.js';
import { scoreImpeccableArtifacts } from './impeccableScorer.js';
import {
  loadForgeArtifactsFromDir,
  loadArtifactsFromPipelineJob,
  loadArtifactsFromCreateJob,
} from './impeccableArtifactLoader.js';
import { writeImpeccableArtifacts } from './impeccableArtifacts.js';

export const IMPECCABLE_STEPS = [
  'impeccable.audit.validate',
  'impeccable.audit.artifacts',
  'impeccable.audit.visual',
  'impeccable.audit.score',
  'impeccable.audit.done',
];

/**
 * @param {object} options
 */
export async function runImpeccableWorker(options = {}) {
  const {
    query = '',
    target = null,
    pipelineJobId = null,
    createJobId = null,
    artifactDir = null,
    createEnvelope = null,
    extractEnvelope = null,
    appJsx = null,
    blueprintMd = null,
    browserObservation = null,
    includeVisualAudit = false,
    outputDir = null,
    traceId = null,
    onStep,
  } = options;

  const emit = (step, status, extra = {}) => {
    onStep?.({ step, status, trace_id: traceId, ...extra });
  };

  emit('impeccable.audit.validate', 'running');

  const inputCheck = validateDesignAuditInput({
    query: query || target,
    target,
    pipelineJobId,
    createJobId,
    artifactDir,
    createEnvelope,
    extractEnvelope,
  });

  if (!inputCheck.ok) {
    emit('impeccable.audit.validate', 'error', { violations: inputCheck.violations });
    return { ok: false, trace_id: traceId, violations: inputCheck.violations };
  }

  emit('impeccable.audit.validate', 'ok');
  emit('impeccable.audit.artifacts', 'running');

  let loaded = {
    createEnvelope,
    extractEnvelope,
    appJsx,
    blueprintMd,
    artifactDir,
    source: 'inline',
  };

  if (pipelineJobId) {
    loaded = await loadArtifactsFromPipelineJob(pipelineJobId);
  } else if (createJobId) {
    loaded = await loadArtifactsFromCreateJob(createJobId);
  } else if (artifactDir) {
    loaded = await loadForgeArtifactsFromDir(artifactDir);
    loaded.source = 'artifact_dir';
  }

  if (!loaded.createEnvelope) {
    emit('impeccable.audit.artifacts', 'error', { code: 'CREATE_ENVELOPE_MISSING' });
    return {
      ok: false,
      trace_id: traceId,
      violations: [
        {
          code: 'CREATE_ENVELOPE_MISSING',
          message: 'design-create.json introuvable — lancer le pipeline D4 avant audit.',
        },
      ],
    };
  }

  emit('impeccable.audit.artifacts', 'ok', {
    source: loaded.source,
    objective: loaded.createEnvelope.objective,
  });

  let visualObservation = browserObservation;

  if (includeVisualAudit && !visualObservation && loaded.extractEnvelope?.source?.url) {
    emit('impeccable.audit.visual', 'skipped', {
      reason: 'browser_observation_not_injected',
    });
  } else if (includeVisualAudit && visualObservation) {
    emit('impeccable.audit.visual', 'running');
    emit('impeccable.audit.visual', 'ok', {
      samples: visualObservation.computed_styles?.length ?? 0,
    });
  } else {
    emit('impeccable.audit.visual', 'skipped', { reason: 'visual_audit_disabled' });
  }

  emit('impeccable.audit.score', 'running');

  const scored = scoreImpeccableArtifacts({
    createEnvelope: loaded.createEnvelope,
    extractEnvelope: loaded.extractEnvelope,
    appJsx: loaded.appJsx,
    blueprintMd: loaded.blueprintMd,
    browserObservation: visualObservation,
  });

  const envelope = buildImpeccableAuditEnvelope({
    ...scored,
    source: loaded.source,
    pipeline_job_id: pipelineJobId || null,
  });

  emit('impeccable.audit.score', 'ok', {
    score_global: envelope.score_global,
    merge_ok: envelope.merge_ok,
    blockers_count: envelope.blockers.length,
  });

  let artifacts = null;
  if (outputDir) {
    artifacts = await writeImpeccableArtifacts(outputDir, envelope, {
      source: loaded.source,
      job_id: pipelineJobId || createJobId || null,
    });
  }

  emit('impeccable.audit.done', envelope.merge_ok ? 'ok' : 'blocked', {
    merge_ok: envelope.merge_ok,
  });

  return {
    ok: true,
    trace_id: traceId,
    envelope,
    artifacts,
    merge_ok: envelope.merge_ok,
  };
}

export default runImpeccableWorker;
