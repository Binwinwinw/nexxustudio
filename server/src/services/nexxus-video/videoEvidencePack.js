/**
 * Assemblage evidence pack — représentation structurée pour analyse Nexxus.
 */

/**
 * @param {object} payload
 * @returns {object}
 */
export function buildVideoEvidencePack(payload = {}) {
  const {
    sourceHash = null,
    objective = 'summary',
    depth = 'fast',
    probe = {},
    scenes = [],
    keyframes = [],
    transcript = {},
    ocr = {},
    sceneMeta = {},
  } = payload;

  const spokenSegments = transcript.segments || [];
  const ocrEntries = ocr.entries || [];

  const uncertainties = [];
  if (sceneMeta.warning) uncertainties.push(sceneMeta.warning);
  if (transcript.message && spokenSegments.length === 0) {
    uncertainties.push(transcript.message);
  }
  if (ocr.message && ocrEntries.length === 0) {
    uncertainties.push(ocr.message);
  }

  const segmentConfidence = scenes.map((scene) => ({
    scene_id: scene.id,
    confidence: scene.confidence ?? 0.5,
    start_s: scene.start_s,
    end_s: scene.end_s,
  }));

  return {
    version: '1.0.0',
    kind: 'nexxus.video.evidence_pack',
    objective,
    depth,
    source: {
      hash_sha256: sourceHash,
      container: probe.container || null,
      duration_s: probe.durationSeconds ?? null,
      size_bytes: probe.sizeBytes ?? null,
      has_audio: probe.hasAudio ?? null,
      resolution:
        probe.width && probe.height ? `${probe.width}x${probe.height}` : null,
    },
    scenes,
    keyframes,
    transcript: {
      ok: transcript.ok !== false,
      segments: spokenSegments,
      source: transcript.source || null,
    },
    ocr: {
      ok: ocr.ok !== false,
      entries: ocrEntries,
      source: ocr.source || null,
    },
    uncertainties,
    segment_confidence: segmentConfidence,
    generated_at: new Date().toISOString(),
  };
}

/**
 * @param {object} pack
 * @param {object} [analysis]
 */
export function buildVideoAnalysisResult(pack, analysis = {}) {
  return {
    version: '1.0.0',
    kind: 'nexxus.video.analysis_result',
    objective: pack.objective,
    summary: analysis.summary || null,
    timeline: analysis.timeline || [],
    highlights: analysis.highlights || [],
    spoken_text: analysis.spoken_text || [],
    on_screen_text: analysis.on_screen_text || [],
    confidence: analysis.confidence ?? null,
    evidence_pack: pack,
    generated_at: new Date().toISOString(),
  };
}

export default {
  buildVideoEvidencePack,
  buildVideoAnalysisResult,
};
