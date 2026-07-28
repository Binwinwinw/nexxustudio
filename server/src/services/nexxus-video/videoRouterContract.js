/**
 * Contrat fonctionnel Nexxus Video v1 — limites, objectifs, étapes pipeline.
 */

export const NEXXUS_VIDEO_SKILL_ID = 'skill-nexxus-video';

export const VIDEO_INTENT_ID = 'VIDEO_ANALYSIS';

/** MVP v1 — MP4 local, max 10 minutes. */
export const NEXXUS_VIDEO_LIMITS = {
  maxDurationSeconds: 600,
  maxFileSizeBytes: 512 * 1024 * 1024,
  allowedContainers: ['mp4'],
  allowedMimeTypes: ['video/mp4'],
  budgetSeconds: 900,
  depthProfiles: ['fast', 'full'],
  egressPolicies: ['local-only', 'hybrid-controlled'],
};

export const VIDEO_PIPELINE_STEPS = [
  'video.probe',
  'video.scene_detect',
  'video.transcribe',
  'video.ocr',
  'video.pack_build',
  'video.analyze',
];

export const VIDEO_ANALYSIS_OBJECTIVES = [
  'summary',
  'timeline',
  'qa',
  'audit',
  'extraction',
  'rag_prep',
];

export const VIDEO_REFUSAL_CODES = {
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  DURATION_EXCEEDED: 'DURATION_EXCEEDED',
  SIZE_EXCEEDED: 'SIZE_EXCEEDED',
  PROBE_FAILED: 'PROBE_FAILED',
  NO_AUDIO: 'NO_AUDIO',
  SCENES_UNRELIABLE: 'SCENES_UNRELIABLE',
  INSUFFICIENT_SIGNAL: 'INSUFFICIENT_SIGNAL',
  EGRESS_DENIED: 'EGRESS_DENIED',
};

/**
 * @param {object} input
 * @param {string} [input.container]
 * @param {number} [input.durationSeconds]
 * @param {number} [input.sizeBytes]
 * @param {string} [input.egressPolicy]
 */
export function validateVideoInput(input = {}) {
  const violations = [];
  const container = String(input.container || '').toLowerCase();

  if (
    container &&
    !NEXXUS_VIDEO_LIMITS.allowedContainers.includes(container)
  ) {
    violations.push({
      code: VIDEO_REFUSAL_CODES.UNSUPPORTED_FORMAT,
      message: `Format ${container} non supporté en v1 (MP4 uniquement).`,
    });
  }

  if (
    input.durationSeconds != null &&
    input.durationSeconds > NEXXUS_VIDEO_LIMITS.maxDurationSeconds
  ) {
    violations.push({
      code: VIDEO_REFUSAL_CODES.DURATION_EXCEEDED,
      message: `Durée ${Math.round(input.durationSeconds)}s > max ${NEXXUS_VIDEO_LIMITS.maxDurationSeconds}s.`,
    });
  }

  if (
    input.sizeBytes != null &&
    input.sizeBytes > NEXXUS_VIDEO_LIMITS.maxFileSizeBytes
  ) {
    violations.push({
      code: VIDEO_REFUSAL_CODES.SIZE_EXCEEDED,
      message: 'Fichier vidéo trop volumineux pour le profil MVP.',
    });
  }

  if (
    input.egressPolicy &&
    !NEXXUS_VIDEO_LIMITS.egressPolicies.includes(input.egressPolicy)
  ) {
    violations.push({
      code: VIDEO_REFUSAL_CODES.EGRESS_DENIED,
      message: `Politique egress ${input.egressPolicy} non autorisée.`,
    });
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

export default {
  NEXXUS_VIDEO_SKILL_ID,
  VIDEO_INTENT_ID,
  NEXXUS_VIDEO_LIMITS,
  VIDEO_PIPELINE_STEPS,
  VIDEO_ANALYSIS_OBJECTIVES,
  VIDEO_REFUSAL_CODES,
  validateVideoInput,
};
