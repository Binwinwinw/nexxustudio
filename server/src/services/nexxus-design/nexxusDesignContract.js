/**
 * Contrat Nexxus Design — création / proposition (DESIGN_CREATE).
 */
export const NEXXUS_DESIGN_SKILL_ID = 'skill-nexxus-design';

export const DESIGN_CREATE_INTENT = 'DESIGN_CREATE';

export const DESIGN_CREATE_ENVELOPE_VERSION = '1.0.0';

export const EXTRACT_ENVELOPE_KIND = 'nexxus.design.extract_result';

export const DESIGN_CREATE_OBJECTIVES = [
  'landing',
  'cockpit',
  'webapp',
  'design_system',
  'redesign',
  'component',
  'micro_interaction',
];

export const DESIGN_CREATE_OUTPUTS = [
  'blueprint',
  'tokens',
  'components',
  'page_structure',
  'ux_copy',
  'guidelines',
];

/**
 * @param {object} envelope
 */
export function validateReferenceDna(envelope = null) {
  const violations = [];

  if (!envelope || typeof envelope !== 'object') {
    violations.push({
      code: 'REFERENCE_DNA_REQUIRED',
      message: 'Envelope Design Extract v2 requise comme ADN de référence.',
    });
    return { ok: false, violations };
  }

  if (envelope.kind !== EXTRACT_ENVELOPE_KIND) {
    violations.push({
      code: 'REFERENCE_DNA_KIND_INVALID',
      message: `Kind attendu « ${EXTRACT_ENVELOPE_KIND} », reçu « ${envelope.kind || '—'} ».`,
    });
  }

  if (envelope.version !== '2.0.0') {
    violations.push({
      code: 'REFERENCE_DNA_VERSION_UNSUPPORTED',
      message: `Version Extract « ${envelope.version || '—'} » non supportée (2.0.0 requis).`,
    });
  }

  const paletteCount = envelope.tokens?.colors?.distinct_count ?? 0;
  if (paletteCount < 3) {
    violations.push({
      code: 'REFERENCE_DNA_INSUFFICIENT',
      message: 'Palette ADN insuffisante pour création design fiable.',
    });
  }

  const gate = envelope.quality_gate;
  if (gate && gate.merge_ok === false && (gate.score ?? 0) < 60) {
    violations.push({
      code: 'REFERENCE_DNA_QUALITY_BLOCKED',
      message: 'Quality gate Extract bloquant — création refusée (fail-closed).',
    });
  }

  return { ok: violations.length === 0, violations };
}

/**
 * @param {object} input
 * @param {string} [input.objective]
 * @param {string} [input.query]
 * @param {object} [input.referenceDna]
 * @param {object} [input.extractEnvelope] — alias referenceDna
 * @param {boolean} [input.hasReferenceDna]
 */
export function validateDesignCreateInput(input = {}) {
  const violations = [];
  const objective = String(input.objective || 'redesign').toLowerCase();
  const referenceDna = input.referenceDna || input.extractEnvelope || null;

  if (!input.query?.trim() && !referenceDna) {
    violations.push({
      code: 'QUERY_OR_DNA_REQUIRED',
      message: 'Brief design ou envelope Extract v2 requis.',
    });
  }

  if (objective && !DESIGN_CREATE_OBJECTIVES.includes(objective)) {
    violations.push({
      code: 'OBJECTIVE_UNKNOWN',
      message: `Objectif ${objective} hors périmètre v1.`,
    });
  }

  if (referenceDna) {
    const dnaCheck = validateReferenceDna(referenceDna);
    if (!dnaCheck.ok) {
      violations.push(...dnaCheck.violations);
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * @param {object} payload
 */
export function buildDesignCreateEnvelope(payload = {}) {
  return {
    version: payload.version || DESIGN_CREATE_ENVELOPE_VERSION,
    kind: 'nexxus.design.create_result',
    skill_id: NEXXUS_DESIGN_SKILL_ID,
    objective: payload.objective || 'redesign',
    source: {
      extract_version: payload.source?.extract_version || '2.0.0',
      extract_url: payload.source?.extract_url || null,
      extraction_mode: payload.source?.extraction_mode || null,
      quality_score: payload.source?.quality_score ?? null,
    },
    blueprint: payload.blueprint || null,
    tokens: payload.tokens || {},
    components: payload.components || [],
    page_structure: payload.page_structure || [],
    ux_copy: payload.ux_copy || {},
    guidelines: payload.guidelines || [],
    assembly: payload.assembly || {},
    uncertainties: payload.uncertainties || [],
    generated_at: new Date().toISOString(),
  };
}

export default {
  NEXXUS_DESIGN_SKILL_ID,
  DESIGN_CREATE_INTENT,
  DESIGN_CREATE_ENVELOPE_VERSION,
  EXTRACT_ENVELOPE_KIND,
  DESIGN_CREATE_OBJECTIVES,
  DESIGN_CREATE_OUTPUTS,
  validateReferenceDna,
  validateDesignCreateInput,
  buildDesignCreateEnvelope,
};
