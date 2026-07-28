/**
 * Worker pipeline D4 — Extract (hybrid) → Design Create → Forge.
 */
import { validateDesignPipelineInput } from './designPipelineContract.js';
import {
  writeDesignPipelineSuccessArtifacts,
  writePartialPipelineFailureArtifacts,
} from './designPipelineArtifacts.js';
import runDesignExtractWorker from '../design-extract/designExtractWorker.js';
import runNexxusDesignWorker from '../nexxus-design/nexxusDesignWorker.js';

export const DESIGN_PIPELINE_STEPS = [
  'design.pipeline.validate',
  'design.pipeline.extract',
  'design.pipeline.design.create',
  'design.pipeline.forge',
  'design.pipeline.done',
];

/**
 * @param {object} options
 * @param {() => boolean} [options.isAborted]
 */
export async function runDesignPipelineWorker(options = {}) {
  const {
    url = null,
    query = '',
    objective = 'redesign',
    referenceDna = null,
    extractEnvelope = null,
    extractionMode = 'hybrid',
    egressPolicy = 'local-only',
    htmlSnapshot = null,
    viewport = null,
    projectTitle = null,
    emitForge = true,
    outputDir = null,
    traceId = null,
    onStep,
    isAborted = () => false,
    extractRunner = runDesignExtractWorker,
    designRunner = runNexxusDesignWorker,
    fetchHtml = undefined,
    browserObservation = null,
    browserObserveRunner = undefined,
    browserLauncher = undefined,
  } = options;

  const orchestrationEvents = [];

  const emit = (step, status, extra = {}) => {
    const entry = {
      step,
      status,
      trace_id: traceId,
      ...extra,
    };
    orchestrationEvents.push(entry);
    onStep?.(entry);
  };

  emit('design.pipeline.validate', 'running');

  const inputCheck = validateDesignPipelineInput({
    url,
    query,
    objective,
    referenceDna: referenceDna || extractEnvelope,
    extractionMode,
    egressPolicy,
    htmlSnapshot,
  });

  if (!inputCheck.ok) {
    emit('design.pipeline.validate', 'error', { violations: inputCheck.violations });
    return {
      ok: false,
      trace_id: traceId,
      phase: 'validate',
      violations: inputCheck.violations,
      orchestrationEvents,
    };
  }

  emit('design.pipeline.validate', 'ok', { mode: inputCheck.mode });

  if (isAborted()) {
    return { ok: false, trace_id: traceId, aborted: true, orchestrationEvents };
  }

  let resolvedDna = referenceDna || extractEnvelope;
  let extractResultEnvelope = null;

  if (inputCheck.mode === 'url_extract') {
    emit('design.pipeline.extract', 'running', { url: inputCheck.normalized.url });

    const extractResult = await extractRunner({
      url: inputCheck.normalized.url,
      query: inputCheck.normalized.query,
      extractionMode: inputCheck.normalized.extractionMode,
      egressPolicy: inputCheck.normalized.egressPolicy,
      htmlSnapshot,
      viewport,
      outputDir,
      traceId,
      fetchHtml,
      browserObservation,
      browserObserveRunner,
      browserLauncher,
      onStep: (entry) => {
        orchestrationEvents.push(entry);
        onStep?.(entry);
        if (isAborted()) return;
      },
    });

    if (isAborted()) {
      return { ok: false, trace_id: traceId, aborted: true, orchestrationEvents };
    }

    if (!extractResult.ok) {
      emit('design.pipeline.extract', 'error', {
        code: extractResult.refusal?.code || extractResult.violations?.[0]?.code,
      });

      let partialFiles = null;
      if (outputDir) {
        const partial = await writePartialPipelineFailureArtifacts(outputDir, {
          phase: 'extract',
          code: extractResult.refusal?.code || 'EXTRACT_FAILED',
          refusal: extractResult.refusal,
          violations: extractResult.violations,
          orchestrationEvents,
          trace_id: traceId,
        });
        partialFiles = partial.files;
      }

      return {
        ok: false,
        trace_id: traceId,
        phase: 'extract',
        refusal: extractResult.refusal,
        violations: extractResult.violations,
        orchestrationEvents,
        artifacts: partialFiles ? { files: partialFiles } : null,
      };
    }

    resolvedDna = extractResult.envelope;
    extractResultEnvelope = extractResult.envelope;
    emit('design.pipeline.extract', 'ok', {
      palette: resolvedDna?.tokens?.colors?.distinct_count,
      quality_score: resolvedDna?.quality_gate?.score,
    });
  } else {
    emit('design.pipeline.extract', 'skipped', { reason: 'reference_dna_provided' });
    extractResultEnvelope = resolvedDna;
  }

  if (isAborted()) {
    return { ok: false, trace_id: traceId, aborted: true, orchestrationEvents };
  }

  emit('design.pipeline.design.create', 'running');

  const designResult = await designRunner({
    query: inputCheck.normalized?.query ?? query,
    objective: inputCheck.normalized?.objective ?? objective,
    referenceDna: resolvedDna,
    projectTitle,
    emitForge,
    outputDir,
    traceId,
    onStep: (entry) => {
      orchestrationEvents.push(entry);
      onStep?.(entry);
      if (entry.step === 'design.create.forge' && entry.status === 'ok') {
        emit('design.pipeline.forge', 'ok', {
          scaffold_template: entry.scaffold_template,
          file_count: entry.file_count,
        });
      }
      if (entry.step === 'design.create.forge' && entry.status === 'running') {
        emit('design.pipeline.forge', 'running');
      }
    },
  });

  if (isAborted()) {
    return { ok: false, trace_id: traceId, aborted: true, orchestrationEvents };
  }

  if (!designResult.ok) {
    emit('design.pipeline.design.create', 'error', {
      code: designResult.violations?.[0]?.code,
    });

    let partialFiles = null;
    if (outputDir) {
      const partial = await writePartialPipelineFailureArtifacts(outputDir, {
        phase: 'design.create',
        code: designResult.violations?.[0]?.code || 'DESIGN_CREATE_FAILED',
        violations: designResult.violations,
        extractEnvelope: extractResultEnvelope,
        orchestrationEvents,
        trace_id: traceId,
      });
      partialFiles = partial.files;
    }

    return {
      ok: false,
      trace_id: traceId,
      phase: 'design.create',
      violations: designResult.violations,
      extractEnvelope: extractResultEnvelope,
      orchestrationEvents,
      artifacts: partialFiles ? { files: partialFiles } : null,
    };
  }

  emit('design.pipeline.design.create', 'ok', {
    objective: designResult.envelope?.objective,
  });

  if (emitForge && designResult.forgeScaffold) {
    emit('design.pipeline.forge', 'ok', {
      scaffold_template: designResult.forgeScaffold.scaffold_template,
    });
  }

  let artifacts = designResult.artifacts;

  if (outputDir) {
    const consolidated = await writeDesignPipelineSuccessArtifacts(outputDir, {
      extractEnvelope: extractResultEnvelope,
      orchestrationEvents,
      existingFiles: designResult.artifacts?.files || {},
    });
    artifacts = { files: { ...consolidated.files, ...(designResult.artifacts?.files || {}) } };
  }

  emit('design.pipeline.done', 'ok', {
    mode: inputCheck.mode,
    objective: designResult.envelope?.objective,
  });

  return {
    ok: true,
    trace_id: traceId,
    mode: inputCheck.mode,
    extractEnvelope: extractResultEnvelope,
    createEnvelope: designResult.envelope,
    forgeScaffold: designResult.forgeScaffold,
    artifacts,
    orchestrationEvents,
  };
}

export default runDesignPipelineWorker;
