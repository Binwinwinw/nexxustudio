/**
 * Upload MP4 sécurisé — magic bytes, allowlist MIME, stockage isolé (Nexxus Video).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  validateDoubleExtension,
  UPLOAD_REJECTION_CODES,
} from '../../../../shared/uploadGuards.js';
import { NEXXUS_VIDEO_LIMITS } from './videoRouterContract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_UPLOAD_ROOT = path.resolve(__dirname, '../../data/video-uploads');

export const VIDEO_UPLOAD_ROOT =
  process.env.NEXXUS_VIDEO_UPLOAD_DIR || DEFAULT_UPLOAD_ROOT;

export const VIDEO_UPLOAD_REJECTION_CODES = {
  ...UPLOAD_REJECTION_CODES,
  MAGIC_BYTES_INVALID: 'VIDEO_MAGIC_BYTES_INVALID',
  MIME_NOT_ALLOWED: 'VIDEO_MIME_NOT_ALLOWED',
  EXTENSION_NOT_ALLOWED: 'VIDEO_EXTENSION_NOT_ALLOWED',
  SIZE_EXCEEDED: 'VIDEO_SIZE_EXCEEDED',
  EMPTY_FILE: 'VIDEO_EMPTY_FILE',
};

/**
 * Vérifie la signature ISO-BMFF `ftyp` (offset 4).
 * @param {Buffer} buffer
 */
export function validateMp4MagicBytes(buffer) {
  if (!buffer || buffer.length < 12) return false;
  return buffer.slice(4, 8).toString('ascii') === 'ftyp';
}

/**
 * @param {object} file
 * @param {Buffer} [file.buffer]
 * @param {string} [file.mimetype]
 * @param {string} [file.originalname]
 * @param {number} [file.size]
 */
export function validateVideoUploadFile(file = {}) {
  const buffer = file.buffer;
  const mimetype = String(file.mimetype || '').toLowerCase();
  const originalname = String(file.originalname || file.name || '');
  const size = Number(file.size ?? buffer?.length ?? 0);

  if (!buffer || buffer.length === 0) {
    return {
      ok: false,
      code: VIDEO_UPLOAD_REJECTION_CODES.EMPTY_FILE,
      message: 'Fichier vidéo vide.',
    };
  }

  if (size > NEXXUS_VIDEO_LIMITS.maxFileSizeBytes) {
    return {
      ok: false,
      code: VIDEO_UPLOAD_REJECTION_CODES.SIZE_EXCEEDED,
      message: `Taille max ${Math.round(NEXXUS_VIDEO_LIMITS.maxFileSizeBytes / (1024 * 1024))} Mo dépassée.`,
    };
  }

  const doubleExt = validateDoubleExtension(originalname);
  if (doubleExt.rejected) {
    return {
      ok: false,
      code: doubleExt.code,
      message: doubleExt.message,
    };
  }

  if (!NEXXUS_VIDEO_LIMITS.allowedMimeTypes.includes(mimetype)) {
    return {
      ok: false,
      code: VIDEO_UPLOAD_REJECTION_CODES.MIME_NOT_ALLOWED,
      message: 'MIME autorisé : video/mp4 uniquement.',
    };
  }

  if (!/\.mp4$/i.test(originalname)) {
    return {
      ok: false,
      code: VIDEO_UPLOAD_REJECTION_CODES.EXTENSION_NOT_ALLOWED,
      message: 'Extension autorisée : .mp4 uniquement.',
    };
  }

  if (!validateMp4MagicBytes(buffer)) {
    return {
      ok: false,
      code: VIDEO_UPLOAD_REJECTION_CODES.MAGIC_BYTES_INVALID,
      message: 'Signature MP4 (ftyp) introuvable — fichier rejeté.',
    };
  }

  return { ok: true };
}

/**
 * Persiste la vidéo hors web root avec nom UUID.
 * @param {object} params
 * @param {Buffer} params.buffer
 * @param {string} [params.traceId]
 */
export async function persistSecureVideoUpload({ buffer, traceId = null }) {
  await fs.mkdir(VIDEO_UPLOAD_ROOT, { recursive: true });

  const fileId = crypto.randomUUID();
  const storageName = `${fileId}.mp4`;
  const storagePath = path.join(VIDEO_UPLOAD_ROOT, storageName);
  const sourceHash = crypto.createHash('sha256').update(buffer).digest('hex');

  await fs.writeFile(storagePath, buffer);

  return {
    fileId,
    storagePath,
    storageName,
    sourceHash,
    trace_id: traceId,
  };
}

export default {
  VIDEO_UPLOAD_ROOT,
  VIDEO_UPLOAD_REJECTION_CODES,
  validateMp4MagicBytes,
  validateVideoUploadFile,
  persistSecureVideoUpload,
};
