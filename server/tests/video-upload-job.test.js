import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMp4MagicBytes,
  validateVideoUploadFile,
  VIDEO_UPLOAD_REJECTION_CODES,
} from '../src/services/nexxus-video/videoUploadService.js';
import { VideoJobManager } from '../src/services/nexxus-video/VideoJobManager.js';

/** Buffer minimal ISO-BMFF avec box ftyp. */
function minimalMp4Buffer() {
  return Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x00,
    0x69, 0x73, 0x6f, 0x6d, 0x61, 0x76, 0x63, 0x31,
  ]);
}

test('validateMp4MagicBytes: accepte ftyp', () => {
  assert.equal(validateMp4MagicBytes(minimalMp4Buffer()), true);
});

test('validateMp4MagicBytes: rejette PDF déguisé', () => {
  const pdf = Buffer.from('%PDF-1.4 fake video');
  assert.equal(validateMp4MagicBytes(pdf), false);
});

test('validateVideoUploadFile: accepte MP4 conforme', () => {
  const buffer = minimalMp4Buffer();
  const result = validateVideoUploadFile({
    buffer,
    mimetype: 'video/mp4',
    originalname: 'demo.mp4',
    size: buffer.length,
  });
  assert.equal(result.ok, true);
});

test('validateVideoUploadFile: rejette MIME incorrect', () => {
  const buffer = minimalMp4Buffer();
  const result = validateVideoUploadFile({
    buffer,
    mimetype: 'application/octet-stream',
    originalname: 'demo.mp4',
    size: buffer.length,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, VIDEO_UPLOAD_REJECTION_CODES.MIME_NOT_ALLOWED);
});

test('VideoJobManager: job mocké émet done avec trace_id', async () => {
  const manager = new VideoJobManager({
    pipelineRunner: async ({ onStep, traceId }) => {
      onStep?.({ step: 'video.probe', status: 'ok' });
      return {
        ok: true,
        trace_id: traceId,
        analysisResult: { summary: 'OK test' },
        evidencePack: { kind: 'nexxus.video.evidence_pack' },
        artifacts: { files: { reportMarkdown: '/tmp/report.md' } },
      };
    },
  });

  const { jobId, traceId } = manager.startJob({
    filePath: '/tmp/fake.mp4',
    browserId: 'browser-test',
    traceId: 'trace-video-test',
  });

  await new Promise((resolve) => setTimeout(resolve, 50));

  const job = manager.getJob(jobId);
  assert.ok(job);
  assert.equal(job.status, 'SUCCESS');
  assert.equal(job.traceId, traceId);
  assert.ok(job.events.some((event) => event.done === true));
});
