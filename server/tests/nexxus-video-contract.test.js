import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateVideoInput,
  NEXXUS_VIDEO_LIMITS,
  VIDEO_REFUSAL_CODES,
} from '../src/services/nexxus-video/videoRouterContract.js';
import { buildVideoEvidencePack } from '../src/services/nexxus-video/videoEvidencePack.js';
import { renderEvidencePackMarkdown } from '../src/services/nexxus-video/videoArtifactsService.js';

test('validateVideoInput: accepte MP4 dans les limites MVP', () => {
  const result = validateVideoInput({
    container: 'mp4',
    durationSeconds: 120,
    sizeBytes: 10 * 1024 * 1024,
    egressPolicy: 'local-only',
  });
  assert.equal(result.ok, true);
});

test('validateVideoInput: refuse durée > 10 minutes', () => {
  const result = validateVideoInput({
    container: 'mp4',
    durationSeconds: NEXXUS_VIDEO_LIMITS.maxDurationSeconds + 1,
  });
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].code, VIDEO_REFUSAL_CODES.DURATION_EXCEEDED);
});

test('validateVideoInput: refuse format non MP4', () => {
  const result = validateVideoInput({ container: 'mkv' });
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].code, VIDEO_REFUSAL_CODES.UNSUPPORTED_FORMAT);
});

test('buildVideoEvidencePack: assemble scènes et incertitudes', () => {
  const pack = buildVideoEvidencePack({
    sourceHash: 'abc123',
    objective: 'summary',
    depth: 'fast',
    probe: {
      container: 'mp4',
      durationSeconds: 90,
      sizeBytes: 1024,
      hasAudio: true,
      width: 1920,
      height: 1080,
    },
    scenes: [{ id: 'scene-1', start_s: 0, end_s: 90, confidence: 0.8 }],
    keyframes: [{ scene_id: 'scene-1', timestamp_s: 0 }],
    transcript: { ok: true, segments: [], source: 'stub', message: 'Transcription pending' },
    ocr: { ok: true, entries: [], source: 'stub' },
    sceneMeta: { source: 'stub' },
  });

  assert.equal(pack.kind, 'nexxus.video.evidence_pack');
  assert.equal(pack.scenes.length, 1);
  assert.ok(pack.uncertainties.some((note) => /Transcription/i.test(note)));
});

test('renderEvidencePackMarkdown: inclut scènes et hash', () => {
  const md = renderEvidencePackMarkdown({
    objective: 'timeline',
    depth: 'fast',
    source: { hash_sha256: 'deadbeef', duration_s: 42 },
    scenes: [{ id: 'scene-1', start_s: 0, end_s: 42, confidence: 0.7 }],
    uncertainties: [],
  });
  assert.match(md, /deadbeef/);
  assert.match(md, /scene-1/);
});
