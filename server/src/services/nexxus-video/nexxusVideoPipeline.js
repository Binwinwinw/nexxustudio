/**
 * Orchestrateur Nexxus Video — job asynchrone structuré (MVP v1).
 */
import {
  VIDEO_PIPELINE_STEPS,
  VIDEO_REFUSAL_CODES,
} from './videoRouterContract.js';
import { preprocessVideo } from './videoPreprocessor.js';
import {
  buildVideoEvidencePack,
  buildVideoAnalysisResult,
} from './videoEvidencePack.js';
import { writeVideoArtifacts } from './videoArtifactsService.js';

/**
 * @param {object} options
 * @param {string} options.filePath
 * @param {string} [options.objective]
 * @param {string} [options.depth]
 * @param {string} [options.outputDir]
 * @param {string} [options.egressPolicy]
 * @param {Function} [options.onStep]
 * @param {string} [options.traceId]
 */
export async function runNexxusVideoPipeline(options = {}) {
  const {
    filePath,
    objective = 'summary',
    depth = 'fast',
    outputDir = null,
    egressPolicy = 'local-only',
    onStep,
    traceId = null,
  } = options;

  const timeline = [];
  const emit = (step, status, extra = {}) => {
    const entry = {
      step,
      status,
      at: new Date().toISOString(),
      trace_id: traceId,
      ...extra,
    };
    timeline.push(entry);
    onStep?.(entry);
  };

  for (const step of VIDEO_PIPELINE_STEPS) {
    emit(step, 'pending');
  }

  emit('video.probe', 'running');
  const preprocessed = await preprocessVideo({ filePath, egressPolicy });

  if (!preprocessed.ok) {
    emit('video.probe', 'error', {
      code: preprocessed.code || preprocessed.violations?.[0]?.code,
      message:
        preprocessed.message ||
        preprocessed.violations?.[0]?.message ||
        'Prétraitement refusé.',
    });
    return {
      ok: false,
      trace_id: traceId,
      timeline,
      refusal: preprocessed,
    };
  }

  emit('video.probe', 'ok', { sourceHash: preprocessed.sourceHash });
  emit('video.scene_detect', 'ok', { scenes: preprocessed.scenes.length });
  emit('video.transcribe', preprocessed.transcript.ok ? 'ok' : 'degraded', {
    segments: preprocessed.transcript.segments?.length || 0,
  });
  emit('video.ocr', preprocessed.ocr.ok ? 'ok' : 'degraded');
  emit('video.pack_build', 'running');

  const evidencePack = buildVideoEvidencePack({
    ...preprocessed,
    objective,
    depth,
    sceneMeta: preprocessed.sceneMeta,
  });

  emit('video.pack_build', 'ok');
  emit('video.analyze', 'running');

  const analysisResult = buildVideoAnalysisResult(evidencePack, {
    summary:
      evidencePack.scenes.length > 0
        ? `Vidéo structurée en ${evidencePack.scenes.length} scène(s). Analyse Nexxus à brancher sur le evidence pack.`
        : null,
    timeline: evidencePack.scenes.map((scene) => ({
      at_s: scene.start_s,
      label: `Scène ${scene.id}`,
    })),
    highlights: [],
    spoken_text: evidencePack.transcript.segments,
    on_screen_text: evidencePack.ocr.entries,
    confidence:
      evidencePack.segment_confidence.length > 0
        ? evidencePack.segment_confidence.reduce(
            (sum, item) => sum + item.confidence,
            0,
          ) / evidencePack.segment_confidence.length
        : 0,
  });

  if (!analysisResult.summary) {
    emit('video.analyze', 'error', {
      code: VIDEO_REFUSAL_CODES.INSUFFICIENT_SIGNAL,
      message: 'Signal vidéo insuffisant pour analyse.',
    });
    return {
      ok: false,
      trace_id: traceId,
      timeline,
      evidencePack,
      refusal: {
        code: VIDEO_REFUSAL_CODES.INSUFFICIENT_SIGNAL,
        message: 'Signal vidéo insuffisant pour analyse.',
      },
    };
  }

  emit('video.analyze', 'ok');

  let artifacts = null;
  if (outputDir) {
    artifacts = await writeVideoArtifacts(outputDir, {
      evidencePack,
      analysisResult,
    });
  }

  return {
    ok: true,
    trace_id: traceId,
    timeline,
    evidencePack,
    analysisResult,
    artifacts,
  };
}

export default runNexxusVideoPipeline;
