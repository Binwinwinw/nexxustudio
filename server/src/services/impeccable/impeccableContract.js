/**
 * Contrat Impeccable — audit qualité design / UX (DESIGN_AUDIT).
 */

export const IMPECCABLE_SKILL_ID = 'skill-impeccable';

export const DESIGN_AUDIT_INTENT = 'DESIGN_AUDIT';

export const IMPECCABLE_DIMENSIONS = [
  'coherence',
  'hierarchy',
  'rhythm',
  'readability',
  'accessibility',
  'affordance',
  'density',
  'contrast',
  'continuity',
];

export const ISSUE_SEVERITIES = ['blocker', 'major', 'minor', 'nit'];

export const IMPECCABLE_MERGE_SCORE_MIN = 72;

/**
 * @param {object} input
 * @param {string} [input.target]
 * @param {string} [input.query]
 * @param {string} [input.pipelineJobId]
 * @param {string} [input.createJobId]
 * @param {string} [input.artifactDir]
 * @param {object} [input.createEnvelope]
 */
export function validateDesignAuditInput(input = {}) {
  const violations = [];
  const hasInline =
    Boolean(input.createEnvelope) ||
    Boolean(input.extractEnvelope) ||
    Boolean(input.artifactDir?.trim());
  const hasJobRef =
    Boolean(input.pipelineJobId?.trim()) || Boolean(input.createJobId?.trim());
  const hasTarget = Boolean(input.query?.trim() || input.target?.trim());

  if (!hasInline && !hasJobRef && !hasTarget) {
    violations.push({
      code: 'AUDIT_TARGET_REQUIRED',
      message:
        'Cible requise : pipelineJobId, createJobId, artifactDir, envelope inline ou brief.',
    });
  }

  if (hasInline && hasJobRef) {
    violations.push({
      code: 'AUDIT_INPUT_AMBIGUOUS',
      message: 'Références job et artefacts inline mutuellement exclusifs.',
    });
  }

  return { ok: violations.length === 0, violations };
}

/**
 * @param {object} payload
 */
export function buildImpeccableAuditEnvelope(payload = {}) {
  const issues = Array.isArray(payload.issues) ? payload.issues : [];
  const blockers =
    payload.blockers?.length > 0
      ? payload.blockers
      : issues.filter((entry) => entry.severity === 'blocker');
  const score = payload.score_global ?? null;
  const merge_ok =
    typeof payload.merge_ok === 'boolean'
      ? payload.merge_ok
      : score !== null && score >= IMPECCABLE_MERGE_SCORE_MIN && blockers.length === 0;

  return {
    version: '1.0.0',
    kind: 'nexxus.design.audit_result',
    skill_id: IMPECCABLE_SKILL_ID,
    score_global: score,
    merge_ok,
    dimensions: payload.dimensions || {},
    issues: issues.map((issue) => ({
      severity: issue.severity || 'minor',
      dimension: issue.dimension || 'coherence',
      message: issue.message || '',
      recommendation: issue.recommendation || null,
    })),
    quick_wins: payload.quick_wins || [],
    blockers,
    checklist_pre_merge: payload.checklist_pre_merge || [],
    source: payload.source || null,
    pipeline_job_id: payload.pipeline_job_id || null,
    generated_at: new Date().toISOString(),
  };
}

export default {
  IMPECCABLE_SKILL_ID,
  DESIGN_AUDIT_INTENT,
  IMPECCABLE_DIMENSIONS,
  ISSUE_SEVERITIES,
  validateDesignAuditInput,
  buildImpeccableAuditEnvelope,
};
