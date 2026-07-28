/**
 * Étape 1 — prétraitement vidéo déterministe (probe, scènes, keyframes, transcript, OCR).
 * Fail-closed si ffprobe/ffmpeg indisponibles et signal insuffisant.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {
  validateVideoInput,
  VIDEO_REFUSAL_CODES,
} from './videoRouterContract.js';

const execFileAsync = promisify(execFile);

/**
 * @param {string} filePath
 */
async function sha256File(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * @param {string} filePath
 */
export async function probeVideo(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);
    const parsed = JSON.parse(stdout);
    const format = parsed.format || {};
    const videoStream = (parsed.streams || []).find(
      (stream) => stream.codec_type === 'video',
    );
    const audioStream = (parsed.streams || []).find(
      (stream) => stream.codec_type === 'audio',
    );

    return {
      ok: true,
      container: String(format.format_name || '')
        .split(',')[0]
        .toLowerCase(),
      durationSeconds: Number(format.duration || 0),
      sizeBytes: Number(format.size || 0),
      width: videoStream ? Number(videoStream.width || 0) : null,
      height: videoStream ? Number(videoStream.height || 0) : null,
      hasAudio: Boolean(audioStream),
      codec: videoStream?.codec_name || null,
      source: 'ffprobe',
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      code: VIDEO_REFUSAL_CODES.PROBE_FAILED,
      source: 'ffprobe',
    };
  }
}

/**
 * Détection de scènes MVP — 1 segment fallback si ffmpeg indisponible.
 * @param {string} filePath
 * @param {number} durationSeconds
 */
export async function detectScenes(filePath, durationSeconds = 0) {
  try {
    const { stderr } = await execFileAsync('ffmpeg', [
      '-hide_banner',
      '-i',
      filePath,
      '-filter:v',
      'select=gt(scene\\,0.35),showinfo',
      '-f',
      'null',
      '-',
    ]);

    const timestamps = [...String(stderr).matchAll(/pts_time:([0-9.]+)/g)].map(
      (match) => Number(match[1]),
    );

    const unique = [...new Set(timestamps.filter((value) => Number.isFinite(value)))];
    if (unique.length === 0) {
      return {
        ok: true,
        scenes: [{ id: 'scene-1', start_s: 0, end_s: durationSeconds || null, confidence: 0.4 }],
        source: 'ffmpeg-fallback-single',
      };
    }

    const scenes = unique.map((start, index) => ({
      id: `scene-${index + 1}`,
      start_s: start,
      end_s: unique[index + 1] ?? durationSeconds ?? null,
      confidence: 0.72,
    }));

    return { ok: true, scenes, source: 'ffmpeg-scene-detect' };
  } catch {
    return {
      ok: true,
      scenes: [{ id: 'scene-1', start_s: 0, end_s: durationSeconds || null, confidence: 0.3 }],
      source: 'stub-single-scene',
      warning: 'Scene detect indisponible — segment unique.',
    };
  }
}

/**
 * @param {Array<object>} scenes
 */
export function extractSceneKeyframes(scenes = []) {
  return scenes.map((scene) => ({
    scene_id: scene.id,
    timestamp_s: scene.start_s,
    path: null,
    note: 'Keyframe extraction v1 — chemin rempli par worker local.',
  }));
}

/**
 * Transcription horodatée — stub local si whisper/ffmpeg absent.
 */
export async function transcribeAudio(_filePath, { hasAudio = true } = {}) {
  if (!hasAudio) {
    return {
      ok: false,
      code: VIDEO_REFUSAL_CODES.NO_AUDIO,
      segments: [],
      message: 'Aucune piste audio détectée.',
    };
  }

  return {
    ok: true,
    segments: [],
    source: 'stub-transcribe',
    message: 'Transcription locale à brancher (whisper/faster-whisper).',
  };
}

/**
 * OCR frames — stub v1.
 */
export async function ocrKeyframes(_keyframes = []) {
  return {
    ok: true,
    entries: [],
    source: 'stub-ocr',
    message: 'OCR frame v1 — à brancher sur moteur local.',
  };
}

/**
 * @param {object} options
 * @param {string} options.filePath
 * @param {string} [options.egressPolicy]
 */
export async function preprocessVideo(options = {}) {
  const { filePath, egressPolicy = 'local-only' } = options;
  if (!filePath) {
    return {
      ok: false,
      code: VIDEO_REFUSAL_CODES.INSUFFICIENT_SIGNAL,
      message: 'Chemin vidéo requis.',
    };
  }

  const sourceHash = await sha256File(filePath);
  const probe = await probeVideo(filePath);

  if (!probe.ok) {
    return {
      ok: false,
      code: probe.code,
      message: probe.error || 'ffprobe a échoué.',
      sourceHash,
    };
  }

  const validation = validateVideoInput({
    container: probe.container,
    durationSeconds: probe.durationSeconds,
    sizeBytes: probe.sizeBytes,
    egressPolicy,
  });

  if (!validation.ok) {
    return {
      ok: false,
      violations: validation.violations,
      sourceHash,
      probe,
    };
  }

  const scenesResult = await detectScenes(filePath, probe.durationSeconds);
  const keyframes = extractSceneKeyframes(scenesResult.scenes);
  const transcript = await transcribeAudio(filePath, { hasAudio: probe.hasAudio });
  const ocr = await ocrKeyframes(keyframes);

  return {
    ok: true,
    sourceHash,
    probe,
    scenes: scenesResult.scenes,
    sceneMeta: {
      source: scenesResult.source,
      warning: scenesResult.warning || null,
    },
    keyframes,
    transcript,
    ocr,
  };
}

export default {
  probeVideo,
  detectScenes,
  extractSceneKeyframes,
  transcribeAudio,
  ocrKeyframes,
  preprocessVideo,
};
